<script>
  import { onMount } from 'svelte'
  import { theme } from './theme.js'
  import WeightEntry from './components/WeightEntry.svelte'
  import Dashboard from './components/Dashboard.svelte'
  import Settings from './components/Settings.svelte'
  import SplashScreen from './components/SplashScreen.svelte'

  let currentView = 'dashboard'

  onMount(() => {
    // Check if app is installed as PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
    })

    // Set initial theme
    if ($theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  })

  function setView(view) {
    currentView = view
  }

  function toggleTheme() {
    theme.set($theme === 'dark' ? 'light' : 'dark')
  }
</script>

<SplashScreen />

<div data-theme={$theme} class="min-h-screen bg-base-100">
  <div class="navbar bg-base-200 shadow-lg">
    <div class="flex-1">
      <button 
        class="btn btn-ghost text-xl font-bold text-primary"
        on:click={() => setView('dashboard')}
      >
         <img 
        src="/logo.svg" 
        alt="WayMe Logo" 
        class="animate-pulse"
        style="width: 151px; height: 46px;"
      />
      </button>
    </div>
  </div>

  <div class="tabs tabs-bordered w-full">
    <button 
      class="tab {currentView === 'dashboard' ? 'tab-active' : ''}"
      on:click={() => setView('dashboard')}
    >
      Dashboard
    </button>
    <button 
      class="tab {currentView === 'entry' ? 'tab-active' : ''}"
      on:click={() => setView('entry')}
    >
      Weight Entry
    </button>
    <button 
      class="tab {currentView === 'settings' ? 'tab-active' : ''}"
      on:click={() => setView('settings')}
    >
      Settings
    </button>
  </div>

  <div class="p-6">
    {#if currentView === 'dashboard'}
      <Dashboard />
    {:else if currentView === 'entry'}
      <WeightEntry />
    {:else if currentView === 'settings'}
      <Settings />
    {/if}
  </div>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
