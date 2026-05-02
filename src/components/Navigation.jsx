import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navigation.css';

export default function Navigation({ activeSection, setActiveSection, navItems, isHeaderCollapsed, setIsHeaderCollapsed, language, setLanguage }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
  // Update mobile status on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Only show visible items, and strictly hide 'admin' for non-staff users
  const allVisibleItems = (navItems || []).filter(item => {
    if (!item.visible) return false;
    // Special rule: Only show 'Admin' tab to verified staff
    if (item.id === 'admin') return isAdmin || isSuperAdmin;
    return true;
  });

  // On mobile, slice to show only first 3
  const visibleItems = isMobile ? allVisibleItems.slice(0, 3) : allVisibleItems;

  return (
    <nav className={`navigation ${isHeaderCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="side-toggle left"
        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        title={isHeaderCollapsed ? "Expand Header" : "Collapse Header"}
      >
        {isHeaderCollapsed ? '▼' : '▲'}
      </button>

      <div className="nav-bar">
        <ul className="nav-list">
          {visibleItems.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-btn ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                style={{ '--item-bg': item.color }}
              >
                {item.label}
                {item.isProtected && <span className="nav-lock-icon">🔒</span>}
              </button>
            </li>
          ))}
        </ul>
        
        <div className="nav-search-lang-row">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Searching for?" 
              className="nav-search-input"
            />
            <button className="search-btn" aria-label="Search">
              🔍
            </button>
          </div>
          {/* 🔘 LANGUAGE TOGGLE — moved from Header to here */}
          <div className="nav-language-toggle">
            <button 
              className={language === 'en' ? 'active' : ''} 
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button 
              className={language === 'gu' ? 'active' : ''} 
              onClick={() => setLanguage('gu')}
            >
              ગુજ
            </button>
          </div>
        </div>
      </div>

      <button 
        className="side-toggle right"
        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        title={isHeaderCollapsed ? "Expand Header" : "Collapse Header"}
      >
        {isHeaderCollapsed ? '▼' : '▲'}
      </button>
    </nav>
  );
}
