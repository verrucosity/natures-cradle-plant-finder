import { useState, useRef, useCallback, useEffect } from 'react';
import { parsePDF } from '../utils/parsePDF';
import { mergePrices } from '../utils/matchPlants';
import PLANTS from '../data/plants.json';
import GROWER_DIRECTORY from '../data/grower-directory.json';
import './AdminPage.css';

const STEPS = {
  LOGIN: 'login', UPLOAD: 'upload', PARSING: 'parsing',
  PREVIEW: 'preview', PUBLISHING: 'publishing', DONE: 'done',
};

const DEFAULT_GROWERS_JSON = {
  activeGrowers: [],
  defaultMultiplier: 2.0,
  baseLocation: 'Eastchester, NY',
};

export default function AdminPage() {
  const [tab, setTab]           = useState('upload'); // 'upload' | 'growers'
  const [step, setStep]         = useState(STEPS.LOGIN);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState({ page: 0, total: 0 });
  const [result, setResult]     = useState(null);
  const [publishError, setPublishError] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const fileRef = useRef();

  // Grower/upload settings
  const [growers, setGrowers]           = useState(DEFAULT_GROWERS_JSON);
  const [selectedGrowerId, setSelectedGrowerId] = useState('combined');
  const [multiplierOverride, setMultiplierOverride] = useState('');
  const [noMultiplier, setNoMultiplier] = useState(false);
  const [growersLoaded, setGrowersLoaded] = useState(false);
  const [growersSaving, setGrowersSaving] = useState(false);
  const [growersSaved, setGrowersSaved]   = useState(false);

  // Load growers from GitHub when logged in
  useEffect(() => {
    if (step === STEPS.UPLOAD && !growersLoaded) {
      fetch('https://raw.githubusercontent.com/verrucosity/natures-cradle-plant-finder/main/src/data/growers.json')
        .then(r => r.json())
        .then(data => { setGrowers(data); setGrowersLoaded(true); })
        .catch(() => setGrowersLoaded(true));
    }
  }, [step, growersLoaded]);

  // Effective multiplier for current upload
  const effectiveMultiplier = noMultiplier ? 1.0 :
    (parseFloat(multiplierOverride) ||
    growers.activeGrowers.find(g => g.id === selectedGrowerId)?.multiplier ||
    growers.defaultMultiplier || 2.0);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    if (!password.trim()) { setAuthError('Enter a password'); return; }
    const res = await fetch('/api/update-plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true, adminPassword: password }),
    });
    if (res.status === 401) { setAuthError('Incorrect password'); return; }
    setStep(STEPS.UPLOAD);
  }

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a PDF file.');
      return;
    }
    setStep(STEPS.PARSING);
    setParseProgress({ page: 0, total: 0 });
    try {
      const entries = await parsePDF(file, (page, total) =>
        setParseProgress({ page, total })
      );
      const merged = mergePrices(PLANTS, entries, effectiveMultiplier, selectedGrowerId);
      setResult(merged);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      alert('Failed to parse PDF: ' + err.message);
      setStep(STEPS.UPLOAD);
    }
  }, [effectiveMultiplier, selectedGrowerId]);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handlePublish() {
    setStep(STEPS.PUBLISHING);
    setPublishError('');
    try {
      const res = await fetch('/api/update-plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plants: result.plants,
          stats: result.stats,
          adminPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setCommitSha(data.sha);
      setStep(STEPS.DONE);
    } catch (err) {
      setPublishError(err.message);
      setStep(STEPS.PREVIEW);
    }
  }

  async function saveGrowers(updatedGrowers) {
    setGrowersSaving(true);
    try {
      const res = await fetch('/api/save-growers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ growers: updatedGrowers, adminPassword: password }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setGrowers(updatedGrowers);
      setGrowersSaved(true);
      setTimeout(() => setGrowersSaved(false), 2000);
    } catch (err) {
      alert('Failed to save growers: ' + err.message);
    } finally {
      setGrowersSaving(false);
    }
  }

  function updateGrower(id, field, value) {
    setGrowers(prev => ({
      ...prev,
      activeGrowers: prev.activeGrowers.map(g =>
        g.id === id ? { ...g, [field]: value } : g
      ),
    }));
  }

  function removeGrower(id) {
    setGrowers(prev => ({
      ...prev,
      activeGrowers: prev.activeGrowers.filter(g => g.id !== id),
    }));
  }

  function addFromDirectory(dirGrower) {
    if (growers.activeGrowers.some(g => g.id === dirGrower.id)) return;
    setGrowers(prev => ({
      ...prev,
      activeGrowers: [...prev.activeGrowers, {
        ...dirGrower,
        multiplier: prev.defaultMultiplier,
        notes: dirGrower.specialty || '',
      }],
    }));
  }

  // ── RENDER ──────────────────────────────────────────────

  return (
    <div className="admin-page">
      <div className="admin-header">
        <a href="/" className="admin-back">← Back to Plant Wizard</a>
        <div className="admin-logo">
          <div className="logo-leaf-sm" />
          <span>Admin</span>
        </div>
      </div>

      {/* ── LOGIN ── */}
      {step === STEPS.LOGIN && (
        <div className="admin-body">
          <div className="admin-card admin-login">
            <div className="admin-icon">🔒</div>
            <h2>Admin Access</h2>
            <p>Enter your admin password to continue.</p>
            <form onSubmit={handleLogin} className="admin-form">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" autoFocus className={authError ? 'error' : ''} />
              {authError && <span className="admin-error-msg">{authError}</span>}
              <button type="submit" className="admin-btn-primary">Continue →</button>
            </form>
          </div>
        </div>
      )}

      {/* ── TABS (after login) ── */}
      {step !== STEPS.LOGIN && (
        <>
          <div className="admin-tabs">
            <button className={`admin-tab${tab === 'upload' ? ' active' : ''}`} onClick={() => setTab('upload')}>
              📋 Upload Availability
            </button>
            <button className={`admin-tab${tab === 'growers' ? ' active' : ''}`} onClick={() => setTab('growers')}>
              🌱 Manage Growers
            </button>
          </div>

          <div className="admin-body">

            {/* ── UPLOAD TAB ── */}
            {tab === 'upload' && (
              <>
                {step === STEPS.UPLOAD && (
                  <div className="admin-card">
                    <div className="admin-icon">📋</div>
                    <h2>Upload Availability PDF</h2>
                    <p>Upload a grower availability sheet. Prices will be multiplied to your retail rate before going live.</p>

                    {/* Grower + Multiplier selector */}
                    <div className="admin-upload-settings">
                      <div className="admin-setting-row">
                        <label>Grower Source</label>
                        <select value={selectedGrowerId} onChange={e => setSelectedGrowerId(e.target.value)}>
                          <option value="combined">Combined / All Growers</option>
                          {growers.activeGrowers.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="admin-setting-row">
                        <label>
                          Price Multiplier
                          <span className="admin-setting-hint">wholesale × multiplier = customer price</span>
                        </label>
                        <div className="admin-multiplier-wrap">
                          <input
                            type="number"
                            min="1" max="10" step="0.1"
                            placeholder={noMultiplier ? '1.0' : effectiveMultiplier.toFixed(1)}
                            value={noMultiplier ? '' : multiplierOverride}
                            onChange={e => setMultiplierOverride(e.target.value)}
                            disabled={noMultiplier}
                            style={noMultiplier ? { opacity: 0.4, pointerEvents: 'none' } : {}}
                          />
                          <span className="admin-multiplier-preview">
                            {noMultiplier
                              ? 'prices used as-is'
                              : `e.g. $50.00 → ${'$' + (50 * effectiveMultiplier).toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                      <div className="admin-setting-row admin-no-multi-row">
                        <label className="admin-checkbox-label">
                          <input
                            type="checkbox"
                            checked={noMultiplier}
                            onChange={e => setNoMultiplier(e.target.checked)}
                          />
                          <span>Prices already include markup</span>
                          <span className="admin-setting-hint">Use when uploading the master availability sheet (retail prices already applied)</span>
                        </label>
                      </div>
                    </div>

                    <div
                      className={`admin-dropzone${dragOver ? ' over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      onClick={() => fileRef.current?.click()}
                    >
                      <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <p><strong>Drag & drop PDF here</strong><br />or click to browse</p>
                      <span className="admin-dropzone-hint">Nature's Cradle Grower Availability PDF</span>
                      <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                        onChange={e => handleFile(e.target.files[0])} />
                    </div>
                  </div>
                )}

                {step === STEPS.PARSING && (
                  <div className="admin-card admin-center">
                    <div className="admin-spinner" />
                    <h2>Parsing PDF…</h2>
                    <p>Reading page {parseProgress.page} of {parseProgress.total || '…'}</p>
                    <div className="admin-progress-bar">
                      <div className="admin-progress-fill"
                        style={{ width: parseProgress.total ? `${Math.round((parseProgress.page / parseProgress.total) * 100)}%` : '3%' }} />
                    </div>
                    <p className="admin-hint">Takes ~30–60s for the full 194-page PDF.</p>
                  </div>
                )}

                {step === STEPS.PREVIEW && result && (
                  <div className="admin-card admin-preview">
                    <div className="admin-icon">✅</div>
                    <h2>Ready to Publish</h2>

                    <div className={`admin-multiplier-badge${noMultiplier ? ' admin-no-multi-badge' : ''}`}>
                      {noMultiplier
                        ? <><strong>No multiplier</strong><span> — prices from sheet used as-is (already retail)</span></>
                        : <>Multiplier applied: <strong>{effectiveMultiplier}×</strong><span> — wholesale prices × {effectiveMultiplier} = retail prices shown to customers</span></>
                      }
                    </div>

                    <div className="admin-stats-grid">
                      <div className="admin-stat"><strong>{result.stats.plantsWithPrices.toLocaleString()}</strong><span>Plants Matched</span></div>
                      <div className="admin-stat"><strong>{result.stats.matched.toLocaleString()}</strong><span>Price Entries</span></div>
                      <div className="admin-stat"><strong>{result.stats.totalPDFEntries.toLocaleString()}</strong><span>PDF Rows</span></div>
                      <div className="admin-stat admin-stat-warn"><strong>{result.stats.unmatched.toLocaleString()}</strong><span>Unmatched</span></div>
                    </div>

                    <div className="admin-sample">
                      <div className="admin-sample-title">
                        {noMultiplier ? 'Sample prices (no multiplier — used as-is)' : `Sample retail prices (after ${effectiveMultiplier}× markup)`}
                      </div>
                      <table className="admin-table">
                        <thead><tr><th>Plant</th><th>{noMultiplier ? 'Sheet Price' : 'Wholesale'}</th><th>{noMultiplier ? 'Customer Price (same)' : '→ Retail (shown to customers)'}</th></tr></thead>
                        <tbody>
                          {result.plants.filter(p => p.availability?.length).slice(0, 6).map(p => (
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              <td style={{ color: 'var(--text-light)' }}>
                                {p.availability[0]?.wholesalePrice}
                              </td>
                              <td>
                                {p.availability.map((a, i) => (
                                  <span key={i} className="admin-price-chip">{a.size} · {a.price}</span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {result.stats.unmatchedSample.length > 0 && (
                      <details className="admin-unmatched">
                        <summary>Unmatched names (first {result.stats.unmatchedSample.length})</summary>
                        <ul>{result.stats.unmatchedSample.map((n, i) => <li key={i}>{n}</li>)}</ul>
                      </details>
                    )}

                    {publishError && <p className="admin-error-msg" style={{ marginTop: 12 }}>{publishError}</p>}

                    <div className="admin-actions">
                      <button className="admin-btn-secondary" onClick={() => setStep(STEPS.UPLOAD)}>← Try Different PDF</button>
                      <button className="admin-btn-primary" onClick={handlePublish}>Publish to Live Site →</button>
                    </div>
                  </div>
                )}

                {step === STEPS.PUBLISHING && (
                  <div className="admin-card admin-center">
                    <div className="admin-spinner" />
                    <h2>Publishing…</h2>
                    <p>Committing updated prices to GitHub. Vercel will redeploy automatically.</p>
                  </div>
                )}

                {step === STEPS.DONE && (
                  <div className="admin-card admin-center">
                    <div className="admin-success-icon">🌿</div>
                    <h2>Published!</h2>
                    <p>Retail prices are live. Vercel is redeploying — changes appear in ~60 seconds.</p>
                    {commitSha && (
                      <a href={`https://github.com/verrucosity/natures-cradle-plant-finder/commit/${commitSha}`}
                        target="_blank" rel="noreferrer" className="admin-commit-link">
                        View commit →
                      </a>
                    )}
                    <div className="admin-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                      <button className="admin-btn-primary" onClick={() => { setStep(STEPS.UPLOAD); setResult(null); }}>
                        Upload Next Week's PDF
                      </button>
                      <a href="/" className="admin-btn-secondary">Go to Site</a>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── GROWERS TAB ── */}
            {tab === 'growers' && (
              <div className="admin-card" style={{ maxWidth: 760 }}>
                <div className="admin-growers-header">
                  <div>
                    <h2>Wholesale Growers</h2>
                    <p style={{ marginBottom: 0 }}>
                      Growers within 100 miles of Eastchester, NY. Each grower's multiplier overrides the default when uploading their PDF.
                    </p>
                  </div>
                  <div className="admin-default-multi">
                    <label>Default Multiplier</label>
                    <input
                      type="number" min="1" max="10" step="0.1"
                      value={growers.defaultMultiplier}
                      onChange={e => setGrowers(prev => ({ ...prev, defaultMultiplier: parseFloat(e.target.value) || 2.0 }))}
                    />
                  </div>
                </div>

                {/* Active growers */}
                <div className="admin-section-title">Active Growers ({growers.activeGrowers.length})</div>
                {growers.activeGrowers.length === 0 && (
                  <p className="admin-hint" style={{ marginBottom: 16 }}>No growers added yet. Add from the directory below.</p>
                )}
                <div className="admin-growers-list">
                  {growers.activeGrowers.map(g => (
                    <div key={g.id} className="admin-grower-row">
                      <div className="admin-grower-info">
                        <span className="admin-grower-name">{g.name}</span>
                        <span className="admin-grower-loc">📍 {g.location} · {g.distanceMiles} mi</span>
                      </div>
                      <div className="admin-grower-controls">
                        <div className="admin-grower-multi-wrap">
                          <span>Multiplier</span>
                          <input
                            type="number" min="1" max="10" step="0.1"
                            value={g.multiplier}
                            onChange={e => updateGrower(g.id, 'multiplier', parseFloat(e.target.value) || 2.0)}
                          />
                        </div>
                        <button className="admin-grower-remove" onClick={() => removeGrower(g.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="admin-actions" style={{ marginBottom: 28 }}>
                  <button
                    className="admin-btn-primary"
                    onClick={() => saveGrowers(growers)}
                    disabled={growersSaving}
                  >
                    {growersSaving ? 'Saving…' : growersSaved ? '✓ Saved!' : 'Save Grower Settings'}
                  </button>
                </div>

                {/* Directory */}
                <div className="admin-section-title">Add from Directory — within 100 miles</div>
                <div className="admin-directory-list">
                  {GROWER_DIRECTORY.filter(d => !growers.activeGrowers.some(g => g.id === d.id)).map(d => (
                    <div key={d.id} className="admin-dir-row">
                      <div className="admin-grower-info">
                        <span className="admin-grower-name">{d.name}</span>
                        <span className="admin-grower-loc">📍 {d.location} · {d.distanceMiles} mi · {d.specialty}</span>
                      </div>
                      <button className="admin-btn-add" onClick={() => addFromDirectory(d)}>+ Add</button>
                    </div>
                  ))}
                  {GROWER_DIRECTORY.filter(d => !growers.activeGrowers.some(g => g.id === d.id)).length === 0 && (
                    <p className="admin-hint">All directory growers have been added.</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
