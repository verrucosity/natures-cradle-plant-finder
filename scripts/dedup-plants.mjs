import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANTS_PATH = path.join(__dirname, '../src/data/plants.json');

// Strip quotes/apostrophes and normalize whitespace for comparison
function flatNorm(s) {
  return (s || '').toLowerCase()
    .replace(/[''`'']/g, '')
    .replace(/[^a-z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf8'));
console.log(`Starting with ${plants.length} plants`);

// Group plants by flat-normalized name
const groups = new Map();
for (const p of plants) {
  const key = flatNorm(p.name);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}

const deduped = [];
let mergedCount = 0;

for (const [, group] of groups) {
  if (group.length === 1) {
    deduped.push(group[0]);
    continue;
  }

  // Pick the "best" record: prefer one with a desc, more fields filled
  group.sort((a, b) => {
    const scoreA = (a.desc ? 10 : 0) + (a.zones?.length || 0) + (a.light?.length || 0) + (a.availability?.length || 0);
    const scoreB = (b.desc ? 10 : 0) + (b.zones?.length || 0) + (b.light?.length || 0) + (b.availability?.length || 0);
    return scoreB - scoreA;
  });

  const winner = { ...group[0] };

  // Merge availability from all duplicates into winner, deduplicate by size+growerId
  const availMap = new Map();
  for (const p of group) {
    for (const a of (p.availability || [])) {
      const key = `${a.size}||${a.growerId}`;
      const existing = availMap.get(key);
      // Keep highest price
      const price = parseFloat((a.price || '').replace(/[$,]/g, '')) || 0;
      if (!existing || price > parseFloat((existing.price || '').replace(/[$,]/g, ''))) {
        availMap.set(key, a);
      }
    }
  }
  if (availMap.size) {
    winner.availability = [...availMap.values()].sort((a, b) =>
      (parseFloat(a.size) || 999) - (parseFloat(b.size) || 999) || a.size.localeCompare(b.size)
    );
  }

  deduped.push(winner);
  mergedCount += group.length - 1;
}

console.log(`Removed ${mergedCount} duplicates`);
console.log(`Final count: ${deduped.length} plants`);

writeFileSync(PLANTS_PATH, JSON.stringify(deduped, null, 2), 'utf8');
console.log('plants.json saved!');
