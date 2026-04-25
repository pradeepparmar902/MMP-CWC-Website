import React, { useState } from 'react';
import './BorderEditor.css';

const BORDER_STYLES = [
  { value: 'none',   label: 'None',   css: 'none' },
  { value: 'solid',  label: 'Solid',  css: 'solid' },
  { value: 'dashed', label: 'Dashed', css: 'dashed' },
  { value: 'dotted', label: 'Dotted', css: 'dotted' },
  { value: 'double', label: 'Double', css: 'double' },
  { value: 'groove', label: 'Groove', css: 'groove' },
  { value: 'ridge',  label: 'Ridge',  css: 'ridge' },
  { value: 'inset',  label: 'Inset',  css: 'inset' },
];

const PRESETS = [
  { name: 'None',     borderStyle:'none',   borderWidth:'0', borderColor:'',        borderRadius:'12', shadowEnabled:false, gradientBorder:false },
  { name: 'Subtle',   borderStyle:'solid',  borderWidth:'1', borderColor:'#e2e8f0', borderRadius:'12', shadowEnabled:false, gradientBorder:false },
  { name: 'Bold',     borderStyle:'solid',  borderWidth:'3', borderColor:'#1e293b', borderRadius:'8',  shadowEnabled:false, gradientBorder:false },
  { name: 'Card',     borderStyle:'solid',  borderWidth:'1', borderColor:'#e2e8f0', borderRadius:'16', shadowEnabled:true,  shadowX:'0', shadowY:'4', shadowBlur:'16', shadowSpread:'0', shadowColor:'rgba(0,0,0,0.09)', gradientBorder:false },
  { name: 'Pill',     borderStyle:'solid',  borderWidth:'2', borderColor:'#7c3aed', borderRadius:'50', shadowEnabled:false, gradientBorder:false },
  { name: 'Neon',     borderStyle:'solid',  borderWidth:'2', borderColor:'#7c3aed', borderRadius:'12', shadowEnabled:true,  shadowX:'0', shadowY:'0', shadowBlur:'18', shadowSpread:'3', shadowColor:'rgba(124,58,237,0.55)', gradientBorder:false },
  { name: 'Dashed',   borderStyle:'dashed', borderWidth:'2', borderColor:'#64748b', borderRadius:'8',  shadowEnabled:false, gradientBorder:false },
  { name: 'Gradient', borderStyle:'solid',  borderWidth:'3', borderColor:'',        borderRadius:'12', shadowEnabled:false, gradientBorder:true, gradientColor1:'#7c3aed', gradientColor2:'#3b82f6', gradientAngle:'135' },
  { name: 'Glow',     borderStyle:'solid',  borderWidth:'2', borderColor:'#f59e0b', borderRadius:'12', shadowEnabled:true,  shadowX:'0', shadowY:'0', shadowBlur:'20', shadowSpread:'4', shadowColor:'rgba(245,158,11,0.45)', gradientBorder:false },
];

const RADIUS_PRESETS = [
  { name: 'Sharp',  value: '0' },
  { name: 'Soft',   value: '8' },
  { name: 'Round',  value: '16' },
  { name: 'Pill',   value: '50' },
  { name: 'Circle', value: '9999' },
];

export default function BorderEditor({ formData, onChange }) {
  const [tab, setTab] = useState('style');

  const set = (key, val) => onChange(key, val);

  const applyPreset = (preset) => {
    const { name, ...fields } = preset;
    Object.entries(fields).forEach(([k, v]) => set(k, v));
  };

  /* ── Live Preview Style ─────────────────────────────────── */
  const previewStyle = (() => {
    const s = {
      background: formData.bgColor || '#ffffff',
      transition: 'all 0.25s',
    };

    // Radius
    const tl = formData.borderRadiusTL !== '' ? `${formData.borderRadiusTL}px` : `${formData.borderRadius || 12}px`;
    const tr = formData.borderRadiusTR !== '' ? `${formData.borderRadiusTR}px` : `${formData.borderRadius || 12}px`;
    const br = formData.borderRadiusBR !== '' ? `${formData.borderRadiusBR}px` : `${formData.borderRadius || 12}px`;
    const bl = formData.borderRadiusBL !== '' ? `${formData.borderRadiusBL}px` : `${formData.borderRadius || 12}px`;
    s.borderRadius = `${tl} ${tr} ${br} ${bl}`;

    // Gradient or solid border
    if (formData.gradientBorder && Number(formData.borderWidth) > 0) {
      const bg   = formData.bgColor || '#ffffff';
      const ang  = formData.gradientAngle  || 135;
      const c1   = formData.gradientColor1 || '#7c3aed';
      const c2   = formData.gradientColor2 || '#3b82f6';
      s.background = `linear-gradient(${bg}, ${bg}) padding-box, linear-gradient(${ang}deg, ${c1}, ${c2}) border-box`;
      s.border = `${formData.borderWidth || 3}px solid transparent`;
    } else if (formData.borderStyle && formData.borderStyle !== 'none' && Number(formData.borderWidth) > 0) {
      s.border = `${formData.borderWidth || 1}px ${formData.borderStyle || 'solid'} ${formData.borderColor || '#e2e8f0'}`;
    } else {
      s.border = 'none';
    }

    // Shadow
    if (formData.shadowEnabled) {
      s.boxShadow = `${formData.shadowX || 0}px ${formData.shadowY || 4}px ${formData.shadowBlur || 12}px ${formData.shadowSpread || 0}px ${formData.shadowColor || 'rgba(0,0,0,0.1)'}`;
    }

    return s;
  })();

  return (
    <div className="be-root">

      {/* ── LIVE PREVIEW ──────────────────────────────────────── */}
      <div className="be-preview-strip">
        <div className="be-preview-box" style={previewStyle}>
          <span className="be-preview-text">Preview</span>
        </div>
      </div>

      {/* ── QUICK PRESETS ─────────────────────────────────────── */}
      <div className="be-presets-wrap">
        <div className="be-presets-label">⚡ Quick Presets</div>
        <div className="be-presets-row">
          {PRESETS.map(p => (
            <button key={p.name} className="be-preset-btn" onClick={() => applyPreset(p)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────── */}
      <div className="be-tabs">
        {[
          { id: 'style',    icon: '🖊', label: 'Style'    },
          { id: 'radius',   icon: '🔲', label: 'Radius'   },
          { id: 'shadow',   icon: '💫', label: 'Shadow'   },
          { id: 'gradient', icon: '🌈', label: 'Gradient' },
        ].map(t => (
          <button
            key={t.id}
            className={`be-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: STYLE ────────────────────────────────────────── */}
      {tab === 'style' && (
        <div className="be-panel">

          {/* Border Style Icons */}
          <div className="be-field">
            <label className="be-label">Border Style</label>
            <div className="be-style-grid">
              {BORDER_STYLES.map(bs => (
                <button
                  key={bs.value}
                  className={`be-style-btn ${formData.borderStyle === bs.value ? 'active' : ''}`}
                  onClick={() => set('borderStyle', bs.value)}
                  title={bs.label}
                >
                  <span
                    className="be-style-preview"
                    style={{
                      borderBottom: bs.value === 'none'
                        ? '3px solid transparent'
                        : `3px ${bs.css} #1e293b`
                    }}
                  />
                  <span className="be-style-name">{bs.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Width */}
          <div className="be-field">
            <label className="be-label">
              Border Width&nbsp;<strong>{formData.borderWidth || 1}px</strong>
            </label>
            <div className="be-slider-row">
              <input
                type="range" min="0" max="20"
                value={formData.borderWidth || 1}
                onChange={e => set('borderWidth', e.target.value)}
                className="be-slider"
              />
              <input
                type="number" min="0" max="50"
                value={formData.borderWidth || 1}
                onChange={e => set('borderWidth', e.target.value)}
                className="be-number-input"
              />
            </div>
          </div>

          {/* Color */}
          <div className="be-field be-color-field">
            <label className="be-label">Border Color</label>
            <input
              type="color"
              value={formData.borderColor || '#e2e8f0'}
              onChange={e => set('borderColor', e.target.value)}
              className="be-color-swatch"
            />
            <input
              type="text"
              value={formData.borderColor || '#e2e8f0'}
              onChange={e => set('borderColor', e.target.value)}
              className="be-color-hex"
              placeholder="#e2e8f0"
            />
          </div>
        </div>
      )}

      {/* ── TAB: RADIUS ───────────────────────────────────────── */}
      {tab === 'radius' && (
        <div className="be-panel">
          {/* Presets */}
          <div className="be-field">
            <label className="be-label">Radius Presets</label>
            <div className="be-radius-presets">
              {RADIUS_PRESETS.map(rp => (
                <button
                  key={rp.name}
                  className={`be-radius-preset-btn ${formData.borderRadius === rp.value ? 'active' : ''}`}
                  onClick={() => set('borderRadius', rp.value)}
                >
                  {rp.name}
                </button>
              ))}
            </div>
          </div>

          {/* All corners */}
          <div className="be-field">
            <label className="be-label">All Corners: <strong>{formData.borderRadius || 12}px</strong></label>
            <div className="be-slider-row">
              <input
                type="range" min="0" max="200"
                value={formData.borderRadius || 12}
                onChange={e => set('borderRadius', e.target.value)}
                className="be-slider"
              />
              <input
                type="number" min="0" max="9999"
                value={formData.borderRadius || 12}
                onChange={e => set('borderRadius', e.target.value)}
                className="be-number-input"
              />
            </div>
          </div>

          {/* Individual corners */}
          <div className="be-field">
            <label className="be-label">Individual Corners (overrides above)</label>
            <div className="be-corners-grid">
              {[
                { key: 'borderRadiusTL', label: '↖ Top Left' },
                { key: 'borderRadiusTR', label: '↗ Top Right' },
                { key: 'borderRadiusBL', label: '↙ Bottom Left' },
                { key: 'borderRadiusBR', label: '↘ Bottom Right' },
              ].map(c => (
                <div key={c.key} className="be-corner-item">
                  <span className="be-corner-label">{c.label}</span>
                  <input
                    type="number" min="0" max="9999"
                    placeholder={formData.borderRadius || 12}
                    value={formData[c.key] ?? ''}
                    onChange={e => set(c.key, e.target.value)}
                    className="be-corner-input"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SHADOW ───────────────────────────────────────── */}
      {tab === 'shadow' && (
        <div className="be-panel">
          <div className="be-field">
            <label className="be-toggle-label">
              <input
                type="checkbox"
                checked={formData.shadowEnabled || false}
                onChange={e => set('shadowEnabled', e.target.checked)}
              />
              <span>Enable Shadow / Glow</span>
            </label>
          </div>

          {formData.shadowEnabled && (
            <>
              {[
                { key:'shadowX',      label:'X Offset', min:-30, max:30 },
                { key:'shadowY',      label:'Y Offset', min:-30, max:30 },
                { key:'shadowBlur',   label:'Blur',     min:0,   max:80 },
                { key:'shadowSpread', label:'Spread',   min:-20, max:40 },
              ].map(s => (
                <div key={s.key} className="be-field">
                  <label className="be-label">{s.label}: <strong>{formData[s.key] ?? (s.key === 'shadowY' ? 4 : 0)}px</strong></label>
                  <input
                    type="range"
                    min={s.min} max={s.max}
                    value={formData[s.key] ?? (s.key === 'shadowY' ? 4 : 0)}
                    onChange={e => set(s.key, e.target.value)}
                    className="be-slider"
                  />
                </div>
              ))}

              <div className="be-field be-color-field">
                <label className="be-label">Shadow Color</label>
                <input
                  type="color"
                  value={/^#/.test(formData.shadowColor || '') ? formData.shadowColor : '#000000'}
                  onChange={e => set('shadowColor', e.target.value)}
                  className="be-color-swatch"
                />
                <input
                  type="text"
                  value={formData.shadowColor || 'rgba(0,0,0,0.1)'}
                  onChange={e => set('shadowColor', e.target.value)}
                  className="be-color-hex"
                  placeholder="rgba(0,0,0,0.1)"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: GRADIENT ─────────────────────────────────────── */}
      {tab === 'gradient' && (
        <div className="be-panel">
          <div className="be-field">
            <label className="be-toggle-label">
              <input
                type="checkbox"
                checked={formData.gradientBorder || false}
                onChange={e => set('gradientBorder', e.target.checked)}
              />
              <span>Enable Gradient Border</span>
            </label>
          </div>

          {formData.gradientBorder && (
            <>
              {[
                { key: 'gradientColor1', label: 'Start Color' },
                { key: 'gradientColor2', label: 'End Color' },
              ].map(gc => (
                <div key={gc.key} className="be-field be-color-field">
                  <label className="be-label">{gc.label}</label>
                  <input
                    type="color"
                    value={formData[gc.key] || (gc.key === 'gradientColor1' ? '#7c3aed' : '#3b82f6')}
                    onChange={e => set(gc.key, e.target.value)}
                    className="be-color-swatch"
                  />
                  <input
                    type="text"
                    value={formData[gc.key] || ''}
                    onChange={e => set(gc.key, e.target.value)}
                    className="be-color-hex"
                    placeholder={gc.key === 'gradientColor1' ? '#7c3aed' : '#3b82f6'}
                  />
                </div>
              ))}

              {/* Gradient preview strip */}
              <div
                className="be-gradient-preview"
                style={{ background: `linear-gradient(${formData.gradientAngle || 135}deg, ${formData.gradientColor1 || '#7c3aed'}, ${formData.gradientColor2 || '#3b82f6'})` }}
              />

              <div className="be-field">
                <label className="be-label">Angle: <strong>{formData.gradientAngle || 135}°</strong></label>
                <input
                  type="range" min="0" max="360"
                  value={formData.gradientAngle || 135}
                  onChange={e => set('gradientAngle', e.target.value)}
                  className="be-slider"
                />
              </div>

              <div className="be-field">
                <label className="be-label">Border Width: <strong>{formData.borderWidth || 3}px</strong></label>
                <div className="be-slider-row">
                  <input
                    type="range" min="1" max="20"
                    value={formData.borderWidth || 3}
                    onChange={e => set('borderWidth', e.target.value)}
                    className="be-slider"
                  />
                  <input
                    type="number" min="1" max="50"
                    value={formData.borderWidth || 3}
                    onChange={e => set('borderWidth', e.target.value)}
                    className="be-number-input"
                  />
                </div>
              </div>
            </>
          )}

          {!formData.gradientBorder && (
            <p className="be-hint">Enable the toggle above to configure gradient borders.</p>
          )}
        </div>
      )}
    </div>
  );
}
