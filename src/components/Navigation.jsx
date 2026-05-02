import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navigation.css';

export default function Navigation({ activeSection, setActiveSection, navItems, isHeaderCollapsed, setIsHeaderCollapsed, language, setLanguage, favorites }) {
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

  // Filter by favorites
  const visibleItems = allVisibleItems.filter(item => favorites.includes(item.id));
  
  // Enforce maximum 3 items on mobile to save vertical space
  const displayItems = isMobile ? visibleItems.slice(0, 3) : visibleItems;

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
        <div className="nav-content-centered">
          {displayItems.map((item) => (
            <div key={item.id} className="nav-item">
              <button
                className={`nav-btn ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                style={{ '--item-bg': item.color }}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.isProtected && <span className="nav-lock-icon">🔒</span>}
              </button>
            </div>
          ))}
          
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search" 
              className="nav-search-input"
            />
            <button className="search-btn" aria-label="Search">
              🔍
            </button>
          </div>

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
