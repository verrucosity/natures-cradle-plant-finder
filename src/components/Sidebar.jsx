import './Sidebar.css';

const FILTERS = [
  { key: 'category',    label: 'Category',           field: 'category',    multi: false },
  { key: 'colors',      label: 'Color',              field: 'colors',      multi: true  },
  { key: 'light',       label: 'Light Level',         field: 'light',       multi: true  },
  { key: 'zones',       label: 'Hardiness Zone',      field: 'zones',       multi: true  },
  { key: 'water',       label: 'Water Needs',         field: 'water',       multi: true  },
  { key: 'maintenance', label: 'Maintenance',         field: 'maintenance', multi: true  },
  { key: 'season',      label: 'Season of Interest',  field: 'season',      multi: true  },
  { key: 'height',      label: 'Average Height',      field: 'height',      multi: false },
  { key: 'soil',        label: 'Soil Type',           field: 'soil',        multi: true  },
];

const COLOR_SWATCHES = {
  'White':   '#f5f5f5',
  'Cream':   '#fffdd0',
  'Yellow':  '#f5c518',
  'Orange':  '#f58518',
  'Red':     '#d9534f',
  'Pink':    '#f4a7b9',
  'Purple':  '#9b59b6',
  'Blue':    '#4a90d9',
  'Lavender':'#b57bee',
  'Green':   '#4a7c3f',
  'Silver':  '#c0c0c0',
  'Bronze':  '#cd7f32',
  'Brown':   '#8b6f47',
  'Black':   '#2c2c2c',
  'Variegated': 'linear-gradient(135deg,#fff 33%,#4a7c3f 33%,#4a7c3f 66%,#c8dfc0 66%)',
};

export { FILTERS };

export default function Sidebar({ options, active, onToggle, open, onClose }) {
  return (
    <>
    {open && <div className="sidebar-backdrop" onClick={onClose} />}
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-mobile-header">
        <span>Filters</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close filters">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      {FILTERS.map(f => {
        const opts = options[f.key] || [];
        const activeCount = active[f.key]?.length || 0;
        return (
          <div className="filter-section" key={f.key}>
            <div className="filter-title-row">
              <span className="filter-title">{f.label}</span>
              {activeCount > 0 && (
                <span className="filter-badge show">{activeCount}</span>
              )}
            </div>
            <div className={`filter-chips${f.key === 'colors' ? ' color-chips' : ''}`}>
              {opts.map(val => {
                const swatch = f.key === 'colors' ? COLOR_SWATCHES[val] : null;
                const isActive = active[f.key]?.includes(val);
                return (
                  <button
                    key={val}
                    className={`chip${isActive ? ' active' : ''}${swatch ? ' color-chip' : ''}`}
                    onClick={() => onToggle(f.key, val)}
                    title={val}
                  >
                    {swatch && (
                      <span
                        className="color-dot"
                        style={{ background: swatch }}
                      />
                    )}
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <button className="sidebar-apply" onClick={onClose}>Show Plants</button>
    </aside>
    </>
  );
}
