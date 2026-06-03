import { useState } from 'react';
import { useWishlist } from '../context/WishlistContext';
import './WishlistDrawer.css';

const SIZES = ['Any / Not Sure', '1 Gallon', '3 Gallon', '5 Gallon', '7 Gallon', 'B&B', 'Other'];

function WishlistItem({ item }) {
  const { removeItem, updateItem } = useWishlist();
  const { plant, qty, size } = item;
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="wl-item">
      <div className="wl-item-img-wrap">
        {plant.imageUrl && !imgErr
          ? <img src={plant.imageUrl} alt={plant.name} onError={() => setImgErr(true)} />
          : <div className="wl-item-img-placeholder" />}
      </div>
      <div className="wl-item-info">
        <div className="wl-item-category">{plant.category}</div>
        <div className="wl-item-name">{plant.name}</div>
        <div className="wl-item-controls">
          <div className="wl-qty-wrap">
            <button
              className="wl-qty-btn"
              onClick={() => updateItem(plant.id, 'qty', Math.max(1, qty - 1))}
              aria-label="Decrease quantity"
            >−</button>
            <span className="wl-qty-num">{qty}</span>
            <button
              className="wl-qty-btn"
              onClick={() => updateItem(plant.id, 'qty', qty + 1)}
              aria-label="Increase quantity"
            >+</button>
          </div>
          <select
            className="wl-size-select"
            value={size}
            onChange={e => updateItem(plant.id, 'size', e.target.value)}
          >
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <button className="wl-item-remove" onClick={() => removeItem(plant.id)} aria-label="Remove">
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

export default function WishlistDrawer() {
  const { items, drawerOpen, setDrawerOpen, clearWishlist } = useWishlist();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);

    const fd = new FormData(e.target);

    // Build a readable wishlist summary for the email body
    const plantList = items.map((item, i) =>
      `${i + 1}. ${item.plant.name} (${item.plant.category}) — Qty: ${item.qty}${item.size && item.size !== 'Any / Not Sure' ? `, Size: ${item.size}` : ''}`
    ).join('\n');

    const payload = {
      _subject: `Plant Wizard Wishlist — ${fd.get('fname')} ${fd.get('lname')}`,
      name:     `${fd.get('fname')} ${fd.get('lname')}`,
      email:    fd.get('email'),
      phone:    fd.get('phone') || 'Not provided',
      notes:    fd.get('notes') || 'None',
      wishlist: plantList,
      total_plants: items.length,
      total_units:  items.reduce((s, i) => s + i.qty, 0),
    };

    try {
      const res = await fetch('https://formsubmit.co/ajax/estevan400@gmail.com', {
        method:  'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== 'false') {
        setSubmitted(true);
      } else {
        alert('Something went wrong — please email us directly at estevan400@gmail.com');
      }
    } catch {
      alert('Network error — please email us directly at estevan400@gmail.com');
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setDrawerOpen(false);
    if (submitted) {
      setSubmitted(false);
      clearWishlist();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div className="wl-backdrop" onClick={handleClose} />
      )}

      <div className={`wl-drawer${drawerOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="wl-header">
          <div className="wl-header-left">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>My Wishlist</span>
            {items.length > 0 && <span className="wl-header-count">{items.length}</span>}
          </div>
          <button className="wl-close" onClick={handleClose} aria-label="Close wishlist">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="wl-body">
          {submitted ? (
            /* ── Success state ── */
            <div className="wl-success">
              <div className="wl-success-icon">
                <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <path d="M22 4 12 14.01l-3-3"/>
                </svg>
              </div>
              <h3>Wishlist Sent!</h3>
              <p>Thank you! Our team at Nature's Cradle will review your wishlist and reach out shortly to finalize availability and pricing.</p>
              <button className="wl-btn-primary" onClick={handleClose}>
                Close &amp; Continue Browsing
              </button>
            </div>
          ) : items.length === 0 ? (
            /* ── Empty state ── */
            <div className="wl-empty">
              <svg width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <h3>Your wishlist is empty</h3>
              <p>Browse plants and tap the heart icon to add them here.</p>
            </div>
          ) : (
            <>
              {/* ── Plant list ── */}
              <div className="wl-items">
                {items.map(item => (
                  <WishlistItem key={item.plant.id} item={item} />
                ))}
              </div>

              <div className="wl-summary">
                <span>{items.length} plant{items.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.qty, 0)} total units</span>
                <button className="wl-clear" onClick={clearWishlist}>Clear all</button>
              </div>

              {/* ── Submit form ── */}
              <div className="wl-form-wrap">
                <h4>Send Your Wishlist</h4>
                <p className="wl-form-sub">We'll review availability and reach out to finalize your order.</p>
                <form className="wl-form" onSubmit={handleSubmit}>
                  <div className="wl-form-row">
                    <div className="wl-field">
                      <label>First Name</label>
                      <input type="text" name="fname" required placeholder="Jane" />
                    </div>
                    <div className="wl-field">
                      <label>Last Name</label>
                      <input type="text" name="lname" required placeholder="Smith" />
                    </div>
                  </div>
                  <div className="wl-form-row">
                    <div className="wl-field">
                      <label>Email</label>
                      <input type="email" name="email" required placeholder="jane@email.com" />
                    </div>
                    <div className="wl-field">
                      <label>Phone</label>
                      <input type="tel" name="phone" placeholder="(914) 555-0100" />
                    </div>
                  </div>
                  <div className="wl-field">
                    <label>Notes (optional)</label>
                    <textarea name="notes" placeholder="Timeline, project details, questions…" />
                  </div>
                  <button type="submit" className="wl-btn-primary wl-btn-submit" disabled={sending}>
                    {sending
                      ? 'Sending…'
                      : `Send Wishlist (${items.length} plant${items.length !== 1 ? 's' : ''}) →`}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
