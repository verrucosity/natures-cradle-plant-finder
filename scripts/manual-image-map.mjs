/**
 * manual-image-map.mjs
 * Hard-coded filename → plant ID mapping for files the auto-matcher couldn't resolve.
 * Run after process-local-images.mjs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dir   = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = 'C:/Code/hjh/gardencenter-images';
const OUT_DIR = join(__dir, '../public/images/plants');
const DATA    = join(__dir, '../src/data/plants.json');

// file (exact basename) → plant ID
// When multiple files map to the same plant, we pick the largest source file below.
const MAP = {
  // Akebia
  'akebia_quinata10.JPG':                          'AROS4',
  'akebia_quintata_anne67.JPG':                    'AROS4',
  'akebia_quintata_anne88.JPG':                    'AROS4',
  'AKEBIA \'SILVER BELLS\'.JPG':                   'AROS4',
  'akebia_silverbells19.JPG':                      'AROS4',

  // Achillea
  'achillea_moondust_ar87.JPG':                    'AMON1',   // Achillea 'Moonshine' closest
  'achillea_moondust_ars37.JPG':                   'AMON1',
  'achillea_prettybelinda_as.JPG':                 'AMON1',   // no Pretty Belinda — use Moonshine
  'Achillea_ptarmica_Peter_Cottontail_CWalters3.jpg': 'APET1',
  'achillea_rainbow-summerwine_ars01crop.jpg':     'ASUM7',
  'achillea_rainbow-summerwine_ars34.jpg':         'ASUM7',
  'achillea_rainbow-summerwine_ars54.jpg':         'ASUM7',
  'achillea_rainbow-tricolor_ars32.jpg':           'ATRI2',
  'achillea_rainbow-tricolor_ars78.jpg':           'ATRI2',
  'achillea_rainbow-tricolor_ars98crop.jpg':       'ATRI2',
  'Achillea_rainbow_sparklingcontrast_ars.jpg':    'ASPA3',
  'Achillea_rainbow_sparklingcontrast_ars45.jpg':  'ASPA3',
  'Achillea_rainbow_sparklingcontrast_ars90.jpg':  'ASPA3',
  'Achillea_skysail_bright_pink_ars87.jpg':        'ASKY1',
  'Achillea_skysail_bright_pink_ars888.jpg':       'ASKY1',
  'Achillea_skysail_fire_ars847.jpg':              'ASKY2',
  'Achillea_skysail_fire_ars896.jpg':              'ASKY2',
  'achillea_songsiren_angie_ars34.jpg':            'ASON1',
  'achillea_song_siren_angie_ars.JPG':             'ASON1',
  'achillea_song_siren_angie_ars3.JPG':            'ASON1',

  // Aucuba (misspelled "acuba" in filenames)
  'acuba_golddust_ars.JPG':                        'AGOL2',
  'acuba_golddust_ars6.JPG':                       'AGOL2',
  'aucuba_gold_dust_ars89.jpg':                    'AGOL2',
  'acuba_mr_gold_strike_ars67.jpg':                'AGOL2',

  // Allium
  'Allium_purple_sensensation_ars770.jpg':         'APUR3',
  'Allium_purple_sensensation_ars78.jpg':          'APUR3',
  'allium_chivette_ars.jpg':                       'ASCH1',
  'allium_chivette_ars13.jpg':                     'ASCH1',

  // Amelanchier
  'Amelanchlier_canadensis351.jpg':                'ACAN7',   // Amelanchier canadensis - Clump

  // Anemone
  'ANEMONE `PRETTY LADY EMILY` (WFF).JPG':        'APRE1',
  'anemone_littleprincess01.JPG':                  'ALIT3',

  // Aquilegia
  'aquilegia_winky_pink_ars87.jpg':                'AWIP1',
  'Aquilegia_Winky_red_and_white_ars32.jpg':       'AWRW1',
  'Aquilegia_Winky_red_and_white_ars80.jpg':       'AWRW1',

  // Aronia
  'HIRES-W00127-Aronia-arb-Brilliantissima-Red-Chokeberry.jpg': 'ABRI1',
  'HIRES2-W00131-Aronia-melanocarpa-Iroquois-Beauty-Black-Chokeberry.jpg': 'AIRO1',
  'HIRES3-W00131-Aronia-melanocarpa-Iroquois-Beauty-Black-Chokeberry (1).jpg': 'AIRO1',
  'HIRES3-W00131-Aronia-melanocarpa-Iroquois-Beauty-Black-Chokeberry.jpg': 'AIRO1',
  'HIRES4-W04097-Aronia-melanocarpa-Groundhug.jpg': 'AGRO1',

  // Asarum
  'asarum_european_ars76.JPG':                     'ACAN6',   // Asarum canadense (closest)

  // Azalea
  'azalea_artic_rose_ars90.jpg':                   'AARC3',
  'Azalea \'Pink and Sweet\'.jpg':                 'APIN7',
  'AZALEA `PINK AND SWEET BEAUTY SHOT.JPG':        'APIN7',
  'azalea_girards_rose_ars34.jpg':                 'AGIR1',
  'azalea_lolliop_ars49.JPG':                      'ALOL1',
  'azalea_lolliop_ars51.JPG':                      'ALOL1',
  'Azalea Weston\'s Innocence-2.jpg':              'AWES1',

  // Buddleia
  'buddliea_monarch_dark_dynasty_ars01.jpg':       'BDAR2',
  'buddliea_monarch_dark_dynasty_ars89.jpg':       'BDAR2',
  'AZIBIA \'SUMMER CHOCOLATE\'.JPG':              'ALBI1',  // Albizia
  'albezia_summer_chocolate_ars.jpg':              'ALBI1',

  // Buxus
  'buxus_green_mound_als (3).JPG':                'BGRE4',

  // Chamaecyparis
  'chamacyparis_boulevard_pom_pom_ars610.jpg':     'CBOU1',
  'cypress_butterball_ars2.jpg':                   'CBUT1',

  // Cimicifuga / Actaea
  'Cimicifuga_ChocoholicPP24821_Cwalters08.jpg':  'ACHO1',

  // Clematis
  'clematis_cezanne_ars136.JPG':                  'CCEZ1',
  'clematis_chevalier_ars66.JPG':                 'CCHE4',
  'clematis_raymondevison_Nubia.JPG':             'CNUB1',

  // Cornus
  'Cornus_CharokeeBrave34.JPG':                   'CCHE3',

  // Cryptomeria
  'Cryptomeria_jap_Dragon Prince_ars.21.jpg':     'CRYPTOME',

  // Cupressus
  'cupressus_goldcrest_wilma_ars2.jpg':           'CGOL3',

  // Daphne
  'daphne_carolmackie_ars.jpg':                   'DAPHNEXB',

  // Delosperma
  'Delosperma_lavenderice_ars.JPG':               'DELOSPER11',

  // Delphinium
  'Delphinium_GaurdianBlue_ars5.JPG':             'DBLU3',
  'Delphinium_Gaurdianwhite_ars67.JPG':           'DWHI4',

  // Dianthus
  'Dianthus \'Fire Star\'-watermarked.jpg':        'DFIR4',
  'dianthus_barbarini_red_ars.JPG':               'DBAR1',
  'dianthus_barbarini_red_ars92.JPG':             'DBAR1',
  'dianthus_barbarini_salmon_ars86.JPG':          'DBAS1',

  // Dicentra
  'Dicentra \'King of Hearts\'-watermarked.jpg':  'DKIN1',
  'Dicentra_KingOfHearts10.jpg':                  'DKIN1',
  'Dicentra_spectablis.jpg':                      'DSPE1',

  // Diervilla
  'Diervilla \'Red\'-watermarked.jpg':            'DRED1',

  // Echinacea
  'Echinacea_BUTTERFLY SKIPPER CLEOPATRA\'.JPG':  'EBUT3',
  'Echinacea_cheyannespirit_ars39.JPG':           'ECHE1',
  'Echinacea_Eye_Catcher_Cardinal_Crest_CWalter.jpg': 'ECAR1',
  'Echinacea_kimskneehigh_ars28.JPG':             'EKIM1',
  'Echinacea_milkshake_anne.JPG':                 'EMIL1',
  'Echinacea_redkneehigh_ars77.JPG':              'ERED2',
  'Echinacea_sombrero_hotcoral_ars965.JPG':       'ESOM1',
  'Echinacea_Sweet_Meadow_Mama_Kpax12.jpg':       'ESWM1',
  'Echinacea_Tiki Torch.jpg':                     'ETIK1',

  // Erigeron
  'Erigon_lynnhaven_carpet_ars44.jpg':            'ELYN1',
  'Erigon_lynnhaven_carpet_ars45.jpg':            'ELYN1',

  // Forsythia
  'Forsythia x intermedia \'Lynwood\'-watermarked.jpg': 'FLYN1',

  // Geranium
  'Geranium sanguineum-watermarked.jpg':          'GSAN1',

  // Hakonechloa
  'Hakonachloa macra areola 7.15.06.northcreek.fordhook.gateway 016.jpg': 'HAUR4',

  // Hemerocallis
  'Hemerocallis_younique_yellow_ars43.jpg':       'HYOU1',

  // Hosta
  'Hosta \'Minuteman\'-watermarked.jpg':           'HMIN1',
  'Hosta \'Tokudama Flavocircinalis\'-watermarked.jpg': 'HTOK1',
  'Hosta_fireandIce.jpg':                         'HFIR3',

  // Hydrangea
  'HYDRANGEA \'BELLA ANNA\' BEAUTY SHOT.JPG':     'HBEL1',
  'HYDRANGEA \'CITYLINE RIO\' (PW).JPG':          'HCIT1',
  'HYDRANGEA \'GLOWING EMBERS\'.JPG':             'HGLO1',
  'Hydrangea serrata \'Red\'-watermarked.jpg':     'HSER1',
  'Hydrangea_bluecassell2.jpg':                   'HBLU7',
  'Hydrangea_felicity_ars98.jpg':                 'HFEL1',
  'Hydrangea_hot_rod_ars06.jpg':                  'HHOT1',
  'Hydrangea_lighthouse_ars898.jpg':              'HLIG1',

  // Ilex
  'Ilex cornuta \'Burfordii Nana\'-watermarked.jpg': 'IBUR1',

  // Iris
  'Iris_Wine_Festival_Cwalters.jpg':              'IWIN3',

  // Lagerstroemia
  'Lagerstroemia indica x fauriei \'Tuscarora\'-watermarked.jpg': 'LAGERSTR13',

  // Rhododendron
  'Rhodendron_dreamland1.jpg':                    'RDRE1',
  'Rhodendron_dreamland4.jpg':                    'RDRE1',
  'Rhododendron_Aglo_prides.JPG':                 'RHODODEN5',
  'Rhododendron_Aglo_prides12.JPG':               'RHODODEN5',
  'Rhododendron_Cherry_Cheesecake_Astorm2.jpg':   'RCHE3',
  'Rhododendron_March_Madness_Astorm.jpg':        'RMAR2',
  'Rhododendron_March_Madness_Astorm3.jpg':       'RMAR2',
  'Rhod_PJMElite.JPG':                            'RPJM2',
  'Rhod_Skookum59.jpg':                           'RSKO1',

  // Sedum
  'HIRES-W02231-Sedum-acre-Golden-Stonecrop.jpg': 'SGOL2',
  'HIRES-W02233-Sedum-Angelina-Stonecrop.jpg':    'SANG1',
  'HIRES-W02256-Sedum-Spectabilis-Autumn-Joy-Stonecrop.jpg': 'SAUT1',
  'HIRES-W02263-Sedum-Sunsparkler-Sunsparkler-Firecracker.jpg': 'SFIR1',
  'HIRES-W03668-Sedum-Sunsparkler-Lime-Zinger.jpg': 'SLIM3',
  'HIRES2-W03668-Sedum-Sunsparkler-Lime-Zinger.jpg': 'SLIM3',
  'HIRES-W06458-Sedum-Rock-N-Grow-174-Tiramisu.jpg': 'STIR1',
  'HIRES-W07121-SEDUM-STEEL-THE-SHOW.jpg':        'SSTE1',
  'HIRES2-W06125-SEDUM-ROCK-N-GROW-PRIDE-AND-JOY.jpg': 'SPRI3',

  // Thuja
  'Thuja_or_Morgan_ars34.jpg':                    'TMOR1',

  // Viburnum
  'Viburnum plicatum f. tomentosum-watermarked.jpg': 'VPLI1',

  // Vitex
  'Vitex_flip_side_ars24.jpg':                    'VFLI1',

  // Weigela (all the "wiegela" misspellings)
  'WEIGELA \'MINUET\'.JPG':                       'WMIN1',
  'WEIGELA \'RED PRINCE\' (2).JPG':               'WRED2',
  'WEIGELA \'RED PRINCE\'.JPG':                   'WRED2',
  'WIEGELA \'MY MONET\' BEAUTY SHOT (4).JPG':     'WMYM1',
  'WIEGELA \'VARIEGATA\'.jpg':                     'WVAR1',
  'wiegela_mymonet_Anne.JPG':                     'WMYM1',
  'wiegela_mymonet_Anne4.JPG':                    'WMYM1',
  'wiegela_mymonet_Anne5.JPG':                    'WMYM1',
  'wiegela_pinkpoppet_anne_44.JPG':               'WPIN3',
  'wiegela_pinkpoppet_anne_78.JPG':               'WPIN3',
  'wiegela_wine&roses_anne_.JPG':                 'WWIN1',
  'Weigelia florida \'Wine and Roses\'3.jpg':      'WWIN1',
  'Weigelia Wine and Roses.jpg':                  'WWIN1',
};

// ── Load plants ────────────────────────────────────────────────────────────────
const plants = JSON.parse(readFileSync(DATA, 'utf8'));
const byId   = new Map(plants.map(p => [p.id, p]));

// Find all plant IDs referenced in MAP that actually exist
const validIds = new Set([...new Set(Object.values(MAP))].filter(id => byId.has(id)));
console.log(`Plant IDs in map: ${new Set(Object.values(MAP)).size} | Valid (exist in catalog): ${validIds.size}`);

// Group files by plant ID, pick largest source file per plant
const { statSync } = await import('fs');
const bestByPlant = new Map();

for (const [file, plantId] of Object.entries(MAP)) {
  if (!byId.has(plantId)) continue;
  // Skip if plant already has a local image from previous run
  const plant = byId.get(plantId);
  if (plant.imageUrl?.startsWith('/images/plants/')) {
    // Already has a local image — skip unless this is a better source file
  }

  const srcPath = join(SRC_DIR, file);
  let size = 0;
  try { size = statSync(srcPath).size; } catch { continue; } // file doesn't exist, skip

  const existing = bestByPlant.get(plantId);
  if (!existing || size > existing.size) {
    bestByPlant.set(plantId, { file, size, plantId });
  }
}

console.log(`Unique plants to process: ${bestByPlant.size}`);

// ── Process images ─────────────────────────────────────────────────────────────
let processed = 0, skipped = 0, errors = 0;
const updates = new Map();

for (const [plantId, { file }] of bestByPlant) {
  const srcPath = join(SRC_DIR, file);
  const slug    = plantId.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const outFile = `${slug}.jpg`;
  const outPath = join(OUT_DIR, outFile);

  process.stdout.write(`\r  [${processed + 1}/${bestByPlant.size}] ${plantId.padEnd(20)}`);

  try {
    await sharp(srcPath)
      .resize(900, 700, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);
    updates.set(plantId, `/images/plants/${outFile}`);
    processed++;
  } catch (e) {
    errors++;
    console.log(`\n  ERROR ${file}: ${e.message}`);
  }
}

console.log(`\nProcessed: ${processed} | Skipped: ${skipped} | Errors: ${errors}`);

// ── Update plants.json ─────────────────────────────────────────────────────────
let updated = 0;
for (const plant of plants) {
  const url = updates.get(plant.id);
  if (url) { plant.imageUrl = url; updated++; }
}

writeFileSync(DATA, JSON.stringify(plants, null, 2), 'utf8');
console.log(`Updated ${updated} imageUrls in plants.json`);
