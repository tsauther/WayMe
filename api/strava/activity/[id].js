/**
 * Strava Activity Detail Proxy
 * Endpoint: GET /api/strava/activity/:id
 */

function getAccessToken(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring('Bearer '.length)
  }
  return req.query.token || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing access token' })
  }

  const id = req.query.id
  if (!id || !/^\d+$/.test(String(id))) {
    return res.status(400).json({ error: 'Invalid activity id' })
  }

  try {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 401) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired access token' })
    }

    if (!response.ok) {
      const error = await response.json()
      return res.status(response.status).json({ error: 'Failed to fetch activity detail', details: error })
    }

    const activity = await response.json()
    return res.status(200).json({ activity, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Activity detail proxy error:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
