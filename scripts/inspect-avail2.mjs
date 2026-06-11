import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile("C:\\Users\\camis\\Downloads\\Nature's Cradle Nursery-Grower Availability.xlsx");

// master_formulas: the pre-calculated retail sheet
const ws = wb.Sheets['master_formulas'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

console.log('master_formulas columns (row 0):', rows[0]);
console.log('\nSample rows:');
rows.slice(0, 20).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)));

// also check master sheet headers
const wsM = wb.Sheets['master'];
const masterRows = XLSX.utils.sheet_to_json(wsM, { defval: '', header: 1 });
console.log('\nmaster sheet header row:', masterRows[5]);
console.log('master sample rows:');
masterRows.slice(6, 15).forEach((r, i) => console.log(`  [${i+6}]`, JSON.stringify(r)));

// Check Minimum sheet for farm codes + multipliers
const wsMin = wb.Sheets['Minimum'];
const minRows = XLSX.utils.sheet_to_json(wsMin, { defval: '' });
console.log('\nMinimum sheet (farm multipliers):');
minRows.slice(0, 15).forEach(r => {
  if (r['FARM'] && r['FARM MULTIPLIER']) {
    console.log(`  Farm: ${r['FARM']} multiplier: ${r['FARM MULTIPLIER']} enabled: ${r['ENABLED']}`);
  }
});
