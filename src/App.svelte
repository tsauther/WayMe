<script>
  import { onMount } from 'svelte'
  import { slide } from 'svelte/transition'
  import { theme } from './theme.js'
  import WeightEntry from './components/WeightEntry.svelte'
  import Dashboard from './components/Dashboard.svelte'
  import Settings from './components/Settings.svelte'
  import SplashScreen from './components/SplashScreen.svelte'
  import StravaAuth from './components/StravaAuth.svelte'
  import StravaActivities from './components/StravaActivities.svelte'

  let currentView = 'dashboard'

  // PWA install prompt handling
  let deferredPrompt = null
  let showInstallBanner = false

  onMount(() => {
    const parseViewFromHash = (value) => {
      const clean = value.startsWith('/') ? value.slice(1) : value
      return clean.split('?')[0]
    }

    // Check for route in hash
    const hash = window.location.hash.slice(1) // Remove #
    if (hash.startsWith('/auth/strava')) {
      currentView = 'stravaauth'
    } else if (hash.startsWith('/')) {
      const view = parseViewFromHash(hash)
      if (['dashboard', 'entry', 'settings', 'activities'].includes(view)) {
        currentView = view
      }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.slice(1)
      if (newHash.startsWith('/auth/strava')) {
        currentView = 'stravaauth'
      } else if (newHash.startsWith('/')) {
        const newView = parseViewFromHash(newHash)
        if (['dashboard', 'entry', 'settings', 'activities'].includes(newView)) {
          currentView = newView
        }
      }
    })

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      showInstallBanner = true
    })

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null
      showInstallBanner = false
    })

    // Theme is initialized by theme.js store
  })

  function setView(view) {
    currentView = view
    if (view === 'stravaauth') {
      window.location.hash = '/auth/strava'
    } else {
      window.location.hash = `/${view}`
    }
  }

  function toggleTheme() {
    theme.set($theme === 'waymeM3dark' ? 'waymeM3' : 'waymeM3dark')
  }

  async function installApp() {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice

    if (result.outcome === 'accepted') {
      showInstallBanner = false
      deferredPrompt = null
    }
  }

  function closeBanner() {
    showInstallBanner = false
  }
</script>

<SplashScreen />

<div data-theme={$theme} class="min-h-screen bg-base-100 flex flex-col">
  <div class="navbar bg-base-200 shadow-lg">
    <div class="flex-1">
      <button 
        class="btn btn-ghost text-xl font-bold text-primary"
        on:click={() => setView('dashboard')}
      >
        <img 
          src="logo.svg" 
          alt="WayMe Logo" 
          class="animate-pulse"
          style="width: 151px; height: 46px;"
        />
      </button>
    </div>

    <div class="flex-none">
      <button class="btn btn-ghost" on:click={toggleTheme}>
        {#if $theme === 'waymeM3dark'}
          🌙
        {:else}
          ☀️
        {/if}
      </button>
    </div>
  </div>

  <div class="flex-1 p-6 pb-24 overflow-y-auto">
    {#if currentView === 'dashboard'}
      <Dashboard />
    {:else if currentView === 'activities'}
      <StravaActivities />
    {:else if currentView === 'entry'}
      <WeightEntry />
    {:else if currentView === 'settings'}
      <Settings />
    {:else if currentView === 'stravaauth'}
      <StravaAuth />
    {/if}
  </div>

  <!-- Bottom Navigation -->
  <div class="fixed bottom-0 left-0 right-0 border-t border-base-300 bg-base-100 flex justify-around px-4 py-3">
    <button 
      class="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors {currentView === 'dashboard' ? 'text-primary' : 'text-gray-500 hover:text-gray-400'}"
      on:click={() => setView('dashboard')}
      title="Dashboard"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4-2h2v20h-2zm4 4h2v16h-2z"/>
      </svg>
    </button>
    
    <button 
      class="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors {currentView === 'activities' ? 'text-primary' : 'text-gray-500 hover:text-gray-400'}"
      on:click={() => setView('activities')}
      title="Activities"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <path d="M12 2v4M12 18v4M22 12h-4M4 12H0" stroke="currentColor" stroke-width="2"/>
        <path d="M18.6 5.4l-2.8 2.8M8.2 14.8l-2.8 2.8M5.4 5.4l2.8 2.8M14.8 14.8l2.8 2.8" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>
    
    <button 
      class="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors {currentView === 'entry' ? 'text-primary' : 'text-gray-500 hover:text-gray-400'}"
      on:click={() => setView('entry')}
      title="Weight"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <rect x="8" y="10" width="8" height="4" rx="1"/>
        <line x1="10" y1="16" x2="14" y2="16"/>
      </svg>
    </button>
    
    <button 
      class="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors {currentView === 'settings' ? 'text-primary' : 'text-gray-500 hover:text-gray-400'}"
      on:click={() => setView('settings')}
      title="Settings"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.1.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.1-.62l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
      </svg>
    </button>
  </div>
</div>

<!-- Install Banner -->
{#if showInstallBanner}
  <div
    transition:slide={{ duration: 350 }}
    class="fixed bottom-20 left-0 right-0 flex justify-center z-50"
  >
    <div class="w-full max-w-md mx-auto">
      <div class="alert shadow-xl bg-primary text-primary-content rounded-2xl border border-primary/30">
        <div>
          <span class="font-semibold text-lg">Install WayMe</span>
          <p class="text-sm opacity-90">Add this app to your home screen for quick access.</p>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" on:click={installApp}>
            Install
          </button>
          <button class="btn btn-ghost btn-sm text-primary-content" on:click={closeBanner}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
