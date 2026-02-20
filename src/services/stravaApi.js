/**
 * Strava API Client
 * Frontend utility for calling Strava API endpoints
 * 
 * Usage:
 * const token = await stravaApi.getAccessToken(authCode);
 * localStorage.setItem('strava_token', token.accessToken);
 * 
 * const activities = await stravaApi.getActivities(token.accessToken);
 */

class StravaApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || window.location.origin;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} authCode - Authorization code from Strava OAuth redirect
   * @returns {Promise<{accessToken, refreshToken, expiresAt, athlete}>}
   */
  async getAccessToken(authCode) {
    const response = await fetch(`${this.baseUrl}/api/strava/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error}`);
    }

    return await response.json();
  }

  /**
   * Fetch athlete activities from Strava
   * @param {string} accessToken - Strava access token
   * @param {number} page - Page number (pagination)
   * @param {number} perPage - Activities per page
   * @returns {Promise<Array>} Array of activities
   */
  async getActivities(accessToken, page = 1, perPage = 50) {
    const response = await fetch(
      `${this.baseUrl}/api/strava/activities?page=${page}&per_page=${perPage}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch activities: ${error.error}`);
    }

    const data = await response.json();
    return data.activities;
  }

  /**
   * Refresh access token (call this before token expires)
   * Note: Requires a backend endpoint to handle refresh logic
   * @param {string} refreshToken
   * @returns {Promise<{accessToken, expiresAt}>}
   */
  async refreshToken(refreshToken) {
    // TODO: Create /api/strava/refresh.js endpoint
    // For now, direct Strava API call would bypass your server
    console.warn('Token refresh not yet implemented');
    return null;
  }
}

export const stravaApi = new StravaApiClient();
