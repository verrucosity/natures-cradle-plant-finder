/**
 * api/update-plants.js
 * Vercel serverless function — merges uploaded availability updates into the
 * live plants.json on GitHub and commits it, triggering a Vercel redeploy.
 *
 * The client sends a compact diff ({ updates, growerId }) instead of the full
 * catalog. The merge happens server-side against the current file on GitHub,
 * so publishing never reverts changes made since the client's bundle was
 * built (e.g. the nightly Perenual image cron), never wipes other growers'
 * prices, and stays far under Vercel's request body limit.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const FILE_PATH    = 'src/data/plants.json';
const BRANCH       = 'main';

// Naive in-memory brute-force throttle (per warm lambda instance).
let failedAttempts = 0;
let lockoutUntil   = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { updates, growerId, stats, adminPassword, ping } = req.body;

  if (Date.now() < lockoutUntil) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }

  // Password gate (checked server-side only)
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 15 * 60 * 1000;
      failedAttempts = 0;
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  failedAttempts = 0;

  // Ping — just validates the password without doing anything else
  if (ping) return res.status(200).json({ ok: true });

  if (!updates?.length) return res.status(400).json({ error: 'No availability updates' });

  try {
    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // 1. Get current file SHA via directory listing (the contents API won't
    //    return metadata for files over 1MB, but listings always include sha)
    const dirRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/src/data?ref=${BRANCH}`,
      { headers }
    );
    if (!dirRes.ok) throw new Error('Failed to read repo contents');
    const dir = await dirRes.json();
    const fileMeta = dir.find(f => f.path === FILE_PATH);
    if (!fileMeta?.sha) throw new Error('plants.json not found in repo');

    // 2. Fetch the current live catalog (raw media type works for large files)
    const rawRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { ...headers, Accept: 'application/vnd.github.raw' } }
    );
    if (!rawRes.ok) throw new Error('Failed to fetch current plants.json');
    const plants = await rawRes.json();

    // 3. Merge: drop this grower's old entries everywhere (clears stale
    //    prices for plants no longer in the sheet), then apply new entries.
    const uploadGrower = growerId || 'default';
    const updMap = new Map(updates.map(u => [u.id, u]));
    let touched = 0;

    for (const plant of plants) {
      const hadGrower = plant.availability?.some(a => (a.growerId || 'default') === uploadGrower);
      if (hadGrower) {
        plant.availability = plant.availability.filter(a => (a.growerId || 'default') !== uploadGrower);
      }
      const upd = updMap.get(plant.id);
      if (upd) {
        plant.availability = [...(plant.availability || []), ...(upd.availability || [])];
        plant.availabilityDate = upd.availabilityDate;
        touched++;
      } else if (hadGrower && !plant.availability.length) {
        delete plant.availabilityDate;
      }
    }

    // 4. Commit via GitHub Contents API
    const encoded = Buffer.from(JSON.stringify(plants)).toString('base64');
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const commitRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Update availability prices — ${today} (${stats?.plantsWithPrices ?? touched} plants, ${stats?.matched ?? updates.length} entries, grower: ${uploadGrower})`,
          content: encoded,
          sha: fileMeta.sha,
          branch: BRANCH,
          committer: { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
          author:    { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
        }),
      }
    );

    if (!commitRes.ok) {
      const err = await commitRes.json();
      throw new Error(err.message || 'GitHub commit failed');
    }

    const commit = await commitRes.json();
    return res.status(200).json({
      success: true,
      sha: commit.commit.sha,
      stats,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
