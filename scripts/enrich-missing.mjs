/**
 * enrich-missing.mjs
 *
 * For plants missing desc/zones/light, queries Perenual by genus (up to 30 results
 * per request) to fill: description, zones, light, water, maintenance, image.
 * Falls back to Wikipedia for descriptions when Perenual has nothing useful.
 *
 * Processes 85 genus queries per run (stays under 100 req/day free tier).
 * Run multiple times; progress saved to src/data/enrich-progress.json.
 *
 * Usage: node scripts/enrich-missing.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir    = dirname(fileURLToPath(import.meta.url));
const DATA     = join(__dir, '../src/data/plants.json');
const PROGRESS = join(__dir, '../src/data/enrich-progress.json');

const API_KEY  = process.env.PERENUAL_API_KEY;
const BATCH    = 85;   // genus queries per run
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Perenual helpers ───────────────────────────────────────────────────────────

const WATER_MAP = {
  frequent: 'High',
  average:  'Moderate',
  minimum:  'Low',
  none:     'Very Low',
};

const LIGHT_MAP = {
  'full sun':       'Full Sun',
  'part shade':     'Part Shade',
  'part sun/part shade': 'Part Shade',
  'filtered shade': 'Part Shade',
  'deep shade':     'Full Shade',
  'full shade':     'Full Shade',
};

function mapLight(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(s => LIGHT_MAP[s?.toLowerCase()] || null).filter(Boolean))];
}

function mapZones(hardiness) {
  if (!hardiness) return [];
  const min = parseInt(hardiness.min) || 0;
  const max = parseInt(hardiness.max) || 0;
  if (!min && !max) return [];
  const zones = [];
  for (let z = Math.max(1, min); z <= Math.min(13, max); z++) zones.push(`Zone ${z}`);
  return zones;
}

function mapWater(w) {
  const v = WATER_MAP[(w || '').toLowerCase()];
  return v ? [v] : [];
}

// Normalize name for fuzzy comparison
function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[''`'']/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0' } });
      if (res.status === 429) { console.log('\nRate limited — stopping.'); return null; }
      if (!res.ok) return { status: res.status };
      return res;
    } catch {
      if (i < retries - 1) await sleep(1500 * (i + 1));
    }
  }
  return { error: true };
}

async function queryGenus(genus, page = 1) {
  const url = `https://perenual.com/api/species-list?key=${API_KEY}&q=${encodeURIComponent(genus)}&page=${page}`;
  const res  = await fetchWithRetry(url);
  if (!res || res.error || res.status) return res === null ? null : [];
  const data = await res.json();
  return data?.data || [];
}

// ── Wikipedia fallback ─────────────────────────────────────────────────────────

async function wikiDesc(name) {
  try {
    // Use search first to get the right page title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' plant')}&srlimit=1&format=json&origin=*`;
    const sRes = await fetchWithRetry(searchUrl);
    if (!sRes || sRes.error || sRes.status) return null;
    const sData = await sRes.json();
    const title  = sData?.query?.search?.[0]?.title;
    if (!title) return null;

    // Fetch the extract for that title
    const extUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const eRes = await fetchWithRetry(extUrl);
    if (!eRes || eRes.error || eRes.status) return null;
    const eData = await eRes.json();
    const extract = eData?.extract || '';
    if (!extract || extract.length < 60) return null;
    if (extract.includes('may refer to') || extract.includes('disambiguation')) return null;
    // Skip if it's about something completely unrelated (no botanical terms)
    const botTerms = /plant|shrub|tree|flower|genus|species|perennial|annual|native|cultivar|garden|leaf|bloom|grow/i;
    if (!botTerms.test(extract)) return null;
    return extract;
  } catch { return null; }
}

// ── Main ───────────────────────────────────────────────────────────────────────

const plants   = JSON.parse(readFileSync(DATA, 'utf8'));
const progress = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, 'utf8'))
  : { doneGenera: [] };

const doneGenera = new Set(progress.doneGenera);

// Find plants that need enrichment
const needWork = plants.filter(p =>
  !p.desc || !p.zones?.length || !p.light?.length
);
console.log(`Plants needing enrichment: ${needWork.length}`);

// Group by genus
const byGenus = new Map();
for (const p of needWork) {
  const g = p.name.split(' ')[0].toLowerCase();
  if (doneGenera.has(g)) continue;
  if (!byGenus.has(g)) byGenus.set(g, []);
  byGenus.get(g).push(p);
}
console.log(`Unique genera to process: ${byGenus.size}`);

// Build image URL dedup map
const usedUrlsByGenus = new Map();
for (const p of plants) {
  if (p.imageUrl) {
    const g = p.name.split(' ')[0].toLowerCase();
    if (!usedUrlsByGenus.has(g)) usedUrlsByGenus.set(g, new Set());
    usedUrlsByGenus.get(g).add(p.imageUrl);
  }
}

const genera = [...byGenus.keys()].slice(0, BATCH);
console.log(`Processing ${genera.length} genera this run...\n`);

let enriched = 0;
let wikiHits  = 0;

for (let gi = 0; gi < genera.length; gi++) {
  const genus    = genera[gi];
  const genusPlants = byGenus.get(genus);
  process.stdout.write(`\r[${gi + 1}/${genera.length}] ${genus.padEnd(25)} `);

  // Query Perenual — get first page (up to 30 results)
  const results = await queryGenus(genus);
  if (results === null) break; // rate limited

  // Build a quick lookup: norm(common_name or scientific_name) → result
  const resultsByNorm = new Map();
  for (const r of results) {
    const names = [
      r.common_name,
      ...(r.scientific_name || []),
      r.common_name?.replace(/['']/g, ''),
    ].filter(Boolean);
    for (const n of names) resultsByNorm.set(norm(n), r);
  }

  for (const plant of genusPlants) {
    const pNorm = norm(plant.name);
    // Try to find a match in results
    let match = resultsByNorm.get(pNorm) || null;
    if (!match) {
      // Try partial: plant name words subset of result name
      const pWords = pNorm.split(' ').filter(w => w.length > 3);
      for (const [rNorm, r] of resultsByNorm) {
        if (pWords.every(w => rNorm.includes(w))) { match = r; break; }
      }
    }
    if (!match && results.length > 0) {
      // Use genus-level first result as fallback for structured data only
      match = results[0];
    }

    const idx = plants.findIndex(p => p.id === plant.id);
    if (idx === -1) continue;

    const target = plants[idx];
    let changed = false;

    if (match) {
      // Zones
      if (!target.zones?.length) {
        const zones = mapZones(match.hardiness);
        if (zones.length) { target.zones = zones; changed = true; }
      }
      // Light
      if (!target.light?.length) {
        const light = mapLight(match.sunlight);
        if (light.length) { target.light = light; changed = true; }
      }
      // Water
      if (!target.water?.length) {
        const water = mapWater(match.watering);
        if (water.length) { target.water = water; changed = true; }
      }
      // Image (only from a specific match, not genus fallback)
      if (!target.imageUrl && match !== results[0]) {
        const img = match.default_image?.medium_url || match.default_image?.regular_url;
        if (img && !img.includes('upgrade_plan')) {
          const usedUrls = usedUrlsByGenus.get(genus) || new Set();
          if (!usedUrls.has(img)) {
            target.imageUrl = img;
            if (!usedUrlsByGenus.has(genus)) usedUrlsByGenus.set(genus, new Set());
            usedUrlsByGenus.get(genus).add(img);
            changed = true;
          }
        }
      }
    }

    // Description — try Perenual description first, then Wikipedia
    if (!target.desc) {
      const perenualDesc = match?.description;
      if (perenualDesc && perenualDesc.length > 60 && !perenualDesc.toLowerCase().includes('upgrade')) {
        target.desc = perenualDesc;
        changed = true;
      } else {
        // Wikipedia fallback
        const wDesc = await wikiDesc(plant.name);
        if (wDesc) {
          target.desc = wDesc;
          wikiHits++;
          changed = true;
        }
        await sleep(80);
      }
    }

    if (changed) enriched++;
  }

  doneGenera.add(genus);

  // Save after each genus in case of interruption
  if (gi % 3 === 0 || gi === genera.length - 1) {
    writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');
    writeFileSync(PROGRESS, JSON.stringify({ doneGenera: [...doneGenera] }), 'utf8');
  }

  await sleep(DELAY_MS);
}

writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');
writeFileSync(PROGRESS, JSON.stringify({ doneGenera: [...doneGenera] }), 'utf8');

const stillMissing = plants.filter(p => !p.desc || !p.zones?.length || !p.light?.length).length;
console.log(`\nEnriched: ${enriched} plants (${wikiHits} via Wikipedia)`);
console.log(`Still missing data: ${stillMissing}`);
console.log('Saved!');
