/**
 * fetch-images-perenual.mjs
 *
 * Fetches plant images from the Perenual API for plants that currently
 * have no image (Wikipedia didn't find them).
 *
 * Free tier = 100 req/day, so this script processes 90 at a time and
 * saves progress — run it daily until all gaps are filled.
 *
 * Usage: node scripts/fetch-images-perenual.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir    = dirname(fileURLToPath(import.meta.url));
const DATA     = join(__dir, '../src/data/plants.json');
const PROGRESS = join(__dir, '../src/data/perenual-progress.json');

const API_KEY   = 'sk-hIq06a233375ca2f06294';
const BATCH     = 90;   // stay under 100/day limit
const DELAY_MS  = 400;  // ~2.5 req/s to be polite

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanName(name) {
  // Strip cultivar part for better API matches
  // e.g. "Abelia 'Edward Goucher'" → "Abelia"
  // e.g. "Acer palmatum 'Bloodgood'" → "Acer palmatum"
  return name
    .replace(/\s*['''][^''']+[''']/, '')  // remove cultivar in quotes
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchPerenual(name) {
  const url = `https://perenual.com/api/species-list?key=${API_KEY}&q=${encodeURIComponent(name)}&page=1`;
  const res  = await fetch(url, {
    headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0' }
  });

  if (res.status === 429) { console.log('Rate limited — stopping for today.'); return null; }
  if (!res.ok) return null;

  const data = await res.json();
  // Return the first result's image if it exists and isn't an upgrade-required URL
  const best = data?.data?.[0];
  const img  = best?.default_image?.medium_url || best?.default_image?.regular_url || best?.default_image?.small_url;
  if (!img || img.includes('upgrade_plan')) return null;
  return img;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const plants = JSON.parse(readFileSync(DATA, 'utf8'));

// Load progress (set of plant IDs already attempted via Perenual)
const progress = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, 'utf8'))
  : { attempted: [] };

const attempted = new Set(progress.attempted);

// Find plants still needing an image
const needImage = plants.filter(p => !p.imageUrl && !attempted.has(p.id));
console.log(`Plants needing images: ${needImage.length} (${attempted.size} already attempted)`);

if (needImage.length === 0) {
  console.log('All done! Every plant has been attempted.');
  process.exit(0);
}

const batch = needImage.slice(0, BATCH);
console.log(`Processing batch of ${batch.length}...`);

let hits = 0, misses = 0;

for (let i = 0; i < batch.length; i++) {
  const plant = batch[i];
  const query = cleanName(plant.name);

  process.stdout.write(`\r  [${i + 1}/${batch.length}] ${plant.name.substring(0, 50).padEnd(50)}`);

  const imageUrl = await searchPerenual(query);

  if (imageUrl) {
    // Find and update in main array
    const idx = plants.findIndex(p => p.id === plant.id);
    if (idx !== -1) plants[idx] = { ...plants[idx], imageUrl };
    hits++;
  } else {
    misses++;
  }

  attempted.add(plant.id);
  if (i < batch.length - 1) await sleep(DELAY_MS);
}

console.log(`\nDone. Found: ${hits} | Not found: ${misses}`);
console.log(`Remaining after today: ${needImage.length - batch.length}`);

// Save updated plants + progress
writeFileSync(DATA, JSON.stringify(plants), 'utf8');
writeFileSync(PROGRESS, JSON.stringify({ attempted: [...attempted] }), 'utf8');
console.log('✓ Saved plants.json and progress file.');
