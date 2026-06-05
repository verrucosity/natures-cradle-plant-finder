import { useWishlist } from '../context/WishlistContext';
import './Header.css';

export default function Header({ customerZip, onChangeZip }) {
  const { items, setDrawerOpen } = useWishlist();
  const count = items.length;

  return (
    <header className="header">
      <a className="header-logo" href="https://naturescradle.com" target="_blank" rel="noreferrer">
        <img src="/logo.webp" alt="Nature's Cradle" className="header-logo-img" />
      </a>

      <div className="header-center">
        {customerZip ? (
          <button className="header-zip" onClick={onChangeZip} title="Change zip code">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {customerZip} · Change
          </button>
        ) : (
          <span className="header-tagline">55 Mill Road, Eastchester NY · (914) 779-8723</span>
        )}
      </div>

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
