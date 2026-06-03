import { useState, useRef, useCallback } from 'react';
import { parsePDF } from '../utils/parsePDF';
import { mergePrices } from '../utils/matchPlants';
import PLANTS from '../data/plants.json';
import './AdminPage.css';

const STEPS = {
  LOGIN: 'login', UPLOAD: 'upload', PARSING: 'parsing',
  PREVIEW: 'preview', PUBLISHING: 'publishing', DONE: 'done',
};

export default function AdminPage() {
  const [step, setStep]         = useState(STEPS.LOGIN);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState({ page: 0, total: 0 });
  const [result, setResult]     = useState(null);
  const [publishError, setPublishError] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const fileRef = useRef();

  // Password is checked server-side — client just stores what was typed
  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    if (!password.trim()) { setAuthError('Enter a password'); return; }
    // Validate against server immediately with a lightweight ping
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
      const merged = mergePrices(PLANTS, entries);
      setResult(merged);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      alert('Failed to parse PDF: ' + err.message);
      setStep(STEPS.UPLOAD);
    }
  }, []);

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

  return (
    <div className="admin-page">
      <div className="admin-header">
        <a href="/" className="admin-back">← Back to Plant Wizard</a>
        <div className="admin-logo">
          <div className="logo-leaf-sm" />
          <span>Admin · Availability Upload</span>
        </div>
      </div>

      <div className="admin-body">

        {/* ── LOGIN ── */}
        {step === STEPS.LOGIN && (
          <div className="admin-card admin-login">
            <div className="admin-icon">🔒</div>
            <h2>Admin Access</h2>
            <p>Enter the admin password to upload the weekly availability PDF.</p>
            <form onSubmit={handleLogin} className="admin-form">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className={authError ? 'error' : ''}
              />
              {authError && <span className="admin-error-msg">{authError}</span>}
              <button type="submit" className="admin-btn-primary">Continue →</button>
            </form>
          </div>
        )}

        {/* ── UPLOAD ── */}
        {step === STEPS.UPLOAD && (
          <div className="admin-card">
            <div className="admin-icon">📋</div>
            <h2>Upload Availability PDF</h2>
            <p>Drop the weekly grower availability PDF. Plants with matching names will get their prices and sizes updated automatically.</p>
            <div
              className={`admin-dropzone${dragOver ? ' over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p><strong>Drag & drop PDF here</strong><br />or click to browse</p>
              <span className="admin-dropzone-hint">Nature's Cradle Nursery-Grower Availability PDF</span>
              <input
                ref={fileRef} type="file" accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {/* ── PARSING ── */}
        {step === STEPS.PARSING && (
          <div className="admin-card admin-center">
            <div className="admin-spinner" />
            <h2>Parsing PDF…</h2>
            <p>Reading page {parseProgress.page} of {parseProgress.total || '…'}</p>
            <div className="admin-progress-bar">
              <div
                className="admin-progress-fill"
                style={{ width: parseProgress.total ? `${Math.round((parseProgress.page / parseProgress.total) * 100)}%` : '3%' }}
              />
            </div>
            <p className="admin-hint">Takes about 30–60 s for the full 194-page PDF.</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === STEPS.PREVIEW && result && (
          <div className="admin-card admin-preview">
            <div className="admin-icon">✅</div>
            <h2>Ready to Publish</h2>

            <div className="admin-stats-grid">
              <div className="admin-stat">
                <strong>{result.stats.plantsWithPrices.toLocaleString()}</strong>
                <span>Plants Matched</span>
              </div>
              <div className="admin-stat">
                <strong>{result.stats.matched.toLocaleString()}</strong>
                <span>Price Entries</span>
              </div>
              <div className="admin-stat">
                <strong>{result.stats.totalPDFEntries.toLocaleString()}</strong>
                <span>PDF Rows</span>
              </div>
              <div className="admin-stat admin-stat-warn">
                <strong>{result.stats.unmatched.toLocaleString()}</strong>
                <span>Unmatched</span>
              </div>
            </div>

            <div className="admin-sample">
              <div className="admin-sample-title">Sample matched plants</div>
              <table className="admin-table">
                <thead><tr><th>Plant</th><th>Sizes & Prices</th></tr></thead>
                <tbody>
                  {result.plants
                    .filter(p => p.availability?.length)
                    .slice(0, 8)
                    .map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>
                          {p.availability.map((a, i) => (
                            <span key={i} className="admin-price-chip">
                              {a.size} · {a.price}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {result.stats.unmatchedSample.length > 0 && (
              <details className="admin-unmatched">
                <summary>Unmatched PDF names (first {result.stats.unmatchedSample.length})</summary>
                <ul>{result.stats.unmatchedSample.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </details>
            )}

            {publishError && <p className="admin-error-msg" style={{ marginTop: 12 }}>{publishError}</p>}

            <div className="admin-actions">
              <button className="admin-btn-secondary" onClick={() => setStep(STEPS.UPLOAD)}>
                ← Try Different PDF
              </button>
              <button className="admin-btn-primary" onClick={handlePublish}>
                Publish to Live Site →
              </button>
            </div>
          </div>
        )}

        {/* ── PUBLISHING ── */}
        {step === STEPS.PUBLISHING && (
          <div className="admin-card admin-center">
            <div className="admin-spinner" />
            <h2>Publishing…</h2>
            <p>Committing updated prices to GitHub. Vercel will redeploy automatically.</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === STEPS.DONE && (
          <div className="admin-card admin-center">
            <div className="admin-success-icon">🌿</div>
            <h2>Published!</h2>
            <p>Prices and sizes are live. Vercel is redeploying — changes will appear in ~60 seconds.</p>
            {commitSha && (
              <a
                href={`https://github.com/verrucosity/natures-cradle-plant-finder/commit/${commitSha}`}
                target="_blank" rel="noreferrer" className="admin-commit-link"
              >
                View commit on GitHub →
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

      </div>
    </div>
  );
}
