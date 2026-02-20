# Strava Integration Architecture

## Overview

This document explains how WayMe integrates with Strava to track exercise activities and calculate calories burned.

## Architecture Components

### 1. Backend (Vercel Serverless Functions)

**Location:** `api/strava/`

#### `api/strava/callback.js`
- **Purpose:** Handles OAuth token exchange after user authorizes the app
- **Endpoint:** `POST /api/strava/callback`
- **Flow:**
  1. Receives authorization code from Strava redirect
  2. Exchanges code for access token using Strava OAuth
  3. Returns tokens to frontend (which stores them in IndexedDB)

#### `api/strava/activities.js`
- **Purpose:** Proxies requests to Strava API (prevents CORS issues)
- **Endpoint:** `GET /api/strava/activities`
- **Flow:**
  1. Receives access token from Authorization header
  2. Fetches activities from Strava API
  3. Returns activity list to frontend

### 2. Frontend (Svelte Components)

#### `src/services/stravaApi.js`
- **Purpose:** JavaScript client for communicating with backend endpoints
- **Methods:**
  - `getAccessToken(code)` - Exchange auth code for tokens
  - `getActivities(token)` - Fetch user's activities
  - `refreshToken(token)` - Refresh expired tokens

#### `src/services/stravaSync.js`
- **Purpose:** Service for auto-fetching and storing activities
- **Key Features:**
  - `autoSync()` - Called on app load, fetches new activities
  - `recalculateStats()` - Updates lifetime statistics
  - `getWeeklyCalories()` - Calculates calories for current week (Sun-Sat)
  - `getActivitiesByType()` - Filter activities by type (Run, Ride, etc.)

#### `src/components/StravaAuth.svelte`
- **Purpose:** OAuth callback page
- **Flow:**
  1. Extracts code from URL
  2. Exchanges code for tokens
  3. Saves to database
  4. Redirects to settings

#### `src/components/Settings.svelte` (Updated)
- **New Features:**
  - "Connect Strava Account" button
  - Shows connected athlete name
  - "Sync Now" button to manually sync
  - Disconnect option

#### `src/components/StravaActivities.svelte`
- **Purpose:** Browse and filter stored activities
- **Features:**
  - View up to 100 recent activities
  - Filter by activity type
  - Sort by date or distance
  - Display stats (miles, minutes, elevation, calories)

#### `src/components/Dashboard.svelte` (Updated)
- **New Card:** "Weekly Exercise" showing calories burned this week
- **Auto-sync:** Calls `stravaSyncService.autoSync()` on app load

### 3. Database (IndexedDB via Dexie)

**Database Name:** `WayMeDB`

#### Tables Added:

**`activities`**
- Fields: `id`, `stravaId`, `name`, `type`, `timestamp`, `distance`, `duration`, `elevation`, `calories`, `heartRate`, etc.
- Primary: `++id`
- Indexes: `timestamp`, `type`

**`stravaStats`**
- Fields: `key` (always 'lifetime'), `totalMiles`, `totalMinutes`, `totalElevationFeet`, `activityCount`, `lastSync`
- Purpose: Stores lifetime aggregate statistics

**`stravaAuth`**
- Fields: `key` (always 'strava'), `accessToken`, `refreshToken`, `expiresAt`, `athlete`
- Purpose: Stores user's OAuth tokens

## Data Flow

### On App Load
```
1. App mounts (App.svelte)
2. Dashboard loads and calls stravaSyncService.autoSync()
3. autoSync() checks if user is authenticated (has tokens)
4. If authenticated:
   - Fetches activities from /api/strava/activities
   - Stores each activity in Dexie
   - Recalculates lifetime stats
   - Updates Dashboard with weekly calories
```

### User Connects Strava
```
1. User clicks "Connect Strava Account" in Settings
2. Frontend redirects to Strava OAuth authorization URL
3. User authorizes WayMe app
4. Strava redirects to: http://localhost:5173/#/auth/strava?code=...
5. StravaAuth.svelte component:
   - Extracts code from URL
   - Calls "/api/strava/callback" with code
   - Backend exchanges code for tokens
   - Frontend stores tokens in Dexie
   - Redirects back to Settings
```

### Weekly Calories Calculation
```
Current Week = Sunday 00:00 to Saturday 23:59 (US standard)
1. Get all activities from Dexie
2. Filter by timestamp (within current week)
3. Sum calories from filtered activities
4. Display on Dashboard
```

## Environment Variables

### Required for Backend (`api/strava/*.js`)
```
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=your_secret_here
STRAVA_REDIRECT_URI=http://localhost:5173/#/auth/strava
```

### Required for Frontend (client code)
```
VITE_STRAVA_CLIENT_ID=123456
```

**Note:** Vercel automatically injects environment variables into serverless functions. Frontend access requires `VITE_` prefix.

## Deployment to Vercel

### 1. Update `.env.local` (Local Development)
```
STRAVA_REDIRECT_URI=http://localhost:5173/#/auth/strava
VITE_STRAVA_CLIENT_ID=204249
```

### 2. Update Strava App Settings
In https://www.strava.com/settings/api, update Authorization Callback Domain:
```
localhost:5173
your-app-name.vercel.app
```

### 3. Deploy to Vercel
```bash
vercel deploy
```

### 4. Set Environment Variables in Vercel Dashboard
1. Go to your Vercel project settings
2. Add environment variables:
   - `STRAVA_CLIENT_SECRET=b2bd8afe...`
   - `STRAVA_CLIENT_ID=204249`
   - `STRAVA_REDIRECT_URI=https://your-app-name.vercel.app/#/auth/strava`
   - `VITE_STRAVA_CLIENT_ID=204249`

## Database Schema

### activities table
```javascript
{
  id: 1,                           // Auto-increment
  stravaId: 9876543210,
  name: "Morning Run",
  type: "Run",                     // Run, Ride, Swim, Walk, etc.
  timestamp: 1708358400000,        // Unix milliseconds
  startDate: "2024-02-19T09:00:00Z",
  distance: 5000,                  // Meters
  duration: 1800,                  // Seconds
  elevation: 50,                   // Meters
  calories: 450,
  heartRate: 145,
  movingTime: 1740,
  averageSpeed: 2.78,              // m/s
  maxSpeed: 5.2,
  raw: { ...full Strava response... }
}
```

### stravaStats table
```javascript
{
  key: "lifetime",
  totalMiles: 125.5,
  totalMinutes: 12450,
  totalElevationFeet: 2500,
  activityCount: 42,
  lastSync: 1708358400000,
  updatedAt: 1708358400000
}
```

### stravaAuth table
```javascript
{
  key: "strava",
  accessToken: "e7eb2b87...",
  refreshToken: "223561c1...",
  expiresAt: 1708444800000,
  athlete: {
    firstname: "John",
    lastname: "Doe",
    profile: "https://...",
    ...
  },
  savedAt: 1708358400000
}
```

## Future Enhancements

- [ ] Token refresh endpoint (`api/strava/refresh.js`)
- [ ] More granular filtering (by date range, distance, etc.)
- [ ] Activity details page
- [ ] Comparison of weight loss vs exercise calories
- [ ] Weekly/monthly activity summaries
- [ ] Export activities as CSV
- [ ] Webhook support for real-time activity sync

## Troubleshooting

### "Not recognized as an internal command" when running `npm run dev`
- Run `npm install` to ensure all dependencies are installed

### "No activities synced yet"
- Check that .env.local has STRAVA_CLIENT_ID set
- Verify you've clicked "Connect Strava Account" in Settings
- Check browser console for errors

### Activities not updating
- Click "Sync Now" button in Settings
- Check that your Strava token hasn't expired
- Verify `/api/strava/activities` endpoint is working (check server logs)

### CORS errors
- The backend proxy endpoint should be at `/api/strava/activities`
- Make sure the Authorization header is being sent correctly

## API Response Examples

### GET /api/strava/activities
```json
{
  "activities": [
    {
      "id": 9876543210,
      "name": "Morning Run",
      "type": "Run",
      "start_date": "2024-02-19T09:00:00Z",
      "distance": 5000,
      "elapsed_time": 1800,
      "total_elevation_gain": 50,
      "calories": 450,
      "average_heartrate": 145,
      "moving_time": 1740,
      "average_speed": 2.78,
      "max_speed": 5.2
    }
  ],
  "count": 1,
  "timestamp": "2024-02-19T14:30:00Z"
}
```

### POST /api/strava/callback
**Request:**
```json
{
  "code": "abc123def456"
}
```

**Response:**
```json
{
  "accessToken": "e7eb2b87...",
  "refreshToken": "223561c1...",
  "expiresIn": 86400,
  "expiresAt": 1708444800000,
  "athlete": {
    "firstname": "John",
    "lastname": "Doe",
    "id": 123,
    "profile": "https://..."
  }
}
```
