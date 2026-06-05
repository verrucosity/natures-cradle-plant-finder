/**
 * api/scrape-hardscrabble.js
 *
 * Scrapes live availability + pricing from hardscrabblefarms.com,
 * matches to the plant catalog, applies the grower multiplier,
 * and commits updated plants.json to GitHub (auto-deploys via Vercel).
 *
 * Called automatically every Monday at 6am ET via Vercel cron.
 * Can also be triggered manually: POST /api/scrape-hardscrabble with adminPassword.
 */

import { parse } from 'node-html-parser';

const HSF_BASE     = 'https://hardscrabblefarms.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const BRANCH       = 'main';

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(str) {
  return (str || '')
    .toUpperCase()
    .replace(/[''""]/g, '')
    .replace(/\bX\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCultivar(name) {
  const m = name.match(/[''"]([^''"]+)[''"]/) || name.match(/'([^']+)'/);
  return m ? m[1].toUpperCase().trim() : null;
}

function parsePrice(str) {
  const n = parseFloat((str || '').replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function formatPrice(num) {
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function applyMultiplier(priceStr, multiplier) {
  const raw = parsePrice(priceStr);
  if (!raw || !multiplier) return priceStr;
  return formatPrice(raw * multiplier);
}

// ── Login ────────────────────────────────────────────────────────────────────

async function loginHSF() {
  const body = new URLSearchParams({
    fuseaction:   'wholesale.main',
    loginAttempt: 'true',
    redirect:     `${HSF_BASE}/Availability`,
    login:        process.env.HSF_LOGIN,
    pw:           process.env.HSF_PASSWORD,
    isLogin:      'Login',
  });

  const res = await fetch(`${HSF_BASE}/index.cfm`, {
    method:   'POST',
    headers:  {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   'Mozilla/5.0 (compatible; NaturesCradleBot/1.0)',
    },
    body:     body.toString(),
    redirect: 'manual',
  });

  // Collect all Set-Cookie headers into one cookie string
  const raw = res.headers.get('set-cookie') || '';
  // ColdFusion sets CFID + CFTOKEN + JSESSIONID
  const cookies = raw
    .split(/,(?=[^ ])/g)
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  const location = res.headers.get('location') || '';
  const success  = !location.includes('Login') && (location || res.status === 200);

  return { cookies, success, location, status: res.status };
}

// ── Fetch availability pages ──────────────────────────────────────────────────

async function fetchPage(url, cookies) {
  const res = await fetch(url, {
    headers: {
      'Cookie':     cookies,
      'User-Agent': 'Mozilla/5.0 (compatible; NaturesCradleBot/1.0)',
    },
  });
  return res.text();
}

/**
 * Parse the availability HTML table.
 * Returns array of { name, size, avail, comingSoon, wholesalePrice }
 */
function parseAvailabilityTable(html) {
  const root = parse(html);
  const rows = root.querySelectorAll('table tbody tr');
  const entries = [];

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) continue;

    const name          = cells[0]?.innerText?.trim() || '';
    const size          = cells[1]?.innerText?.trim() || '';
    const avail         = cells[2]?.innerText?.trim() || '';
    const comingSoon    = cells[3]?.innerText?.trim() || '';
    const priceRaw      = cells[4]?.innerText?.trim() || '';

    // Skip rows with no name, header rows, or login-wall rows
    if (!name || name === 'NAME' || priceRaw === 'LOGIN' || priceRaw === '') continue;
    if (!size || /^\d+$/.test(size)) continue; // skip blank or numeric-only sizes

    const wholesalePrice = priceRaw.startsWith('$') ? priceRaw : null;
    if (!wholesalePrice) continue;

    entries.push({ name, size, avail, comingSoon, wholesalePrice });
  }

  return entries;
}

/**
 * Find all availability pages (letters A–Z + numbered filters).
 * Returns array of URLs to scrape.
 */
function findPaginationLinks(html) {
  const root  = parse(html);
  const links = root.querySelectorAll('a[href*="Availability"], a[href*="availability"]');
  const urls  = new Set();

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes('letter=') || href.includes('filter=') || href.includes('page=')) {
      urls.add(href.startsWith('http') ? href : `${HSF_BASE}${href.startsWith('/') ? '' : '/'}${href}`);
    }
  }

  return [...urls];
}

// ── Plant matching ────────────────────────────────────────────────────────────

function buildIndex(plants) {
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

function findMatch(scrapedName, index) {
  const norm  = normalizeName(scrapedName);
  const cult  = extractCultivar(scrapedName);
  const genus = norm.split(' ')[0];

  // 1. Exact
  if (index.byNorm.has(norm)) return index.byNorm.get(norm)[0];

  // 2. Cultivar
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

// ── GitHub commit ─────────────────────────────────────────────────────────────

async function commitToGitHub(plants, stats) {
  const headers = {
    Authorization:         `token ${GITHUB_TOKEN}`,
    Accept:                'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type':         'application/json',
  };

  const filePath = 'src/data/plants.json';
  const getRes   = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`, { headers });
  const fileData = await getRes.json();
  const encoded  = Buffer.from(JSON.stringify(plants)).toString('base64');
  const today    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const commitRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message:   `Auto-scrape Hardscrabble Farms — ${today} (${stats.matched} prices updated)`,
      content:   encoded,
      sha:       fileData.sha,
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

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Allow cron (GET) or manual trigger (POST with password)
  const isCron = req.method === 'GET' && req.headers['x-vercel-cron'] === '1';
  const isManual = req.method === 'POST';

  if (!isCron && !isManual) return res.status(405).end();

  if (isManual) {
    const { adminPassword } = req.body || {};
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Starting Hardscrabble Farms scrape...`);

    // 1. Login
    const { cookies, success, status } = await loginHSF();
    if (!success) {
      log.push(`[${ts()}] Login failed (status ${status}). Cookies: ${cookies.substring(0, 100)}`);
      return res.status(503).json({ error: 'Login failed', log });
    }
    log.push(`[${ts()}] Logged in. Cookies: ${cookies.substring(0, 80)}…`);

    // 2. Fetch availability index page
    const indexHtml = await fetchPage(`${HSF_BASE}/Availability`, cookies);
    log.push(`[${ts()}] Fetched availability index (${indexHtml.length} bytes)`);

    // Parse first page
    let allEntries = parseAvailabilityTable(indexHtml);
    log.push(`[${ts()}] Parsed ${allEntries.length} entries from index page`);

    // Find and fetch any letter/pagination sub-pages
    const subPages = findPaginationLinks(indexHtml);
    log.push(`[${ts()}] Found ${subPages.length} sub-pages`);

    for (const url of subPages) {
      const html    = await fetchPage(url, cookies);
      const entries = parseAvailabilityTable(html);
      allEntries    = allEntries.concat(entries);
    }
    log.push(`[${ts()}] Total scraped entries: ${allEntries.length}`);

    // 3. Load catalog + growers config from GitHub
    const plantsRes  = await fetch(`https://raw.githubusercontent.com/${REPO}/main/src/data/plants.json`);
    const plants     = await plantsRes.json();

    const growersRes = await fetch(`https://raw.githubusercontent.com/${REPO}/main/src/data/growers.json`);
    const growersConfig = await growersRes.json();

    const hsfGrower    = growersConfig.activeGrowers?.find(g => g.id === 'hardscrabble');
    const multiplier   = hsfGrower?.multiplier || growersConfig.defaultMultiplier || 2.0;
    log.push(`[${ts()}] Using multiplier: ${multiplier}×`);

    // 4. Match + merge
    const index = buildIndex(plants);
    const byPlantId = new Map();
    let matched = 0, unmatched = 0;

    for (const entry of allEntries) {
      const plant = findMatch(entry.name, index);
      if (!plant) { unmatched++; continue; }
      matched++;
      if (!byPlantId.has(plant.id)) byPlantId.set(plant.id, []);
      byPlantId.get(plant.id).push(entry);
    }

    const today = new Date().toISOString().slice(0, 10);
    const updated = plants.map(plant => {
      const entries = byPlantId.get(plant.id);
      if (!entries) return plant;

      // Deduplicate by size, keep highest wholesale price → highest retail
      const bySize = new Map();
      for (const e of entries) {
        const key = e.size.trim().toLowerCase();
        const existing = bySize.get(key);
        const newWholesale  = parsePrice(e.wholesalePrice) || 0;
        const prevWholesale = parsePrice(existing?.wholesalePrice) || 0;
        if (!existing || newWholesale > prevWholesale) {
          bySize.set(key, {
            size:           e.size,
            wholesalePrice: e.wholesalePrice,
            price:          applyMultiplier(e.wholesalePrice, multiplier),
            qty:            e.avail,
            comingSoon:     e.comingSoon,
            growerId:       'hardscrabble',
          });
        }
      }

      return {
        ...plant,
        availability:     [...bySize.values()],
        availabilityDate: today,
      };
    });

    const stats = { matched, unmatched, plantsWithPrices: byPlantId.size, totalScraped: allEntries.length };
    log.push(`[${ts()}] Match results: ${JSON.stringify(stats)}`);

    // 5. Commit to GitHub
    const sha = await commitToGitHub(updated, stats);
    log.push(`[${ts()}] Committed to GitHub: ${sha}`);

    return res.status(200).json({ success: true, sha, stats, log });

  } catch (err) {
    log.push(`[${ts()}] ERROR: ${err.message}`);
    console.error(err);
    return res.status(500).json({ error: err.message, log });
  }
}
