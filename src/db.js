import Dexie from 'dexie'

// Initialize Dexie database
export const db = new Dexie('WayMeDB')

db.version(1).stores({
  weights: '++id, timestamp',
  settings: 'key'
})

db.version(2).stores({
  weights: '++id, timestamp',
  settings: 'key',
  activities: '++id, timestamp, type',
  stravaStats: 'key',
  stravaAuth: 'key'
})

export async function addWeight(weight, unit, timestamp = Date.now()) {
  try {
    await db.weights.add({ weight, unit, timestamp })
    return true
  } catch (error) {
    console.error('Error adding weight:', error)
    return false
  }
}

export async function getWeights(limit = 100) {
  try {
    return await db.weights.reverse().limit(limit).toArray()
  } catch (error) {
    console.error('Error fetching weights:', error)
    return []
  }
}

export async function saveSettings(key, value) {
  try {
    await db.settings.put({ key, value })
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

export async function getSettings(key) {
  try {
    const setting = await db.settings.get(key)
    return setting ? setting.value : null
  } catch (error) {
    console.error('Error fetching settings:', error)
    return null
  }
}

// ==================== STRAVA ACTIVITIES ====================

export async function saveActivity(activity) {
  try {
    // Transform Strava activity to our schema
    const storedActivity = {
      stravaId: activity.id,
      name: activity.name,
      type: activity.type,
      timestamp: new Date(activity.start_date).getTime(),
      startDate: activity.start_date,
      distance: activity.distance, // meters
      duration: activity.elapsed_time, // seconds
      elevation: activity.total_elevation_gain, // meters
      calories: activity.calories || 0,
      heartRate: activity.average_heartrate || 0,
      movingTime: activity.moving_time,
      averageSpeed: activity.average_speed, // m/s
      maxSpeed: activity.max_speed, // m/s
      raw: activity // Store full Strava response
    }
    await db.activities.put(storedActivity)
    return true
  } catch (error) {
    console.error('Error saving activity:', error)
    return false
  }
}

export async function getActivities(limit = 100) {
  try {
    return await db.activities.reverse().limit(limit).toArray()
  } catch (error) {
    console.error('Error fetching activities:', error)
    return []
  }
}

export async function getActivityCount() {
  try {
    return await db.activities.count()
  } catch (error) {
    console.error('Error counting activities:', error)
    return 0
  }
}

// ==================== STRAVA STATS ====================

export async function updateStravaStats(stats) {
  try {
    // stats = { totalMiles, totalMinutes, totalElevation, lastSync, activityCount }
    await db.stravaStats.put({
      key: 'lifetime',
      ...stats,
      updatedAt: Date.now()
    })
    return true
  } catch (error) {
    console.error('Error updating strava stats:', error)
    return false
  }
}

export async function getStravaStats() {
  try {
    const stats = await db.stravaStats.get('lifetime')
    return stats || {
      totalMiles: 0,
      totalMinutes: 0,
      totalElevation: 0,
      activityCount: 0,
      lastSync: null
    }
  } catch (error) {
    console.error('Error fetching strava stats:', error)
    return null
  }
}

// ==================== STRAVA AUTH ====================

export async function saveStravaAuth(authData) {
  try {
    // authData = { accessToken, refreshToken, expiresAt, athlete }
    await db.stravaAuth.put({
      key: 'strava',
      ...authData,
      savedAt: Date.now()
    })
    return true
  } catch (error) {
    console.error('Error saving strava auth:', error)
    return false
  }
}

export async function getStravaAuth() {
  try {
    return await db.stravaAuth.get('strava')
  } catch (error) {
    console.error('Error fetching strava auth:', error)
    return null
  }
}

export async function clearStravaAuth() {
  try {
    await db.stravaAuth.delete('strava')
    return true
  } catch (error) {
    console.error('Error clearing strava auth:', error)
    return false
  }
}

// ==================== EXPORT ====================

export async function exportData() {
  try {
    const weights = await db.weights.toArray()
    const settings = await db.settings.toArray()
    const activities = await db.activities.toArray()
    const stravaStats = await db.stravaStats.toArray()
    return JSON.stringify({ weights, settings, activities, stravaStats }, null, 2)
  } catch (error) {
    console.error('Error exporting data:', error)
    return null
  }
}
