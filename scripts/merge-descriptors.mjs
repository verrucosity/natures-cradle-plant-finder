import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const EXCEL_PATH = 'C:\\Users\\camis\\Downloads\\plants_categorized (6).xlsx';
const PLANTS_PATH = path.join(__dirname, '../src/data/plants.json');

function splitList(val) {
  if (!val) return [];
  return val.toString().split(/[,;|]+/).map(s => s.trim()).filter(Boolean);
}

function norm(s) {
  return (s || '').toString().toLowerCase()
    .replace(/[''`'']/g, "'")
    .replace(/[^a-z0-9' .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('Reading Excel...');
const wb = XLSX.readFile(EXCEL_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Plants'], { defval: '' });
console.log(`${rows.length} rows in sheet`);

// Build lookup by SKU and by normalized name
const bySku  = new Map();
const byName = new Map();
for (const row of rows) {
  const sku = (row['SKU'] || '').toString().trim();
  const name = norm(row['Name'] || '');
  if (sku)  bySku.set(sku, row);
  if (name) byName.set(name, row);
}

console.log('Reading plants.json...');
const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));

let updated = 0;
let skipped = 0;

for (const plant of plants) {
  const row = bySku.get(plant.id) || byName.get(norm(plant.name));
  if (!row) { skipped++; continue; }

  // Description — fill if blank, or replace generic Wikipedia genus stubs
  const desc = (row['Description'] || '').toString().trim();
  if (desc) {
    const genus = (plant.name || '').split(' ')[0];
    const isGenericStub = !plant.desc
      || plant.desc.length < 300
      || (plant.desc.startsWith(genus + ' is a genus') || plant.desc.startsWith(genus + ' is an'));
    if (isGenericStub) plant.desc = desc;
  }

  // Structured fields — fill blanks, don't overwrite good existing data
  const zones = splitList(row['Climate Zones']);
  if (zones.length && (!plant.zones || !plant.zones.length)) plant.zones = zones;

  const light = splitList(row['Light Levels']);
  if (light.length && (!plant.light || !plant.light.length)) plant.light = light;

  const water = splitList(row['Water Needs']);
  if (water.length && (!plant.water || !plant.water.length)) plant.water = water;

  const maintenance = splitList(row['Maintenance']);
  if (maintenance.length && (!plant.maintenance || !plant.maintenance.length)) plant.maintenance = maintenance;

  const season = splitList(row['Season of Interest']);
  if (season.length && (!plant.season || !plant.season.length)) plant.season = season;

  const height = (row['Height'] || '').toString().trim();
  if (height && !plant.height) plant.height = height;

  const soil = splitList(row['Soil Type']);
  if (soil.length && (!plant.soil || !plant.soil.length)) plant.soil = soil;

  const type = (row['Type'] || '').toString().trim();
  if (type && !plant.plantType) plant.plantType = type;

  // Extra enrichment fields
  const soilPH = (row['Soil pH'] || '').toString().trim();
  if (soilPH) plant.soilPH = soilPH;

  const soilDrainage = (row['Soil Drainage'] || '').toString().trim();
  if (soilDrainage) plant.soilDrainage = soilDrainage;

  const attractWildlife = (row['Attract Wildlife'] || '').toString().trim();
  if (attractWildlife) plant.attractWildlife = splitList(attractWildlife);

  const tolerances = (row['Tolerances'] || '').toString().trim();
  if (tolerances) plant.tolerances = splitList(tolerances);

  const bloomColor = (row['Bloom Color'] || '').toString().trim();
  if (bloomColor && (!plant.colors || !plant.colors.length)) {
    plant.colors = splitList(bloomColor);
  }

  const bloomTime = (row['Bloom Time'] || '').toString().trim();
  if (bloomTime) plant.bloomTime = splitList(bloomTime);

  const spread = (row['Spread'] || '').toString().trim();
  if (spread) plant.spread = spread;

  const nativePlant = (row['Native Plant'] || '').toString().trim();
  if (nativePlant && nativePlant.toLowerCase() !== 'no') plant.nativePlant = true;

  const scientificName = (row['Scientific Name'] || '').toString().trim();
  if (scientificName) plant.scientificName = scientificName;

  updated++;
}

console.log(`Updated: ${updated} | No match: ${skipped}`);
writeFileSync(PLANTS_PATH, JSON.stringify(plants, null, 2), 'utf8');
console.log('plants.json saved!');
