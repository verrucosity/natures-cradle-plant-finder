import './Hero.css';

export default function Hero({ totalCount }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <h1>Find the <em>perfect plant</em><br />for your landscape</h1>
        <p>
          Browse our master catalog of {totalCount.toLocaleString()}+ varieties. Filter by light, hardiness
          zone, height, soil, and more — then request a quote from our team.
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
