import { useMemo, useState, useCallback } from 'react';
import PLANTS from '../data/plants.json';
import { FILTERS } from '../components/Sidebar';

const PER_PAGE = 24;

function buildOptions() {
  const opts = {};
  FILTERS.forEach(f => {
    const seen = new Set();
    PLANTS.forEach(p => {
      const val = p[f.field];
      if (Array.isArray(val)) val.forEach(v => seen.add(v));
      else if (val) seen.add(val);
    });
    opts[f.key] = [...seen].sort();
  });
  return opts;
}

const OPTIONS = buildOptions();

const initActive = () => Object.fromEntries(FILTERS.map(f => [f.key, []]));

export default function usePlants() {
  const [query, setQuery]   = useState('');
  const [active, setActive] = useState(initActive);
  const [sort, setSort]     = useState('az');
  const [page, setPage]     = useState(1);

  const filtered = useMemo(() => {
    let list = PLANTS.filter(p => {
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.category.toLowerCase().includes(q) &&
          !(p.desc || '').toLowerCase().includes(q)
        ) return false;
      }
      for (const f of FILTERS) {
        const sel = active[f.key];
        if (!sel.length) continue;
        const val = p[f.field];
        if (f.multi) {
          if (!sel.some(s => Array.isArray(val) ? val.includes(s) : val === s)) return false;
        } else {
          if (!sel.includes(val)) return false;
        }
      }
      return true;
    });

    if (sort === 'az')  list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'za') list.sort((a, b) => b.name.localeCompare(a.name));
    else list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    return list;
  }, [query, active, sort]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage    = Math.min(page, totalPages);
  const paginated   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const toggleFilter = useCallback((key, val) => {
    setActive(prev => {
      const cur = prev[key];
      return { ...prev, [key]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
    setPage(1);
  }, []);

  const removeFilter = useCallback((key, val) => {
    setActive(prev => ({ ...prev, [key]: prev[key].filter(v => v !== val) }));
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setActive(initActive());
    setQuery('');
    setPage(1);
  }, []);

  const handleQuery = useCallback(q => { setQuery(q); setPage(1); }, []);
  const handleSort  = useCallback(s => { setSort(s);  setPage(1); }, []);

  return {
    query, handleQuery,
    active, toggleFilter, removeFilter, clearAll,
    sort, handleSort,
    page, setPage,
    paginated, filtered,
    totalPages,
    options: OPTIONS,
    totalCount: PLANTS.length,
  };
}
