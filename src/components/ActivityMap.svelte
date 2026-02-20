<script>
  import { onMount, onDestroy } from 'svelte'
  import { decodePolyline } from '../utils/polyline.js'
  
  export let polyline = ''
  export let height = 300
  
  let mapContainer
  let map
  let mapId = `map-${Math.random().toString(36).substr(2, 9)}`
  let error = null
  
  onMount(async () => {
    try {
      // Dynamically import Leaflet to avoid SSR issues
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      
      if (!polyline || !mapContainer) return
      
      const coords = decodePolyline(polyline)
      if (coords.length === 0) {
        error = 'No route data available'
        return
      }
      
      // Validate coordinates
      const validCoords = coords.filter(c => 
        c && typeof c.lat === 'number' && typeof c.lng === 'number' &&
        !isNaN(c.lat) && !isNaN(c.lng) &&
        c.lat >= -90 && c.lat <= 90 &&
        c.lng >= -180 && c.lng <= 180
      )
      
      if (validCoords.length === 0) {
        error = 'Invalid route coordinates'
        return
      }
      
      // Initialize map
      map = L.map(mapContainer, {
        zoomControl: true,
        attributionControl: true
      })
      
      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map)
      
      // Convert coords to Leaflet LatLng format and create polyline
      const latLngs = validCoords.map(coord => L.latLng(coord.lat, coord.lng))
      const routeLine = L.polyline(latLngs, {
        color: '#ff6b35',
        weight: 3,
        opacity: 0.8
      }).addTo(map)
      
      // Add start marker (green)
      if (latLngs.length > 0) {
        L.circleMarker(latLngs[0], {
          radius: 6,
          fillColor: '#10b981',
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).addTo(map)
      }
      
      // Add end marker (red)
      if (latLngs.length > 1) {
        L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 6,
          fillColor: '#ef4444',
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).addTo(map)
      }
      
      // Fit bounds to show entire route with validation
      const bounds = routeLine.getBounds()
      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [20, 20]
        })
      } else if (latLngs.length > 0) {
        // Fallback to center on first point
        map.setView(latLngs[0], 13)
      }
    } catch (err) {
      console.error('Map error:', err)
      error = 'Failed to load map'
    }
  })
  
  onDestroy(() => {
    if (map) {
      map.remove()
      map = null
    }
  })
</script>

<div>
  {#if error}
    <div class="bg-gray-100 border border-gray-300 rounded p-3 text-center text-sm text-gray-600">
      📍 {error}
    </div>
  {:else}
    <div 
      id={mapId}
      bind:this={mapContainer} 
      style="width: 100%; height: {height}px; border-radius: 0.5rem;"
      class="border border-base-300"
    ></div>
  {/if}
</div>

<style>
  :global(.leaflet-container) {
    border-radius: 0.5rem;
  }
</style>
