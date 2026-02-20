/**
 * Polyline encoding/decoding utilities for Strava summary_polyline
 * Based on Google's Encoded Polyline Algorithm Format
 */

/**
 * Decode an encoded polyline string to an array of [lat, lng] coordinates
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<{lat: number, lng: number}>} Array of coordinates
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return poly;
}

/**
 * Generate a static map URL for a polyline
 * Uses a simple approach with center and zoom
 * @param {string} encodedPolyline - Encoded polyline from Strava
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {string} Static map URL
 */
export function getStaticMapUrl(encodedPolyline, width = 300, height = 200) {
  if (!encodedPolyline) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
  }

  // Decode polyline to get coordinates
  const coords = decodePolyline(encodedPolyline);
  
  if (coords.length === 0) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
  }

  // Calculate bounding box
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Calculate zoom level based on bounds
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);
  
  let zoom = 15;
  if (maxDiff > 0.1) zoom = 11;
  else if (maxDiff > 0.05) zoom = 12;
  else if (maxDiff > 0.02) zoom = 13;
  else if (maxDiff > 0.01) zoom = 14;

  // Use OpenStreetMap tile server via staticmap.openstreetmap.de
  // Format: center, zoom, size
  const pathString = coords.map(c => `${c.lat},${c.lng}`).join('|');
  
  // Use a simple tile-based static map service
  // Alternative: Use Mapbox Static API with a token
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path-2+f44-0.5(${encodeURIComponent('enc:' + encodedPolyline)})/${centerLng},${centerLat},${zoom},0/${width}x${height}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
  
  return url;
}

/**
 * Generate an SVG visualization of the route
 * @param {string} encodedPolyline - Encoded polyline from Strava
 * @param {number} width - SVG width
 * @param {number} height - SVG height  
 * @returns {string} SVG string
 */
export function generateRouteSvg(encodedPolyline, width = 300, height = 200) {
  if (!encodedPolyline) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="#999">No route data</text></svg>`;
  }

  const coords = decodePolyline(encodedPolyline);
  
  if (coords.length === 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/></svg>`;
  }

  // Calculate bounding box
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); 
  const maxLng = Math.max(...lngs);

  const padding = 10;
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  // Convert lat/lng to SVG coordinates
  const toSvgX = (lng) => padding + ((lng - minLng) / lngRange) * (width - 2 * padding);
  const toSvgY = (lat) => height - padding - ((lat - minLat) / latRange) * (height - 2 * padding);

  // Build SVG path
  const pathData = coords.map((coord, i) => {
    const x = toSvgX(coord.lng);
    const y = toSvgY(coord.lat);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #f9fafb;">
    <path d="${pathData}" stroke="#FC4C02" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${toSvgX(coords[0].lng)}" cy="${toSvgY(coords[0].lat)}" r="5" fill="#10b981"/>
    <circle cx="${toSvgX(coords[coords.length-1].lng)}" cy="${toSvgY(coords[coords.length-1].lat)}" r="5" fill="#ef4444"/>
  </svg>`;
}
