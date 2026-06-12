/**
 * lib/scrape-engine.js
 *
 * Shared engine for all grower availability scrapers.
 * Each grower gets a small adapter (lib/growers/<id>.js) that knows how to
 * log in and return raw entries; everything else — catalog matching, markup,
 * per-grower merge, GitHub commit — lives here.
 *
 * Merge semantics: a scrape for grower X strips X's old entries from every
 * plant (clearing stale stock) and appends the fresh ones. Other growers'
 * prices and manual uploads are never touched.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const BRANCH       = 'main';
const FILE_PATH    = 'src/data/plants.json';

// ── Name normalization + matching ─────────────────────────────────────────────

export function normalizeName(str) {
  return (str || '')
    .toUpperCase()
    .replace(/[''""]/g, '')
    .replace(/\bX\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractCultivar(name) {
  const m = name.match(/[''"]([^''"]+)[''"]/) || name.match(/'([^']+)'/);
  return m ? m[1].toUpperCase().trim() : null;
}

export function parsePrice(str) {
  const n = parseFloat((str || '').replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

export function formatPrice(num) {
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function applyMultiplier(priceStr, multiplier) {
  const raw = parsePrice(priceStr);
  if (!raw || !multiplier) return priceStr;
  return formatPrice(raw * multiplier);
}

export function buildIndex(plants) {
  const byNorm     = new Map();
  const byCultivar = new Map();
  const byGenus    = new Map();

  for (const p of plants) {
    const norm = normalizeName(p.name);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm).push(p);

    const cult = extractCultivar(p.name);
    if (cult) {
      if (!byCultivar.has(cult)) byCultivar.set(cult, []);
      byCultivar.get(cult).push(p);
    }

    const genus = norm.split(' ')[0];
    if (!byGenus.has(genus)) byGenus.set(genus, []);
    byGenus.get(genus).push(p);
  }

  return { byNorm, byCultivar, byGenus };
}

export function findMatch(scrapedName, index) {
  const norm  = normalizeName(scrapedName);
  const cult  = extractCultivar(scrapedName);
  const genus = norm.split(' ')[0];

  // 1. Exact
  if (index.byNorm.has(norm)) return index.byNorm.get(norm)[0];

  // 2. Cultivar (prefer same genus)
  if (cult && index.byCultivar.has(cult)) {
    const candidates = index.byCultivar.get(cult);
    const sameGenus  = candidates.filter(p => normalizeName(p.name).startsWith(genus));
    return sameGenus[0] || candidates[0];
  }

  // 3. Token overlap within genus
  const genusCandidates = index.byGenus.get(genus) || [];
  const normTokens = new Set(norm.split(' ').filter(t => t.length > 2));
  let best = null, bestScore = 0;
  for (const p of genusCandidates) {
    const pTokens = new Set(normalizeName(p.name).split(' ').filter(t => t.length > 2));
    let overlap = 0;
    for (const t of normTokens) if (pTokens.has(t)) overlap++;
    const score = overlap / Math.max(normTokens.size, pTokens.size, 1);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.4 ? best : null;
}

// ── Catalog + config loading ──────────────────────────────────────────────────

export async function loadCatalog() {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE_PATH}`);
  if (!res.ok) throw new Error('Failed to load plant catalog from GitHub');
  return res.json();
}

export async function loadGrowersConfig() {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/src/data/growers.json`);
  if (!res.ok) throw new Error('Failed to load growers config from GitHub');
  return res.json();
}

export function growerMultiplier(growersConfig, growerId) {
  const grower = growersConfig.activeGrowers?.find(g => g.id === growerId);
  return grower?.multiplier || growersConfig.defaultMultiplier || 2.0;
}

// ── Match + merge ─────────────────────────────────────────────────────────────

/**
 * Matches scraped entries to the catalog and merges them in per-grower.
 *
 * @param {object[]} plants  - full catalog (mutated copy returned)
 * @param {object[]} entries - [{ name, size, wholesalePrice, qty?, comingSoon?, details? }]
 * @param {string}   growerId
 * @param {number}   multiplier - wholesale → retail
 * @returns {{ plants, stats }}
 */
export function mergeScrapedEntries(plants, entries, growerId, multiplier) {
  const index = buildIndex(plants);
  const byPlantId = new Map();
  let matched = 0, unmatched = 0;
  const unmatchedNames = new Set();

  for (const entry of entries) {
    const plant = findMatch(entry.name, index);
    if (!plant) { unmatched++; unmatchedNames.add(entry.name); continue; }
    matched++;
    if (!byPlantId.has(plant.id)) byPlantId.set(plant.id, []);
    byPlantId.get(plant.id).push(entry);
  }

  const today = new Date().toISOString().slice(0, 10);

  const updated = plants.map(plant => {
    // Always strip this grower's previous entries (clears stale stock)
    const others = (plant.availability || []).filter(a => (a.growerId || 'default') !== growerId);
    const fresh  = byPlantId.get(plant.id);

    if (!fresh) {
      if (others.length === (plant.availability || []).length) return plant; // untouched
      return { ...plant, availability: others };
    }

    // Deduplicate by size — keep highest wholesale price per size
    const bySize = new Map();
    for (const e of fresh) {
      const key = (e.size || '').trim().toLowerCase();
      if (!key) continue;
      const existing = bySize.get(key);
      const newW  = parsePrice(e.wholesalePrice) || 0;
      const prevW = parsePrice(existing?.wholesalePrice) || 0;
      if (!existing || newW > prevW) {
        bySize.set(key, {
          size:           e.size,
          wholesalePrice: e.wholesalePrice,
          price:          applyMultiplier(e.wholesalePrice, multiplier),
          qty:            e.qty,
          comingSoon:     e.comingSoon,
          details:        e.details,
          growerId,
        });
      }
    }

    return {
      ...plant,
      availability:     [...others, ...bySize.values()],
      availabilityDate: today,
    };
  });

  return {
    plants: updated,
    stats: {
      totalScraped:     entries.length,
      matched,
      unmatched,
      plantsWithPrices: byPlantId.size,
      unmatchedSample:  [...unmatchedNames].slice(0, 25),
    },
  };
}

// ── GitHub commit ─────────────────────────────────────────────────────────────

export async function commitCatalog(plants, message) {
  const headers = {
    Authorization:          `token ${GITHUB_TOKEN}`,
    Accept:                 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Directory listing always includes the sha, even for >1MB files
  const dirRes = await fetch(`https://api.github.com/repos/${REPO}/contents/src/data?ref=${BRANCH}`, { headers });
  if (!dirRes.ok) throw new Error('Failed to read repo contents');
  const dir = await dirRes.json();
  const fileMeta = dir.find(f => f.path === FILE_PATH);
  if (!fileMeta?.sha) throw new Error('plants.json not found in repo');

  const encoded = Buffer.from(JSON.stringify(plants)).toString('base64');
  const commitRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content:   encoded,
      sha:       fileMeta.sha,
      branch:    BRANCH,
      committer: { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
      author:    { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
    }),
  });

  if (!commitRes.ok) {
    const err = await commitRes.json();
    throw new Error(err.message || 'GitHub commit failed');
  }
  const commit = await commitRes.json();
  return commit.commit.sha;
}

// ── Full scrape run ───────────────────────────────────────────────────────────

/**
 * Runs a complete scrape for one grower using its adapter.
 * Adapter contract: { id, name, fetchEntries(log) → entries[] }
 */
export async function runScrape(adapter, log = []) {
  const ts = () => new Date().toISOString();

  log.push(`[${ts()}] Starting ${adapter.name} scrape...`);
  const entries = await adapter.fetchEntries(log);
  log.push(`[${ts()}] Scraped ${entries.length} entries`);

  if (!entries.length) throw new Error(`${adapter.name}: no entries scraped — site layout may have changed`);

  const [plants, growersConfig] = await Promise.all([loadCatalog(), loadGrowersConfig()]);
  const multiplier = growerMultiplier(growersConfig, adapter.id);
  log.push(`[${ts()}] Using multiplier: ${multiplier}×`);

  const { plants: updated, stats } = mergeScrapedEntries(plants, entries, adapter.id, multiplier);
  log.push(`[${ts()}] Match results: ${JSON.stringify({ ...stats, unmatchedSample: undefined })}`);

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const sha = await commitCatalog(updated, `Auto-scrape ${adapter.name} — ${today} (${stats.matched} prices updated)`);
  log.push(`[${ts()}] Committed: ${sha}`);

  return { sha, stats, log };
}
