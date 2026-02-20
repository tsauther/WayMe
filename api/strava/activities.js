/**
 * Strava Activities Proxy
 * Endpoint: GET /api/strava/activities
 * 
 * Fetches athlete's activities from Strava API
 * Requires: accessToken in Authorization header or query param
 * Returns: Array of activities with extended stats
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get access token from header or query param
  let accessToken = null;

  // Try Authorization header first (recommended)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring('Bearer '.length);
  }

  // Fallback to query parameter
  if (!accessToken && req.query.token) {
    accessToken = req.query.token;
  }

  if (!accessToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing access token',
    });
  }

  try {
    const perPage = req.query.per_page || 50;
    const page = req.query.page || 1;
    const after = req.query.after || null; // Unix timestamp
    const before = req.query.before || null; // Unix timestamp

    // Build Strava API URL with parameters
    let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`;
    if (after) url += `&after=${after}`;
    if (before) url += `&before=${before}`;

    // Fetch activities from Strava API
    const activitiesResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (activitiesResponse.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired access token',
      });
    }

    if (!activitiesResponse.ok) {
      const error = await activitiesResponse.json();
      console.error('Strava API error:', error);
      return res.status(activitiesResponse.status).json({
        error: 'Failed to fetch activities',
        details: error,
      });
    }

    const activities = await activitiesResponse.json();

    // Return activities data
    return res.status(200).json({
      activities,
      count: activities.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Activities proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
