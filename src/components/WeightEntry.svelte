<script>
  import { onMount } from 'svelte'
  import { addWeight, getWeights } from '../db.js'

  let weight = ''
  let unit = 'lbs'
  let recentWeight = null
  let loading = false

  onMount(() => {
    loadRecentWeight()
  })

  async function loadRecentWeight() {
    const weights = await getWeights(1)
    if (weights.length > 0) {
      recentWeight = weights[0].weight
    }
  }

  async function handleSubmit() {
    if (weight && !isNaN(weight)) {
      loading = true
      try {
        await addWeight(parseFloat(weight), unit)
        recentWeight = weight
        weight = ''
        // Show success message
        const elem = document.getElementById('success-message')
        if (elem) {
          elem.classList.remove('hidden')
          setTimeout(() => elem.classList.add('hidden'), 3000)
        }
      } catch (err) {
        console.error('Error saving weight:', err)
      } finally {
        loading = false
      }
    }
  }
</script>

<div class="space-y-6">
  <h2 class="text-3xl font-bold text-primary">Log Weight</h2>

  <div id="success-message" class="alert alert-success hidden">
    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    <span>Weight logged successfully!</span>
  </div>

  <div class="card bg-gradient-to-br from-primary to-secondary shadow-xl">
    <div class="card-body text-center">
      <div class="text-6xl font-bold text-white font-mono">
        {weight || recentWeight || '0'}
      </div>
      <p class="text-2xl text-white mt-2">{unit}</p>
      <p class="text-sm text-white opacity-75 mt-4">
        {recentWeight ? `Last: ${recentWeight} ${unit}` : 'No previous entries'}
      </p>
    </div>
  </div>

  <div class="form-control w-full">
    <label class="label" for="weightInput">
      <span class="label-text font-semibold">Enter Weight</span>
    </label>
    <input 
      id="weightInput"
      type="number" 
      step="0.1"
      bind:value={weight} 
      placeholder="Enter weight"
      on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
      class="input input-bordered input-lg input-primary"
      disabled={loading}
    />
  </div>

  <div class="form-control">
    <label class="label" for="unitGroup">
      <span class="label-text font-semibold">Unit</span>
    </label>
    <div class="space-y-2" id="unitGroup">
      <label class="label cursor-pointer" for="unitLbs">
        <span class="label-text">Pounds (lbs)</span>
        <input 
          id="unitLbs"
          type="radio" 
          name="unit" 
          class="radio radio-primary"
          bind:group={unit} 
          value="lbs" 
        />
      </label>
      <label class="label cursor-pointer" for="unitKg">
        <span class="label-text">Kilograms (kg)</span>
        <input 
          id="unitKg"
          type="radio" 
          name="unit" 
          class="radio radio-primary"
          bind:group={unit} 
          value="kg" 
        />
      </label>
    </div>
  </div>

  <button 
    on:click={handleSubmit} 
    class="btn btn-primary btn-lg w-full"
    disabled={loading || !weight}
  >
    {loading ? 'Saving...' : 'Log Weight'}
  </button>
</div>
