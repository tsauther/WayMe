You are working in the `c:\WayMe` Svelte app. Implement a Strava-only advanced analytics layer (Intervals-style insights) that augments existing Strava activities with lazy, cached enrichment while minimizing Strava API requests.

Primary goals:
1. Do not change existing Strava list presentment on initial load.
2. Only fetch extra Strava data when needed (on-demand).
3. Cache all fetched detail/streams so repeated views do not re-hit Strava.
4. Add advanced analytics derived locally from Strava detail + streams.
5. Keep API usage conservative and rate-limit friendly.

Current code context:
- Strava summary list sync exists via:
  - `api/strava/activities.js`
  - `src/services/stravaSync.js`
  - `src/services/stravaApi.js`
- Local storage is Dexie in `src/db.js`.
- Activity UI is in `src/components/StravaActivities.svelte`.

Implementation requirements:

A) UX behavior
- Preserve current list/cards exactly as default behavior.
- Add click interaction on activity title (or nearby “Details”) to open an expandable analytics panel.
- On first open, fetch enrichment data for only that activity.
- On subsequent opens, use cache immediately.
- Show loading/error states only inside the panel.
- Include a “Refresh analytics” action that bypasses cache for that activity only.
- Graphs should be used on any time based metric using the existing graphing tools.  Care should be given to make them stylistically modern, robust and useful.

B) Data strategy and caching
- Add Dexie tables/fields for enrichment cache:
  - `stravaDetailCache` keyed by `stravaId`
  - `stravaStreamsCache` keyed by `stravaId` + requested stream-key signature
  - `derivedAnalyticsCache` keyed by `stravaId` + analytics version
- Store:
  - payload
  - requested keys (for streams)
  - `fetchedAt`
  - `status`/`lastError`
  - `schemaVersion` / analytics version hash
- Cache policy:
  - Historical completed activities: long TTL (e.g. 30 days) or immutable unless manual refresh.
  - Recent activities (e.g. last 3 days): shorter TTL (e.g. 6-24h).
  - Never refetch when cache is valid.
  - If requested stream keys are a subset of cached keys, do not refetch.

C) Strava request minimization
- Keep existing summary sync as-is (`/athlete/activities` list endpoint only).
- Add backend proxy endpoints for on-demand enrichment only:
  - `GET /api/strava/activity/:id` -> `GET /activities/{id}`
  - `GET /api/strava/activity/:id/streams` -> `GET /activities/{id}/streams`
- Do not prefetch detail/streams during list sync.
- Fetch streams only if needed for visible analytics not already cached.
- Request minimal stream keys initially: `time,distance,heartrate,watts,cadence,velocity_smooth,grade_smooth`.
- Request optional keys (`altitude,temp,moving,latlng`) only when the UI section using them is expanded.

D) Local analytics to implement (Intervals-style, Strava-derived)
- Activity-level derived metrics:
  - decoupling-like metric (HR drift proxy for steady efforts)
  - simple intensity/load score from HR/power and duration
  - best effort snapshots from stream windows (e.g. 1m/5m/20m power or pace equivalents)
  - interval candidate detection (basic work/rest segmentation heuristic)
  - power-vs-HR summary bins if both streams exist
- Athlete-level trend metrics (computed from cached activities):
  - rolling acute/chronic load proxies (ATL/CTL-like)
  - form/freshness proxy (CTL - ATL style)
  - rolling efficiency indicators (pace-at-HR or watts-at-HR trend where data exists)
- Handle sparse data gracefully:
  - If no power stream, compute HR/pace-based alternatives.
  - If no HR stream, compute pace/power-only summaries.

E) Architecture and module boundaries
- Add service modules if needed:
  - `src/services/activityEnrichment.js` (fetch + cache orchestration)
  - `src/services/derivedAnalytics.js` (pure metric calculations)
- Keep backend endpoints thin (proxy + validation), put analytics math on client or shared service.
- Ensure deterministic outputs for same input/cache version.

F) Code quality constraints
- Keep current architecture patterns and naming style.
- Keep changes scoped and incremental; avoid broad refactors.
- Add succinct comments only where logic is non-obvious.
- Update `README.md` with:
  - added endpoints
  - cache policy
  - lazy fetch behavior
  - API-rate-limit rationale
  - known limitations vs Intervals.icu platform features

G) Verification
- Provide a short manual test checklist proving:
  1. Initial list load makes no new Strava detail/streams calls.
  2. Clicking title triggers first enrichment fetch.
  3. Re-opening same activity uses cache.
  4. Refresh button re-fetches and updates cache timestamps.
  5. Streams are requested with minimal keys first.
  6. Analytics still render with missing HR or missing power.

Deliverables:
- All required code changes.
- No regression to current Strava list behavior.
- Brief change summary with file paths and why each was edited.

Other Improvements:
- Entries to weight should be editable. From the list view, add link to entry screen for editing of existing value.