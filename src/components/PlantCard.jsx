import { useState } from 'react';
import { useWishlist } from '../context/WishlistContext';
import { cleanSizeLabel, hasDisplayableSize } from '../utils/labels';
import SizePicker from './SizePicker';
import './PlantCard.css';

const COLOR_SWATCHES = {
  'White':   '#f5f5f5',
  'Cream':   '#fffdd0',
  'Yellow':  '#f5c518',
  'Orange':  '#f58518',
  'Red':     '#d9534f',
  'Pink':    '#f4a7b9',
  'Purple':  '#9b59b6',
  'Blue':    '#4a90d9',
  'Lavender':'#b57bee',
  'Green':   '#4a7c3f',
  'Silver':  '#c0c0c0',
  'Bronze':  '#cd7f32',
  'Brown':   '#8b6f47',
  'Black':   '#2c2c2c',
};

function parsePrice(str) {
  return parseFloat((str || '').replace(/[$,]/g, '')) || Infinity;
}

export default function PlantCard({ plant, onOpen }) {
  const catClass = 'cat-' + (plant.category || '').toLowerCase().replace(/[^a-z]/g, '');
  const [imgError, setImgError] = useState(false);
  const showImg = plant.imageUrl && !imgError;

  const { isInWishlist, toggleWishlist } = useWishlist();
  const wishlisted = isInWishlist(plant.id);
  const [showPicker, setShowPicker] = useState(false);

  const avail = plant.availability || [];
  const availWithSize = avail.filter(hasDisplayableSize);
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
      <div className="card-img-wrap">
        {showImg ? (
          <img
            className="card-img"
            src={plant.imageUrl}
            alt={plant.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`card-img-ph ${catClass}`}>
            <svg className="card-img-ph-leaf" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
            <span className="card-img-ph-initial">{(plant.name || '?')[0]}</span>
          </div>
        )}
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

      <div className="card-body">
        <div className="card-name">{plant.name}</div>
        {plant.desc && <div className="card-desc">{plant.desc}</div>}
        <div className="card-attrs">
          {(plant.light || []).map(l => (
            <span key={l} className="attr-pill sun">{l}</span>
          ))}
          {plant.water?.[0] && (
            <span className="attr-pill water">{plant.water[0]}</span>
          )}
          {(plant.zones || []).slice(0, 3).map(z => (
            <span key={z} className="attr-pill zone">{z}</span>
          ))}
        </div>

        {/* Color dots */}
        {plant.colors?.length > 0 && (
          <div className="card-colors">
            {plant.colors.slice(0, 6).map(c => {
              const swatch = COLOR_SWATCHES[c];
              return swatch ? (
                <span key={c} className="card-color-dot" style={{ background: swatch }} title={c} />
              ) : (
                <span key={c} className="card-color-label">{c}</span>
              );
            })}
          </div>
        )}

        {/* Availability sizes + prices */}
        {inStock && (
          <div className="card-avail">
            {availWithSize.slice(0, 4).map((a, i) => (
              <span key={i} className="card-avail-chip">
                <span className="card-avail-size">{cleanSizeLabel(a.size)}</span>
                <span className="card-avail-price">{a.price}</span>
              </span>
            ))}
            {availWithSize.length > 4 && (
              <span className="card-avail-chip card-avail-more">+{availWithSize.length - 4} more</span>
            )}
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
