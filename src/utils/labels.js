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
