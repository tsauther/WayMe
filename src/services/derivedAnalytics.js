export const ANALYTICS_VERSION = 'v1.0.0'

function getStreamArray(streams, key) {
  if (!streams) return []

  const keyed = streams[key]
  if (keyed && Array.isArray(keyed.data)) {
    return keyed.data
  }

  if (Array.isArray(streams)) {
    const found = streams.find((s) => s?.type === key)
    return Array.isArray(found?.data) ? found.data : []
  }

  return []
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rollingBestAverage(values, windowSamples) {
  if (!values.length || windowSamples <= 0 || values.length < windowSamples) return null

  let sum = 0
  for (let i = 0; i < windowSamples; i++) {
    sum += values[i]
  }

  let best = sum / windowSamples
  for (let i = windowSamples; i < values.length; i++) {
    sum += values[i] - values[i - windowSamples]
    const current = sum / windowSamples
    if (current > best) best = current
  }

  return best
}

function decouplingProxy({ watts, heartrate, velocity }) {
  const signal = watts.length ? watts : velocity
  if (!heartrate.length || !signal.length) {
    return null
  }

  const length = Math.min(heartrate.length, signal.length)
  if (length < 120) return null

  const midpoint = Math.floor(length / 2)

  const firstHr = mean(heartrate.slice(0, midpoint))
  const secondHr = mean(heartrate.slice(midpoint, length))
  const firstSignal = mean(signal.slice(0, midpoint))
  const secondSignal = mean(signal.slice(midpoint, length))

  if (!firstHr || !secondHr || !firstSignal || !secondSignal) return null

  const firstRatio = firstHr / firstSignal
  const secondRatio = secondHr / secondSignal
  if (!firstRatio) return null

  return {
    value: ((secondRatio - firstRatio) / firstRatio) * 100,
    unit: '%',
    source: watts.length ? 'power-hr' : 'pace-hr',
    firstHalfRatio: firstRatio,
    secondHalfRatio: secondRatio
  }
}

function intensityLoad({ duration, heartrate, watts, activity }) {
  const durationHours = (duration || activity?.elapsed_time || 0) / 3600
  if (!durationHours) return { score: 0, source: 'none' }

  if (watts.length) {
    const avgWatts = mean(watts)
    const ftpEstimate = 250
    const intensityFactor = avgWatts / ftpEstimate
    const score = Math.max(0, intensityFactor * intensityFactor * 100 * durationHours)

    return {
      score: Math.round(score),
      source: 'power',
      intensityFactor: Number(intensityFactor.toFixed(3))
    }
  }

  if (heartrate.length) {
    const avgHr = mean(heartrate)
    const thresholdHrEstimate = 170
    const intensityFactor = avgHr / thresholdHrEstimate
    const score = Math.max(0, intensityFactor * intensityFactor * 100 * durationHours)

    return {
      score: Math.round(score),
      source: 'heart-rate',
      intensityFactor: Number(intensityFactor.toFixed(3))
    }
  }

  const distance = activity?.distance || 0
  const paceFactor = distance > 0 ? Math.min(2, (distance / (duration || 1)) / 4.47) : 0.8
  return {
    score: Math.round(100 * durationHours * paceFactor),
    source: 'duration-pace'
  }
}

function bestEfforts({ watts, velocity }) {
  const windows = [60, 300, 1200]
  const output = []

  if (watts.length) {
    for (const seconds of windows) {
      const bestPower = rollingBestAverage(watts, seconds)
      if (bestPower) {
        output.push({
          metric: `best_${Math.round(seconds / 60)}m_power`,
          value: Math.round(bestPower),
          unit: 'W'
        })
      }
    }
    return output
  }

  if (velocity.length) {
    for (const seconds of windows) {
      const bestVelocity = rollingBestAverage(velocity, seconds)
      if (bestVelocity) {
        const paceSecPerMile = 1609.34 / bestVelocity
        output.push({
          metric: `best_${Math.round(seconds / 60)}m_pace`,
          value: Number((paceSecPerMile / 60).toFixed(2)),
          unit: 'min/mi'
        })
      }
    }
  }

  return output
}

function detectIntervals({ watts, heartrate, velocity }) {
  const signal = watts.length ? watts : (heartrate.length ? heartrate : velocity)
  if (!signal.length) return []

  const baseline = mean(signal)
  if (!baseline) return []

  const threshold = baseline * (watts.length ? 1.15 : 1.08)
  const intervals = []
  let currentStart = null

  for (let i = 0; i < signal.length; i++) {
    if (signal[i] >= threshold && currentStart === null) {
      currentStart = i
      continue
    }

    if ((signal[i] < threshold || i === signal.length - 1) && currentStart !== null) {
      const end = signal[i] < threshold ? i - 1 : i
      const duration = end - currentStart + 1
      if (duration >= 30) {
        intervals.push({
          startSec: currentStart,
          endSec: end,
          durationSec: duration,
          average: Number(mean(signal.slice(currentStart, end + 1)).toFixed(1))
        })
      }
      currentStart = null
    }
  }

  return intervals.slice(0, 20)
}

function buildPowerHrBins({ watts, heartrate }) {
  if (!watts.length || !heartrate.length) return []

  const length = Math.min(watts.length, heartrate.length)
  const bins = new Map()

  for (let i = 0; i < length; i++) {
    const watt = watts[i]
    const hr = heartrate[i]
    if (!watt || !hr) continue

    const bucketStart = Math.floor(watt / 50) * 50
    const key = `${bucketStart}-${bucketStart + 49}`
    if (!bins.has(key)) {
      bins.set(key, { bucket: key, hrSamples: [], powerSamples: [] })
    }

    const bucket = bins.get(key)
    bucket.hrSamples.push(hr)
    bucket.powerSamples.push(watt)
  }

  return Array.from(bins.values())
    .map((bucket) => ({
      bucket: bucket.bucket,
      avgHr: Number(mean(bucket.hrSamples).toFixed(1)),
      avgWatts: Number(mean(bucket.powerSamples).toFixed(1)),
      samples: bucket.hrSamples.length
    }))
    .sort((a, b) => Number(a.bucket.split('-')[0]) - Number(b.bucket.split('-')[0]))
}

function toDailyLoads(activities) {
  const byDay = new Map()

  for (const activity of activities) {
    const timestamp = activity.timestamp || (activity.startDate ? new Date(activity.startDate).getTime() : null)
    if (!timestamp) continue

    const day = new Date(timestamp)
    day.setHours(0, 0, 0, 0)
    const key = day.getTime()

    const durationHours = (activity.duration || 0) / 3600
    const hr = activity.heartRate || 0
    const watts = activity.averageWatts || 0
    const paceLoad = activity.averageSpeed ? activity.averageSpeed * 15 : 0.6

    let load = durationHours * 100 * paceLoad
    if (watts) load = durationHours * 100 * Math.pow(watts / 250, 2)
    if (!watts && hr) load = durationHours * 100 * Math.pow(hr / 170, 2)

    byDay.set(key, (byDay.get(key) || 0) + Math.max(0, load))
  }

  return Array.from(byDay.entries())
    .map(([dayTimestamp, load]) => ({ dayTimestamp, load }))
    .sort((a, b) => a.dayTimestamp - b.dayTimestamp)
}

function ewmaSeries(dailyLoads, tauDays) {
  const alpha = 1 - Math.exp(-1 / tauDays)
  const output = []
  let current = 0

  for (const item of dailyLoads) {
    current = current + alpha * (item.load - current)
    output.push({ dayTimestamp: item.dayTimestamp, value: current })
  }

  return output
}

function trendSlope(points) {
  if (points.length < 3) return null

  const n = points.length
  const xs = points.map((_, idx) => idx)
  const ys = points.map((p) => p.y)
  const xBar = mean(xs)
  const yBar = mean(ys)

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xBar) * (ys[i] - yBar)
    denominator += (xs[i] - xBar) * (xs[i] - xBar)
  }

  if (!denominator) return null
  return numerator / denominator
}

function efficiencyTrends(activities) {
  const paceHr = []
  const wattsHr = []

  for (const activity of activities) {
    if (activity.heartRate > 0 && activity.averageSpeed > 0) {
      paceHr.push({
        x: activity.timestamp,
        y: activity.averageSpeed / activity.heartRate
      })
    }

    if (activity.heartRate > 0 && activity.averageWatts > 0) {
      wattsHr.push({
        x: activity.timestamp,
        y: activity.averageWatts / activity.heartRate
      })
    }
  }

  const recentPace = paceHr.slice(-30)
  const recentWatts = wattsHr.slice(-30)

  return {
    paceAtHrTrend: {
      slope: trendSlope(recentPace),
      latest: recentPace.length ? recentPace[recentPace.length - 1].y : null,
      samples: recentPace.length
    },
    wattsAtHrTrend: {
      slope: trendSlope(recentWatts),
      latest: recentWatts.length ? recentWatts[recentWatts.length - 1].y : null,
      samples: recentWatts.length
    }
  }
}

export function buildAthleteTrendMetrics(activities) {
  const dailyLoads = toDailyLoads(activities)
  const atlSeries = ewmaSeries(dailyLoads, 7)
  const ctlSeries = ewmaSeries(dailyLoads, 42)

  const latestAtl = atlSeries.length ? atlSeries[atlSeries.length - 1].value : 0
  const latestCtl = ctlSeries.length ? ctlSeries[ctlSeries.length - 1].value : 0

  return {
    atl: Number(latestAtl.toFixed(1)),
    ctl: Number(latestCtl.toFixed(1)),
    form: Number((latestCtl - latestAtl).toFixed(1)),
    series: {
      atl: atlSeries.map((item) => [item.dayTimestamp, Number(item.value.toFixed(2))]),
      ctl: ctlSeries.map((item) => [item.dayTimestamp, Number(item.value.toFixed(2))])
    },
    efficiency: efficiencyTrends(activities)
  }
}

export function computeDerivedAnalytics({ activity, detail, streams, allActivities }) {
  const watts = getStreamArray(streams, 'watts')
  const heartrate = getStreamArray(streams, 'heartrate')
  const velocity = getStreamArray(streams, 'velocity_smooth')

  const activityMetrics = {
    decoupling: decouplingProxy({ watts, heartrate, velocity }),
    load: intensityLoad({
      duration: detail?.elapsed_time || activity?.duration,
      heartrate,
      watts,
      activity: detail || activity
    }),
    bestEfforts: bestEfforts({ watts, velocity }),
    intervalCandidates: detectIntervals({ watts, heartrate, velocity }),
    powerVsHrBins: buildPowerHrBins({ watts, heartrate })
  }

  return {
    analyticsVersion: ANALYTICS_VERSION,
    computedAt: Date.now(),
    activityMetrics,
    athleteTrendMetrics: buildAthleteTrendMetrics(allActivities || [])
  }
}
