# WayMe

A local-first fitness tracker with Strava sync, weight tracking, and lazy advanced analytics.

## Strava Enrichment (Intervals-style)

WayMe keeps the default activities list fast by syncing summaries only. Advanced analytics are loaded on demand for a single activity when you open Details.

### Added API endpoints
- `GET /api/strava/activity/:id`
	- Proxies Strava `GET /activities/{id}`
- `GET /api/strava/activity/:id/streams?keys=...`
	- Proxies Strava `GET /activities/{id}/streams`
	- Uses `key_by_type=true`

### Lazy fetch behavior
- Initial activities sync still uses only `GET /api/strava/activities` (athlete list endpoint).
- No per-activity detail/stream prefetch is performed during list sync.
- Clicking an activity Details panel triggers enrichment fetch for that activity only.
- Re-opening a previously viewed activity uses Dexie cache when valid.
- `Refresh analytics` bypasses cache for that activity only.

### Cache policy
Dexie cache tables:
- `stravaDetailCache` keyed by `stravaId`
- `stravaStreamsCache` keyed by `stravaId + keySignature`
- `derivedAnalyticsCache` keyed by `stravaId + analyticsVersion`

Stored metadata:
- `payload`
- `requestedKeys` (streams)
- `fetchedAt`
- `status` and `lastError`
- `schemaVersion` / `analyticsVersion`

TTL strategy:
- Recent activities (<= 3 days old): short TTL (12 hours)
- Historical completed activities: long TTL (30 days)

Stream minimization:
- Initial stream request keys:
	- `time,distance,heartrate,watts,cadence,velocity_smooth,grade_smooth`
- Optional keys loaded only when requested by UI:
	- `altitude,temp,moving,latlng`
- If requested keys are already cached (subset), no stream refetch occurs.

### API rate-limit rationale
- Keeps list loading cheap and rate-limit friendly by avoiding per-activity hydration.
- Defers expensive calls until user intent (activity panel expansion).
- Reuses local cache aggressively with TTL-aware validation.
- Supports explicit per-activity refresh instead of blanket refetching.

### Implemented local analytics
- Activity-level:
	- HR drift / decoupling proxy
	- Intensity/load proxy
	- Best efforts (1m/5m/20m power or pace fallback)
	- Interval candidate detection heuristic
	- Power-vs-HR summary bins
- Athlete-level trends:
	- ATL/CTL-like rolling load proxies
	- Form/freshness proxy (`CTL - ATL`)
	- Efficiency indicators (`pace@HR` and `watts@HR` trends)

### Known limitations vs Intervals.icu
- Proxy metrics are heuristic and not equivalent to Intervals.icu algorithms.
- No FTP/LTHR personalization yet (uses baseline estimates).
- No multi-sport model specialization beyond available Strava streams.
- No server-side long-term analytics warehouse; computations are local and cache-scoped.

### Manual verification checklist
1. Open Activities page: confirm only list sync is used (no detail/streams calls yet).
2. Open one activity Details: confirm first enrichment fetch occurs.
3. Close/re-open same Details: confirm cached data is used.
4. Click `Refresh analytics`: confirm detail/streams are re-fetched and cache timestamp updates.
5. Confirm first stream fetch uses minimal keys and optional keys only after requesting them.
6. Validate analytics still render when HR or power streams are missing.

## Structure
- `src/` - Source code directory
- `prompt.md` - Prompt template for project guidance

## License
MIT
