/**
 * api/update-plants.js
 * Vercel serverless function — receives updated plants JSON and
 * commits it to GitHub, triggering an automatic Vercel redeploy.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const FILE_PATH    = 'src/data/plants.json';
const BRANCH       = 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plants, stats, adminPassword, ping } = req.body;

  // Password gate (checked server-side only)
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Ping — just validates the password without doing anything else
  if (ping) return res.status(200).json({ ok: true });

  if (!plants?.length) return res.status(400).json({ error: 'No plant data' });

  try {
    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    // 1. Get current file SHA (required for update)
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers }
    );
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // 2. Encode new content as base64
    const newContent = JSON.stringify(plants);
    const encoded = Buffer.from(newContent).toString('base64');

    // 3. Commit via GitHub Contents API
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const commitRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Update availability prices — ${today} (${stats.plantsWithPrices} plants, ${stats.matched} entries)`,
          content: encoded,
          sha,
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
