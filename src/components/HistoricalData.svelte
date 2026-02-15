<script>
  import { onMount } from 'svelte'
  import { addWeight, getWeights } from '../db.js'

  let historicalData = []
  let newEntry = {
    date: new Date().toISOString().split('T')[0],
    weight: '',
    unit: 'lbs'
  }
  let loading = false
  let showSuccess = false

  onMount(() => {
    loadData()
  })

  async function loadData() {
    const weights = await getWeights(100)
    historicalData = weights.reverse()
  }

  async function handleAddHistorical() {
    if (!newEntry.weight || isNaN(newEntry.weight) || !newEntry.date) {
      return
    }

    loading = true
    try {
      const date = new Date(newEntry.date)
      const timestamp = date.getTime()
      
      await addWeight(parseFloat(newEntry.weight), newEntry.unit, timestamp)
      
      // Reset form and reload data
      newEntry.weight = ''
      newEntry.date = new Date().toISOString().split('T')[0]
      
      await loadData()
      
      showSuccess = true
      setTimeout(() => {
        showSuccess = false
      }, 3000)
    } catch (err) {
      console.error('Error adding historical data:', err)
    } finally {
      loading = false
    }
  }
</script>

<div class="space-y-6">
  <h2 class="text-3xl font-bold text-primary">Add Historical Data</h2>

  {#if showSuccess}
    <div class="alert alert-success">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Historical data added successfully!</span>
    </div>
  {/if}

  <div class="card bg-base-200 shadow-md">
    <div class="card-body">
      <h3 class="card-title">Add Past Weight Entry</h3>
      
      <div class="form-control">
        <label class="label" for="historyDateInput">
          <span class="label-text font-semibold">Date</span>
        </label>
        <input 
          id="historyDateInput"
          type="date"
          bind:value={newEntry.date}
          class="input input-bordered input-primary"
          disabled={loading}
        />
      </div>

      <div class="form-control">
        <label class="label" for="historyWeightInput">
          <span class="label-text font-semibold">Weight</span>
        </label>
        <input 
          id="historyWeightInput"
          type="number"
          step="0.1"
          bind:value={newEntry.weight}
          placeholder="Enter weight"
          class="input input-bordered input-primary"
          disabled={loading}
        />
      </div>

      <div class="form-control">
        <label class="label" for="historyUnitGroup">
          <span class="label-text font-semibold">Unit</span>
        </label>
        <div class="space-y-2" id="historyUnitGroup">
          <label class="label cursor-pointer" for="historyUnitLbs">
            <span class="label-text">Pounds (lbs)</span>
            <input 
              id="historyUnitLbs"
              type="radio" 
              name="hist-unit" 
              class="radio radio-primary"
              bind:group={newEntry.unit} 
              value="lbs"
              disabled={loading}
            />
          </label>
          <label class="label cursor-pointer" for="historyUnitKg">
            <span class="label-text">Kilograms (kg)</span>
            <input 
              id="historyUnitKg"
              type="radio" 
              name="hist-unit" 
              class="radio radio-primary"
              bind:group={newEntry.unit} 
              value="kg"
              disabled={loading}
            />
          </label>
        </div>
      </div>

      <button 
        on:click={handleAddHistorical} 
        class="btn btn-primary w-full"
        disabled={loading || !newEntry.weight || !newEntry.date}
      >
        {loading ? 'Adding...' : 'Add Historical Entry'}
      </button>
    </div>
  </div>

  <div class="card bg-base-200 shadow-md">
    <div class="card-body">
      <h3 class="card-title">All Entries ({historicalData.length})</h3>
      
      {#if historicalData.length > 0}
        <div class="overflow-x-auto">
          <table class="table table-compact w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {#each historicalData as entry (entry.id)}
                <tr class="hover">
                  <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                  <td class="font-semibold">{entry.weight}</td>
                  <td>{entry.unit}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-8">
          <p class="text-gray-500">No weight entries yet. Add your first entry above!</p>
        </div>
      {/if}
    </div>
  </div>
</div>