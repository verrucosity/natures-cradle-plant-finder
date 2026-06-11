/**
 * enrich-from-genus.mjs
 *
 * Fills missing zones/light/water/maintenance/season/soil/height/category for
 * plants with no data by deriving consensus values from other plants in the
 * same genus that already have data. Zero API calls needed.
 *
 * Then does Wikipedia description lookups (genus-level when cultivar fails).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA  = join(__dir, '../src/data/plants.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Most-common value from an array of arrays
function consensus(arrays) {
  const freq = new Map();
  for (const arr of arrays) {
    for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  }
  if (!freq.size) return [];
  const max = Math.max(...freq.values());
  return [...freq.entries()].filter(([,c]) => c >= max * 0.4).map(([v]) => v);
}

function mostCommon(values) {
  const freq = new Map();
  for (const v of values) if (v) freq.set(v, (freq.get(v) || 0) + 1);
  if (!freq.size) return '';
  return [...freq.entries()].sort((a,b) => b[1]-a[1])[0][0];
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0' } });
      if (res.status === 429) return null;
      if (!res.ok) return null;
      return res;
    } catch {
      if (i < retries - 1) await sleep(800 * (i + 1));
    }
  }
  return null;
}

async function wikiDesc(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' plant')}&srlimit=1&format=json&origin=*`;
    const res = await fetchWithRetry(url);
    if (!res) return null;
    const data = await res.json();
    const title = data?.query?.search?.[0]?.title;
    if (!title) return null;
    const eRes = await fetchWithRetry(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!eRes) return null;
    const eData = await eRes.json();
    const extract = eData?.extract || '';
    if (extract.length < 60) return null;
    if (/may refer to|disambiguation/i.test(extract)) return null;
    if (!/plant|shrub|tree|flower|genus|species|perennial|annual|native|cultivar|garden|leaf|bloom|grow/i.test(extract)) return null;
    return extract;
  } catch { return null; }
}

// ── Build genus defaults from existing data ────────────────────────────────────

const plants = JSON.parse(readFileSync(DATA, 'utf8'));
console.log(`Total plants: ${plants.length}`);

const genusDefaults = new Map();

// Group plants with data by genus
const withData = plants.filter(p =>
  p.zones?.length && p.light?.length
);
console.log(`Plants with zones+light data: ${withData.length}`);

const genusGroups = new Map();
for (const p of withData) {
  const g = p.name.split(' ')[0].toLowerCase();
  if (!genusGroups.has(g)) genusGroups.set(g, []);
  genusGroups.get(g).push(p);
}

for (const [genus, group] of genusGroups) {
  genusDefaults.set(genus, {
    zones:       consensus(group.map(p => p.zones || [])),
    light:       consensus(group.map(p => p.light || [])),
    water:       consensus(group.map(p => p.water || [])),
    maintenance: consensus(group.map(p => p.maintenance || [])),
    season:      consensus(group.map(p => p.season || [])),
    soil:        consensus(group.map(p => p.soil || [])),
    height:      mostCommon(group.map(p => p.height).filter(Boolean)),
    category:    mostCommon(group.map(p => p.category).filter(Boolean)),
    plantType:   mostCommon(group.map(p => p.plantType).filter(Boolean)),
  });
}
console.log(`Genus defaults built for ${genusDefaults.size} genera`);

// ── Apply defaults to plants missing data ──────────────────────────────────────

const needWork = plants.filter(p => !p.zones?.length || !p.light?.length);
console.log(`Plants needing structured data: ${needWork.length}`);

let structuredFilled = 0;

for (const plant of needWork) {
  const genus = plant.name.split(' ')[0].toLowerCase();
  const def = genusDefaults.get(genus);
  if (!def) continue;

  const idx = plants.findIndex(p => p.id === plant.id);
  if (idx === -1) continue;

  if (!plants[idx].zones?.length && def.zones.length)       { plants[idx].zones = def.zones; }
  if (!plants[idx].light?.length && def.light.length)       { plants[idx].light = def.light; }
  if (!plants[idx].water?.length && def.water.length)       { plants[idx].water = def.water; }
  if (!plants[idx].maintenance?.length && def.maintenance.length) { plants[idx].maintenance = def.maintenance; }
  if (!plants[idx].season?.length && def.season.length)     { plants[idx].season = def.season; }
  if (!plants[idx].soil?.length && def.soil.length)         { plants[idx].soil = def.soil; }
  if (!plants[idx].height && def.height)                    { plants[idx].height = def.height; }
  if (!plants[idx].plantType && def.plantType)              { plants[idx].plantType = def.plantType; }
  // Only override category if it's blank or the catch-all inferred value
  if ((!plants[idx].category || plants[idx].category === 'Shrub') && def.category) {
    plants[idx].category = def.category;
  }
  structuredFilled++;
}

console.log(`Structured data filled: ${structuredFilled}`);

// Save after structured fill
writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');

// ── Wikipedia descriptions ─────────────────────────────────────────────────────

const needDesc = plants.filter(p => !p.desc);
console.log(`\nPlants needing descriptions: ${needDesc.length}`);
console.log('Fetching from Wikipedia (genus-level for speed)...\n');

// Build genus-level description cache to avoid re-fetching same genus
const genusDescCache = new Map();

let descFilled = 0;
let genusDescUsed = 0;

for (let i = 0; i < needDesc.length; i++) {
  const plant = needDesc[i];
  const genus  = plant.name.split(' ')[0];
  const genusL = genus.toLowerCase();

  process.stdout.write(`\r  [${i + 1}/${needDesc.length}] ${plant.name.slice(0, 45).padEnd(45)}`);

  const idx = plants.findIndex(p => p.id === plant.id);
  if (idx === -1) continue;

  // Try cultivar-specific first
  let desc = null;
  const cultivar = plant.name.match(/'([^']+)'/)?.[1];
  if (cultivar) {
    desc = await wikiDesc(`${genus} ${cultivar}`);
    await sleep(60);
  }

  // Fall back to genus-level
  if (!desc) {
    if (genusDescCache.has(genusL)) {
      desc = genusDescCache.get(genusL);
      genusDescUsed++;
    } else {
      desc = await wikiDesc(genus);
      await sleep(80);
      if (desc) genusDescCache.set(genusL, desc);
    }
  }

  if (desc) {
    plants[idx].desc = desc;
    descFilled++;
  }

  // Save every 50 plants
  if ((i + 1) % 50 === 0) {
    writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');
  }
}

writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');

const finalMissing = plants.filter(p => !p.desc || !p.zones?.length).length;
console.log(`\n\nDescriptions filled: ${descFilled} (${genusDescUsed} from genus cache)`);
console.log(`Still missing anything: ${finalMissing}`);
console.log('Done!');
