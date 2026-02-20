/**
 * Strava OAuth Callback Handler
 * Endpoint: POST /api/strava/callback
 * 
 * Exchanges authorization code for access token
 * Returns: { accessToken, refreshToken, expiresIn, athlete }
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Missing Strava environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Strava token exchange error:', error);
      return res.status(tokenResponse.status).json({
        error: 'Failed to exchange token',
        details: error,
      });
    }

    const tokenData = await tokenResponse.json();

    // Return tokens and athlete info to the frontend
    // Frontend will securely store these (localStorage with caution for PWA)
    return res.status(200).json({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      athlete: tokenData.athlete,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
