/**
 * Client-side integrity utilities.
 */

// ── DevTools detection ────────────────────────────────────────────────────────
// Blurs the page when developer tools are opened to deter inspection.
export function initDevToolsGuard() {
  const THRESHOLD = 160;
  let blurred = false;

  function check() {
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > THRESHOLD || heightDiff > THRESHOLD;

    if (isOpen && !blurred) {
      document.body.style.filter  = 'blur(8px)';
      document.body.style.pointerEvents = 'none';
      blurred = true;
    } else if (!isOpen && blurred) {
      document.body.style.filter  = '';
      document.body.style.pointerEvents = '';
      blurred = false;
    }
  }

  setInterval(check, 800);
}

// ── Right-click prevention ────────────────────────────────────────────────────
export function initContextMenuGuard() {
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.grid, .card, .modal, .wl-drawer')) {
      e.preventDefault();
    }
  });
}

// ── Keyboard shortcut blockers ────────────────────────────────────────────────
// Blocks Ctrl+U (view source), Ctrl+S (save page), Ctrl+A (select all)
export function initKeyGuard() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && ['u', 's', 'a', 'p'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
}

// ── Decoy data injection ──────────────────────────────────────────────────────
// Injects invisible fake plant entries into the DOM.
// Screen readers and real browsers never see them (CSS display:none),
// but naive HTML scrapers will pick them up and corrupt their dataset.
export function injectDecoys() {
  const decoys = [
    { name: 'Quercus robur Phantom', price: '$0.00', size: '99 Gallon' },
    { name: 'Acer platanoides Ghost', price: '$1.00', size: '1 Gallon' },
    { name: 'Betula pendula Mirage', price: '$999.99', size: '50 Gallon' },
    { name: 'Taxus baccata Shadow', price: '$0.01', size: '200 Gallon' },
    { name: 'Cornus florida Echo', price: '$5,000.00', size: '0.5 Gallon' },
  ];

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
  container.innerHTML = decoys.map(d => `
    <div class="plant-item" data-type="availability">
      <span class="plant-name">${d.name}</span>
      <span class="plant-size">${d.size}</span>
      <span class="plant-price">${d.price}</span>
    </div>
  `).join('');
  document.body.appendChild(container);
}
