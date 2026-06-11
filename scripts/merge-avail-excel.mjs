import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const EXCEL_PATH = "C:\\Users\\camis\\Downloads\\Nature's Cradle Nursery-Grower Availability.xlsx";
const PLANTS_PATH = path.join(__dirname, '../src/data/plants.json');

// Farm code → grower ID
const FARM_TO_GROWER = {
  CTP:  'prides-corner',
  MDP:  'perennial-farm',
  NJD:  'deans',
  NJF:  'fernbrook',
  NJJ:  'johns-farm',
  NJT:  'tuckahoe',
  NYG:  'glover',
  NYI:  'ithilien',
  NJEJ: 'edgar-joyce',
  NJS:  'sunset',
  LIDR: 'colesville',
  NJP:  'waverly',
};

console.log('Reading Excel...');
const wb = XLSX.readFile(EXCEL_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['master_formulas'], { defval: '', header: 1 });

// Parse master_formulas: [key@FARM, name, size, qty, height, price]
const entries = [];
for (const row of rows) {
  const key    = (row[0] || '').toString();
  const name   = (row[1] || '').toString().trim();
  const size   = (row[2] || '').toString().trim();
  const qty    = parseInt(row[3]) || 0;
  const height = (row[4] || '').toString().trim();
  const price  = parseFloat(row[5]) || 0;
  if (!name || !size || !price) continue;

  const atIdx = key.lastIndexOf('@');
  const farmCode = atIdx >= 0 ? key.slice(atIdx + 1) : '';
  const growerId = FARM_TO_GROWER[farmCode] || farmCode.toLowerCase();

  entries.push({ name: name.toLowerCase(), size, qty, height, price, growerId, farmCode });
}
console.log(`Parsed ${entries.length} availability entries`);

// Build lookup: normalized name → entries[]
const byName = new Map();
for (const e of entries) {
  const k = e.name;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(e);
}

function norm(s) {
  return s.toLowerCase()
    .replace(/[''`‘’]/g, "'")
    .replace(/[^a-z0-9' .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract cultivar text from quotes, e.g. "acer 'bloodgood'" → "bloodgood"
function cultivar(s) {
  const m = s.match(/'([^']+)'/);
  return m ? m[1].trim() : '';
}

// Build secondary lookup: "genus||cultivar" → entries[]
const byCultivar = new Map();
for (const e of entries) {
  const n = e.name;
  const cv = cultivar(n);
  const genus = n.split(' ')[0];
  if (!cv) continue;
  const k = `${genus}||${cv}`;
  if (!byCultivar.has(k)) byCultivar.set(k, []);
  byCultivar.get(k).push(e);
}

// Also: "genus||species" for plants without cultivar
const byGenus = new Map();
for (const e of entries) {
  const genus = e.name.split(' ')[0];
  if (!byGenus.has(genus)) byGenus.set(genus, []);
  byGenus.get(genus).push(e);
}

function findEntries(plantName) {
  const n = norm(plantName);
  // 1. Exact
  if (byName.has(n)) return byName.get(n);
  // 2. Genus + cultivar
  const cv = cultivar(n);
  const genus = n.split(' ')[0];
  if (cv) {
    const k = `${genus}||${cv}`;
    if (byCultivar.has(k)) return byCultivar.get(k);
    // 3. Partial cultivar: Excel cultivar starts with plant cultivar
    const genusEntries = byGenus.get(genus) || [];
    const partial = genusEntries.filter(e => {
      const ecv = cultivar(e.name);
      return ecv && (ecv.startsWith(cv) || cv.startsWith(ecv));
    });
    if (partial.length) return partial;
  }
  return [];
}

console.log('Reading plants.json...');
const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));

let matched = 0;
let totalEntries = 0;

for (const plant of plants) {
  const hits = findEntries(plant.name);

  if (!hits.length) continue;
  matched++;

  // Group by size+growerId, keep highest price per (size, growerId)
  const sizeGrowerMap = new Map();
  for (const h of hits) {
    const mapKey = `${h.size}||${h.growerId}`;
    const existing = sizeGrowerMap.get(mapKey);
    if (!existing || h.price > existing.price) {
      sizeGrowerMap.set(mapKey, h);
    }
  }

  plant.availability = [...sizeGrowerMap.values()].map(h => ({
    size: h.size,
    price: `$${h.price.toFixed(2)}`,
    qty: h.qty,
    height: h.height || undefined,
    growerId: h.growerId,
  })).sort((a, b) => {
    // Sort by size (gallon number ascending)
    const galA = parseFloat(a.size) || 999;
    const galB = parseFloat(b.size) || 999;
    return galA - galB || a.size.localeCompare(b.size);
  });

  totalEntries += plant.availability.length;
}

console.log(`Matched ${matched}/${plants.length} plants`);
console.log(`Total availability entries: ${totalEntries}`);

// --- Add new plants from Excel that had no match ---
const existingNorms = new Set(plants.map(p => norm(p.name)));
const existingIds   = new Set(plants.map(p => p.id));

// Collect all unmatched excel entries grouped by plant name
const unmatchedByName = new Map();
for (const e of entries) {
  const n = norm(e.name);
  if (existingNorms.has(n)) continue; // already matched
  // Also skip if a cultivar match was possible (would have been caught above)
  const cv = cultivar(n);
  const genus = n.split(' ')[0];
  if (cv) {
    const k = `${genus}||${cv}`;
    if (byCultivar.has(k)) {
      // Check if this cultivar already matched an existing plant
      const existing = plants.find(p => {
        const pn = norm(p.name);
        const pcv = cultivar(pn);
        return pn.split(' ')[0] === genus && pcv === cv;
      });
      if (existing) continue;
    }
  }
  if (!unmatchedByName.has(n)) unmatchedByName.set(n, { rawName: e.name, entries: [] });
  unmatchedByName.get(n).entries.push(e);
}

// Generate a unique slug ID from name
function makeId(name) {
  let slug = name.toUpperCase()
    .replace(/[''`'']/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  let id = slug;
  let i = 2;
  while (existingIds.has(id)) id = slug + (i++);
  existingIds.add(id);
  return id;
}

// Title-case a string
function toTitleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .replace(/'([a-z])/g, (_, c) => "'" + c.toUpperCase());
}

let added = 0;
for (const [, { rawName, entries: es }] of unmatchedByName) {
  const name = toTitleCase(rawName.toLowerCase().replace(/[''`]/g, "'"));

  // Deduplicate sizes
  const sizeGrowerMap = new Map();
  for (const h of es) {
    const mapKey = `${h.size}||${h.growerId}`;
    const existing = sizeGrowerMap.get(mapKey);
    if (!existing || h.price > existing.price) sizeGrowerMap.set(mapKey, h);
  }

  const availability = [...sizeGrowerMap.values()].map(h => ({
    size: h.size,
    price: `$${h.price.toFixed(2)}`,
    qty: h.qty,
    height: h.height || undefined,
    growerId: h.growerId,
  })).sort((a, b) => (parseFloat(a.size) || 999) - (parseFloat(b.size) || 999) || a.size.localeCompare(b.size));

  // Infer rough category from name
  const nl = rawName.toLowerCase();
  let category = 'Shrub';
  if (/\b(acer|betula|quercus|fagus|tilia|ulmus|fraxinus|platanus|liquidambar|liriodendron|nyssa|cercis|cornus|magnolia|prunus|malus|pyrus|sorbus|gleditsia|robinia|catalpa|paulownia|metasequoia|taxodium|ginkgo|conifer|abies|picea|pinus|tsuga|thuja|chamaecyparis|cedrus|juniperus|cryptomeria)\b/.test(nl)) category = 'Tree';
  else if (/\b(achillea|agastache|allium|anemone|aquilegia|aster|astilbe|baptisia|bergenia|brunnera|campanula|coreopsis|delphinium|dianthus|digitalis|echinacea|eupatorium|geranium|helenium|hemerocallis|heuchera|hosta|iris|kniphofia|lavandula|leucanthemum|liatris|lupinus|monarda|nepeta|penstemon|perovskia|phlox|platycodon|rudbeckia|salvia|scabiosa|sedum|verbena|veronica|perennial|ornamental grass|grass|fern|athyrium|dryopteris|osmunda|carex|pennisetum|miscanthus|panicum|molinia)\b/.test(nl)) category = 'Perennial';
  else if (/\b(rosa|rose)\b/.test(nl)) category = 'Rose';

  plants.push({
    id: makeId(rawName),
    name,
    desc: '',
    category,
    plantType: '',
    light: [],
    zones: [],
    water: [],
    maintenance: [],
    season: [],
    height: '',
    soil: [],
    availability,
  });

  existingNorms.add(norm(name));
  added++;
}

console.log(`Added ${added} new plants from Excel`);
console.log(`Total plants: ${plants.length}`);

writeFileSync(PLANTS_PATH, JSON.stringify(plants, null, 2), 'utf8');
console.log('plants.json saved!');
