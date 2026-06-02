import './PlantCard.css';

export default function PlantCard({ plant, onOpen }) {
  const catClass = 'cat-' + plant.category.toLowerCase().replace(/[^a-z]/g, '');

  return (
    <div className="card" onClick={() => onOpen(plant)}>
      <div className={`card-color-bar ${catClass}`} />
      <div className="card-body">
        <div className="card-category">{plant.category}</div>
        <div className="card-name">{plant.name}</div>
        {plant.desc && <div className="card-desc">{plant.desc}</div>}
        <div className="card-attrs">
          {plant.light.map(l => (
            <span key={l} className="attr-pill sun">{l}</span>
          ))}
          {plant.water[0] && (
            <span className="attr-pill water">{plant.water[0]}</span>
          )}
          {plant.zones.slice(0, 3).map(z => (
            <span key={z} className="attr-pill zone">{z}</span>
          ))}
        </div>
      </div>
      <div className="card-footer">
        <span className="card-height">
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2v20M5 19l7 3 7-3"/>
          </svg>
          {plant.height || '—'}
        </span>
        <button
          className="btn-quote"
          onClick={e => { e.stopPropagation(); onOpen(plant); }}
        >
          Request Quote
        </button>
      </div>
    </div>
  );
}
