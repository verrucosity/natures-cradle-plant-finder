/**
 * parsePDF.js
 * Extracts plant availability data from Nature's Cradle grower PDF.
 * Uses PDF.js to get text items with coordinates, then reconstructs
 * the 5-column table: Botanical Name | Pot Size | Qty | Details | Price
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use the bundled worker via Vite's ?url import (avoids CDN/version mismatch issues)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const HEADER_STRINGS = new Set([
  'botanical name', 'pot size/caliper', 'quantity/status',
  'other details', 'price', 'week of', '55 mill road',
  'ithilien farm', 'glover', 'perennial farm', "john's farm",
  'prides corner', 'deans', 'fernbrook', 'edgar joyce',
  'tuckahoe', 'sunset',
]);

function isHeaderRow(cells) {
  const joined = cells.join(' ').toLowerCase();
  return HEADER_STRINGS.has(cells[0]?.toLowerCase()) ||
    joined.includes('week of') ||
    joined.includes('mill road') ||
    joined.includes('botanical name');
}

function normalizePrice(str) {
  if (!str) return null;
  const m = str.match(/\$[\d,]+\.?\d*/);
  return m ? m[0] : null;
}

/**
 * Extract rows from one PDF page using text item coordinates.
 * Groups items by Y position (row), then by X position (column).
 */
function extractPageRows(textItems, pageWidth) {
  // Filter blanks
  const items = textItems
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .filter(i => i.text.length > 0);

  if (!items.length) return [];

  // Group by Y (row) — items within 4pt of each other are same row
  const rows = [];
  const sorted = [...items].sort((a, b) => b.y - a.y); // top to bottom

  for (const item of sorted) {
    const existing = rows.find(r => Math.abs(r.y - item.y) < 5);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // For each row, sort items left to right and assign to 5 columns
  // Column boundaries (relative to page width ~612pt):
  // 0: name    0–35%
  // 1: size   35–55%
  // 2: qty    55–67%
  // 3: detail 67–80%
  // 4: price  80–100%
  const W = pageWidth || 612;
  const COLS = [0, 0.35, 0.55, 0.67, 0.80, 1.0].map(p => p * W);

  return rows.map(row => {
    const cells = ['', '', '', '', ''];
    for (const item of row.items) {
      let col = 4;
      for (let c = 0; c < 5; c++) {
        if (item.x >= COLS[c] && item.x < COLS[c + 1]) { col = c; break; }
      }
      cells[col] = (cells[col] + ' ' + item.text).trim();
    }
    return cells;
  });
}

/**
 * Main parse function — returns array of availability entries:
 * [{ name, size, qty, details, price }]
 */
export async function parsePDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const total = pdf.numPages;
  const entries = [];

  for (let p = 1; p <= total; p++) {
    if (onProgress) onProgress(p, total);

    const page   = await pdf.getPage(p);
    const vp     = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const rows = extractPageRows(content.items, vp.width);

    for (const cells of rows) {
      if (isHeaderRow(cells)) continue;
      const [name, size, qty, details, priceRaw] = cells;
      if (!name || name.length < 3) continue;

      const price = normalizePrice(priceRaw);
      if (!price) continue; // skip rows without a price

      // Clean size: strip trailing standalone numbers (those are quantities bleeding in)
      // e.g. "#2/ 8-10' 75" → "#2/ 8-10'"
      const cleanSize = (size || '').replace(/\s+\d+$/, '').trim();

      // If size is purely numeric or empty, it's actually a qty — leave size blank
      const sizeIsNumeric = /^\d+$/.test(cleanSize);

      entries.push({
        name:    name.toUpperCase().trim(),
        size:    sizeIsNumeric ? '' : cleanSize,
        qty:     qty?.trim() || '',
        details: details?.trim() || '',
        price,
      });
    }
  }

  return entries;
}
