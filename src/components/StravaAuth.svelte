<script>
  import { onMount } from 'svelte'
  import { stravaApi } from '../services/stravaApi'
  import { saveStravaAuth } from '../db.js'

  let status = 'loading'
  let error = null

  onMount(async () => {
    try {
      // Get authorization code from URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')

      if (!code) {
        throw new Error('No authorization code received')
      }

      // Exchange code for tokens
      const tokenData = await stravaApi.getAccessToken(code)

      // Save to database
      const saved = await saveStravaAuth(tokenData)

      if (saved) {
        status = 'success'
        // Redirect to settings after 2 seconds
        setTimeout(() => {
          window.location.href = '/#/settings'
        }, 2000)
      } else {
        throw new Error('Failed to save authentication')
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
      error = err.message
      status = 'error'
    }
  })
</script>

<div class="min-h-screen flex items-center justify-center bg-base-100">
  <div class="card w-96 shadow-lg">
    <div class="card-body text-center">
      {#if status === 'loading'}
        <h2 class="card-title justify-center">Connecting to Strava...</h2>
        <div class="flex justify-center my-4">
          <div class="loading loading-spinner loading-lg text-primary"></div>
        </div>
        <p class="text-sm text-gray-500">Please wait while we connect your account</p>
      {:else if status === 'success'}
        <h2 class="card-title justify-center text-success">Connected!</h2>
        <p class="my-4">✓ Your Strava account has been connected successfully</p>
        <p class="text-sm text-gray-500">Redirecting to settings...</p>
      {:else if status === 'error'}
        <h2 class="card-title justify-center text-error">Connection Failed</h2>
        <p class="my-4 text-red-600">{error}</p>
        <p class="text-sm text-gray-500 mb-4">Please try connecting again</p>
        <a href="/#/settings" class="btn btn-primary btn-sm">Back to Settings</a>
      {/if}
    </div>
  </div>
</div>
