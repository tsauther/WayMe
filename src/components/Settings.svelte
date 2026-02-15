<script>
  import { onMount } from 'svelte'
  import { saveSettings, getSettings, exportData } from '../db.js'
  import { theme } from '../theme.js'
  import HistoricalData from './HistoricalData.svelte'
  import InstallPrompt from './InstallPrompt.svelte'

  let settings = {
    unit: 'lbs',
    poundsPerWeek: 1,
    notifyHoursBefore: 2,
    weigh_in_day: 'Monday',
    weigh_in_time: '08:00',
  }

  let saving = false
  let showSuccess = false
  let settingsTab = 'config'

  onMount(() => {
    loadSettings()
  })

  async function loadSettings() {
    const keys = ['unit', 'poundsPerWeek', 'notifyHoursBefore', 'weigh_in_day', 'weigh_in_time']
    for (const key of keys) {
      const value = await getSettings(key)
      if (value !== null) {
        settings[key] = value
      }
    }
    settings = { ...settings }
  }

  async function handleSave(e) {
    e.preventDefault()
    saving = true
    try {
      await saveSettings('unit', settings.unit)
      await saveSettings('poundsPerWeek', settings.poundsPerWeek)
      await saveSettings('notifyHoursBefore', settings.notifyHoursBefore)
      await saveSettings('weigh_in_day', settings.weigh_in_day)
      await saveSettings('weigh_in_time', settings.weigh_in_time)
      
      showSuccess = true
      setTimeout(() => {
        showSuccess = false
      }, 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
    } finally {
      saving = false
    }
  }

  async function handleExport() {
    try {
      const data = await exportData()
      if (data) {
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `wayme-data-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Error exporting data:', err)
    }
  }

  function toggleTheme() {
    theme.set($theme === 'dark' ? 'light' : 'dark')
  }
</script>

<div class="space-y-6">
  <h2 class="text-3xl font-bold text-primary">Settings</h2>

  <div class="tabs tabs-bordered w-full">
    <button 
      class="tab {settingsTab === 'config' ? 'tab-active' : ''}"
      on:click={() => settingsTab = 'config'}
    >
      Configuration
    </button>
    <button 
      class="tab {settingsTab === 'historical' ? 'tab-active' : ''}"
      on:click={() => settingsTab = 'historical'}
    >
      Historical Data
    </button>
  </div>

  {#if settingsTab === 'config'}
    <InstallPrompt />
    
    {#if showSuccess}
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Settings saved successfully!</span>
      </div>
    {/if}

    <form on:submit={handleSave} class="space-y-6">
      <div class="card bg-base-200 shadow-md">
        <div class="card-body">
          <h3 class="card-title">Theme</h3>
          
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Dark Mode</span>
              <input 
                type="checkbox" 
                class="toggle toggle-primary"
                checked={$theme === 'dark'}
                on:change={toggleTheme}
              />
            </label>
          </div>
        </div>
      </div>

      <div class="card bg-base-200 shadow-md">
        <div class="card-body">
          <h3 class="card-title">Units & Goals</h3>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Measurement Unit</span>
            </label>
            <select bind:value={settings.unit} class="select select-bordered select-primary">
              <option value="lbs">Pounds (lbs)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Target Loss per Week ({settings.unit})</span>
            </label>
            <input 
              type="number" 
              bind:value={settings.poundsPerWeek} 
              min="0.5" 
              max="5" 
              step="0.5"
              class="input input-bordered input-primary"
            />
          </div>
        </div>
      </div>

      <div class="card bg-base-200 shadow-md">
        <div class="card-body">
          <h3 class="card-title">Notifications</h3>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Weigh In Day</span>
            </label>
            <select bind:value={settings.weigh_in_day} class="select select-bordered select-primary">
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Weigh In Time</span>
            </label>
            <input 
              type="time" 
              bind:value={settings.weigh_in_time}
              class="input input-bordered input-primary"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Notify Hours Before Weigh In</span>
            </label>
            <input 
              type="number" 
              bind:value={settings.notifyHoursBefore} 
              min="1" 
              max="24"
              class="input input-bordered input-primary"
            />
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg w-full" disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </form>

    <div class="card bg-base-200 shadow-md">
      <div class="card-body">
        <h3 class="card-title">Data Management</h3>
        <button on:click={handleExport} class="btn btn-secondary w-full">
          📥 Export Data as JSON
        </button>
      </div>
    </div>
  {:else if settingsTab === 'historical'}
    <HistoricalData />
  {/if}
</div>
