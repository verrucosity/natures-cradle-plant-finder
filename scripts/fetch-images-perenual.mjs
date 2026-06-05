/**
 * fetch-images-perenual.mjs
 *
 * Fetches plant images from the Perenual API for plants that currently
 * have no image. Processes 90 at a time (free tier = 100 req/day).
 *
 * Key fix: tries cultivar-specific search first, then genus+species,
 * then genus-only — but NEVER reuses the same image URL for multiple
 * plants in the same genus (avoids 10 Arabis cultivars all looking identical).
 *
 * Usage: node scripts/fetch-images-perenual.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir    = dirname(fileURLToPath(import.meta.url));
const DATA     = join(__dir, '../src/data/plants.json');
const PROGRESS = join(__dir, '../src/data/perenual-progress.json');

const API_KEY  = 'sk-hIq06a233375ca2f06294';
const BATCH    = 90;
const DELAY_MS = 420;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getGenus(name) { return name.split(' ')[0].toLowerCase(); }

async function searchPerenual(query) {
  const url = `https://perenual.com/api/species-list?key=${API_KEY}&q=${encodeURIComponent(query)}&page=1`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0' } });
  if (res.status === 429) { console.log('\nRate limited — stopping.'); process.exit(0); }
  if (!res.ok) return null;
  const data = await res.json();
  const best = data?.data?.[0];
  const img  = best?.default_image?.medium_url || best?.default_image?.regular_url || best?.default_image?.small_url;
  return (!img || img.includes('upgrade_plan')) ? null : img;
}

/**
 * Try searches in order of specificity:
 * 1. Full name (with cultivar) e.g. "Arabis caucasica Glacier"
 * 2. Genus + species (first 2 words) e.g. "Arabis caucasica"
 * 3. Genus only e.g. "Arabis" — BUT only if no other plant with same genus already got this URL
 */
async function findImage(plant, usedUrlsByGenus) {
  const words  = plant.name.replace(/['''"]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const genus  = getGenus(plant.name);
  const usedUrls = usedUrlsByGenus.get(genus) || new Set();

  const candidates = [
    plant.name.replace(/['''"]/g, '').trim(),         // full name cleaned
    words.slice(0, 3).join(' '),                       // first 3 words
    words.slice(0, 2).join(' '),                       // genus + species
    words[0],                                          // genus only
  ];

  for (const query of [...new Set(candidates)]) {
    const img = await searchPerenual(query);
    if (!img) continue;
    if (usedUrls.has(img)) continue; // skip — another plant in this genus already has this image
    return img;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const plants  = JSON.parse(readFileSync(DATA, 'utf8'));
const progress = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, 'utf8'))
  : { attempted: [] };

const attempted = new Set(progress.attempted);

// Build a map of genus → Set of image URLs already in use
const usedUrlsByGenus = new Map();
for (const p of plants) {
  if (p.imageUrl) {
    const g = getGenus(p.name);
    if (!usedUrlsByGenus.has(g)) usedUrlsByGenus.set(g, new Set());
    usedUrlsByGenus.get(g).add(p.imageUrl);
  }
}

const needImage = plants.filter(p => !p.imageUrl && !attempted.has(p.id));
console.log(`Plants needing images: ${needImage.length} (${attempted.size} already attempted)`);
if (needImage.length === 0) { console.log('All done!'); process.exit(0); }

const batch = needImage.slice(0, BATCH);
console.log(`Processing batch of ${batch.length}...`);

let hits = 0, misses = 0, skippedDupe = 0;

for (let i = 0; i < batch.length; i++) {
  const plant = batch[i];
  const genus = getGenus(plant.name);

  process.stdout.write(`\r  [${i + 1}/${batch.length}] ${plant.name.substring(0, 50).padEnd(50)}`);

  const imageUrl = await findImage(plant, usedUrlsByGenus);

  if (imageUrl) {
    const idx = plants.findIndex(p => p.id === plant.id);
    if (idx !== -1) plants[idx] = { ...plants[idx], imageUrl };
    // Register this URL as used for this genus
    if (!usedUrlsByGenus.has(genus)) usedUrlsByGenus.set(genus, new Set());
    usedUrlsByGenus.get(genus).add(imageUrl);
    hits++;
  } else {
    misses++;
  }

  attempted.add(plant.id);
  if (i < batch.length - 1) await sleep(DELAY_MS);
}

console.log(`\nDone. Found: ${hits} | Not found: ${misses}`);
console.log(`Remaining: ${needImage.length - batch.length}`);

writeFileSync(DATA, JSON.stringify(plants), 'utf8');
writeFileSync(PROGRESS, JSON.stringify({ attempted: [...attempted] }), 'utf8');
console.log('✓ Saved.');
