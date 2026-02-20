/**
 * Strava Sync Service
 * Handles automatic syncing of Strava activities on app load
 * Calculates and stores lifetime statistics
 */

import {
  getStravaAuth,
  saveActivity,
  getActivities,
  updateStravaStats,
  getStravaStats,
  getWeights
} from '../db.js'

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

      // Check if token is expired
      if (auth.expiresAt && auth.expiresAt < Date.now()) {
        console.log('Strava token expired, user needs to re-authenticate')
        // TODO: Implement token refresh
        return false
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
   * Pulls 10 years of history backwards from today
   */
  async fetchAndStoreActivities(accessToken) {
    try {
      // Calculate 10 years ago timestamp
      const tenYearsAgo = Math.floor((Date.now() - (10 * 365 * 24 * 60 * 60 * 1000)) / 1000)
      const now = Math.floor(Date.now() / 1000)
      
      let page = 1
      let totalSaved = 0
      let hasMore = true
      const perPage = 200 // Max allowed by Strava

      console.log(`Fetching Strava activities from last 10 years...`)

      while (hasMore) {
        // Fetch from backend (which proxies to Strava)
        const response = await fetch(
          `/api/strava/activities?page=${page}&per_page=${perPage}&after=${tenYearsAgo}&before=${now}`,
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

        if (activities.length === 0) {
          hasMore = false
          break
        }

        // Save each activity to database with calculated calories
        for (const activity of activities) {
          const saved = await saveActivity(activity)
          if (saved) totalSaved++
        }

        console.log(`Page ${page}: Saved ${activities.length} activities (Total: ${totalSaved})`)

        // If we got fewer than perPage, we're done
        if (activities.length < perPage) {
          hasMore = false
        } else {
          page++
        }
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
      return stats
    } catch (error) {
      console.error('Error recalculating stats:', error)
      return null
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
