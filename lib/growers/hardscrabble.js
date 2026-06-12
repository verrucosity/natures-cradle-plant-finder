/**
 * lib/growers/hardscrabble.js
 * Adapter for Hardscrabble Farms (hardscrabblefarms.com — ColdFusion site).
 * Logs in with HSF_LOGIN / HSF_PASSWORD env vars and scrapes the
 * availability tables.
 */

import { parse } from 'node-html-parser';

const BASE = 'https://hardscrabblefarms.com';
const UA   = 'Mozilla/5.0 (compatible; NaturesCradleBot/1.0)';

async function login() {
  const body = new URLSearchParams({
    fuseaction:   'wholesale.main',
    loginAttempt: 'true',
    redirect:     `${BASE}/Availability`,
    login:        process.env.HSF_LOGIN,
    pw:           process.env.HSF_PASSWORD,
    isLogin:      'Login',
  });

  const res = await fetch(`${BASE}/index.cfm`, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body:     body.toString(),
    redirect: 'manual',
  });

  const raw = res.headers.get('set-cookie') || '';
  const cookies = raw
    .split(/,(?=[^ ])/g)
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  const location = res.headers.get('location') || '';
  const success  = !location.includes('Login') && (location || res.status === 200);
  return { cookies, success, status: res.status };
}

async function fetchPage(url, cookies) {
  const res = await fetch(url, { headers: { Cookie: cookies, 'User-Agent': UA } });
  return res.text();
}

function parseAvailabilityTable(html) {
  const root = parse(html);
  const rows = root.querySelectorAll('table tbody tr');
  const entries = [];

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) continue;

    const name       = cells[0]?.innerText?.trim() || '';
    const size       = cells[1]?.innerText?.trim() || '';
    const avail      = cells[2]?.innerText?.trim() || '';
    const comingSoon = cells[3]?.innerText?.trim() || '';
    const priceRaw   = cells[4]?.innerText?.trim() || '';

    if (!name || name === 'NAME' || priceRaw === 'LOGIN' || priceRaw === '') continue;
    if (!size || /^\d+$/.test(size)) continue;
    if (!priceRaw.startsWith('$')) continue;

    entries.push({ name, size, qty: avail, comingSoon, wholesalePrice: priceRaw });
  }

  return entries;
}

function findPaginationLinks(html) {
  const root  = parse(html);
  const links = root.querySelectorAll('a[href*="Availability"], a[href*="availability"]');
  const urls  = new Set();

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes('letter=') || href.includes('filter=') || href.includes('page=')) {
      urls.add(href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`);
    }
  }
  return [...urls];
}

export default {
  id:   'hardscrabble',
  name: 'Hardscrabble Farms',

  async fetchEntries(log = []) {
    const ts = () => new Date().toISOString();

    const { cookies, success, status } = await login();
    if (!success) throw new Error(`Hardscrabble login failed (status ${status}) — check HSF_LOGIN/HSF_PASSWORD`);
    log.push(`[${ts()}] Logged in to Hardscrabble`);

    const indexHtml = await fetchPage(`${BASE}/Availability`, cookies);
    let entries = parseAvailabilityTable(indexHtml);

    const subPages = findPaginationLinks(indexHtml);
    log.push(`[${ts()}] Found ${subPages.length} sub-pages`);

    for (const url of subPages) {
      const html = await fetchPage(url, cookies);
      entries = entries.concat(parseAvailabilityTable(html));
    }

    return entries;
  },
};
