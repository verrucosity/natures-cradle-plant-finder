import { useEffect, useRef } from 'react';
import './SizePicker.css';

/**
 * Small popover that appears when adding a plant with availability sizes.
 * Lets the customer pick a size + price before it lands in the wishlist.
 */
export default function SizePicker({ plant, onSelect, onClose }) {
  const ref = useRef();
  const sizes = (plant.availability || []).filter(a => a.size && !/^\d+$/.test(a.size));

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div className="sp-overlay">
      <div className="sp-card" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="sp-header">
          <span className="sp-title">Choose a size</span>
          <button className="sp-close" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="sp-plant-name">{plant.name}</div>
        <div className="sp-sizes">
          {sizes.map((a, i) => (
            <button key={i} className="sp-size-btn" onClick={() => onSelect(a)}>
              <span className="sp-size-label">{a.size}</span>
              <span className="sp-size-price">{a.price}</span>
              {a.qty && !isNaN(Number(a.qty)) && Number(a.qty) > 0 && (
                <span className="sp-size-qty">{Number(a.qty)} avail.</span>
              )}
            </button>
          ))}
        </div>
        <button className="sp-skip" onClick={() => onSelect(null)}>
          Add without size preference
        </button>
      </div>
    </div>
  );
}
