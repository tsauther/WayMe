<script>
  import { onMount } from 'svelte'

  let showSplash = true

  onMount(() => {
    // Show splash screen for at least 2 seconds
    const timer = setTimeout(() => {
      showSplash = false
    }, 3000)

    return () => clearTimeout(timer)
  })
</script>

{#if showSplash}
  <div class="fixed inset-0 bg-base-100 flex flex-col items-center justify-center z-50">
    <div class="flex flex-col items-center gap-4">
      <img 
        src="logo.svg" 
        alt="WayMe Logo" 
        class="w-64 h-64 animate-pulse"
      />
      <p class="text-sm text-base-content opacity-75">Weight tracking made simple</p>
    </div>
  </div>
{/if}

<style>
  :global(.animate-pulse) {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
