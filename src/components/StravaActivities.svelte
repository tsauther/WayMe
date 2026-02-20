<script>
  import { onMount } from 'svelte'
  import { getActivities, getStravaStats } from '../db.js'
  import { generateRouteSvg } from '../utils/polyline.js'

  let activities = []
  let stats = {}
  let loading = true
  let selectedType = 'All'
  let sortBy = 'recent'

  const activityTypes = ['All', 'Run', 'Ride', 'Swim', 'Walk', 'Hike']

  onMount(async () => {
    await loadActivities()
    await loadStats()
    loading = false
  })

  async function loadActivities() {
    activities = await getActivities(100)
  }

  async function loadStats() {
    stats = await getStravaStats()
  }

  $: filteredActivities = selectedType === 'All' 
    ? activities 
    : activities.filter(a => a.type === selectedType)

  $: sortedActivities = (() => {
    const sorted = [...filteredActivities]
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

    <!-- Filters -->
    <div class="flex gap-4 flex-wrap">
      <div class="join">
        {#each activityTypes as type}
          <button
            class="join-item btn {selectedType === type ? 'btn-active btn-primary' : 'btn-ghost'}"
            on:click={() => selectedType = type}
          >
            {type}
          </button>
        {/each}
      </div>
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
                <h3 class="card-title text-lg">{activity.name}</h3>
                <p class="text-sm text-gray-500">{formatDate(activity.timestamp)}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <div class="badge badge-primary">{activity.type}</div>
                {#if activity.calories > 0}
                  <div class="text-lg font-bold text-secondary">{activity.calories} cal</div>
                {/if}
              </div>
            </div>

            <!-- Route Map -->
            {#if activity.summaryPolyline}
              <div class="mb-4 rounded-lg overflow-hidden border border-gray-300">
                {@html generateRouteSvg(activity.summaryPolyline, 600, 200)}
              </div>
            {/if}

            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if sortedActivities.length === 0 && selectedType !== 'All'}
      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>No {selectedType} activities found.</span>
      </div>
    {/if}
  {/if}
</div>
