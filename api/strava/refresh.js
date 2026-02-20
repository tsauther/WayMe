/**
 * Strava Token Refresh Handler
 * Endpoint: POST /api/strava/refresh
 * 
 * Refreshes an expired Strava access token using the refresh token
 * Returns: { accessToken, refreshToken, expiresAt, expiresIn }
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' })
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Missing Strava environment variables')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // Request new access token from Strava using refresh token
    const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      console.error('Strava token refresh error:', error)
      return res.status(tokenResponse.status).json({
        error: 'Failed to refresh token',
        details: error,
      })
    }

    const data = await tokenResponse.json()

    // Return new token data
    return res.status(200).json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: Date.now() + data.expires_in * 1000,
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}
