<script>
  import { onMount } from 'svelte'
  import { slide } from 'svelte/transition'
  import { theme } from './theme.js'
  import WeightEntry from './components/WeightEntry.svelte'
  import Dashboard from './components/Dashboard.svelte'
  import Settings from './components/Settings.svelte'
  import SplashScreen from './components/SplashScreen.svelte'

  let currentView = 'dashboard'

  // PWA install prompt handling
  let deferredPrompt = null
  let showInstallBanner = false

  onMount(() => {
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

<div data-theme={$theme} class="min-h-screen bg-base-100">
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
        {#if $theme === 'dark'}
          🌙
        {:else}
          ☀️
        {/if}
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

<!-- Install Banner -->
{#if showInstallBanner}
  <div
    transition:slide={{ duration: 350 }}
    class="fixed bottom-0 left-0 right-0 flex justify-center z-50"
  >
    <div class="w-full max-w-md mx-auto">
      <div class="alert shadow-xl bg-primary text-primary-content rounded-t-2xl border border-primary/30">
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
