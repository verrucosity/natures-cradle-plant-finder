import { useWishlist } from '../context/WishlistContext';
import './Header.css';

export default function Header() {
  const { items, setDrawerOpen } = useWishlist();
  const count = items.length;

  return (
    <header className="header">
      <a className="header-logo" href="https://naturescradle.com" target="_blank" rel="noreferrer">
        <div className="logo-leaf" />
        <div className="logo-text">
          <strong>Plant Wizard</strong>
          <span>by Nature's Cradle</span>
        </div>
      </a>

      <span className="header-tagline">55 Mill Road, Eastchester NY · (914) 779-8723</span>

      <button
        className="wishlist-btn"
        onClick={() => setDrawerOpen(true)}
        aria-label={`Open wishlist${count > 0 ? `, ${count} plants` : ''}`}
      >
        <svg width="20" height="20" fill={count > 0 ? '#f28b82' : 'none'} stroke={count > 0 ? '#f28b82' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span className="wishlist-btn-label">Wishlist</span>
        {count > 0 && <span className="wishlist-badge">{count}</span>}
      </button>
    </header>
  );
}
