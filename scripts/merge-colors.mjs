import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// xlsx must be installed: npm install xlsx
const XLSX = require('xlsx');

const EXCEL_PATH = 'C:\\Users\\camis\\Downloads\\uniformNaming (4).xlsx';
const PLANTS_PATH = path.join(__dirname, '../src/data/plants.json');

console.log('Reading Excel file...');
const wb = XLSX.readFile(EXCEL_PATH);

// --- Sheet16: SKU + Colors ---
const ws16 = wb.Sheets['Sheet16'];
const sheet16 = XLSX.utils.sheet_to_json(ws16, { defval: '' });

// Build SKU -> colors map from variable rows only
const colorMap = new Map();
for (const row of sheet16) {
  const type = (row['Type'] || '').toString().trim().toLowerCase();
  if (type !== 'variable') continue;
  const sku = (row['SKU'] || '').toString().trim();
  const colors = (row['Colors'] || '').toString().trim();
  if (sku && colors) {
    colorMap.set(sku, colors);
  }
}
console.log(`Color map: ${colorMap.size} entries`);

// --- FROMplants_structured: richer fields ---
const wsF = wb.Sheets['FROMplants_structured'];
let enrichMap = new Map();
if (wsF) {
  const fromPlants = XLSX.utils.sheet_to_json(wsF, { defval: '' });
  for (const row of fromPlants) {
    const name = (row['Name'] || row['name'] || '').toString().trim().toLowerCase();
    if (!name) continue;
    enrichMap.set(name, row);
  }
  console.log(`FROMplants_structured: ${enrichMap.size} entries`);
} else {
  console.log('FROMplants_structured sheet not found, skipping');
}

// --- Merge into plants.json ---
console.log('Reading plants.json...');
const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));

let colorMatches = 0;
let enrichMatches = 0;

for (const plant of plants) {
  // Colors from Sheet16 by SKU (plant.id === SKU)
  const colors = colorMap.get(plant.id);
  if (colors) {
    plant.colors = colors.split(',').map(c => c.trim()).filter(Boolean);
    colorMatches++;
  }

  // Richer data from FROMplants_structured by name
  const row = enrichMap.get((plant.name || '').toLowerCase());
  if (row) {
    enrichMatches++;
    if (row['soilPH'] || row['SoilPH']) plant.soilPH = (row['soilPH'] || row['SoilPH']).toString().trim() || undefined;
    if (row['soilDrainage'] || row['SoilDrainage']) plant.soilDrainage = (row['soilDrainage'] || row['SoilDrainage']).toString().trim() || undefined;
    if (row['attractWildlife'] || row['AttractWildlife']) plant.attractWildlife = (row['attractWildlife'] || row['AttractWildlife']).toString().trim() || undefined;
    if (row['gardenStyles'] || row['GardenStyles']) plant.gardenStyles = (row['gardenStyles'] || row['GardenStyles']).toString().trim() || undefined;
    // Only add colors from here if Sheet16 didn't provide them
    if (!plant.colors) {
      const c = (row['Colors'] || row['colors'] || '').toString().trim();
      if (c) {
        plant.colors = c.split(',').map(x => x.trim()).filter(Boolean);
        colorMatches++;
      }
    }
  }
}

console.log(`Color matches: ${colorMatches}/${plants.length}`);
console.log(`Enrich matches: ${enrichMatches}/${plants.length}`);

writeFileSync(PLANTS_PATH, JSON.stringify(plants, null, 2), 'utf8');
console.log('plants.json updated!');
