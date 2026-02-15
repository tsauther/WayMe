<script>
  import { onMount } from 'svelte'

  let deferredPrompt = null
  let canInstall = false

  onMount(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      canInstall = true
    })

    window.addEventListener('appinstalled', () => {
      canInstall = false
      deferredPrompt = null
    })
  })

  async function handleInstall() {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      canInstall = false
      deferredPrompt = null
    }
  }
</script>

{#if canInstall}
  <div class="alert alert-info mb-4">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-6 w-6 shrink-0 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    <div>
      <h3 class="font-bold">Install WayMe</h3>
      <div class="text-xs">Add WayMe to your home screen for quick access</div>
    </div>
    <button class="btn btn-sm btn-primary" on:click={handleInstall}>
      Install
    </button>
  </div>
{/if}

<style>
</style>
