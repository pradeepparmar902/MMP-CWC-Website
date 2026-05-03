import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import SectionPage from './SectionPage';
import './ElectionCard.css';

// ─────────────────────────────────────────────────────────────────────────────
// 🛠️  Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 🛠️  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a published Google Sheet CSV string into array of row objects */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle commas inside quoted fields
    const cols = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

/** Convert Google Drive share link → embeddable preview link */
function toPreviewUrl(driveLink) {
  if (!driveLink) return null;
  // Match file ID from various Drive URL formats
  const match = driveLink.match(/\/d\/([\w-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  // Already a direct/preview link
  if (driveLink.includes('drive.google.com')) return driveLink;
  return driveLink;
}

/** Determine if a Drive link points to an image */
function isImageLink(link) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🖼️  Card Viewer Modal
// ─────────────────────────────────────────────────────────────────────────────
function CardViewerModal({ card, onClose }) {
  const previewUrl = toPreviewUrl(card?.cardLink);
  const isImage = isImageLink(card?.cardLink || '');

  return createPortal(
    <div className="ec-viewer-overlay" onClick={onClose}>
      <div className="ec-viewer-modal" onClick={e => e.stopPropagation()}>
        <div className="ec-viewer-header">
          <div className="ec-viewer-info">
            <h3>🆔 {card?.name}</h3>
            <span className="ec-viewer-meta">{card?.membershipNo} • {card?.vibhag} • {card?.year}</span>
          </div>
          <button className="ec-viewer-close" onClick={onClose}>✕</button>
        </div>
        <div className="ec-viewer-body">
          {previewUrl ? (
            isImage ? (
              <img src={previewUrl} alt="Election Card" className="ec-viewer-image" />
            ) : (
              <iframe
                src={previewUrl}
                title="Election Card"
                className="ec-viewer-iframe"
                allow="autoplay"
              />
            )
          ) : (
            <div className="ec-no-card">
              <span>📄</span>
              <p>Card preview not available</p>
              {card?.cardLink && (
                <a href={card.cardLink} target="_blank" rel="noreferrer" className="ec-open-btn">
                  Open in Google Drive ↗
                </a>
              )}
            </div>
          )}
        </div>
        {card?.cardLink && (
          <div className="ec-viewer-footer">
            <a href={card.cardLink} target="_blank" rel="noreferrer" className="ec-open-drive-btn">
              🔗 Open in Google Drive
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🪪  Member's Own Card
// ─────────────────────────────────────────────────────────────────────────────
function MyElectionCard({ membershipNo, allCards }) {
  const [viewCard, setViewCard] = useState(null);

  const myCard = allCards.find(
    c => c.membershipNo?.trim().toLowerCase() === membershipNo?.trim().toLowerCase()
  );

  if (!membershipNo) {
    return (
      <div className="ec-my-card ec-no-membership">
        <span className="ec-big-icon">🆔</span>
        <h3>Membership Number Not Set</h3>
        <p>Please update your membership number in your profile to view your election card.</p>
      </div>
    );
  }

  if (!myCard) {
    return (
      <div className="ec-my-card ec-not-found">
        <span className="ec-big-icon">🔍</span>
        <h3>Card Not Found</h3>
        <p>No election card found for membership number <strong>{membershipNo}</strong>.</p>
        <p className="ec-hint">If you believe this is an error, please contact the admin.</p>
      </div>
    );
  }

  return (
    <>
      <div className="ec-my-card ec-found">
        <div className="ec-card-visual">
          <div className="ec-card-logo">🗳️</div>
          <div className="ec-card-badge">{myCard.status === 'Active' ? '✅ Active' : '⚠️ ' + (myCard.status || 'Pending')}</div>
        </div>
        <div className="ec-card-details">
          <h2 className="ec-card-name">{myCard.name}</h2>
          <div className="ec-detail-grid">
            <div className="ec-detail-item">
              <span className="ec-detail-label">Membership No</span>
              <span className="ec-detail-value ec-id-pill">{myCard.membershipNo}</span>
            </div>
            <div className="ec-detail-item">
              <span className="ec-detail-label">Vibhag / Zone</span>
              <span className="ec-detail-value">{myCard.vibhag || '—'}</span>
            </div>
            <div className="ec-detail-item">
              <span className="ec-detail-label">Year</span>
              <span className="ec-detail-value">{myCard.year || '—'}</span>
            </div>
            <div className="ec-detail-item">
              <span className="ec-detail-label">Mobile</span>
              <span className="ec-detail-value">{myCard.mobile || '—'}</span>
            </div>
          </div>
          <button className="ec-view-btn" onClick={() => setViewCard(myCard)}>
            📄 View My Election Card
          </button>
        </div>
      </div>
      {viewCard && <CardViewerModal card={viewCard} onClose={() => setViewCard(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📋  Admin Table
// ─────────────────────────────────────────────────────────────────────────────
function AdminCardTable({ allCards }) {
  const [search, setSearch] = useState('');
  const [viewCard, setViewCard] = useState(null);

  const filtered = allCards.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.membershipNo?.toLowerCase().includes(search.toLowerCase()) ||
    c.vibhag?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="ec-admin-table-section">
        <div className="ec-admin-header">
          <h3>📋 All Election Cards Registry</h3>
          <input
            type="text"
            placeholder="🔍 Search name, ID, or zone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ec-search"
          />
        </div>
        <div className="ec-table-wrap">
          <table className="ec-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Membership No</th>
                <th>Vibhag</th>
                <th>Mobile</th>
                <th>Year</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="ec-empty-row">No records found</td></tr>
              ) : filtered.map((card, i) => (
                <tr key={i} className={card.cardLink ? '' : 'ec-row-no-card'}>
                  <td>{i + 1}</td>
                  <td className="ec-td-name">{card.name}</td>
                  <td><span className="ec-id-pill-sm">{card.membershipNo}</span></td>
                  <td>{card.vibhag}</td>
                  <td>{card.mobile}</td>
                  <td>{card.year}</td>
                  <td>
                    <span className={`ec-status-badge ${card.status === 'Active' ? 'active' : 'inactive'}`}>
                      {card.status || 'Pending'}
                    </span>
                  </td>
                  <td>
                    {card.cardLink ? (
                      <button className="ec-view-btn-sm" onClick={() => setViewCard(card)}>
                        👁 View
                      </button>
                    ) : (
                      <span className="ec-no-file">No File</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ec-table-count">{filtered.length} of {allCards.length} records</p>
        </div>
      </div>
      {viewCard && <CardViewerModal card={viewCard} onClose={() => setViewCard(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏠  Main ElectionCard Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ElectionCard() {
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  const [allCards, setAllCards] = useState([]);
  const [fetchState, setFetchState] = useState('loading'); // 'loading' | 'done' | 'error' | 'no-config'
  const [membershipNo, setMembershipNo] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Dynamic Config State
  const [configUrl, setConfigUrl] = useState('');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [newConfigUrl, setNewConfigUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // 1. Load Config & User's membership number from Firestore
  useEffect(() => {
    const loadConfigAndProfile = async () => {
      // Load Config First
      try {
        const configDoc = await getDoc(doc(db, 'site_settings', 'election_card'));
        if (configDoc.exists() && configDoc.data().sheetUrl) {
          setConfigUrl(configDoc.data().sheetUrl);
          setNewConfigUrl(configDoc.data().sheetUrl);
        } else {
          setFetchState('no-config');
        }
      } catch (e) {
        console.error('Error loading config:', e);
        setFetchState('error');
      }

      // Load Profile
      if (currentUser) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
          if (adminDoc.exists() && adminDoc.data().membershipNo) {
            setMembershipNo(adminDoc.data().membershipNo);
          } else {
            const pendingDoc = await getDoc(doc(db, 'pending_users', currentUser.uid));
            if (pendingDoc.exists()) {
              const data = pendingDoc.data();
              setMembershipNo(data.membershipNo || data.profile?.membershipNo || '');
            }
          }
        } catch (e) {
          console.error('Error loading membership no:', e);
        }
      }
      setProfileLoading(false);
    };
    
    loadConfigAndProfile();
  }, [currentUser]);

  // 2. Fetch Google Sheet CSV
  const fetchCards = useCallback(async () => {
    if (!configUrl) return;
    
    setFetchState('loading');
    try {
      const res = await fetch(`${configUrl}&cachebust=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      const rows = parseCSV(csv);
      // Normalize column headers (case-insensitive mapping)
      const normalized = rows.map(row => {
        const k = key => Object.entries(row).find(([h]) => h.toLowerCase().replace(/\s+/g,'') === key)?.[1] || '';
        return {
          name:         k('fullname') || k('name'),
          membershipNo: k('membershipno') || k('membershipnumber') || k('id'),
          vibhag:       k('vibhag') || k('zone') || k('area'),
          mobile:       k('mobile') || k('phone') || k('contact'),
          year:         k('year'),
          fileName:     k('filename') || k('cardfilename'),
          cardLink:     k('cardlink') || k('drivelink') || k('cardurl'),
          status:       k('status') || 'Active',
        };
      }).filter(r => r.name || r.membershipNo);
      setAllCards(normalized);
      setFetchState('done');
    } catch (e) {
      console.error('Sheet fetch error:', e);
      setFetchState('error');
    }
  }, [configUrl]);

  useEffect(() => { 
    if (configUrl) {
      fetchCards(); 
    }
  }, [fetchCards, configUrl]);

  const handleSaveConfig = async () => {
    if (!newConfigUrl.trim()) return;
    setSavingConfig(true);
    try {
      await setDoc(doc(db, 'site_settings', 'election_card'), {
        sheetUrl: newConfigUrl.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.uid
      }, { merge: true });
      setConfigUrl(newConfigUrl.trim());
      setIsEditingConfig(false);
      setFetchState('loading'); // will trigger fetchCards due to useEffect
    } catch (e) {
      alert("Failed to save configuration: " + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (profileLoading) {
    return <div className="ec-loading"><div className="ec-spinner" /><p>Loading...</p></div>;
  }

  return (
    <div className="ec-page">

      {/* ── PAGE TITLE ─────────────────────────────────────────────────────── */}
      <div className="ec-page-header">
        <div className="ec-page-title-row">
          <span className="ec-page-icon">🆔</span>
          <div>
            <h1 className="ec-page-title">Election Card</h1>
            <p className="ec-page-subtitle">Mumbai Meghwal Panchayat — Membership Identity</p>
          </div>
        </div>
      </div>

      {/* ── ADMIN CONFIG SETTINGS ─────────────────────────────────────────── */}
      {canManage && (fetchState === 'no-config' || isEditingConfig) && (
        <div className="ec-setup-banner" style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span>⚙️</span>
            <strong style={{ fontSize: '1.1rem' }}>Election Card Configuration</strong>
          </div>
          <p style={{ marginBottom: '16px' }}>Paste the published CSV link from your Google Sheet below to connect the database.</p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              type="url" 
              value={newConfigUrl} 
              onChange={e => setNewConfigUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
              style={{ flex: 1, minWidth: '300px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              disabled={savingConfig}
            />
            <button 
              onClick={handleSaveConfig} 
              disabled={savingConfig || !newConfigUrl}
              style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: savingConfig ? 'not-allowed' : 'pointer' }}
            >
              {savingConfig ? 'Saving...' : 'Connect Database'}
            </button>
            {isEditingConfig && fetchState !== 'no-config' && (
              <button 
                onClick={() => { setIsEditingConfig(false); setNewConfigUrl(configUrl); }}
                style={{ padding: '10px 20px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
          <div style={{ marginTop: '16px', fontSize: '0.8rem', opacity: 0.8, background: 'rgba(0,0,0,0.05)', padding: '12px', borderRadius: '6px' }}>
            <strong>How to get the link:</strong> Open Google Sheet → File → Share → Publish to web → Select "Comma-separated values (.csv)" → Click Publish → Copy the generated link.
          </div>
        </div>
      )}

      {/* ── ADMIN EDIT BUTTON (When configured) ───────────────────────────── */}
      {canManage && fetchState === 'done' && !isEditingConfig && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 16px 12px' }}>
          <button 
            onClick={() => setIsEditingConfig(true)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <span>⚙️</span> Edit Database Connection
          </button>
        </div>
      )}

      {/* ── SHEET NOT CONFIGURED (For regular users) ─────────────────────── */}
      {!canManage && fetchState === 'no-config' && (
        <div className="ec-setup-banner">
          <span>⏳</span>
          <div>
            <strong>System Maintenance</strong>
            <p>The election card database is currently being updated. Please check back later.</p>
          </div>
        </div>
      )}

      {/* ── LOADING / ERROR ────────────────────────────────────────────────── */}
      {fetchState === 'loading' && (
        <div className="ec-loading"><div className="ec-spinner" /><p>Loading cards registry...</p></div>
      )}
      {fetchState === 'error' && (
        <div className="ec-error-banner">
          <span>⚠️</span>
          <div>
            <strong>Could not load election cards registry</strong>
            <p>Check your internet connection or Google Sheet URL.</p>
          </div>
          <button className="ec-retry-btn" onClick={fetchCards}>Retry</button>
        </div>
      )}

      {/* ── MEMBER VIEW — Their Own Card ───────────────────────────────────── */}
      {!canManage && fetchState === 'done' && (
        <MyElectionCard membershipNo={membershipNo} allCards={allCards} />
      )}

      {/* ── ADMIN VIEW — Full Table ────────────────────────────────────────── */}
      {canManage && fetchState === 'done' && (
        <AdminCardTable allCards={allCards} />
      )}

      {/* ── ELECTION NEWS FEED (SectionPage) ──────────────────────────────── */}
      <div className="ec-news-section">
        <SectionPage
          collectionName="election_posts"
          bilingual={true}
          adminRoles={['isSuperAdmin']}
        />
      </div>

    </div>
  );
}
