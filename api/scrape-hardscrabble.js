/**
 * api/scrape-hardscrabble.js
 * Legacy endpoint kept for the existing Monday cron — delegates to the
 * shared scrape engine. New growers use /api/scrape?grower=<id>.
 *
 * This also fixes the old wipe bug: scrapes now merge per-grower instead of
 * replacing each plant's entire availability, so manual uploads and other
 * growers' prices survive the weekly Hardscrabble run.
 */

import { runScrape } from '../lib/scrape-engine.js';
import hardscrabble from '../lib/growers/hardscrabble.js';

export default async function handler(req, res) {
  const isCron   = req.method === 'GET' && req.headers['x-vercel-cron'] === '1';
  const isManual = req.method === 'POST';

  if (!isCron && !isManual) return res.status(405).end();

  if (isManual) {
    const { adminPassword } = req.body || {};
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const log = [];
  try {
    const result = await runScrape(hardscrabble, log);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message, log });
  }
}
