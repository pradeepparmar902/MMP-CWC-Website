import React, { useState, useRef, useEffect } from 'react';
import './ColorPicker.css';

const THEME_COLORS = [
  ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
  ['#f2f2f2', '#808080', '#d0cece', '#d6dce4', '#deebf6', '#fbe5d5', '#ededed', '#fff2cc', '#dae3f3', '#e2efd9'],
  ['#d8d8d8', '#595959', '#aeaaaa', '#adb9ca', '#bdd7ee', '#f7cbac', '#dbdbdb', '#ffe599', '#b4c6e7', '#c5e0b3'],
  ['#bfbfbf', '#3f3f3f', '#757070', '#8496b0', '#9dc3e6', '#f4b083', '#c9c9c9', '#ffd966', '#8eaadb', '#a8d08d'],
  ['#a5a5a5', '#262626', '#3a3838', '#323f4f', '#2e74b5', '#c55a11', '#7b7b7b', '#bf8f00', '#2f5496', '#538135'],
  ['#7f7f7f', '#0c0c0c', '#161616', '#222a35', '#1f4e79', '#833c0b', '#525252', '#7f5f00', '#1f3864', '#375623']
];

const STANDARD_COLORS = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'
];

export default function ColorPicker({ value, onChange, allowNoFill = true, defaultColor = '#000000', className = '', triggerClass = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const nativeInputRef = useRef(null);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.addEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorClick = (color) => {
    onChange(color);
    setIsOpen(false);
  };

  const handleNativeChange = (e) => {
    onChange(e.target.value);
  };

  // Resolve transparent colors and fallbacks
  const isNoFill = !value || value === 'transparent' || value === '';
  const displayColor = isNoFill ? 'transparent' : value;

  return (
    <div className={`office-color-picker ${className}`} ref={popoverRef}>
      {/* Trigger Button */}
      <button 
        type="button" 
        className={`ocp-trigger ${triggerClass}`} 
        onClick={() => setIsOpen(!isOpen)}
        title="Select Color"
      >
        <span 
          className="ocp-swatch" 
          style={{ 
            backgroundColor: displayColor,
            border: displayColor === 'transparent' || displayColor.toLowerCase() === '#ffffff' ? '1px solid #d1d5db' : '1px solid transparent'
          }} 
        >
          {isNoFill && <span className="ocp-nofill-line"></span>}
        </span>
        <span className="ocp-arrow">▼</span>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="ocp-popover">
          <div className="ocp-section">
            <div className="ocp-title">Theme Colors</div>
            <div className="ocp-theme-grid">
              {THEME_COLORS.map((row, rIdx) => (
                <div key={rIdx} className={`ocp-theme-row ${rIdx === 0 ? 'ocp-main-row' : ''}`}>
                  {row.map((col, cIdx) => (
                    <button
                      type="button"
                      key={`${rIdx}-${cIdx}`}
                      className="ocp-color-btn"
                      style={{ backgroundColor: col }}
                      title={col}
                      onClick={() => handleColorClick(col)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="ocp-section">
            <div className="ocp-title">Standard Colors</div>
            <div className="ocp-standard-row">
              {STANDARD_COLORS.map((col, cIdx) => (
                <button
                  type="button"
                  key={cIdx}
                  className="ocp-color-btn ocp-standard-btn"
                  style={{ backgroundColor: col }}
                  title={col}
                  onClick={() => handleColorClick(col)}
                />
              ))}
            </div>
          </div>

          <div className="ocp-actions">
            {allowNoFill && (
              <button 
                type="button" 
                className="ocp-action-btn" 
                onClick={() => handleColorClick('')}
              >
                <div className="ocp-nofill-icon-box">
                  <span className="ocp-nofill-line"></span>
                </div>
                No Fill
              </button>
            )}
            <button 
              type="button" 
              className="ocp-action-btn" 
              onClick={() => {
                nativeInputRef.current.click();
              }}
            >
              <span className="ocp-more-icon">🎨</span> More Colors...
            </button>
            
            {/* Hidden native picker to trigger the OS dialog */}
            <input 
              type="color" 
              ref={nativeInputRef}
              value={isNoFill ? defaultColor : value}
              onChange={handleNativeChange}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '0', height: '0' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
