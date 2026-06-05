import './Hero.css';

export default function Hero({ totalCount }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <h1>Your <em>plant wishlist</em><br />starts here</h1>
        <p>
          Explore over 4,000 plants from Nature's Cradle. Filter by sunlight, hardiness zone, height, soil type, and more. Save your favorites, send us your wishlist, and we'll help you track them down.
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
