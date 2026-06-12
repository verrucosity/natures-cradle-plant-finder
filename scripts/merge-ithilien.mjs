/**
 * merge-ithilien.mjs
 * One-off merge of the Ithilien Farm (@NYI) availability into plants.json,
 * tagged growerId "ithilien" so it gets display priority. Prices in the
 * sheet are already retail — no multiplier applied.
 *
 * Uses the shared engine's matching + per-grower merge, which also clears
 * the old stale ithilien entries.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mergeScrapedEntries } from '../lib/scrape-engine.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA  = join(__dir, '../src/data/plants.json');

// Transcribed from the Ithilien availability sheet (June 2026).
// "Call for Pricing" rows omitted — no price to show customers.
const ROWS = [
  ["Acer 'Bloodgood'", "8-10'", "", 20, "$979.99"],
  ["Acer 'Green Mountain'", '2-2.5"', "A. saccharum", 2, "$540.99"],
  ["Acer 'Inaba Shidare'", '36-42"', "", 2, "$319.99"],
  ["Acer 'Red Dragon'", '36-42"', "", 1, "$488.99"],
  ["Acer 'Tamukeyama'", "5-6'", "", 2, "$1,235.99"],
  ["Acer 'Waterfall'", "5-6'", "", 2, "$749.99"],
  ["Acer griseum", "15 Gallon", "", 2, "$849.99"],
  ["Amelanchier 'Autumn Brilliance'", "10-12'", "", 6, "$684.99"],
  ["Amelanchier 'Autumn Brilliance'", "8-9'", "", 8, "$408.99"],
  ["Azalea 'Blaauw's Pink'", "7 Gallon", '24-30"', 10, "$101.99"],
  ["Azalea 'Delaware Valley White'", "7 Gallon", '24-30"', 10, "$101.99"],
  ["Azalea 'Hino Crimson'", "7 Gallon", '24-30"', 10, "$101.99"],
  ["Azalea 'Tradition'", "7 Gallon", '24-30"', 10, "$101.99"],
  ["Betula 'Heritage'", "10-12'", "", 3, "$602.99"],
  ["Betula 'Heritage'", "12-14'", "", 4, "$724.99"],
  ["Betula 'Heritage'", "14-16'", "", 1, "$849.99"],
  ["Betula 'Heritage'", "18-20'", "", 3, "$989.99"],
  ["Betula jacquemontii", "10-12'", "", 1, "$679.99"],
  ["Buxus 'Sprinter'", '24-30"', "B&B", 13, "$154.99"],
  ["Carpinus 'Fastigiata'", "10-12'", "", 10, "$772.99"],
  ["Cercis 'Lavendar Twist'", "5-6'", "", 1, "$302.99"],
  ["Cercis 'Pink Trim'", "5-6'", "", 1, "$302.99"],
  ["Cercis canadensis", "5-6'", "B&B", 5, "$216.99"],
  ["Cercis canadensis", '4-4.5"', "", 2, "$949.99"],
  ["Chamaecyparis nootkatensis 'Pendula'", "7-8'", "", 6, "$415.99"],
  ["Cornus 'Venus'", '1.75-2"C', "B&B", 8, "$540.99"],
  ["Cornus kousa", "10-12'", "Multi-stem", 3, "$941.99"],
  ["Cornus kousa 'Rosy Teacups'", '1.75-2"C', "Multi Stem", 3, "$540.99"],
  ["Cryptomeria 'Yoshino'", "14-16'", "", 1, "$1,544.99"],
  ["Hamamelis vernalis", "5-6'", "", 1, "$254.99"],
  ["Juniperus 'Blue Point'", "7-8'", "Full", 1, "$695.99"],
  ["Juniperus 'Hetzi Columnaris'", "7-8'", "B&B", 2, "$478.99"],
  ["Juniperus 'Keteleeri'", "7-8'", "B&B", 10, "$418.99"],
  ["Juniperus 'Keteleeri'", "8-10'", "", 4, "$540.99"],
  ["Juniperus 'Sea Green'", "4-5'", "B&B", 2, "$418.99"],
  ["Juniperus 'Spartan'", "6-7'", "", 3, "$324.99"],
  ["Ligustrum ovalifolium", "7-8'", "", 9, "$339.99"],
  ["Ligustrum ovalifolium", "8-9'", "", 6, "$386.99"],
  ["Magnolia 'Ann'", "6-7'", "", 4, "$355.99"],
  ["Prunus 'Arctic Jay'", "10 Gallon", "", 1, "$224.99"],
  ["Prunus 'Burbank'", "15 Gallon", "", 3, "$249.99"],
  ["Prunus 'Elberta'", "15 Gallon", "", 3, "$324.99"],
  ["Prunus 'Krauter Vesuvius'", '4.5-5"', "Purple leaf", 1, "$1,195.99"],
  ["Prunus 'Krauter Vesuvius'", '5-6"', "", 1, "$1,499.99"],
  ["Prunus 'Kwanzan'", "15 Gallon", "", 9, "$370.99"],
  ["Prunus 'Kwanzan'", '4.5-5"', "", 2, "$1,549.99"],
  ["Pyrus 'Bartlett'", "8-9'", '1" Caliper', 2, "$224.99"],
  ["Pyrus 'Chanticleer'", "15 Gallon", '1.25-1.5" Caliper', 3, "$499.99"],
  ["Quercus bicolor", "8-10'", "", 1, "$571.99"],
  ["Quercus rubra", "20 Gallon", "10-12'", 4, "$617.99"],
  ["Spiraea 'Anthony Waterer'", "3 Gallon", "", 2, "$44.99"],
  ["Spiraea 'Anthony Waterer'", "5 Gallon", "", 15, "$98.99"],
  ["Spiraea 'Little Princess'", "5 Gallon", '24-30"', 5, "$98.99"],
  ["Syringa 'Ivory Silk'", '1-1.5"', "", 1, "$259.99"],
  ["Syringa vulgaris", '36-42"', "", 4, "$134.99"],
  ["Thuja 'American Pillar'", "10 Gallon", "", 10, "$200.99"],
  ["Thuja 'American Pillar'", "8-10'", "", 4, "$624.99"],
  ["Thuja 'Emerald Green'", "14-16'", "", 1, "$1,284.99"],
  ["Thuja 'Emerald Green'", "5-6'", "", 2, "$209.99"],
  ["Thuja 'Emerald Green'", "7-8'", "", 6, "$509.99"],
  ["Thuja 'Emerald Green'", "8-10'", "", 1, "$741.99"],
  ["Thuja 'Green Giant'", "6-7'", "B&B", 40, "$355.99"],
  ["Thuja 'Green Giant'", "7-8'", "B&B", 30, "$540.99"],
  ["Thuja 'Nigra'", "7-8'", "", 3, "$359.99"],
  ["Thuja 'Nigra'", "8-10'", "", 9, "$695.99"],
  ["Viburnum 'Alleghany'", "5-6'", "", 1, "$247.99"],
  ["Viburnum 'Mariesii'", "5-6'", "B&B", 6, "$222.99"],
  ["Viburnum burkwoodii", "3-4'", "B&B", 9, "$98.99"],
  ["Viburnum burkwoodii", "5-6'", "B&B", 10, "$293.99"],
];

const entries = ROWS.map(([name, size, details, qty, price]) => ({
  name,
  size,
  details,
  qty: String(qty),
  wholesalePrice: price, // sheet prices are already retail
}));

const plants = JSON.parse(readFileSync(DATA, 'utf8'));
const { plants: updated, stats } = mergeScrapedEntries(plants, entries, 'ithilien', 1);

console.log('Stats:', JSON.stringify(stats, null, 2));

writeFileSync(DATA, JSON.stringify(updated, null, 2), 'utf8');
console.log('plants.json updated.');
