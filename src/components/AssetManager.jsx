import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { getDirectUrl, getSourceType } from '../utils/assetUtils';
import './AssetManager.css';

const CATEGORIES = ['Education', 'Matrimony', 'MeghPush', 'Election', 'Samaj', 'General'];

const ASSET_TYPES = [
  { value: 'pdf', label: '📄 PDF Document' },
  { value: 'image', label: '🖼️ Image' },
  { value: 'link', label: '🔗 External Link' },
];

export default function AssetManager({ assets = [], setAssets }) {
  const [form, setForm] = useState({
    title: '',
    category: 'Education',
    type: 'pdf',
    source: 'upload', // 'upload' or 'link'
    url: '',
    description: '',
  });
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');

  const handleFormChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !form.title.trim()) {
      alert('Please fill in a Title before uploading.');
      return;
    }
    setUploading(true);
    try {
      const storageRef = ref(storage, `site_assets/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setForm(prev => ({ ...prev, url: downloadURL }));
    } catch (error) {
      console.error('Asset upload failed:', error);
      alert(`Upload failed: ${error.code || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = () => {
    if (!form.title.trim()) { alert('Please enter a title.'); return; }
    if (!form.url.trim() || form.url === 'https://') { alert('Please upload a file or paste a valid URL.'); return; }

    const newAsset = {
      id: `asset_${Date.now()}`,
      ...form,
      url: form.url,
      createdAt: new Date().toISOString(),
    };
    setAssets(prev => [newAsset, ...prev]);
    setForm({ title: '', category: 'Education', type: 'pdf', source: 'upload', url: '', description: '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const asset = assets.find(a => a.id === id);
    if (asset && getSourceType(asset.url) === 'firebase') {
      try {
        await deleteObject(ref(storage, asset.url));
      } catch (err) {
        console.error('Storage cleanup failed:', err);
      }
    }
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const filtered = filterCategory === 'All'
    ? assets
    : assets.filter(a => a.category === filterCategory);

  return (
    <div className="asset-manager">
      <h3 className="am-title">📂 Document & Asset Manager</h3>
      <p className="am-subtitle">Upload PDFs, images, and links — assign them to website sections.</p>

      {/* Add New Asset Form */}
      <div className="am-form card">
        <h4>+ Add New Asset</h4>
        <div className="am-form-grid">
          <div className="am-field">
            <label>Title *</label>
            <input
              type="text"
              placeholder="e.g. Scholarship Form 2024"
              value={form.title}
              onChange={e => handleFormChange('title', e.target.value)}
            />
          </div>
          <div className="am-field">
            <label>Category *</label>
            <select value={form.category} onChange={e => handleFormChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="am-field">
            <label>Asset Type</label>
            <select value={form.type} onChange={e => handleFormChange('type', e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="am-field">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Short description..."
              value={form.description}
              onChange={e => handleFormChange('description', e.target.value)}
            />
          </div>
        </div>

        {/* Source Selection */}
        <div className="am-source-tabs">
          <button
            className={`am-tab ${form.source === 'upload' ? 'active' : ''}`}
            onClick={() => handleFormChange('source', 'upload')}
          >
            ☁️ Upload to Firebase
          </button>
          <button
            className={`am-tab ${form.source === 'link' ? 'active' : ''}`}
            onClick={() => { handleFormChange('source', 'link'); handleFormChange('url', ''); }}
          >
            🔗 Google Drive / External URL
          </button>
        </div>

        {form.source === 'upload' ? (
          <div className="am-upload-area">
            <input
              type="file"
              accept={form.type === 'image' ? 'image/*' : form.type === 'pdf' ? '.pdf' : '*/*'}
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {uploading && <span className="uploading-indicator">⏳ Uploading to Firebase...</span>}
            {form.url && !uploading && (
              <div className="am-url-preview">
                ✅ Uploaded: <a href={form.url} target="_blank" rel="noreferrer">Preview File</a>
              </div>
            )}
          </div>
        ) : (
          <div className="am-link-area">
            <input
              type="text"
              className="am-url-input"
              placeholder="Paste Google Drive share link or direct URL..."
              value={form.url}
              onChange={e => handleFormChange('url', e.target.value)}
            />
            <p className="am-hint">💡 Paste the "Anyone with the link can view" sharing URL from Google Drive.</p>
          </div>
        )}

        <button className="am-add-btn" onClick={handleAdd}>
          + Add Asset
        </button>
      </div>

      {/* Filter & List */}
      <div className="am-list-header">
        <h4>Saved Assets</h4>
        <div className="am-filter-tabs">
          <button className={`am-filter-btn ${filterCategory === 'All' ? 'active' : ''}`} onClick={() => setFilterCategory('All')}>All</button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`am-filter-btn ${filterCategory === c ? 'active' : ''}`}
              onClick={() => setFilterCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="am-empty">No assets in this category yet.</div>
      ) : (
        <div className="am-asset-list">
          {filtered.map(asset => (
            <div key={asset.id} className="am-asset-row">
              <div className="am-asset-icon">
                {asset.type === 'pdf' ? '📄' : asset.type === 'image' ? '🖼️' : '🔗'}
              </div>
              <div className="am-asset-info">
                <span className="am-asset-title">{asset.title}</span>
                <div className="am-asset-meta">
                  <span className="am-badge">{asset.category}</span>
                  <span className="am-source-badge">
                    {getSourceType(asset.url) === 'firebase' ? '☁️ Firebase' : '🔗 External'}
                  </span>
                  {asset.description && <span className="am-desc">{asset.description}</span>}
                </div>
              </div>
              <div className="am-asset-actions">
                <a
                  href={getDirectUrl(asset.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="am-open-btn"
                >
                  Open
                </a>
                <button className="am-delete-btn" onClick={() => handleDelete(asset.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
