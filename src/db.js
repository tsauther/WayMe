import Dexie from 'dexie'

// Initialize Dexie database
export const db = new Dexie('WayMeDB')

db.version(1).stores({
  weights: '++id, timestamp',
  settings: 'key'
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

export async function exportData() {
  try {
    const weights = await db.weights.toArray()
    const settings = await db.settings.toArray()
    return JSON.stringify({ weights, settings }, null, 2)
  } catch (error) {
    console.error('Error exporting data:', error)
    return null
  }
}
