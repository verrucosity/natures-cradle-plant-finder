/**
 * lib/growers/index.js
 * Registry of all grower scraper adapters.
 * To add a new grower: create lib/growers/<id>.js implementing
 * { id, name, fetchEntries(log) } and register it here, then add a cron
 * entry in vercel.json pointing at /api/scrape?grower=<id>.
 */

import hardscrabble from './hardscrabble.js';

const ADAPTERS = [
  hardscrabble,
  // colesville — waiting on credentials
  // waverly    — waiting on credentials
  // prides-corner, imperial-nurseries, ... — see grower-directory.json
];

export function getAdapter(id) {
  return ADAPTERS.find(a => a.id === id) || null;
}

export function listAdapters() {
  return ADAPTERS.map(a => ({ id: a.id, name: a.name }));
}
