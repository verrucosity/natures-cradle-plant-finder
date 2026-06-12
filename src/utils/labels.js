/**
 * labels.js
 * Cleans up grower jargon in size labels before showing them to customers.
 * e.g. "3 Gallon Ready Nice" → "3 Gallon", "7 gal Retail Ready" → "7 Gallon"
 */

const JARGON = /\b(ready\s*nice|retail\s*ready|garden\s*ready|nice|heavy|full|premium|select|landscape\s*grade|grower\s*grade|#?\s*1\s*grade)\b/gi;

export function cleanSizeLabel(size) {
  if (!size) return size;
  let s = String(size)
    .replace(JARGON, '')
    .replace(/\bgal\b\.?/gi, 'Gallon')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;-]+$/g, '')
    .trim();
  return s || size;
}

/** True if the availability entry has a meaningful, displayable size. */
export function hasDisplayableSize(a) {
  return a.size && !/^\d+$/.test(a.size);
}

/** Grower whose stock always wins its size slot, regardless of price. */
const PRIORITY_GROWER = 'ithilien';

function priceNum(a) {
  return parseFloat((a.price || '').replace(/[$,]/g, '')) || 0;
}

/**
 * Consolidates availability entries for display:
 * one entry per (cleaned) size — different raw labels like "3 Gallon" and
 * "3 Gallon Ready Nice" collapse into a single "3 Gallon" slot.
 *
 * Winner per slot: Ithilien Farm entries always take priority; otherwise
 * the highest-priced entry wins. Result is sorted by size (numeric when
 * possible) for a tidy small-to-large display.
 */
export function consolidateAvailability(availability) {
  const bySize = new Map();

  for (const a of availability || []) {
    if (!hasDisplayableSize(a)) continue;
    const label = cleanSizeLabel(a.size);
    const key = label.toLowerCase();
    const entry = { ...a, size: label };
    const cur = bySize.get(key);

    if (!cur) { bySize.set(key, entry); continue; }

    const curPriority = cur.growerId === PRIORITY_GROWER;
    const newPriority = entry.growerId === PRIORITY_GROWER;

    if (newPriority && !curPriority) { bySize.set(key, entry); continue; }
    if (curPriority && !newPriority) continue;
    if (priceNum(entry) > priceNum(cur)) bySize.set(key, entry);
  }

  return [...bySize.values()].sort((a, b) => {
    const na = parseFloat(a.size) || Infinity;
    const nb = parseFloat(b.size) || Infinity;
    return na - nb || a.size.localeCompare(b.size);
  });
}
