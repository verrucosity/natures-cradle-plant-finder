import './SearchBar.css';

export default function SearchBar({ query, onQuery, resultCount, onClear }) {
  return (
    <div className="search-wrap">
      <div className="search-inner">
        <div className="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Search by plant name, e.g. Maple, Hydrangea, Hosta…"
            autoComplete="off"
          />
        </div>
        <span className="results-count">
          <strong>{resultCount.toLocaleString()}</strong> plants
        </span>
        <button className="btn-clear" onClick={onClear}>Clear All</button>
      </div>
    </div>
  );
}
