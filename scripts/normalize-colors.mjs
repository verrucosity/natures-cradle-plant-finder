import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANTS_PATH = path.join(__dirname, '../src/data/plants.json');

// Map any color string → basic color(s)
function normalizeColor(raw) {
  const c = raw.toLowerCase().trim();

  if (c.includes('variegat'))        return 'Variegated';
  if (c.includes('white'))           return 'White';
  if (c.includes('cream'))           return 'Cream';
  if (c.includes('yellow'))          return 'Yellow';
  if (c.includes('orange'))          return 'Orange';
  if (c.includes('copper'))          return 'Orange';
  if (c.includes('peach'))           return 'Peach';
  if (c.includes('coral'))           return 'Coral';
  if (c.includes('red'))             return 'Red';
  if (c.includes('pink'))            return 'Pink';
  if (c.includes('lavender'))        return 'Lavender';
  if (c.includes('purple'))          return 'Purple';
  if (c.includes('blue'))            return 'Blue';
  if (c.includes('silver'))         return 'Silver';
  if (c.includes('green'))           return 'Green';
  if (c.includes('brown'))           return 'Brown';
  if (c.includes('bronze'))          return 'Bronze';
  if (c.includes('black'))           return 'Black';
  return null; // drop unknown
}

const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));

let updated = 0;
for (const plant of plants) {
  if (!plant.colors?.length) continue;
  const normalized = [...new Set(
    plant.colors.map(normalizeColor).filter(Boolean)
  )];
  if (normalized.length) {
    plant.colors = normalized;
    updated++;
  } else {
    delete plant.colors;
  }
}

writeFileSync(PLANTS_PATH, JSON.stringify(plants, null, 2), 'utf8');
console.log(`Normalized colors on ${updated} plants`);

// Print unique color values
const allColors = new Set();
plants.forEach(p => p.colors?.forEach(c => allColors.add(c)));
console.log('Unique colors:', [...allColors].sort().join(', '));
