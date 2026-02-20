/**
 * Example: How to integrate Strava OAuth in your Svelte component
 * 
 * Usage in a component:
 * 
 * import { stravaApi } from '../services/stravaApi';
 * 
 * async function connectStrava() {
 *   // Redirect to Strava OAuth
 *   const clientId = 'YOUR_CLIENT_ID';
 *   const redirectUri = encodeURIComponent(window.location.origin + '/auth/strava');
 *   const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all`;
 *   window.location.href = authUrl;
 * }
 * 
 * // In your callback page component:
 * import { onMount } from 'svelte';
 * import { stravaApi } from '../services/stravaApi';
 * 
 * onMount(async () => {
 *   const params = new URLSearchParams(window.location.search);
 *   const code = params.get('code');
 *   
 *   if (code) {
 *     try {
 *       const tokenData = await stravaApi.getAccessToken(code);
 *       // Store token securely
 *       localStorage.setItem('strava_token', tokenData.accessToken);
 *       localStorage.setItem('strava_expires_at', tokenData.expiresAt);
 *       localStorage.setItem('strava_athlete', JSON.stringify(tokenData.athlete));
 *       // Redirect to dashboard
 *       window.location.href = '/';
 *     } catch (error) {
 *       console.error('Auth failed:', error);
 *     }
 *   }
 * });
 */

// TODO: Create these files:
// 1. src/routes/auth/strava.svelte - OAuth callback page
// 2. Add Strava connection button in src/components/Settings.svelte
// 3. Update Dashboard.svelte to display exercise offset chart
