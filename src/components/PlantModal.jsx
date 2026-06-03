import { useState } from 'react';
import { useWishlist } from '../context/WishlistContext';
import './PlantModal.css';

function ModalImage({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) return null;
  return (
    <div className="modal-img-wrap">
      <img src={src} alt={alt} className="modal-img" onError={() => setErr(true)} />
    </div>
  );
}

export default function PlantModal({ plant, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const { isInWishlist, toggleWishlist, setDrawerOpen } = useWishlist();
  const wishlisted = isInWishlist(plant?.id);

  if (!plant) return null;

  const attrRows = [
    ['Light',             plant.light?.join(', ')       || '—'],
    ['Hardiness Zones',   plant.zones?.join(', ')       || '—'],
    ['Water Needs',       plant.water?.join(', ')       || '—'],
    ['Maintenance',       plant.maintenance?.join(', ') || '—'],
    ['Season of Interest',plant.season?.join(', ')      || '—'],
    ['Average Height',    plant.height                  || '—'],
    ['Soil Type',         plant.soil?.join(', ')        || '—'],
    ['Plant Type',        plant.plantType               || '—'],
  ];

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay open" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
          <div className="modal-cat">{plant.category}</div>
          <div className="modal-name">{plant.name}</div>
          {plant.availability?.length > 0 && (
            <div className="modal-availability">
              <div className="modal-avail-header">
                <span className="modal-avail-label">✓ In Stock</span>
                <span className="modal-avail-date">Updated {plant.availabilityDate}</span>
              </div>
              <div className="modal-avail-chips">
                {plant.availability.map((a, i) => (
                  <span key={i} className="modal-avail-chip">
                    {a.size && !/^\d+$/.test(a.size) && (
                      <span className="modal-avail-size">{a.size}</span>
                    )}
                    <span className="modal-avail-price">{a.price}</span>
                    {a.qty && !isNaN(Number(a.qty)) && Number(a.qty) > 0 &&
                      <span className="modal-avail-qty">{Number(a.qty)} avail.</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            className={`modal-wishlist-btn${wishlisted ? ' active' : ''}`}
            onClick={() => {
              toggleWishlist(plant);
              if (!wishlisted) { onClose(); setDrawerOpen(true); }
            }}
          >
            <svg width="14" height="14" fill={wishlisted ? '#f28b82' : 'none'} stroke={wishlisted ? '#f28b82' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {wishlisted ? 'Added to Wishlist ✓' : 'Add to Wishlist'}
          </button>
        </div>

        <div className="modal-body">
          <ModalImage src={plant.imageUrl} alt={plant.name} />
          <p className="modal-desc">{plant.desc || 'No description available.'}</p>

          <div className="modal-attrs-grid">
            {attrRows.map(([label, val]) => (
              <div className="modal-attr" key={label}>
                <div className="modal-attr-label">{label}</div>
                <div className="modal-attr-val">{val}</div>
              </div>
            ))}
          </div>

          <div className="quote-form">
            <h4>Request a Quote</h4>
            <form onSubmit={handleSubmit}>
              <input type="hidden" name="plant" value={plant.name} />
              <div className="form-row">
                <div className="form-field">
                  <label>First Name</label>
                  <input type="text" name="fname" required placeholder="Jane" />
                </div>
                <div className="form-field">
                  <label>Last Name</label>
                  <input type="text" name="lname" required placeholder="Smith" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" name="email" required placeholder="jane@email.com" />
                </div>
                <div className="form-field">
                  <label>Phone</label>
                  <input type="tel" name="phone" placeholder="(914) 555-0100" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Quantity Needed</label>
                  <input type="number" name="qty" min="1" placeholder="e.g. 3" />
                </div>
                <div className="form-field">
                  <label>Preferred Size</label>
                  <select name="size">
                    <option value="">Any / Not Sure</option>
                    <option>1 Gallon</option>
                    <option>3 Gallon</option>
                    <option>5 Gallon</option>
                    <option>7 Gallon</option>
                    <option>B&amp;B</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field full">
                  <label>Project Notes</label>
                  <textarea name="notes" placeholder="Tell us about your project, timeline, or any questions…" />
                </div>
              </div>
              <button
                type="submit"
                className={`btn-submit${submitted ? ' sent' : ''}`}
              >
                {submitted ? '✓ Request Sent!' : 'Send Quote Request →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
