import { useState } from 'react';
import { zipToCoords } from '../utils/distance';
import './ZipGate.css';

const STORAGE_KEY = 'nc_customer_zip';

export function getSavedZip() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function saveZip(zip) {
  if (zip) localStorage.setItem(STORAGE_KEY, zip);
  else localStorage.removeItem(STORAGE_KEY);
}

export default function ZipGate({ onZip }) {
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const zip = input.trim();
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit zip code'); return; }

    setLoading(true);
    setError('');
    const coords = await zipToCoords(zip);
    setLoading(false);

    if (!coords) { setError("We couldn't find that zip code. Try another."); return; }

    saveZip(zip);
    onZip(zip, coords);
  }

  function handleSkip() {
    saveZip('');
    onZip('', null);
  }

  return (
    <div className="zip-gate-overlay">
      <div className="zip-gate-card">
        <div className="zip-gate-logo">
          <div className="logo-leaf" />
          <span>Plant Wizard</span>
        </div>

        <h2>Find plants near you</h2>
        <p>
          Enter your zip code to see what's available from wholesale growers
          in your area — with retail pricing ready to go.
        </p>

        <form onSubmit={handleSubmit} className="zip-gate-form">
          <div className="zip-gate-input-wrap">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="Your zip code"
              value={input}
              onChange={e => { setInput(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoFocus
            />
          </div>
          {error && <span className="zip-gate-error">{error}</span>}
          <button type="submit" className="zip-gate-btn" disabled={loading}>
            {loading ? 'Looking up…' : 'Show Available Plants →'}
          </button>
        </form>

        <button className="zip-gate-skip" onClick={handleSkip}>
          Browse all plants without filtering
        </button>
      </div>
    </div>
  );
}
