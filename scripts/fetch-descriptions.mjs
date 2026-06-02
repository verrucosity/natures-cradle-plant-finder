/**
 * fetch-descriptions.mjs
 *
 * Fetches accurate, complete plant descriptions from Wikipedia for all 4016 plants.
 * Uses the same title-candidate strategy as fetch-images.mjs:
 *   1. Full cleaned name  (e.g. "Abelia Edward Goucher")
 *   2. Genus + species    (e.g. "Abelia")
 *   3. Genus only
 *
 * Wikipedia extracts API: up to 20 titles per request (extracts can be large).
 * Uses exsentences=4 + explaintext to get clean plain-text paragraphs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const DATA   = join(__dir, '../src/data/plants.json');

const BATCH    = 20;
const DELAY_MS = 150;
const MAX_CHARS = 500; // trim very long extracts

const plants = JSON.parse(readFileSync(DATA, 'utf8'));

// ── helpers ──────────────────────────────────────────────────────────────────

function candidates(name) {
  const cleaned = name
    .replace(/[''""]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ');
  const c = [cleaned];
  if (words.length > 2) c.push(words.slice(0, 2).join(' '));
  if (words.length > 1) c.push(words[0]);
  return [...new Set(c)];
}

function cleanExtract(text) {
  if (!text) return null;
  // Strip any leftover HTML
  text = text.replace(/<[^>]+>/g, '').trim();
  // Remove Wikipedia-style parenthetical pronunciation guides
  text = text.replace(/\s*\(\/[^)]+\/\)/g, '');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Trim to MAX_CHARS at a sentence boundary
  if (text.length > MAX_CHARS) {
    const cut = text.lastIndexOf('. ', MAX_CHARS);
    text = cut > 100 ? text.slice(0, cut + 1) : text.slice(0, MAX_CHARS) + '…';
  }
  return text || null;
}

async function fetchExtracts(titles) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action',      'query');
  url.searchParams.set('titles',      titles.join('|'));
  url.searchParams.set('prop',        'extracts');
  url.searchParams.set('exintro',     '1');
  url.searchParams.set('exsentences', '4');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('format',      'json');
  url.searchParams.set('origin',      '*');

  const res  = await fetch(url.toString(), {
    headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0 (verrucosity@gmail.com)' }
  });
  const data = await res.json();
  const pages = data?.query?.pages ?? {};

  // Build map: normalised title (lower) → cleaned extract | null
  const out = {};
  for (const page of Object.values(pages)) {
    const key = (page.title ?? '').toLowerCase();
    out[key] = cleanExtract(page.extract);
  }
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`Processing ${plants.length} plants…`);

const plantCandidates = plants.map(p => candidates(p.name));
const allTitles = [...new Set(plantCandidates.flat())];
console.log(`Unique Wikipedia titles to query: ${allTitles.length}`);

// Fetch all extracts in batches
const extractMap = {};

for (let i = 0; i < allTitles.length; i += BATCH) {
  const batch = allTitles.slice(i, i + BATCH);
  const results = await fetchExtracts(batch);
  Object.assign(extractMap, results);

  const done = Math.min(i + BATCH, allTitles.length);
  process.stdout.write(`\r  Fetched ${done}/${allTitles.length} titles…`);
  if (done < allTitles.length) await sleep(DELAY_MS);
}
console.log('\nAll batches complete.');

// Assign best description to each plant
let wikiHits = 0, kept = 0;

const updated = plants.map((p, idx) => {
  const cands = plantCandidates[idx];
  let newDesc = null;

  for (const c of cands) {
    const ex = extractMap[c.toLowerCase()];
    if (ex && ex.length > 40) { newDesc = ex; break; }
  }

  if (newDesc) {
    wikiHits++;
    return { ...p, desc: newDesc };
  } else {
    // Keep existing description but remove the hard truncation artifact
    kept++;
    const existing = (p.desc || '').replace(/…$/, '').trim();
    return { ...p, desc: existing || `${p.name} is a ${p.category.toLowerCase()} in the Nature's Cradle collection.` };
  }
});

console.log(`Wikipedia descriptions: ${wikiHits}  |  Kept/fallback: ${kept}`);

writeFileSync(DATA, JSON.stringify(updated), 'utf8');
console.log(`✓ Written to ${DATA}`);
