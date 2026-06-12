/**
 * api/scrape.js
 * Generic scrape endpoint — runs any registered grower adapter.
 *
 *   GET  /api/scrape?grower=hardscrabble   (Vercel cron, x-vercel-cron header)
 *   POST /api/scrape  { grower, adminPassword }   (manual trigger from admin)
 *   GET  /api/scrape?list=1                 (list available scrapers)
 */

import { runScrape } from '../lib/scrape-engine.js';
import { getAdapter, listAdapters } from '../lib/growers/index.js';

export default async function handler(req, res) {
  const isCron   = req.method === 'GET' && req.headers['x-vercel-cron'] === '1';
  const isManual = req.method === 'POST';

  if (req.method === 'GET' && req.query.list) {
    return res.status(200).json({ scrapers: listAdapters() });
  }

  if (!isCron && !isManual) return res.status(405).end();

  if (isManual) {
    const { adminPassword } = req.body || {};
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const growerId = (isManual ? req.body?.grower : req.query.grower) || '';
  const adapter  = getAdapter(growerId);
  if (!adapter) {
    return res.status(400).json({ error: `Unknown grower "${growerId}"`, available: listAdapters() });
  }

  const log = [];
  try {
    const result = await runScrape(adapter, log);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message, log });
  }
}
