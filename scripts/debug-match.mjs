import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const EXCEL_PATH = "C:\\Users\\camis\\Downloads\\Nature's Cradle Nursery-Grower Availability.xlsx";
const PLANTS_PATH = 'src/data/plants.json';

const wb = XLSX.readFile(EXCEL_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['master_formulas'], { defval: '', header: 1 });

function norm(s) {
  return s.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9' .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build excel name set
const excelNames = new Set();
for (const row of rows) {
  const name = (row[1] || '').toString().trim();
  if (name) excelNames.add(norm(name));
}
console.log('Unique excel names:', excelNames.size);

const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));
const plantNames = new Set(plants.map(p => norm(p.name)));
console.log('Unique plant names:', plantNames.size);

// How many excel names match plants?
let excelMatchCount = 0;
for (const n of excelNames) {
  if (plantNames.has(n)) excelMatchCount++;
}
console.log('Excel names that match plants:', excelMatchCount);

// Show 10 excel names that DON'T match
let shown = 0;
console.log('\nExcel names NOT in plants.json:');
for (const n of excelNames) {
  if (!plantNames.has(n) && shown < 20) {
    console.log(' ', JSON.stringify(n));
    shown++;
  }
}

// Show 10 plant names that DON'T match excel
shown = 0;
console.log('\nPlant names NOT in excel:');
for (const n of plantNames) {
  if (!excelNames.has(n) && shown < 20) {
    console.log(' ', JSON.stringify(n));
    shown++;
  }
}
