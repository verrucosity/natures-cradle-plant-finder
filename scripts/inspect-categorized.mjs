import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('C:\\Users\\camis\\Downloads\\plants_categorized (6).xlsx');
console.log('Sheets:', wb.SheetNames);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  if (rows.length > 0) {
    console.log('Columns:', Object.keys(rows[0]));
    rows.slice(0, 3).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r).slice(0, 300)));
  }
}
