/**
 * fetch-images.mjs
 * Fetches Wikipedia thumbnail URLs for every plant in plants.json
 * and writes plants-with-images.json alongside it.
 *
 * Strategy per plant name:
 *   1. Strip cultivar markers ('…') → "Abelia 'Edward Goucher'" → "Abelia Edward Goucher"
 *   2. Try that full cleaned name on Wikipedia
 *   3. Fall back to first two words (genus + species epithet)
 *   4. Fall back to first word (genus only)
 *
 * Wikipedia pageimages API: up to 50 titles per request.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_IN  = join(__dir, '../src/data/plants.json');
const DATA_OUT = join(__dir, '../src/data/plants.json'); // overwrite in place

const THUMB_SIZE = 500;
const BATCH      = 50;
const DELAY_MS   = 120; // ~8 req/s, well within Wikipedia limits

const plants = JSON.parse(readFileSync(DATA_IN, 'utf8'));

// ── helpers ──────────────────────────────────────────────────────────────────

function candidates(name) {
  // Remove cultivar quotes, extra descriptors
  const cleaned = name
    .replace(/['']/g, '')          // curly / straight quotes
    .replace(/["]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  const c = [];

  // Full cleaned name
  c.push(cleaned);

  // Genus + species (first 2 words) if name is longer
  if (words.length > 2) c.push(words.slice(0, 2).join(' '));

  // Genus only
  if (words.length > 1) c.push(words[0]);

  // Deduplicate
  return [...new Set(c)];
}

async function fetchImages(titles) {
  // titles: string[]  (max 50)
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action',      'query');
  url.searchParams.set('titles',      titles.join('|'));
  url.searchParams.set('prop',        'pageimages');
  url.searchParams.set('pithumbsize', String(THUMB_SIZE));
  url.searchParams.set('format',      'json');
  url.searchParams.set('origin',      '*');

  const res  = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0 (verrucosity@gmail.com)' }
  });
  const data = await res.json();
  const pages = data?.query?.pages ?? {};

  // Return map: normalised title (lower) → thumb url | null
  const out = {};
  for (const page of Object.values(pages)) {
    const key = (page.title ?? '').toLowerCase();
    out[key] = page.thumbnail?.source ?? null;
  }
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`Processing ${plants.length} plants…`);

// Build per-plant candidate list
const plantCandidates = plants.map(p => candidates(p.name));

// Collect every unique candidate title we'll ever need to look up
const allTitles = [...new Set(plantCandidates.flat())];
console.log(`Unique Wikipedia titles to query: ${allTitles.length}`);

// Fetch in batches
const imageMap = {}; // title.lower → url | null

for (let i = 0; i < allTitles.length; i += BATCH) {
  const batch = allTitles.slice(i, i + BATCH);
  const results = await fetchImages(batch);
  Object.assign(imageMap, results);

  const done = Math.min(i + BATCH, allTitles.length);
  process.stdout.write(`\r  Fetched ${done}/${allTitles.length} titles…`);

  if (done < allTitles.length) await sleep(DELAY_MS);
}
console.log('\nAll batches complete.');

// Assign best image to each plant
let hits = 0, misses = 0;

const updated = plants.map((p, idx) => {
  const cands = plantCandidates[idx];
  let imageUrl = null;

  for (const c of cands) {
    const url = imageMap[c.toLowerCase()];
    if (url) { imageUrl = url; break; }
  }

  if (imageUrl) hits++; else misses++;
  return { ...p, imageUrl };
});

console.log(`Images found: ${hits}  |  No image: ${misses}`);

// Write output
writeFileSync(DATA_OUT, JSON.stringify(updated), 'utf8');
console.log(`✓ Wrote ${DATA_OUT}`);
