<script>
  import { onMount } from 'svelte'
  import { getWeights, getSettings } from '../db.js'
  import { theme } from '../theme.js'
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let weightData = []
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
    const filteredData = filterDataByTimeRange(weightData)

    // Prepare data for uPlot (timestamps in seconds, weights)
    const timestamps = filteredData.map(d => Math.floor(d.timestamp / 1000))
    const weights = filteredData.map(d => d.weight)

    if (timestamps.length === 0) {
      chartContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No data for selected time range</p>'
      return
    }

    const data = [timestamps, weights]

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
          label: 'Weight',
          stroke: 'hsl(217, 100%, 59%)',
          fill: 'rgba(33, 150, 243, 0.1)',
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

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="card bg-gradient-to-br from-info to-info-content shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Current Weight</h4>
        <p class="text-7xl font-bold text-white">{currentWeight || '--'}</p>
      </div>
    </div>
    
    <div class="card bg-gradient-to-br from-success to-success-content shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Daily Calorie Limit</h4>
        <p class="text-7xl font-bold text-white">{dailyCalorieLimit}</p>
      </div>
    </div>
    
    <div class="card bg-gradient-to-br from-warning to-warning-content shadow-md">
      <div class="card-body">
        <h4 class="card-title text-lg text-white">Last Weigh In</h4>
        <p class="text-4xl font-bold text-white">{lastWeighIn || '--'}</p>
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
                </tr>
              </thead>
              <tbody>
                {#each filterDataByTimeRange(weightData) as entry (entry.id)}
                  <tr>
                    <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                    <td>{entry.weight} {entry.unit}</td>
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
