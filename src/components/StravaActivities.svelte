<script>
  import { onDestroy, onMount, tick } from 'svelte'
  import { getActivities, getStravaStats } from '../db.js'
  import { MIN_STREAM_KEYS, OPTIONAL_STREAM_KEYS, getActivityAnalytics, refreshActivityAnalytics } from '../services/activityEnrichment.js'
  import ActivityMap from './ActivityMap.svelte'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let activities = []
  let stats = {}
  let loading = true
  let sortBy = 'recent'
  let expandedActivityId = null
  let panelState = {}

  let streamChartContainers = {}
  let streamCharts = {}
  let trendChartContainers = {}
  let trendCharts = {}

  onMount(async () => {
    await loadActivities()
    await loadStats()
    loading = false
  })

  onDestroy(() => {
    Object.values(streamCharts).forEach((chart) => chart?.destroy?.())
    Object.values(trendCharts).forEach((chart) => chart?.destroy?.())
  })

  async function loadActivities() {
    activities = await getActivities(100)
  }

  async function loadStats() {
    stats = await getStravaStats()
  }

  $: sortedActivities = (() => {
    const sorted = [...activities]
    if (sortBy === 'recent') {
      return sorted.sort((a, b) => b.timestamp - a.timestamp)
    } else if (sortBy === 'longest') {
      return sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0))
    }
    return sorted
  })()

  function formatDistance(meters) {
    const miles = (meters / 1609.34).toFixed(2)
    return `${miles} mi`
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  function formatElevation(meters) {
    const feet = (meters * 3.28084).toFixed(0)
    return `${feet} ft`
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatDuration(seconds = 0) {
    const mins = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${mins}:${String(sec).padStart(2, '0')}`
  }

  function hasAllOptionalStreams(streams = {}) {
    return OPTIONAL_STREAM_KEYS.every((key) => Boolean(streams[key]))
  }

  async function toggleAnalytics(activity) {
    const isOpen = expandedActivityId === activity.stravaId
    expandedActivityId = isOpen ? null : activity.stravaId
    if (isOpen) return

    if (!panelState[activity.stravaId]?.analytics) {
      await loadAnalytics(activity, { forceRefresh: false, includeOptionalStreams: false })
      return
    }

    await tick()
    renderCharts(activity.stravaId)
  }

  async function loadAnalytics(activity, { forceRefresh = false, includeOptionalStreams = false } = {}) {
    const current = panelState[activity.stravaId] || {}

    panelState = {
      ...panelState,
      [activity.stravaId]: {
        ...current,
        loading: true,
        error: null
      }
    }

    try {
      const result = forceRefresh
        ? await refreshActivityAnalytics(activity, includeOptionalStreams)
        : await getActivityAnalytics(activity, { includeOptionalStreams })

      panelState = {
        ...panelState,
        [activity.stravaId]: {
          ...current,
          loading: false,
          error: null,
          detail: result.detail,
          streams: result.streams,
          analytics: result.analytics,
          metadata: result.metadata,
          includeOptionalStreams,
          optionalLoaded: includeOptionalStreams || hasAllOptionalStreams(result.streams),
          lastLoadedAt: Date.now()
        }
      }

      if (expandedActivityId === activity.stravaId) {
        await tick()
        renderCharts(activity.stravaId)
      }
    } catch (error) {
      panelState = {
        ...panelState,
        [activity.stravaId]: {
          ...current,
          loading: false,
          error: error.message || 'Failed to load analytics'
        }
      }
    }
  }

  async function handleRefresh(activity) {
    await loadAnalytics(activity, { forceRefresh: true, includeOptionalStreams: Boolean(panelState[activity.stravaId]?.includeOptionalStreams) })
  }

  async function handleExpandOptional(activity) {
    await loadAnalytics(activity, { forceRefresh: false, includeOptionalStreams: true })
  }

  function renderCharts(activityId) {
    renderStreamChart(activityId)
    renderTrendChart(activityId)
  }

  function renderStreamChart(activityId) {
    const container = streamChartContainers[activityId]
    const state = panelState[activityId]
    if (!container || !state?.streams?.time?.data?.length) return

    const time = state.streams.time.data
    const watts = state.streams.watts?.data || []
    const heartrate = state.streams.heartrate?.data || []
    const velocity = state.streams.velocity_smooth?.data || []

    const x = time.map((seconds) => Math.floor((state.detail?.start_date ? new Date(state.detail.start_date).getTime() : Date.now()) / 1000) + seconds)
    const wattsSeries = x.map((_, idx) => watts[idx] ?? null)
    const hrSeries = x.map((_, idx) => heartrate[idx] ?? null)
    const mphSeries = x.map((_, idx) => (velocity[idx] ? velocity[idx] * 2.23694 : null))

    const data = [x, wattsSeries, hrSeries, mphSeries]

    if (streamCharts[activityId]) {
      streamCharts[activityId].destroy()
      delete streamCharts[activityId]
    }

    streamCharts[activityId] = new uPlot({
      width: Math.max(320, container.offsetWidth),
      height: 240,
      series: [
        {},
        { label: 'Watts', stroke: '#f97316', width: 2 },
        { label: 'Heart Rate', stroke: '#ef4444', width: 2 },
        { label: 'Speed (mph)', stroke: '#3b82f6', width: 2 }
      ],
      axes: [
        { stroke: '#94a3b8' },
        {
          stroke: '#94a3b8',
          values: (u, vals) => vals.map((v) => formatDuration(Number(v - u.data[0][0] || 0)))
        }
      ],
      legend: { show: true }
    }, data, container)
  }

  function renderTrendChart(activityId) {
    const container = trendChartContainers[activityId]
    const series = panelState[activityId]?.analytics?.athleteTrendMetrics?.series
    if (!container || !series?.atl?.length || !series?.ctl?.length) return

    const x = series.atl.map((point) => Math.floor(point[0] / 1000))
    const atl = series.atl.map((point) => point[1])
    const ctl = series.ctl.map((point) => point[1])

    if (trendCharts[activityId]) {
      trendCharts[activityId].destroy()
      delete trendCharts[activityId]
    }

    trendCharts[activityId] = new uPlot({
      width: Math.max(320, container.offsetWidth),
      height: 220,
      series: [
        {},
        { label: 'ATL proxy', stroke: '#f59e0b', width: 2 },
        { label: 'CTL proxy', stroke: '#10b981', width: 2 }
      ],
      axes: [
        { stroke: '#94a3b8' },
        { stroke: '#94a3b8' }
      ],
      legend: { show: true }
    }, [x, atl, ctl], container)
  }
</script>

<div class="space-y-6">
  <h2 class="text-3xl font-bold text-primary">Strava Activities</h2>

  {#if loading}
    <div class="flex justify-center">
      <div class="loading loading-spinner loading-lg text-primary"></div>
    </div>
  {:else if activities.length === 0}
    <div class="alert alert-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>No activities synced yet. Connect your Strava account in Settings.</span>
    </div>
  {:else}
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body">
          <div class="text-sm text-gray-500">Total Activities</div>
          <div class="text-3xl font-bold text-primary">{stats.activityCount || 0}</div>
        </div>
      </div>
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body">
          <div class="text-sm text-gray-500">Total Miles</div>
          <div class="text-3xl font-bold text-primary">{stats.totalMiles || 0}</div>
        </div>
      </div>
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body">
          <div class="text-sm text-gray-500">Total Minutes</div>
          <div class="text-3xl font-bold text-primary">{stats.totalMinutes || 0}</div>
        </div>
      </div>
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body">
          <div class="text-sm text-gray-500">Total Elevation</div>
          <div class="text-3xl font-bold text-primary">{stats.totalElevationFeet || 0} ft</div>
        </div>
      </div>
    </div>

    <!-- Sort Options -->
    <div class="flex gap-4 flex-wrap">
      <select bind:value={sortBy} class="select select-bordered select-sm">
        <option value="recent">Most Recent</option>
        <option value="longest">Longest Distance</option>
      </select>
    </div>

    <!-- Activities List -->
    <div class="space-y-3">
      {#each sortedActivities as activity (activity.stravaId)}
        <div class="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
          <div class="card-body">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <h3 class="card-title text-lg">
                  <button class="link link-hover text-left" on:click={() => toggleAnalytics(activity)}>
                    {activity.name}
                  </button>
                </h3>
                <p class="text-sm text-gray-500">{formatDate(activity.timestamp)}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <div class="badge badge-primary">{activity.type}</div>
                {#if activity.calories > 0}
                  <div class="text-lg font-bold text-secondary">{activity.calories} cal</div>
                {/if}
                <button class="btn btn-ghost btn-xs" on:click={() => toggleAnalytics(activity)}>
                  {expandedActivityId === activity.stravaId ? 'Hide Details' : 'Details'}
                </button>
              </div>
            </div>

            <!-- Route Map -->
            {#if activity.summaryPolyline}
              <div class="mb-4">
                <ActivityMap polyline={activity.summaryPolyline} height={300} />
              </div>
            {/if}

            <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <div class="text-xs text-gray-500">Distance</div>
                <div class="font-bold text-primary">{formatDistance(activity.distance || 0)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">Duration</div>
                <div class="font-bold text-primary">{formatTime(activity.duration || 0)}</div>
              </div>
              {#if activity.elevation > 0}
                <div>
                  <div class="text-xs text-gray-500">Elevation</div>
                  <div class="font-bold text-primary">{formatElevation(activity.elevation)}</div>
                </div>
              {/if}
              {#if activity.heartRate > 0}
                <div>
                  <div class="text-xs text-gray-500">Avg HR</div>
                  <div class="font-bold text-primary">{Math.round(activity.heartRate)} bpm</div>
                </div>
              {/if}
              {#if activity.averageSpeed > 0}
                <div>
                  <div class="text-xs text-gray-500">Avg Speed</div>
                  <div class="font-bold text-primary">{((activity.averageSpeed * 2.23694).toFixed(1))} mph</div>
                </div>
              {/if}
              {#if activity.averageWatts > 0}
                <div>
                  <div class="text-xs text-gray-500">Avg Watts</div>
                  <div class="font-bold text-accent">{Math.round(activity.averageWatts)} W</div>
                </div>
              {/if}
              {#if activity.sufferScore > 0}
                <div>
                  <div class="text-xs text-gray-500">Suffer Score</div>
                  <div class="font-bold text-warning">{activity.sufferScore}</div>
                </div>
              {/if}
              {#if activity.prCount > 0 || activity.achievementCount > 0}
                <div>
                  <div class="text-xs text-gray-500">Achievements</div>
                  <div class="font-bold text-success">{(activity.prCount || 0) + (activity.achievementCount || 0)}</div>
                </div>
              {/if}
            </div>

            {#if expandedActivityId === activity.stravaId}
              <div class="mt-5 border-t border-base-300 pt-4 space-y-4">
                <div class="flex flex-wrap items-center gap-2">
                  <button class="btn btn-sm btn-outline" on:click={() => handleRefresh(activity)} disabled={panelState[activity.stravaId]?.loading}>
                    Refresh analytics
                  </button>
                  {#if !panelState[activity.stravaId]?.optionalLoaded}
                    <button class="btn btn-sm btn-outline" on:click={() => handleExpandOptional(activity)} disabled={panelState[activity.stravaId]?.loading}>
                      Load optional streams
                    </button>
                  {/if}
                  {#if panelState[activity.stravaId]?.metadata?.fetchedStreamKeys?.length}
                    <span class="badge badge-info">
                      Fetched: {panelState[activity.stravaId].metadata.fetchedStreamKeys.join(',')}
                    </span>
                  {:else}
                    <span class="badge badge-success">Using cache</span>
                  {/if}
                </div>

                {#if panelState[activity.stravaId]?.loading}
                  <div class="flex items-center gap-3 text-sm text-gray-500">
                    <span class="loading loading-spinner loading-sm"></span>
                    Loading analytics for this activity...
                  </div>
                {:else if panelState[activity.stravaId]?.error}
                  <div class="alert alert-error">
                    <span>{panelState[activity.stravaId].error}</span>
                  </div>
                {:else if panelState[activity.stravaId]?.analytics}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="card bg-base-100 shadow-sm">
                      <div class="card-body p-4">
                        <div class="text-xs text-gray-500">Decoupling Proxy</div>
                        <div class="text-xl font-bold">
                          {#if panelState[activity.stravaId].analytics.activityMetrics.decoupling}
                            {panelState[activity.stravaId].analytics.activityMetrics.decoupling.value.toFixed(1)}%
                          {:else}
                            N/A
                          {/if}
                        </div>
                      </div>
                    </div>

                    <div class="card bg-base-100 shadow-sm">
                      <div class="card-body p-4">
                        <div class="text-xs text-gray-500">Load Score</div>
                        <div class="text-xl font-bold">
                          {panelState[activity.stravaId].analytics.activityMetrics.load.score}
                        </div>
                        <div class="text-xs text-gray-500">
                          {panelState[activity.stravaId].analytics.activityMetrics.load.source}
                        </div>
                      </div>
                    </div>

                    <div class="card bg-base-100 shadow-sm">
                      <div class="card-body p-4">
                        <div class="text-xs text-gray-500">Form Proxy (CTL-ATL)</div>
                        <div class="text-xl font-bold">
                          {panelState[activity.stravaId].analytics.athleteTrendMetrics.form}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card bg-base-100 shadow-sm">
                    <div class="card-body p-4">
                      <div class="card-title text-base">Time-Series Streams</div>
                      <div class="text-xs text-gray-500 mb-2">
                        Minimal keys loaded first: {MIN_STREAM_KEYS.join(', ')}
                      </div>
                      <div bind:this={streamChartContainers[activity.stravaId]} class="w-full"></div>
                    </div>
                  </div>

                  <div class="card bg-base-100 shadow-sm">
                    <div class="card-body p-4">
                      <div class="card-title text-base">ATL / CTL Trend Proxies</div>
                      <div bind:this={trendChartContainers[activity.stravaId]} class="w-full"></div>
                    </div>
                  </div>

                  <div class="card bg-base-100 shadow-sm">
                    <div class="card-body p-4">
                      <div class="card-title text-base">Best Efforts</div>
                      {#if panelState[activity.stravaId].analytics.activityMetrics.bestEfforts.length > 0}
                        <div class="overflow-x-auto">
                          <table class="table table-sm">
                            <thead>
                              <tr>
                                <th>Metric</th>
                                <th>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each panelState[activity.stravaId].analytics.activityMetrics.bestEfforts as effort}
                                <tr>
                                  <td>{effort.metric}</td>
                                  <td>{effort.value} {effort.unit}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="text-sm text-gray-500">No suitable stream data for best efforts.</p>
                      {/if}
                    </div>
                  </div>

                  <div class="card bg-base-100 shadow-sm">
                    <div class="card-body p-4">
                      <div class="card-title text-base">Interval Candidates</div>
                      {#if panelState[activity.stravaId].analytics.activityMetrics.intervalCandidates.length > 0}
                        <div class="overflow-x-auto">
                          <table class="table table-sm">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Start</th>
                                <th>Duration</th>
                                <th>Avg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each panelState[activity.stravaId].analytics.activityMetrics.intervalCandidates.slice(0, 8) as interval, idx}
                                <tr>
                                  <td>{idx + 1}</td>
                                  <td>{formatTime(interval.startSec)}</td>
                                  <td>{formatTime(interval.durationSec)}</td>
                                  <td>{interval.average}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="text-sm text-gray-500">No interval blocks detected.</p>
                      {/if}
                    </div>
                  </div>

                  <div class="card bg-base-100 shadow-sm">
                    <div class="card-body p-4">
                      <div class="card-title text-base">Power vs HR Bins</div>
                      {#if panelState[activity.stravaId].analytics.activityMetrics.powerVsHrBins.length > 0}
                        <div class="overflow-x-auto">
                          <table class="table table-sm">
                            <thead>
                              <tr>
                                <th>Power Bin</th>
                                <th>Avg HR</th>
                                <th>Samples</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each panelState[activity.stravaId].analytics.activityMetrics.powerVsHrBins as bin}
                                <tr>
                                  <td>{bin.bucket} W</td>
                                  <td>{bin.avgHr} bpm</td>
                                  <td>{bin.samples}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="text-sm text-gray-500">Power/HR pair data unavailable for this activity.</p>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>


  {/if}
</div>
