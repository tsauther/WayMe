/**
 * Strava Activity Streams Proxy
 * Endpoint: GET /api/strava/activity/:id/streams?keys=time,distance
 */

function getAccessToken(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring('Bearer '.length)
  }
  return req.query.token || null
}

function sanitizeKeys(keysParam) {
  if (!keysParam) return []

  const parsed = String(keysParam)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .filter((k) => /^[a-z_]+$/.test(k))

  return [...new Set(parsed)]
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

  const keys = sanitizeKeys(req.query.keys)
  if (!keys.length) {
    return res.status(400).json({ error: 'Missing valid stream keys' })
  }

  try {
    const query = new URLSearchParams({
      keys: keys.join(','),
      key_by_type: 'true'
    })

    const response = await fetch(`https://www.strava.com/api/v3/activities/${id}/streams?${query.toString()}`, {
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
      return res.status(response.status).json({ error: 'Failed to fetch activity streams', details: error })
    }

    const streams = await response.json()
    return res.status(200).json({ streams, requestedKeys: keys, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Activity streams proxy error:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
