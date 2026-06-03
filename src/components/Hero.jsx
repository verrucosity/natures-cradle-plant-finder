import './Hero.css';

export default function Hero({ totalCount }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <h1>Your <em>plant wishlist</em><br />starts here</h1>
        <p>
          Browse {totalCount.toLocaleString()}+ varieties from Nature's Cradle. Filter by light, zone,
          height, soil, and more — heart the ones you love, then send us your wishlist and we'll reach out to finalize.
        </p>
        <div className="hero-stats">
          <div className="hero-stat"><strong>{totalCount.toLocaleString()}</strong><span>Plant Varieties</span></div>
          <div className="hero-stat"><strong>10+</strong><span>Grower Partners</span></div>
          <div className="hero-stat"><strong>8</strong><span>Filter Types</span></div>
        </div>
      </div>
    </section>
  );
}
