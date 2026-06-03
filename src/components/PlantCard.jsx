import { useState } from 'react';
import { useWishlist } from '../context/WishlistContext';
import SizePicker from './SizePicker';
import './PlantCard.css';

function parsePrice(str) {
  return parseFloat((str || '').replace(/[$,]/g, '')) || Infinity;
}

export default function PlantCard({ plant, onOpen }) {
  const catClass = 'cat-' + plant.category.toLowerCase().replace(/[^a-z]/g, '');
  const [imgError, setImgError] = useState(false);
  const showImg = plant.imageUrl && !imgError;

  const { isInWishlist, toggleWishlist } = useWishlist();
  const wishlisted = isInWishlist(plant.id);
  const [showPicker, setShowPicker] = useState(false);

  const avail = plant.availability || [];
  const availWithSize = avail.filter(a => a.size && !/^\d+$/.test(a.size));
  const inStock = availWithSize.length > 0;
  const lowestPrice = inStock
    ? availWithSize.reduce((min, a) => parsePrice(a.price) < parsePrice(min.price) ? a : min, availWithSize[0])
    : null;

  function handleWishlist(e) {
    e.stopPropagation();
    if (wishlisted) {
      toggleWishlist(plant);        // remove directly
    } else if (availWithSize.length > 0) {
      setShowPicker(true);           // show size picker first
    } else {
      toggleWishlist(plant);        // no sizes, add directly
    }
  }

  function handleSizeSelect(sizeObj) {
    toggleWishlist(plant, sizeObj);
    setShowPicker(false);
  }

  return (
    <>
    <div className="card" onClick={() => onOpen(plant)}>
      {showImg ? (
        <div className="card-img-wrap">
          <img
            className="card-img"
            src={plant.imageUrl}
            alt={plant.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <span className={`card-img-category-badge ${catClass}`}>{plant.category}</span>
          {inStock && (
            <span className="card-instock-badge">✓ In Stock</span>
          )}
          <button
            className={`card-heart${wishlisted ? ' active' : ''}`}
            onClick={handleWishlist}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <svg width="15" height="15" fill={wishlisted ? '#f28b82' : 'none'} stroke={wishlisted ? '#f28b82' : 'white'} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className={`card-color-bar ${catClass}`} />
      )}

      <div className="card-body">
        {!showImg && (
          <div className="card-category-row">
            <span className="card-category">{plant.category}</span>
            {inStock && <span className="card-instock-badge-inline">✓ In Stock</span>}
          </div>
        )}
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

        {/* Availability sizes + prices */}
        {inStock && avail.some(a => a.size && !/^\d+$/.test(a.size)) && (
          <div className="card-avail">
            {avail.filter(a => a.size && !/^\d+$/.test(a.size)).map((a, i) => (
              <span key={i} className="card-avail-chip">
                <span className="card-avail-size">{a.size}</span>
                <span className="card-avail-price">{a.price}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card-footer">
        <span className="card-height">
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2v20M5 19l7 3 7-3"/>
          </svg>
          {plant.height || '—'}
        </span>
        <div className="card-footer-actions">
          {inStock && lowestPrice && (
            <span className="card-from-price">from {lowestPrice.price}</span>
          )}
          {!showImg && (
            <button
              className={`card-heart-bare${wishlisted ? ' active' : ''}`}
              onClick={handleWishlist}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <svg width="14" height="14" fill={wishlisted ? '#f28b82' : 'none'} stroke={wishlisted ? '#f28b82' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
          <button
            className="btn-quote"
            onClick={e => { e.stopPropagation(); onOpen(plant); }}
          >
            View Details
          </button>
        </div>
      </div>
    </div>

    {showPicker && (
      <SizePicker
        plant={plant}
        onSelect={handleSizeSelect}
        onClose={() => setShowPicker(false)}
      />
    )}
    </>
  );
}
