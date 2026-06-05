/**
 * api/fetch-perenual-images.js
 *
 * Daily cron: fetches up to 90 plant images from Perenual API
 * for plants currently missing images, commits to GitHub.
 * Runs until all gaps are filled then becomes a no-op.
 *
 * Schedule: every day at noon UTC (8am ET) via vercel.json cron.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PERENUAL_KEY = process.env.PERENUAL_API_KEY;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const BRANCH       = 'main';
const BATCH        = 90;
const DELAY_MS     = 450;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanName(name) {
  return name
    .replace(/\s*['''][^''']+[''']/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchPerenual(name) {
  const url = `https://perenual.com/api/species-list?key=${PERENUAL_KEY}&q=${encodeURIComponent(name)}&page=1`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'NaturesCradlePlantFinder/1.0' } });
  if (res.status === 429 || !res.ok) return null;
  const data = await res.json();
  const best = data?.data?.[0];
  const img  = best?.default_image?.medium_url || best?.default_image?.regular_url || best?.default_image?.small_url;
  if (!img || img.includes('upgrade_plan')) return null;
  return img;
}

async function getGitHubFile(path) {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };
  const res  = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers });
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { data: JSON.parse(content), sha: data.sha };
}

async function commitGitHubFile(path, sha, content, message) {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const encoded = Buffer.from(JSON.stringify(content)).toString('base64');
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
      branch: BRANCH,
      committer: { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
      author:    { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'GitHub commit failed');
  }
  return (await res.json()).commit.sha;
}

export default async function handler(req, res) {
  const isCron     = req.method === 'GET' && req.headers['x-vercel-cron'] === '1';
  const isManual   = req.method === 'POST' && req.body?.adminPassword === process.env.ADMIN_PASSWORD;
  if (!isCron && !isManual) return res.status(405).end();

  try {
    // Load plants + progress from GitHub
    const { data: plants, sha: plantsSha }       = await getGitHubFile('src/data/plants.json');
    const { data: progress, sha: progressSha }   = await getGitHubFile('src/data/perenual-progress.json').catch(() => ({
      data: { attempted: [] }, sha: null,
    }));

    const attempted = new Set(progress.attempted || []);
    const needImage = plants.filter(p => !p.imageUrl && !attempted.has(p.id));

    if (needImage.length === 0) {
      return res.status(200).json({ message: 'All plants have images — nothing to do!', total: plants.length });
    }

    const batch = needImage.slice(0, BATCH);
    let hits = 0, misses = 0;

    for (let i = 0; i < batch.length; i++) {
      const plant = batch[i];
      const imageUrl = await searchPerenual(cleanName(plant.name));

      if (imageUrl) {
        const idx = plants.findIndex(p => p.id === plant.id);
        if (idx !== -1) plants[idx] = { ...plants[idx], imageUrl };
        hits++;
      } else {
        misses++;
      }

      attempted.add(plant.id);
      if (i < batch.length - 1) await sleep(DELAY_MS);
    }

    const remaining = needImage.length - batch.length;
    const today     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Commit both files
    await commitGitHubFile(
      'src/data/plants.json',
      plantsSha,
      plants,
      `Perenual images — ${today}: +${hits} images (${remaining} plants remaining)`
    );

    const newProgress = { attempted: [...attempted], lastRun: new Date().toISOString(), totalAttempted: attempted.size };
    if (progressSha) {
      await commitGitHubFile('src/data/perenual-progress.json', progressSha, newProgress, `Perenual progress update — ${today}`);
    }

    return res.status(200).json({ success: true, hits, misses, remaining, totalAttempted: attempted.size });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
