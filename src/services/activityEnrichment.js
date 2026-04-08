import { db, getActivities, getStravaAuth, saveStravaAuth } from '../db.js'
import { stravaApi } from './stravaApi.js'
import { ANALYTICS_VERSION, computeDerivedAnalytics } from './derivedAnalytics.js'

const SCHEMA_VERSION = 'v1'
const RECENT_DAYS = 3
const RECENT_TTL_MS = 12 * 60 * 60 * 1000
const HISTORICAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const MIN_STREAM_KEYS = ['time', 'distance', 'heartrate', 'watts', 'cadence', 'velocity_smooth', 'grade_smooth']
export const OPTIONAL_STREAM_KEYS = ['altitude', 'temp', 'moving', 'latlng']

function streamSignature(keys = []) {
  return [...new Set(keys)].sort().join(',')
}

function cacheTtlMs(activityTimestamp) {
  const ageMs = Date.now() - (activityTimestamp || 0)
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  return ageDays <= RECENT_DAYS ? RECENT_TTL_MS : HISTORICAL_TTL_MS
}

function isFresh(entry, ttlMs) {
  if (!entry || !entry.fetchedAt || entry.status !== 'ok') return false
  return Date.now() - entry.fetchedAt <= ttlMs
}

function isSubset(subset, superset) {
  const superSet = new Set(superset || [])
  return (subset || []).every((item) => superSet.has(item))
}

async function getValidAccessToken() {
  const auth = await getStravaAuth()
  if (!auth?.accessToken) {
    throw new Error('Missing Strava authentication')
  }

  if (!auth.expiresAt || auth.expiresAt > Date.now()) {
    return auth.accessToken
  }

  const refreshed = await stravaApi.refreshToken(auth.refreshToken)
  await saveStravaAuth({
    ...auth,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || auth.refreshToken,
    expiresAt: refreshed.expiresAt,
    expiresIn: refreshed.expiresIn
  })

  return refreshed.accessToken
}

async function getCachedDetail(stravaId) {
  return db.stravaDetailCache.get(stravaId)
}

async function fetchDetail(activity, accessToken) {
  const payload = await stravaApi.getActivityDetail(accessToken, activity.stravaId)
  await db.stravaDetailCache.put({
    stravaId: activity.stravaId,
    payload,
    fetchedAt: Date.now(),
    status: 'ok',
    lastError: null,
    schemaVersion: SCHEMA_VERSION
  })
  return payload
}

async function getDetail(activity, { forceRefresh = false } = {}) {
  const ttlMs = cacheTtlMs(activity.timestamp)
  const cached = await getCachedDetail(activity.stravaId)
  if (!forceRefresh && isFresh(cached, ttlMs)) {
    return { payload: cached.payload, fromCache: true }
  }

  const accessToken = await getValidAccessToken()
  try {
    const payload = await fetchDetail(activity, accessToken)
    return { payload, fromCache: false }
  } catch (error) {
    await db.stravaDetailCache.put({
      stravaId: activity.stravaId,
      payload: cached?.payload || null,
      fetchedAt: Date.now(),
      status: 'error',
      lastError: error.message,
      schemaVersion: SCHEMA_VERSION
    })
    throw error
  }
}

function mergePayloads(entries) {
  return entries.reduce((acc, entry) => ({ ...acc, ...(entry?.payload || {}) }), {})
}

async function getStreams(activity, requestedKeys, { forceRefresh = false } = {}) {
  const normalizedKeys = [...new Set(requestedKeys)].sort()
  const ttlMs = cacheTtlMs(activity.timestamp)

  const entries = await db.stravaStreamsCache
    .where('stravaId')
    .equals(activity.stravaId)
    .toArray()

  const validEntries = entries.filter((entry) => isFresh(entry, ttlMs))
  const mergedCachedPayload = mergePayloads(validEntries)
  const cachedKeys = Object.keys(mergedCachedPayload)

  if (!forceRefresh && isSubset(normalizedKeys, cachedKeys)) {
    const subsetPayload = {}
    for (const key of normalizedKeys) {
      subsetPayload[key] = mergedCachedPayload[key]
    }

    return { payload: subsetPayload, fromCache: true, fetchedKeys: [] }
  }

  const missingKeys = forceRefresh ? normalizedKeys : normalizedKeys.filter((key) => !cachedKeys.includes(key))
  const keysToRequest = missingKeys.length ? missingKeys : normalizedKeys

  const accessToken = await getValidAccessToken()

  try {
    const { streams } = await stravaApi.getActivityStreams(accessToken, activity.stravaId, keysToRequest)
    const mergedPayload = {
      ...(forceRefresh ? {} : mergedCachedPayload),
      ...(streams || {})
    }

    const subsetPayload = {}
    for (const key of normalizedKeys) {
      subsetPayload[key] = mergedPayload[key]
    }

    await db.stravaStreamsCache.put({
      stravaId: activity.stravaId,
      keySignature: streamSignature(normalizedKeys),
      requestedKeys: normalizedKeys,
      payload: subsetPayload,
      fetchedAt: Date.now(),
      status: 'ok',
      lastError: null,
      schemaVersion: SCHEMA_VERSION
    })

    return { payload: subsetPayload, fromCache: false, fetchedKeys: keysToRequest }
  } catch (error) {
    await db.stravaStreamsCache.put({
      stravaId: activity.stravaId,
      keySignature: streamSignature(normalizedKeys),
      requestedKeys: normalizedKeys,
      payload: mergedCachedPayload,
      fetchedAt: Date.now(),
      status: 'error',
      lastError: error.message,
      schemaVersion: SCHEMA_VERSION
    })
    throw error
  }
}

async function getCachedAnalytics(activity) {
  return db.derivedAnalyticsCache.get([activity.stravaId, ANALYTICS_VERSION])
}

async function saveAnalytics(activity, requestedKeys, payload) {
  await db.derivedAnalyticsCache.put({
    stravaId: activity.stravaId,
    analyticsVersion: ANALYTICS_VERSION,
    streamKeysUsed: requestedKeys,
    payload,
    fetchedAt: Date.now(),
    status: 'ok',
    lastError: null,
    schemaVersion: SCHEMA_VERSION
  })
}

export async function getActivityAnalytics(activity, options = {}) {
  const { forceRefresh = false, includeOptionalStreams = false } = options

  const requestedKeys = includeOptionalStreams
    ? [...MIN_STREAM_KEYS, ...OPTIONAL_STREAM_KEYS]
    : [...MIN_STREAM_KEYS]

  const cachedAnalytics = await getCachedAnalytics(activity)
  const ttlMs = cacheTtlMs(activity.timestamp)

  if (
    !forceRefresh &&
    isFresh(cachedAnalytics, ttlMs) &&
    isSubset(requestedKeys, cachedAnalytics.streamKeysUsed || [])
  ) {
    return {
      detail: cachedAnalytics.payload.detail,
      streams: cachedAnalytics.payload.streams,
      analytics: cachedAnalytics.payload.analytics,
      metadata: {
        analyticsFromCache: true,
        detailFromCache: true,
        streamsFromCache: true,
        fetchedStreamKeys: []
      }
    }
  }

  const [detailResult, streamsResult, allActivities] = await Promise.all([
    getDetail(activity, { forceRefresh }),
    getStreams(activity, requestedKeys, { forceRefresh }),
    getActivities(1000)
  ])

  const analytics = computeDerivedAnalytics({
    activity,
    detail: detailResult.payload,
    streams: streamsResult.payload,
    allActivities
  })

  const cachePayload = {
    detail: detailResult.payload,
    streams: streamsResult.payload,
    analytics
  }

  await saveAnalytics(activity, requestedKeys, cachePayload)

  return {
    detail: detailResult.payload,
    streams: streamsResult.payload,
    analytics,
    metadata: {
      analyticsFromCache: false,
      detailFromCache: detailResult.fromCache,
      streamsFromCache: streamsResult.fromCache,
      fetchedStreamKeys: streamsResult.fetchedKeys
    }
  }
}

export async function refreshActivityAnalytics(activity, includeOptionalStreams = false) {
  return getActivityAnalytics(activity, {
    forceRefresh: true,
    includeOptionalStreams
  })
}
