import { useState } from 'react';
import './AdminPanel.css';

export default function AdminPanel({ config, setConfig }) {
  const handleElementChange = (id, field, value) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, [field]: value } : el
      )
    }));
  };

  const handleGlobalChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleElementChange(id, 'url', reader.result);
      };
      reader.readAsDataURL(file);
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
    setConfig(prev => {
      const elements = prev.elements || [];
      // Use String() to ensure types match perfectly
      const newElements = elements.filter(el => String(el.id) !== String(id));
      return {
        ...prev,
        elements: newElements
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
        <h2 className="admin-title">Canvas Banner Management</h2>
        <div className="admin-actions">
          <button className="fit-btn" onClick={fitBannerToContent} title="Auto-calculate height to fit images">
            📏 Auto-Fit Height
          </button>
          <button className="add-element-btn" onClick={addElement}>+ Add New Image</button>
        </div>
      </div>
      
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
              <label>Image Upload</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => handleImageUpload(el.id, e)} 
              />
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

          <div className="control-group">
            <label>Canvas Background</label>
            <input 
              type="color" 
              value={config.bgColor} 
              onChange={(e) => handleGlobalChange('bgColor', e.target.value)} 
            />
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
    </section>
  );
}
