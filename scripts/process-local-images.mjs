/**
 * process-local-images.mjs
 *
 * 1. Reads all images from the source folder
 * 2. Parses each filename → plant name
 * 3. Matches to plants.json (exact → cultivar → partial)
 * 4. Resizes + compresses to max 900px wide, ~100-150KB
 * 5. Saves to public/images/plants/
 * 6. Updates plants.json imageUrl to /images/plants/<file>
 * 7. When multiple images match the same plant, picks the largest source file (best quality)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dir = dirname(fileURLToPath(import.meta.url));

const SRC_DIR  = 'C:/Code/hjh/gardencenter-images';
const OUT_DIR  = join(__dir, '../public/images/plants');
const DATA     = join(__dir, '../src/data/plants.json');

mkdirSync(OUT_DIR, { recursive: true });

// ── Filename → plant name parser ───────────────────────────────────────────────

function parseFilename(filename) {
  let name = basename(filename, extname(filename));

  // Remove watermark suffix
  name = name.replace(/-watermarked$/i, '');

  // Remove ® ™ symbols
  name = name.replace(/[®™]/g, '');

  // Remove trailing photographer/source codes (word + optional digits at very end)
  // e.g. _ars123, _als, _pcf, _cpw, _anne, _cwalters2, _cvanbelle53, _pw, _pcf, Cpw, CWalters3
  name = name.replace(/[_\s][Cc]?(?:ars|als|pcf|cpw|anne|cwalters|cvanbelle|pw|nubia)\w*$/i, '');

  // Remove trailing descriptors: beauty shot, crop, foliage, tree, standard, pom pom, (WFF), etc.
  name = name.replace(/[\s_](?:beauty[\s_]?shot|crop|foliage|tree|standard|pom[\s_]?pom|female|male)[\s\w\d()]*$/i, '');

  // Remove trailing numbers that are NOT part of a cultivar name
  // e.g. ars234, _11, _45 — but keep things like '1 3/4"'
  // Strategy: strip trailing _digits or digits-at-end-of-a-word-after-underscore
  name = name.replace(/[_\s]\d+$/, '');       // _123 or " 123" at end
  name = name.replace(/\d+$/, '');            // bare digits at very end (e.g. "bloodgood11")

  // Remove trailing (2), (3), etc.
  name = name.replace(/\s*\(\d+\)\s*$/, '');
  name = name.replace(/\s*\([A-Z]+\)\s*$/, ''); // (WFF), (Ll) etc.

  // Handle variety abbreviations: var. dissectum → dissectum; x freemanii → strip x
  name = name.replace(/\bvar\.\s*/gi, '');
  name = name.replace(/\s+x\s+/gi, ' ');

  // Replace underscores and hyphens (outside of quotes) with spaces
  name = name.replace(/_/g, ' ');
  // Only replace hyphens that are word separators (not inside cultivar quotes)
  // Simple heuristic: replace hyphen between letters
  name = name.replace(/([a-zA-Z])-([a-zA-Z])/g, '$1 $2');

  // Normalize quotes
  name = name.replace(/[`'']/g, "'");

  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[''`''®™]/g, '')
    .replace(/[^a-z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Flatten all spaces/punctuation for slug comparison (e.g. "crimsonqueen" matches "crimson queen")
function slug(s) {
  return norm(s).replace(/\s+/g, '');
}

function cultivar(s) {
  const m = s.match(/'([^']+)'/);
  return m ? m[1].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim() : '';
}

// ── Build plant lookup ─────────────────────────────────────────────────────────

const plants = JSON.parse(readFileSync(DATA, 'utf8'));

const byExact    = new Map(plants.map(p => [norm(p.name), p]));
const bySlug     = new Map(plants.map(p => [slug(p.name), p]));
const byCultivar = new Map();
const byGenus    = new Map();

for (const p of plants) {
  const n  = norm(p.name);
  const cv = cultivar(n);
  const g  = n.split(' ')[0];
  if (cv) {
    const k  = `${g}||${cv}`;
    const ks = `${g}||${cv.replace(/\s+/g, '')}`;
    if (!byCultivar.has(k))  byCultivar.set(k, p);
    if (!byCultivar.has(ks)) byCultivar.set(ks, p);
  }
  if (!byGenus.has(g)) byGenus.set(g, []);
  byGenus.get(g).push(p);
}

function findPlant(parsedName) {
  const n  = norm(parsedName);
  const sl = slug(parsedName);
  const g  = n.split(' ')[0];

  if (byExact.has(n))  return byExact.get(n);
  if (bySlug.has(sl))  return bySlug.get(sl);

  const cv = cultivar(n);
  if (cv) {
    const k  = `${g}||${cv}`;
    const ks = `${g}||${cv.replace(/\s+/g, '')}`;
    if (byCultivar.has(k))  return byCultivar.get(k);
    if (byCultivar.has(ks)) return byCultivar.get(ks);

    // Partial cultivar match within genus
    const genusPlants = byGenus.get(g) || [];
    for (const p of genusPlants) {
      const pcv = cultivar(norm(p.name));
      if (pcv && (pcv.replace(/\s+/g,'').includes(cv.replace(/\s+/g,'')) ||
                  cv.replace(/\s+/g,'').includes(pcv.replace(/\s+/g,'')))) return p;
    }
  }

  // Slug match across genus: "acer crimsonqueen" → "acer 'crimson queen'"
  const genusPlants = byGenus.get(g) || [];
  const querySlug   = sl.replace(g, '');
  for (const p of genusPlants) {
    const pSlug = slug(p.name).replace(g, '').replace(/'/g, '');
    if (pSlug && querySlug.includes(pSlug) || (pSlug.length > 5 && querySlug.includes(pSlug.slice(0, -2)))) return p;
  }

  // Word-level match: all non-genus words appear in plant name
  const words = n.split(' ').filter(w => w.length > 3);
  if (words.length >= 2) {
    for (const p of genusPlants) {
      const pn = norm(p.name);
      if (words.slice(1).every(w => pn.includes(w))) return p;
    }
  }

  return null;
}

// ── Collect all source images, group by matched plant (pick largest per plant) ──

const files = readdirSync(SRC_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
console.log(`Found ${files.length} source images`);

// Map: plantId → { file, size }
const bestByPlant = new Map();
// Map: file → plant (for processing)
const fileToPlant = new Map();

let matchCount = 0;
for (const file of files) {
  const parsed = parseFilename(file);
  const plant  = findPlant(parsed);
  if (!plant) continue;

  const srcPath = join(SRC_DIR, file);
  const size    = statSync(srcPath).size;

  // Keep only largest source file per plant (highest quality)
  const existing = bestByPlant.get(plant.id);
  if (!existing || size > existing.size) {
    bestByPlant.set(plant.id, { file, size, plant, parsed });
  }
  matchCount++;
}

console.log(`Matched ${matchCount} files → ${bestByPlant.size} unique plants`);

// ── Process and save images ────────────────────────────────────────────────────

let processed = 0;
let errors    = 0;
const updates = new Map(); // plantId → public path

for (const [plantId, { file, plant }] of bestByPlant) {
  const srcPath  = join(SRC_DIR, file);
  const slug     = plantId.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const outFile  = `${slug}.jpg`;
  const outPath  = join(OUT_DIR, outFile);

  process.stdout.write(`\r  [${processed + 1}/${bestByPlant.size}] ${plant.name.slice(0, 50).padEnd(50)}`);

  try {
    await sharp(srcPath)
      .resize(900, 700, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);

    updates.set(plantId, `/images/plants/${outFile}`);
    processed++;
  } catch (e) {
    errors++;
    console.log(`\n  ERROR: ${file} — ${e.message}`);
  }
}

console.log(`\nProcessed: ${processed} | Errors: ${errors}`);

// ── Update plants.json ─────────────────────────────────────────────────────────

let updated = 0;
for (const plant of plants) {
  const url = updates.get(plant.id);
  if (url) {
    // Local images take priority over Wikipedia/Perenual
    plant.imageUrl = url;
    updated++;
  }
}

writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');
console.log(`plants.json updated: ${updated} imageUrls set`);

// Print unmatched files for reference
const unmatched = [];
for (const file of files) {
  const parsed = parseFilename(file);
  const plant  = findPlant(parsed);
  if (!plant) unmatched.push(`  ${file}  →  "${parsed}"`);
}
if (unmatched.length) {
  console.log(`\nUnmatched files (${unmatched.length}):`);
  unmatched.slice(0, 30).forEach(u => console.log(u));
}
