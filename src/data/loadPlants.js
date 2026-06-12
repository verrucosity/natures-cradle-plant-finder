/**
 * loadPlants.js
 * Loads the plant catalog as a separately-cached static asset instead of
 * bundling 6MB of JSON into the JS bundle. The ?url import makes Vite emit
 * plants.json as a hashed asset; we fetch it once and share the promise.
 */
import plantsUrl from './plants.json?url';

let promise = null;

export function loadPlants() {
  if (!promise) {
    promise = fetch(plantsUrl).then(r => {
      if (!r.ok) throw new Error('Failed to load plant catalog');
      return r.json();
    });
  }
  return promise;
}
