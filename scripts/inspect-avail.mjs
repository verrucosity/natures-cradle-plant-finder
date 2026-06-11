import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile("C:\\Users\\camis\\Downloads\\Nature's Cradle Nursery-Grower Availability.xlsx");
console.log('Sheets:', wb.SheetNames);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  // Print first 5 rows as headers + samples
  rows.slice(0, 6).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r).slice(0, 200)));
}
