/**
 * Strava Sync Service
 * Handles automatic syncing of Strava activities on app load
 * Calculates and stores lifetime statistics
 */

import {
  getStravaAuth,
  saveStravaAuth,
  saveActivity,
  getActivities,
  updateStravaStats,
  getStravaStats,
  getWeights,
  saveWeeklyExercise
} from '../db.js'
import { stravaApi } from './stravaApi.js'

class StravaSyncService {
  constructor() {
    this.isSyncing = false
    this.lastSyncTime = null
  }

  /**
   * Auto-sync on app load
   * Fetches latest activities if user is authenticated
   */
  async autoSync() {
    // Don't sync if already syncing
    if (this.isSyncing) {
      console.log('Sync already in progress')
      return false
    }

    try {
      this.isSyncing = true
      const auth = await getStravaAuth()

      if (!auth || !auth.accessToken) {
        console.log('No Strava authentication found')
        return false
      }

      // Check if token is expired and refresh if needed
      if (auth.expiresAt && auth.expiresAt < Date.now()) {
        console.log('Strava token expired, attempting refresh...')
        try {
          const refreshed = await stravaApi.refreshToken(auth.refreshToken)
          if (refreshed && refreshed.accessToken) {
            // Update stored auth with new token
            await saveStravaAuth({
              ...auth,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken || auth.refreshToken,
              expiresAt: refreshed.expiresAt,
              expiresIn: refreshed.expiresIn
            })
            console.log('Token refreshed successfully')
            auth.accessToken = refreshed.accessToken
            auth.expiresAt = refreshed.expiresAt
          } else {
            throw new Error('No new token returned')
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          console.log('User needs to re-authenticate')
          return false
        }
      }
      
      console.log('Starting Strava sync...')
      const success = await this.fetchAndStoreActivities(auth.accessToken)
      
      if (success) {
        this.lastSyncTime = Date.now()
        console.log('Strava sync completed successfully')
      }

      return success
    } catch (error) {
      console.error('Auto-sync error:', error)
      return false
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Fetch activities from backend and store them
   * Pulls activities from newest to oldest with pagination
   */
  async fetchAndStoreActivities(accessToken) {
    try {
      let page = 1
      let totalSaved = 0
      let hasMore = true
      const perPage = 200 // Max allowed by Strava

      console.log(`Fetching Strava activities (newest first)...`)

      while (hasMore && page <= 50) { // Limit to 50 pages (10,000 activities max)
        console.log(`========== Fetching page ${page} ==========`)
        
        // Fetch from backend (which proxies to Strava)
        // Strava returns newest first by default
        const response = await fetch(
          `/api/strava/activities?page=${page}&per_page=${perPage}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to fetch activities:', error)
          return false
        }

        const data = await response.json()
        const activities = data.activities || []

        console.log(`Received ${activities.length} activities`)

        if (activities.length === 0) {
          console.log('No more activities to fetch - breaking loop')
          hasMore = false
          break
        }

        // Log activity dates for debugging
        const actDates = activities.map(a => new Date(a.start_date).toISOString().split('T')[0]).join(', ')
        console.log(`Page ${page}: ${activities.length} activities [${actDates}]`)
        
        // CRITICAL DEBUG: Show first and last activity 
        if (activities.length > 0) {
          const first = activities[0]
          const last = activities[activities.length - 1]
          console.log(`  First activity: "${first.name}" on ${first.start_date} (id: ${first.id})`)
          console.log(`  Last activity: "${last.name}" on ${last.start_date} (id: ${last.id})`)
          const firstDate = new Date(first.start_date).getTime()
          const lastDate = new Date(last.start_date).getTime()
          if (firstDate < lastDate) {
            console.log(`  WARNING: Activities are in ASCENDING order (oldest first)!`)
          } else {
            console.log(`  ✓ Activities are in DESCENDING order (newest first)`)
          }
        }

        // Save each activity to database with calculated calories
        let savedCount = 0
        for (const activity of activities) {
          const saved = await saveActivity(activity)
          if (saved) {
            savedCount++
            totalSaved++
          }
        }

        console.log(`Page ${page}: Saved ${savedCount}/${activities.length} activities (Total saved: ${totalSaved})`)  

        // If we got fewer than perPage, we're done
        if (activities.length < perPage) {
          console.log(`Got ${activities.length} < ${perPage}, setting hasMore = false`)
          hasMore = false
        } else {
          console.log(`Got ${activities.length} == ${perPage}, incrementing page to ${page + 1}`)
          page++
        }
        console.log(`========== End of page ${page - 1} ==========\n`)
      }

      console.log(`Sync complete! Saved ${totalSaved} total activities`)

      // Recalculate lifetime stats
      await this.recalculateStats()

      return true
    } catch (error) {
      console.error('Error fetching/storing activities:', error)
      return false
    }
  }

  /**
   * Recalculate lifetime statistics from all activities
   */
  async recalculateStats() {
    try {
      const activities = await getActivities(1000) // Get up to 1000 activities
      
      let totalMeters = 0
      let totalSeconds = 0
      let totalElevationMeters = 0
      let activityCount = activities.length

      for (const activity of activities) {
        totalMeters += activity.distance || 0
        totalSeconds += activity.duration || 0
        totalElevationMeters += activity.elevation || 0
      }

      // Convert to imperial
      const totalMiles = (totalMeters / 1609.34).toFixed(2)
      const totalMinutes = Math.round(totalSeconds / 60)
      const totalElevationFeet = (totalElevationMeters * 3.28084).toFixed(0)

      const stats = {
        totalMiles: parseFloat(totalMiles),
        totalMinutes,
        totalElevationFeet: parseFloat(totalElevationFeet),
        activityCount,
        lastSync: Date.now()
      }

      await updateStravaStats(stats)
      console.log('Stats updated:', stats)

      // Also calculate and store weekly exercise data
      await this.calculateWeeklyExercise(activities)

      return stats
    } catch (error) {
      console.error('Error recalculating stats:', error)
      return null
    }
  }

  /**
   * Calculate and store weekly exercise calories for all weeks in activity history
   */
  async calculateWeeklyExercise(activities) {
    try {
      // Sort activities by timestamp (oldest first)
      const sortedActivities = activities.sort((a, b) => a.timestamp - b.timestamp)

      // Group activities by week (Sunday start)
      const weeks = new Map()

      for (const activity of sortedActivities) {
        const actDate = new Date(activity.timestamp)
        const dayOfWeek = actDate.getDay()
        const weekStart = new Date(actDate)
        weekStart.setDate(actDate.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)

        const weekStartTime = weekStart.getTime()

        if (!weeks.has(weekStartTime)) {
          weeks.set(weekStartTime, 0)
        }

        const currentCalories = weeks.get(weekStartTime)
        weeks.set(weekStartTime, currentCalories + (activity.calories || 0))
      }

      // Save each week's data
      for (const [weekStartTime, calories] of weeks) {
        await saveWeeklyExercise(weekStartTime, Math.round(calories))
      }

      console.log(`Calculated and saved ${weeks.size} weeks of exercise data`)
    } catch (error) {
      console.error('Error calculating weekly exercise:', error)
    }
  }

  /**
   * Get weekly calories burned (Sunday through Saturday)
   * @returns {number} Estimated calories for current week
   */
  async getWeeklyCalories() {
    try {
      const activities = await getActivities(500)
      
      // Get current week: Sunday 00:00 to Saturday 23:59
      const today = new Date()
      const dayOfWeek = today.getDay()
      const Sunday = new Date(today)
      Sunday.setDate(today.getDate() - dayOfWeek)
      Sunday.setHours(0, 0, 0, 0)
      
      const sundayTime = Sunday.getTime()
      const saturdayTime = sundayTime + 7 * 24 * 60 * 60 * 1000

      let weeklyCalories = 0

      for (const activity of activities) {
        if (activity.timestamp >= sundayTime && activity.timestamp < saturdayTime) {
          weeklyCalories += activity.calories || 0
        }
      }

      return weeklyCalories
    } catch (error) {
      console.error('Error calculating weekly calories:', error)
      return 0
    }
  }

  /**
   * Get activities for a specific type (e.g., "Run", "Ride")
   */
  async getActivitiesByType(type) {
    try {
      const activities = await getActivities(1000)
      return activities.filter(a => a.type === type)
    } catch (error) {
      console.error('Error filtering activities by type:', error)
      return []
    }
  }
}

export const stravaSyncService = new StravaSyncService()
