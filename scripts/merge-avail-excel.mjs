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

writeFileSync(PLANTS_PATH, JSON.stringify(plants, null, 2), 'utf8');
console.log('plants.json saved!');
