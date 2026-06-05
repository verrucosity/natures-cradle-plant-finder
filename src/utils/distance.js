/**
 * distance.js
 * Zip code → coordinates lookup + haversine distance calculator.
 * Uses the free zippopotam.us API (no key required).
 */

const cache = new Map(); // in-memory cache for zip lookups

export async function zipToCoords(zip) {
  if (cache.has(zip)) return cache.get(zip);
  try {
    const res  = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    const coords = {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      city: place['place name'],
      state: place['state abbreviation'],
    };
    cache.set(zip, coords);
    return coords;
  } catch {
    return null;
  }
}

/**
 * Haversine distance between two lat/lng points in miles.
 */
export function haversineDistance(a, b) {
  const R   = 3958.8; // Earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * Returns distance in miles between two zip codes.
 * Returns null if either zip can't be resolved.
 */
export async function distanceBetweenZips(zip1, zip2) {
  const [c1, c2] = await Promise.all([zipToCoords(zip1), zipToCoords(zip2)]);
  if (!c1 || !c2) return null;
  return haversineDistance(c1, c2);
}
