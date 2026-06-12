import PlantCard from './PlantCard';
import './PlantGrid.css';

export default function PlantGrid({ plants, sort, onSort, activeFilters, onRemoveFilter, onOpen, inStockOnly, onToggleInStock }) {
  return (
    <main className="main">
      <div className="sort-bar">
        <div className="active-filters">
          {Object.entries(activeFilters).flatMap(([key, vals]) =>
            vals.map(val => (
              <span
                key={`${key}-${val}`}
                className="active-filter-tag"
                onClick={() => onRemoveFilter(key, val)}
              >
                {val}
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </span>
            ))
          )}
        </div>
        <button
          className={`instock-toggle${inStockOnly ? ' active' : ''}`}
          onClick={onToggleInStock}
        >
          <span className="instock-toggle-dot" />
          In Stock Only
        </button>
        <select className="sort-select" value={sort} onChange={e => onSort(e.target.value)}>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="priceAsc">Price: Low → High</option>
          <option value="priceDesc">Price: High → Low</option>
          <option value="cat">By Category</option>
        </select>
      </div>

      <div className="grid">
        {plants.length === 0 ? (
          <div className="empty">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M12 2C8 2 4 6 4 12c0 3.5 2 6.5 5 8"/>
              <path d="M12 2c4 0 8 4 8 10 0 3.5-2 6.5-5 8"/>
              <path d="M12 22v-6M9 19l3 3 3-3"/>
            </svg>
            <h3>No plants found</h3>
            <p>Try adjusting your filters or search term.</p>
          </div>
        ) : (
          plants.map(p => (
            <PlantCard key={p.id} plant={p} onOpen={onOpen} />
          ))
        )}
      </div>
    </main>
  );
}
