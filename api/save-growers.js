const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = 'verrucosity/natures-cradle-plant-finder';
const FILE_PATH    = 'src/data/growers.json';
const BRANCH       = 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { growers, adminPassword } = req.body;
  if (adminPassword !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!growers) return res.status(400).json({ error: 'No data' });

  try {
    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
    const getRes  = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, { headers });
    const fileData = await getRes.json();
    const encoded  = Buffer.from(JSON.stringify(growers, null, 2)).toString('base64');

    const commitRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: 'PUT', headers,
      body: JSON.stringify({
        message: `Update grower settings (${growers.activeGrowers?.length || 0} growers)`,
        content: encoded,
        sha: fileData.sha,
        branch: BRANCH,
        committer: { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
        author:    { name: 'Estevan Mejia', email: 'verrucosity@gmail.com' },
      }),
    });
    if (!commitRes.ok) {
      const err = await commitRes.json();
      throw new Error(err.message || 'GitHub commit failed');
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
