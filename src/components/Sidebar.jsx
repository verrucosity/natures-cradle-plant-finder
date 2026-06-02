import './Sidebar.css';

const FILTERS = [
  { key: 'category',    label: 'Category',           field: 'category',    multi: false },
  { key: 'light',       label: 'Light Level',         field: 'light',       multi: true  },
  { key: 'zones',       label: 'Hardiness Zone',      field: 'zones',       multi: true  },
  { key: 'water',       label: 'Water Needs',         field: 'water',       multi: true  },
  { key: 'maintenance', label: 'Maintenance',         field: 'maintenance', multi: true  },
  { key: 'season',      label: 'Season of Interest',  field: 'season',      multi: true  },
  { key: 'height',      label: 'Average Height',      field: 'height',      multi: false },
  { key: 'soil',        label: 'Soil Type',           field: 'soil',        multi: true  },
];

export { FILTERS };

export default function Sidebar({ options, active, onToggle }) {
  return (
    <aside className="sidebar">
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
            <div className="filter-chips">
              {opts.map(val => (
                <button
                  key={val}
                  className={`chip${active[f.key]?.includes(val) ? ' active' : ''}`}
                  onClick={() => onToggle(f.key, val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
