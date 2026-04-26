import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { getDirectUrl, getSourceType } from '../utils/assetUtils';
import { useAuth } from '../context/AuthContext';
import AssetManager from './AssetManager';
import './AdminPanel.css';

export default function AdminPanel({ config, setConfig, syncStatus, assets, setAssets }) {
  const { isSuperAdmin } = useAuth();
  const [uploadingMap, setUploadingMap] = useState({});
  const [uploadLog, setUploadLog] = useState([]);

  const handleElementChange = (id, field, value) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, [field]: value } : el
      )
    }));
  };

  const handleGlobalChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleNavItemChange = (id, key, value) => {
    const newItems = config.navItems.map(item => 
      item.id === id ? { ...item, [key]: value } : item
    );
    handleGlobalChange('navItems', newItems);
  };

  const moveNavItem = (index, direction) => {
    const newItems = [...config.navItems];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < newItems.length) {
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      handleGlobalChange('navItems', newItems);
    }
  };

  const addNavItem = () => {
    const newId = `nav_${Date.now()}`;
    const newItem = { id: newId, label: 'New Page', color: '#6366F1', visible: true };
    handleGlobalChange('navItems', [...(config.navItems || []), newItem]);
  };

  const removeNavItem = (id) => {
    const item = config.navItems.find(i => i.id === id);
    if (item?.protected) {
      alert("This item is protected and cannot be deleted.");
      return;
    }
    handleGlobalChange('navItems', config.navItems.filter(item => item.id !== id));
  };
  
  /**
   * Extracts the storage object path from a Firebase download URL.
   * URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?...
   */
  const extractFirebasePath = (url) => {
    try {
      const match = url.match(/\/o\/([^?#]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  };

  const deleteFromStorage = async (url, storagePath, logFn) => {
    const path = storagePath
      || (url && url.includes('firebasestorage.googleapis.com') ? extractFirebasePath(url) : null);

    const log = logFn || ((msg) => console.log(msg));

    if (!path) {
      log('🔗 External link — no Firebase file to delete.');
      return;
    }
    log(`🗑️ Attempting delete: ${path}`);
    try {
      await deleteObject(ref(storage, path));
      log('✅ File permanently deleted from Firebase Storage!');
    } catch (error) {
      if (error.code === 'storage/object-not-found') {
        log('⚠️ File was already deleted or not found in Storage.');
      } else {
        log(`❌ Delete failed: ${error.code} — ${error.message}`);
        console.error('Delete failed:', error);
      }
    }
  };

  const removeImage = async (id) => {
    const el = config.elements.find(el => el.id === id);
    if (el && el.url) {
      setUploadLog([`🗑️ Removing image from: ${el.name || id}`]);
      await deleteFromStorage(el.url, el.storagePath, (msg) => {
        setUploadLog(prev => [...prev, msg]);
      });
      setConfig(prev => ({
        ...prev,
        elements: prev.elements.map(e =>
          e.id === id ? { ...e, url: '', storagePath: '' } : e
        )
      }));
    } else {
      setUploadLog(['⚠️ No image URL found on this element to remove.']);
    }
  };

  const handleImageUpload = async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingMap(prev => ({ ...prev, [id]: true }));
    setUploadLog([`[1/4] Starting upload: ${file.name} (${(file.size/1024).toFixed(1)} KB)`]);

    try {
      // Cleanup old image (background, no await)
      const oldElement = config.elements.find(el => el.id === id);
      if (oldElement?.url) {
        deleteFromStorage(oldElement.url, oldElement.storagePath);
      }

      const path = `banner_images/${id}_${Date.now()}`;
      const storageRef = ref(storage, path);

      setUploadLog(prev => [...prev, `[2/4] Uploading to Firebase bucket: ${path}`]);
      const snapshot = await uploadBytes(storageRef, file);
      
      setUploadLog(prev => [...prev, `[3/4] Upload OK (${snapshot.totalBytes} bytes). Getting URL...`]);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUploadLog(prev => [...prev, `[4/4] ✅ Done! URL acquired. Updating preview...`]);

      setConfig(prev => ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === id ? { ...el, url: downloadURL, storagePath: path } : el
        )
      }));
    } catch (error) {
      const msg = `❌ ERROR: ${error.code || error.message}`;
      setUploadLog(prev => [...prev, msg]);
      console.error('UPLOAD ERROR:', error);
      alert(`Upload failed: ${error.code || error.message}\n\nCheck the upload log in the Admin Panel for details.`);
    } finally {
      setUploadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const addElement = () => {
    const newId = Date.now().toString();
    const currentElements = config.elements || [];
    const newElement = {
      id: newId,
      name: `New Image ${currentElements.length + 1}`,
      url: '',
      width: 150,
      height: 150,
      scale: 1,
      x: 10,
      y: 10
    };
    setConfig(prev => ({
      ...prev,
      elements: [...(prev.elements || []), newElement]
    }));
  };

  const removeElement = (id) => {
    if (!confirm('Are you sure you want to delete this image slot completely?')) return;
    
    setConfig(prev => {
      const elements = prev.elements || [];
      const target = elements.find(el => String(el.id) === String(id));
      
      // Delete from Firebase Storage using stored path (most reliable)
      if (target) {
        deleteFromStorage(target.url, target.storagePath);
      }

      return {
        ...prev,
        elements: elements.filter(el => String(el.id) !== String(id))
      };
    });
  };

  const fitBannerToContent = () => {
    if (!config.elements || config.elements.length === 0) {
      handleGlobalChange('bannerHeight', 40);
      return;
    }

    let maxHeightNeeded = 10;

    config.elements.forEach(el => {
      if (!el.url) return;
      
      const scaledHeight = el.height * el.scale;
      const yFactor = el.y / 100;
      
      // Accounting for transform-origin: center (default)
      // Visual bottom is roughly top + (originalHeight + scaledHeight) / 2
      if (yFactor < 1) {
        const requiredH = (el.height * (1 + el.scale) / 2) / (1 - yFactor);
        if (requiredH > maxHeightNeeded) maxHeightNeeded = requiredH;
      } else {
        const requiredH = (el.y/100 * config.bannerHeight) + (el.height * (1 + el.scale) / 2);
        if (requiredH > maxHeightNeeded) maxHeightNeeded = requiredH;
      }
    });

    // Reduce padding by taking a tight ceiling
    handleGlobalChange('bannerHeight', Math.ceil(Math.min(maxHeightNeeded, 1500)));
  };

  return (
    <section className="admin-panel container">
      <div className="admin-header">
        <div className="admin-title-group">
          <h2 className="admin-title">Canvas Banner Management</h2>
          <div className={`sync-indicator ${syncStatus.startsWith('error') ? 'error' : syncStatus}`}>
            {syncStatus === 'saving' && '⏳ Saving to Cloud...'}
            {syncStatus === 'synced' && '✅ All changes synced'}
            {syncStatus.startsWith('error') && `❌ ${syncStatus.replace('error: ', '')}`}
          </div>
        </div>
        <div className="admin-actions">
          <button className="fit-btn" onClick={fitBannerToContent} title="Auto-calculate height to fit images">
            📏 Auto-Fit Height
          </button>
          <button className="add-element-btn" onClick={addElement}>+ Add New Image</button>
        </div>
      </div>

      {uploadLog.length > 0 && (
        <div className="upload-log-panel">
          <div className="upload-log-header">
            <span>📡 Upload Status</span>
            <button className="upload-log-clear" onClick={() => setUploadLog([])}>✕ Clear</button>
          </div>
          {uploadLog.map((line, i) => (
            <div key={i} className={`upload-log-line ${line.includes('❌') ? 'error' : line.includes('✅') ? 'success' : ''}`}>
              {line}
            </div>
          ))}
        </div>
      )}
      
      <div className="admin-grid">
        {config.elements.map((el) => (
          <div key={el.id} className="slot-editor card element-card">
            <div className="element-card-header">
              <input 
                type="text" 
                className="element-name-input" 
                value={el.name} 
                onChange={(e) => handleElementChange(el.id, 'name', e.target.value)}
              />
              <button 
                type="button"
                className="delete-btn" 
                onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                title="Delete this image"
              >
                🗑️
              </button>
            </div>
            
            <div className="control-group">
              <label>Source Type</label>
              <div className="source-toggle">
                <button 
                  className={`toggle-btn ${!el.url || getSourceType(el.url) === 'firebase' ? 'active' : ''}`}
                  onClick={() => {/* purely visual or handling logic if needed */}}
                >
                  ☁️ Firebase
                </button>
                <button 
                  className={`toggle-btn ${el.url && getSourceType(el.url) !== 'firebase' ? 'active' : ''}`}
                  onClick={() => {/* purely visual */}}
                >
                  🔗 External / Drive
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>Current Image Preview</label>
              <div className="element-preview-box">
                {el.url ? (
                  <img src={getDirectUrl(el.url)} alt="Preview" className="admin-thumb-preview" />
                ) : (
                  <div className="thumb-placeholder">No Image</div>
                )}
              </div>
            </div>

            <div className="control-group">
              <label>
                {el.url && getSourceType(el.url) !== 'firebase' ? 'External Image URL' : 'Image Upload'} 
                {uploadingMap[el.id] && <span className="uploading-indicator"> (⏳ Uploading...)</span>}
              </label>
              
              {el.url && getSourceType(el.url) !== 'firebase' ? (
                <div className="link-input-group">
                  <input 
                    type="text" 
                    placeholder="Paste Google Drive or Image URL"
                    value={el.url}
                    onChange={(e) => handleElementChange(el.id, 'url', e.target.value)}
                    className="url-input"
                  />
                  <button className="switch-source-btn" onClick={() => handleElementChange(el.id, 'url', '')}>
                    Switch to Upload
                  </button>
                </div>
              ) : (
                <input 
                  type="file" 
                  accept="image/*" 
                  disabled={uploadingMap[el.id]}
                  onChange={(e) => handleImageUpload(el.id, e)} 
                />
              )}

              {el.url && (
                <button 
                  type="button" 
                  className="remove-img-btn" 
                  onClick={() => removeImage(el.id)}
                  title="Remove this picture"
                >
                  ❌ Remove Picture
                </button>
              )}
              
              {!el.url && (
                <div className="manual-link-row">
                  <span className="or-text">OR</span>
                  <button className="link-mode-btn" onClick={() => handleElementChange(el.id, 'url', 'https://')}>
                    🔗 Paste External Link
                  </button>
                </div>
              )}
            </div>

            <div className="control-group">
              <label>Quick Align</label>
              <div className="quick-pos-row">
                <button type="button" className="pos-btn" onClick={() => { 
                  handleElementChange(el.id, 'x', 5); 
                  handleElementChange(el.id, 'y', 10);
                  handleElementChange(el.id, 'width', 100);
                  handleElementChange(el.id, 'height', 100);
                }}>Left</button>
                <button type="button" className="pos-btn" onClick={() => { 
                  handleElementChange(el.id, 'x', 30); 
                  handleElementChange(el.id, 'y', 5);
                  handleElementChange(el.id, 'width', 500); 
                  handleElementChange(el.id, 'height', 120);
                }}>Center</button>
                <button type="button" className="pos-btn" onClick={() => { 
                  handleElementChange(el.id, 'x', 85); 
                  handleElementChange(el.id, 'y', 10);
                  handleElementChange(el.id, 'width', 100);
                  handleElementChange(el.id, 'height', 100);
                }}>Right</button>
              </div>
            </div>

            <div className="canvas-controls-row">
              <div className="control-group">
                <label>Horizontal (X): {el.x}%</label>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={el.x} 
                  onChange={(e) => handleElementChange(el.id, 'x', parseInt(e.target.value))} 
                />
              </div>
              <div className="control-group">
                <label>Vertical (Y): {el.y}%</label>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={el.y} 
                  onChange={(e) => handleElementChange(el.id, 'y', parseInt(e.target.value))} 
                />
              </div>
            </div>

            <div className="canvas-controls-row">
              <div className="control-group">
                <label>Width: {el.width}px</label>
                <input 
                  type="range" 
                  min="10" max="1000" 
                  value={el.width} 
                  onChange={(e) => handleElementChange(el.id, 'width', parseInt(e.target.value))} 
                />
              </div>
              <div className="control-group">
                <label>Height: {el.height}px</label>
                <input 
                  type="range" 
                  min="10" max="500" 
                  value={el.height} 
                  onChange={(e) => handleElementChange(el.id, 'height', parseInt(e.target.value))} 
                />
              </div>
            </div>

            <div className="control-group">
              <label>Zoom/Scale: {el.scale}</label>
              <input 
                type="range" 
                min="0.1" max="3" step="0.1"
                value={el.scale} 
                onChange={(e) => handleElementChange(el.id, 'scale', parseFloat(e.target.value))} 
              />
            </div>
          </div>
        ))}

        <div className="slot-editor card menu-management">
          <div className="section-header-row">
            <h3 className="slot-name">Menu Management</h3>
            {isSuperAdmin && (
              <button className="add-element-btn small" onClick={addNavItem}>+ Add Menu</button>
            )}
          </div>
          
          {!isSuperAdmin && (
            <p className="admin-hint-text">Structural changes (renaming, visibility, and protection) are reserved for Senior Management.</p>
          )}
          
          <div className="nav-items-list">
            {(config.navItems || []).map((item, index) => (
              <div key={item.id} className="nav-item-admin">
                <div className="nav-item-header">
                  <div className="nav-item-main">
                    <input 
                      type="text" 
                      className="nav-label-input" 
                      value={item.label} 
                      onChange={(e) => handleNavItemChange(item.id, 'label', e.target.value)}
                      disabled={!isSuperAdmin}
                    />
                    <input 
                      type="color" 
                      className="nav-color-picker" 
                      value={item.color} 
                      onChange={(e) => handleNavItemChange(item.id, 'color', e.target.value)}
                      disabled={!isSuperAdmin}
                    />
                  </div>
                  <div className="nav-item-actions">
                    <button 
                      className="move-btn" 
                      disabled={!isSuperAdmin || index === 0} 
                      onClick={() => moveNavItem(index, -1)}
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <button 
                      className="move-btn" 
                      disabled={!isSuperAdmin || index === config.navItems.length - 1} 
                      onClick={() => moveNavItem(index, 1)}
                      title="Move Down"
                    >
                      ↓
                    </button>
                    <button 
                      className={`visibility-btn ${item.visible ? 'on' : 'off'}`}
                      disabled={!isSuperAdmin}
                      onClick={() => handleNavItemChange(item.id, 'visible', !item.visible)}
                      title={item.visible ? "Visible" : "Hidden"}
                    >
                      {item.visible ? '👁️' : '🕶️'}
                    </button>
                    <button 
                      className={`protection-btn ${item.isProtected ? 'locked' : 'unlocked'}`}
                      onClick={() => handleNavItemChange(item.id, 'isProtected', !item.isProtected)}
                      title={item.isProtected ? "Protected (Login Required)" : "Public (No Login)"}
                      disabled={!isSuperAdmin || item.id === 'admin'}
                    >
                      {item.isProtected ? '🔒' : '🔓'}
                    </button>
                    {isSuperAdmin && !item.protected && (
                      <button 
                        className="delete-btn small" 
                        onClick={() => removeNavItem(item.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="slot-editor card global-settings">
          <h3 className="slot-name">Canvas Settings</h3>
          
          <div className="control-group">
            <label>Canvas Height: {config.bannerHeight}px</label>
            <input 
              type="range" 
              min="40" max="1500" 
              value={config.bannerHeight} 
              onChange={(e) => handleGlobalChange('bannerHeight', parseInt(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={config.showHeaderTitle} 
                onChange={(e) => handleGlobalChange('showHeaderTitle', e.target.checked)} 
              />
              Show Header Title Row
            </label>
          </div>

          <div className="canvas-controls-row">
            <div className="control-group">
              <label>Banner Background</label>
              <input 
                type="color" 
                value={config.bannerBgColor || '#ffffff'} 
                onChange={(e) => handleGlobalChange('bannerBgColor', e.target.value)} 
              />
            </div>

            <div className="control-group">
              <label>Website Background</label>
              <input 
                type="color" 
                value={config.bodyBgColor || '#f9fafb'} 
                onChange={(e) => handleGlobalChange('bodyBgColor', e.target.value)} 
              />
            </div>
          </div>
          
          <button 
            className="reset-btn" 
            onClick={() => {
              if (confirm('Reset canvas to default layout?')) {
                localStorage.removeItem('mmp_banner_config');
                window.location.reload();
              }
            }}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Universal Asset & Document Manager */}
      <AssetManager assets={assets} setAssets={setAssets} />
    </section>
  );
}
