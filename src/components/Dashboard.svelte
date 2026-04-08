<script>
  import { onMount } from 'svelte'
  import { getWeights, getSettings, getWeeklyExerciseHistory } from '../db.js'
  import { theme } from '../theme.js'
  import { stravaSyncService } from '../services/stravaSync.js'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let weightData = []
  let weeklyExerciseData = []
  let dailyCalorieLimit = 0
  let currentWeight = null
  let lastWeighIn = null
  let timeRange = '1m'
  let displayMode = 'graph' // 'graph' or 'table'
  let chartContainer
  let chart = null
  let poundsPerWeek = 1
  let maintenanceCalories = 2500 // Estimated baseline
  let currentTheme = 'light'
  let weeklyExerciseCalories = 0

  onMount(() => {
    // Load persisted time range from localStorage
    const savedTimeRange = localStorage.getItem('dashboardTimeRange')
    if (savedTimeRange) {
      timeRange = savedTimeRange
    }
    
    // Subscribe to theme changes
    const unsubscribe = theme.subscribe(value => {
      currentTheme = value
      // Re-render chart when theme changes
      if (displayMode === 'graph' && weightData.length > 0) {
        renderChart()
      }
    })
    
    loadData()
    // Auto-sync Strava on app load
    stravaSyncService.autoSync()
    return unsubscribe
  })

  function calculateDailyCalorieLimit() {
    // Formula: Daily Limit = Maintenance Calories - (Target Weekly Loss * 3500 / 7)
    // 3500 calories = 1 pound of body weight
    const weeklyCalorieDeficit = (poundsPerWeek * 3500)
    const dailyDeficit = weeklyCalorieDeficit / 7
    const calculatedLimit = Math.round(maintenanceCalories - dailyDeficit)
    return Math.max(calculatedLimit, 1200) // Minimum safety limit
  }

  function filterDataByTimeRange(data) {
    const now = Date.now()
    let cutoffDate

    switch (timeRange) {
      case '1m':
        cutoffDate = now - 30 * 24 * 60 * 60 * 1000
        break
      case '3m':
        cutoffDate = now - 90 * 24 * 60 * 60 * 1000
        break
      case '6m':
        cutoffDate = now - 180 * 24 * 60 * 60 * 1000
        break
      case '1y':
        cutoffDate = now - 365 * 24 * 60 * 60 * 1000
        break
      case 'all':
        return data // Return all data without filtering
      default:
        cutoffDate = now - 30 * 24 * 60 * 60 * 1000
    }

    return data.filter(entry => entry.timestamp >= cutoffDate)
  }

  function renderChart() {
    if (!chartContainer || weightData.length === 0) return

    // Filter data by time range
    const filteredWeights = filterDataByTimeRange(weightData)

    if (filteredWeights.length === 0) {
      chartContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No data for selected time range</p>'
      return
    }

    // Prepare weight data for uPlot (timestamps in seconds, weights)
    const timestamps = filteredWeights.map(d => Math.floor(d.timestamp / 1000))
    const weights = filteredWeights.map(d => d.weight)

    // Filter weekly exercise data by time range and prepare for chart
    // Weekly exercise timestamps should be aligned with the chart's time axis
    const cutoffTime = (() => {
      const now = Date.now()
      switch (timeRange) {
        case '1m': return now - 30 * 24 * 60 * 60 * 1000
        case '3m': return now - 90 * 24 * 60 * 60 * 1000
        case '6m': return now - 180 * 24 * 60 * 60 * 1000
        case '1y': return now - 365 * 24 * 60 * 60 * 1000
        case 'all': return 0
        default: return now - 30 * 24 * 60 * 60 * 1000
      }
    })()

    // Create a map of timestamps to exercise values
    const exerciseMap = new Map()
    for (const week of weeklyExerciseData) {
      if (week.weekStartTimestamp >= cutoffTime) {
        exerciseMap.set(Math.floor(week.weekStartTimestamp / 1000), week.caloriesBurned)
      }
    }

    // Create exercise array aligned with weight timestamps
    const exerciseValues = timestamps.map(ts => {
      // Find nearest week start
      const nearestWeek = Array.from(exerciseMap.keys()).reduce((prev, curr) => {
        return Math.abs(curr - ts) < Math.abs(prev - ts) ? curr : prev
      }, timestamps[0])
      
      return exerciseMap.get(nearestWeek) || 0
    })

    const data = [timestamps, weights, exerciseValues]

    // Determine text color based on theme
    const textColor = currentTheme === 'dark' ? '#e5e7eb' : '#1f2937'

    const options = {
      id: 'chart',
      class: 'my-chart',
      width: chartContainer.offsetWidth,
      height: 300,
      series: [
        {},
        {
          label: 'Weight (lbs)',
          stroke: 'hsl(217, 100%, 59%)',
          fill: 'rgba(33, 150, 243, 0.1)',
          scale: 'weight'
        },
        {
          label: 'Weekly Exercise (cal)',
          stroke: 'hsl(142, 71%, 45%)',
          fill: 'rgba(34, 197, 94, 0.1)',
          scale: 'exercise'
        }
      ],
      scales: {
        weight: {
          side: 0
        },
        exercise: {
          side: 1
        }
      },
      axes: [
        {},
        {
          label: 'Weight (lbs)',
          scale: 'weight',
          side: 0
        },
        {
          label: 'Exercise (cal)',
          scale: 'exercise',
          side: 1
        }
      ]
    }

    // Destroy old chart if it exists
    if (chart) {
      chart.destroy()
    }

    chart = new uPlot(options, data, chartContainer)
  }

  async function loadData() {
    const weights = await getWeights(100)
    weightData = weights.reverse()
    
    // Load weekly exercise data
    const weeklyExercise = await getWeeklyExerciseHistory(104) // 2 years of weeks
    weeklyExerciseData = weeklyExercise.reverse()
    
    if (weights.length > 0) {
      currentWeight = weights[weights.length - 1].weight
      lastWeighIn = new Date(weights[weights.length - 1].timestamp).toLocaleDateString()
    }

    // Load settings
    const savedPoundsPerWeek = await getSettings('poundsPerWeek')
    if (savedPoundsPerWeek !== null) {
      poundsPerWeek = savedPoundsPerWeek
    }

    // Calculate daily calorie limit dynamically
    dailyCalorieLimit = calculateDailyCalorieLimit()

    // Load weekly exercise calories from Strava
    weeklyExerciseCalories = await stravaSyncService.getWeeklyCalories()

    // Render chart if in graph mode
    if (displayMode === 'graph') {
      renderChart()
    }
  }

  function handleDisplayModeChange(mode) {
    displayMode = mode
    if (mode === 'graph') {
      setTimeout(() => {
        renderChart()
      }, 0)
    }
  }

  function handleTimeRangeChange() {
    // Persist time range selection to localStorage
    localStorage.setItem('dashboardTimeRange', timeRange)
    if (displayMode === 'graph') {
      renderChart()
    }
  }
</script>

<div class="space-y-6">
  <h2 class="text-3xl font-bold text-primary">Dashboard</h2>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="card bg-primary shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Current Weight</h4>
        <p class="text-7xl font-bold text-white">{currentWeight || '--'}</p>
      </div>
    </div>
    
    <div class="card bg-accent shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Daily Calorie Limit</h4>
        <p class="text-7xl font-bold text-white">{dailyCalorieLimit}</p>
      </div>
    </div>
    
    <div class="card bg-secondary shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Last Weigh In</h4>
        <p class="text-4xl font-bold text-white">{lastWeighIn || '--'}</p>
      </div>
    </div>

    <div class="card bg-error shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Weekly Exercise</h4>
        <p class="text-5xl font-bold text-white">{weeklyExerciseCalories}</p>
        <p class="text-xs text-white mt-2">calories burned</p>
      </div>
    </div>
  </div>

 

  {#if displayMode === 'graph'}
    <div class="card shadow-md {currentTheme === 'dark' ? 'bg-gray-100' : 'bg-base-200'}">
      <div class="card-body" style="padding:0px;">
        <div 
          bind:this={chartContainer}
          class="w-full"
        ></div>
      </div>
    </div>
  {:else}
    <div class="card bg-base-200 shadow-md">
      <div class="card-body">
        <div class="card-title">Weight History</div>
        {#if weightData.length > 0}
          <div class="overflow-x-auto">
            <table class="table table-compact w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filterDataByTimeRange(weightData) as entry (entry.id)}
                  <tr>
                    <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                    <td>{entry.weight} {entry.unit}</td>
                    <td>
                      <a class="link link-primary" href={`#/entry?edit=${entry.id}`}>
                        Edit
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-center text-gray-500">No weight entries yet</p>
        {/if}
      </div>
    </div>
  {/if}

   <div class="card bg-base-200 shadow-md">
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <div class="card-title">View Settings</div>
        <div class="flex gap-2">
          <button 
            class="btn btn-sm {displayMode === 'graph' ? 'btn-primary' : 'btn-outline'}"
            on:click={() => handleDisplayModeChange('graph')}
          >
            📈 Graph
          </button>
          <button 
            class="btn btn-sm {displayMode === 'table' ? 'btn-primary' : 'btn-outline'}"
            on:click={() => handleDisplayModeChange('table')}
          >
            📊 Table
          </button>
        </div>
      </div>
      
      <select 
        bind:value={timeRange} 
        on:change={handleTimeRangeChange}
        class="select select-bordered select-primary"
      >
        <option value="1m">Last Month</option>
        <option value="3m">Last 3 Months</option>
        <option value="6m">Last 6 Months</option>
        <option value="1y">Last Year</option>
        <option value="all">All Time</option>
      </select>
    </div>
  </div>
</div>

<style>
  :global(.my-chart) {
    width: 100%;
  }
</style>
