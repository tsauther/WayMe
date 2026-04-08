import Dexie from 'dexie'

// Initialize Dexie database with clean, simple schema
export const db = new Dexie('WayMeDB')

db.version(1).stores({
  weights: '++id, timestamp',
  settings: 'key',
  activities: '++id, timestamp, type, stravaId',
  stravaStats: 'key',
  stravaAuth: 'key',
  weeklyExercise: '++id, weekStartTimestamp'
})

db.version(2).stores({
  weights: '++id, timestamp',
  settings: 'key',
  activities: '++id, timestamp, type, stravaId',
  stravaStats: 'key',
  stravaAuth: 'key',
  weeklyExercise: '++id, weekStartTimestamp',
  stravaDetailCache: 'stravaId, fetchedAt, status, schemaVersion',
  stravaStreamsCache: '[stravaId+keySignature], stravaId, keySignature, fetchedAt, status',
  derivedAnalyticsCache: '[stravaId+analyticsVersion], stravaId, analyticsVersion, fetchedAt, status'
})

// Database reset function - clears all data but keeps schema
export async function resetDatabase() {
  try {
    await db.delete()
    await db.open()
    console.log('Database reset complete')
    return true
  } catch (error) {
    console.error('Error resetting database:', error)
    return false
  }
}

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

export async function getWeightById(id) {
  try {
    return await db.weights.get(id)
  } catch (error) {
    console.error('Error fetching weight by id:', error)
    return null
  }
}

export async function updateWeightEntry(id, weight, unit) {
  try {
    const updated = await db.weights.update(id, {
      weight,
      unit,
      updatedAt: Date.now()
    })
    return updated > 0
  } catch (error) {
    console.error('Error updating weight entry:', error)
    return false
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

/**
 * Calculate estimated calories burned for an activity
 * Based on activity type, duration, distance, and user weight
 */
async function calculateCalories(activity) {
  // Get current user weight
  const weights = await db.weights.orderBy('timestamp').last()
  const userWeight = weights ? weights.weight : 170 // Default to 170 lbs if no weight data
  const weightInKg = weights?.unit === 'kg' ? userWeight : userWeight * 0.453592
  
  const durationInMinutes = (activity.elapsed_time || 0) / 60
  const distanceInMiles = (activity.distance || 0) / 1609.34
  
  // MET values (Metabolic Equivalent of Task) for different activities
  const metValues = {
    'Run': 9.8,
    'Ride': 8.0,
    'Walk': 3.5,
    'Hike': 6.0,
    'Swim': 8.3,
    'WeightTraining': 6.0,
    'Workout': 5.0,
    'Yoga': 2.5,
    'VirtualRide': 8.0,
    'VirtualRun': 9.8
  }
  
  const met = metValues[activity.type] || 5.0 // Default MET value
  
  // Calories = MET × weight (kg) × duration (hours)
  const calories = Math.round(met * weightInKg * (durationInMinutes / 60))
  
  return calories
}

export async function saveActivity(activity) {
  try {
    // Check if activity already exists by stravaId
    if (activity.id) {
      const existing = await db.activities.where('stravaId').equals(activity.id).first()
      if (existing) {
        console.log(`Activity ${activity.id} already exists, skipping duplicate`)
        return false
      }
    }
    
    // Calculate calories if not provided by Strava
    const calculatedCalories = activity.calories || await calculateCalories(activity)
    
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
      calories: calculatedCalories,
      heartRate: activity.average_heartrate || 0,
      movingTime: activity.moving_time,
      averageSpeed: activity.average_speed, // m/s
      maxSpeed: activity.max_speed, // m/s
      averageWatts: activity.average_watts || 0, // watts
      weightedAverageWatts: activity.weighted_average_watts || 0, // normalized power
      maxWatts: activity.max_watts || 0, // peak watts
      sufferScore: activity.suffer_score || 0, // relative intensity
      prCount: (activity.segment_efforts || []).filter(s => s.pr_rank).length, // personal records
      achievementCount: activity.achievement_count || 0, // badges earned
      summaryPolyline: activity.map?.summary_polyline || null,
      raw: activity // Store full Strava response
    }
    await db.activities.add(storedActivity)
    return true
  } catch (error) {
    console.error('Error saving activity:', error)
    return false
  }
}

export async function getActivities(limit = 100) {
  try {
    return await db.activities
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray()
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

// ==================== WEEKLY EXERCISE ====================

export async function saveWeeklyExercise(weekStartTimestamp, caloriesBurned) {
  try {
    // Check if this week already exists
    const existing = await db.weeklyExercise.where('weekStartTimestamp').equals(weekStartTimestamp).first()
    if (existing) {
      // Update existing record
      await db.weeklyExercise.update(existing.id, { caloriesBurned })
    } else {
      // Add new record
      await db.weeklyExercise.add({
        weekStartTimestamp,
        caloriesBurned,
        timestamp: Date.now()
      })
    }
    return true
  } catch (error) {
    console.error('Error saving weekly exercise:', error)
    return false
  }
}

export async function getWeeklyExerciseHistory(limit = 52) {
  try {
    return await db.weeklyExercise
      .orderBy('weekStartTimestamp')
      .reverse()
      .limit(limit)
      .toArray()
  } catch (error) {
    console.error('Error fetching weekly exercise history:', error)
    return []
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
    const stravaDetailCache = await db.stravaDetailCache.toArray()
    const stravaStreamsCache = await db.stravaStreamsCache.toArray()
    const derivedAnalyticsCache = await db.derivedAnalyticsCache.toArray()
    return JSON.stringify({
      weights,
      settings,
      activities,
      stravaStats,
      stravaDetailCache,
      stravaStreamsCache,
      derivedAnalyticsCache
    }, null, 2)
  } catch (error) {
    console.error('Error exporting data:', error)
    return null
  }
}

// ==================== IMPORT ====================

export async function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData)
    let importedCount = 0
    let skippedCount = 0
    
    // Import weights
    if (data.weights && Array.isArray(data.weights)) {
      for (const weight of data.weights) {
        try {
          // Remove id to let DB assign new ones
          const { id, ...weightWithoutId } = weight
          await db.weights.add(weightWithoutId)
          importedCount++
        } catch (err) {
          console.warn('Skipped weight:', err)
          skippedCount++
        }
      }
    }
    
    // Import settings
    if (data.settings && Array.isArray(data.settings)) {
      for (const setting of data.settings) {
        try {
          await db.settings.put(setting)
          importedCount++
        } catch (err) {
          console.warn('Skipped setting:', err)
          skippedCount++
        }
      }
    }
    
    // Import activities - deduplicate by stravaId
    if (data.activities && Array.isArray(data.activities)) {
      for (const activity of data.activities) {
        try {
          // Check if already in DB by stravaId
          if (activity.stravaId) {
            const existing = await db.activities.where('stravaId').equals(activity.stravaId).first()
            if (existing) {
              skippedCount++
              continue
            }
          }
          // Remove id to let DB assign new ones
          const { id, ...activityWithoutId } = activity
          await db.activities.add(activityWithoutId)
          importedCount++
        } catch (err) {
          console.warn('Skipped activity:', err)
          skippedCount++
        }
      }
    }
    
    // Import Strava stats
    if (data.stravaStats && Array.isArray(data.stravaStats)) {
      for (const stat of data.stravaStats) {
        try {
          await db.stravaStats.put(stat)
          importedCount++
        } catch (err) {
          console.warn('Skipped stat:', err)
          skippedCount++
        }
      }
    }

    // Import detail cache
    if (data.stravaDetailCache && Array.isArray(data.stravaDetailCache)) {
      for (const item of data.stravaDetailCache) {
        try {
          await db.stravaDetailCache.put(item)
          importedCount++
        } catch (err) {
          console.warn('Skipped detail cache item:', err)
          skippedCount++
        }
      }
    }

    // Import streams cache
    if (data.stravaStreamsCache && Array.isArray(data.stravaStreamsCache)) {
      for (const item of data.stravaStreamsCache) {
        try {
          await db.stravaStreamsCache.put(item)
          importedCount++
        } catch (err) {
          console.warn('Skipped streams cache item:', err)
          skippedCount++
        }
      }
    }

    // Import analytics cache
    if (data.derivedAnalyticsCache && Array.isArray(data.derivedAnalyticsCache)) {
      for (const item of data.derivedAnalyticsCache) {
        try {
          await db.derivedAnalyticsCache.put(item)
          importedCount++
        } catch (err) {
          console.warn('Skipped analytics cache item:', err)
          skippedCount++
        }
      }
    }
    
    console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped`)
    return true
  } catch (error) {
    console.error('Error importing data:', error)
    return false
  }
}
