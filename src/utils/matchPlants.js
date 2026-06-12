/**
 * matchPlants.js
 * Fuzzy-matches PDF botanical names to the plants catalog.
 *
 * Strategy (in order of priority):
 * 1. Exact normalized match
 * 2. Cultivar match — extract quoted name, find plants containing it
 * 3. Token overlap — genus + species token match
 */

function normalize(str) {
  return str
    .toUpperCase()
    .replace(/[''""]/g, '')          // remove quotes
    .replace(/\bX\b/g, '')           // remove hybrid marker
    .replace(/[^A-Z0-9\s]/g, ' ')   // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCultivar(name) {
  // Match content in single or double quotes
  const m = name.match(/[''"]([^''"]+)[''"]/) || name.match(/'([^']+)'/);
  return m ? m[1].toUpperCase().trim() : null;
}

function tokenSet(str) {
  return new Set(normalize(str).split(' ').filter(t => t.length > 2));
}

function tokenOverlap(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  let overlap = 0;
  for (const t of sa) if (sb.has(t)) overlap++;
  return overlap / Math.max(sa.size, sb.size, 1);
}

/**
 * Build a lookup index from the catalog for fast matching.
 */
export function buildIndex(plants) {
  const index = {
    byNorm:     new Map(), // normalized name → plant[]
    byCultivar: new Map(), // cultivar name → plant[]
    byGenus:    new Map(), // genus → plant[]
  };

  for (const plant of plants) {
    const norm = normalize(plant.name);
    if (!index.byNorm.has(norm)) index.byNorm.set(norm, []);
    index.byNorm.get(norm).push(plant);

    const cult = extractCultivar(plant.name);
    if (cult) {
      if (!index.byCultivar.has(cult)) index.byCultivar.set(cult, []);
      index.byCultivar.get(cult).push(plant);
    }

    const genus = normalize(plant.name).split(' ')[0];
    if (!index.byGenus.has(genus)) index.byGenus.set(genus, []);
    index.byGenus.get(genus).push(plant);
  }

  return index;
}

/**
 * Find best matching plant for a PDF entry name.
 * Returns { plant, score, method } or null.
 */
export function findMatch(pdfName, index, plants) {
  const norm = normalize(pdfName);
  const cult = extractCultivar(pdfName);
  const genus = norm.split(' ')[0];

  // 1. Exact normalized match
  if (index.byNorm.has(norm)) {
    return { plant: index.byNorm.get(norm)[0], score: 1.0, method: 'exact' };
  }

  // 2. Cultivar match — if PDF has a cultivar name in quotes
  if (cult && index.byCultivar.has(cult)) {
    const candidates = index.byCultivar.get(cult);
    // Among cultivar matches, prefer same genus
    const sameGenus = candidates.filter(p => normalize(p.name).startsWith(genus));
    const best = sameGenus.length ? sameGenus[0] : candidates[0];
    return { plant: best, score: 0.9, method: 'cultivar' };
  }

  // 3. Token overlap within same genus
  const genusCandidates = index.byGenus.get(genus) || [];
  if (genusCandidates.length) {
    let best = null, bestScore = 0;
    for (const plant of genusCandidates) {
      const score = tokenOverlap(pdfName, plant.name);
      if (score > bestScore) { bestScore = score; best = plant; }
    }
    if (best && bestScore >= 0.4) {
      return { plant: best, score: bestScore, method: 'token' };
    }
  }

  return null;
}

function applyMultiplier(priceStr, multiplier) {
  if (!multiplier || multiplier === 1) return priceStr;
  const raw = parseFloat((priceStr || '').replace(/[$,]/g, ''));
  if (!raw) return priceStr;
  const retail = raw * multiplier;
  return '$' + retail.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Main function: given PDF entries and catalog plants,
 * returns updated plants array with price/size data merged in.
 *
 * Each matched plant gets:
 *   plant.availability = [{ size, price, qty, details }]  (sorted by size)
 *   plant.availabilityDate = "YYYY-MM-DD"
 *
 * @param {object[]} plants - catalog
 * @param {object[]} pdfEntries - parsed from PDF
 * @param {number} multiplier - wholesale → retail multiplier (default 2.0)
 * @param {string} growerId - which grower this upload is from
 */
export function mergePrices(plants, pdfEntries, multiplier = 2.0, growerId = 'default') {
  const index = buildIndex(plants);

  // Group PDF entries by matched plant id
  const byPlantId = new Map(); // plant.id → [entries]
  let matched = 0, unmatched = 0;
  const unmatchedNames = new Set();

  for (const entry of pdfEntries) {
    const result = findMatch(entry.name, index, plants);
    if (result) {
      matched++;
      if (!byPlantId.has(result.plant.id)) byPlantId.set(result.plant.id, []);
      byPlantId.get(result.plant.id).push({ ...entry, _method: result.method });
    } else {
      unmatched++;
      unmatchedNames.add(entry.name);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const updated = plants.map(plant => {
    const entries = byPlantId.get(plant.id);
    if (!entries) return plant;

    // Deduplicate by size — keep the highest price per size
    const bySize = new Map();
    for (const e of entries) {
      const sizeKey = (e.size || '').trim().toLowerCase();
      if (!sizeKey) continue; // skip entries with no size
      const existing = bySize.get(sizeKey);
      const newPrice  = parseFloat((e.price  || '').replace(/[$,]/g, '')) || 0;
      const prevPrice = parseFloat((existing?.wholesalePrice || '').replace(/[$,]/g, '')) || 0;
      if (!existing || newPrice > prevPrice) {
        bySize.set(sizeKey, {
          size:          e.size,
          wholesalePrice: e.price,
          price:         applyMultiplier(e.price, multiplier),
          qty:           e.qty,
          details:       e.details,
          growerId,
        });
      }
    }

    const availability = [...bySize.values()];

    return { ...plant, availability, availabilityDate: today };
  });

  // Compact diff for publishing — only plants whose availability changed.
  // The server merges these into the live plants.json so a single-grower
  // upload never wipes other growers' prices.
  const updates = updated
    .filter(p => byPlantId.has(p.id))
    .map(p => ({ id: p.id, availability: p.availability, availabilityDate: p.availabilityDate }));

  return {
    plants: updated,
    updates,
    stats: {
      totalPDFEntries: pdfEntries.length,
      matched,
      unmatched,
      plantsWithPrices: byPlantId.size,
      unmatchedSample: [...unmatchedNames].slice(0, 20),
    },
  };
}
