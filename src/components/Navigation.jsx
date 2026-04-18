import { useAuth } from '../context/AuthContext';
import './Navigation.css';

export default function Navigation({ activeSection, setActiveSection, navItems, isHeaderCollapsed, setIsHeaderCollapsed }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  
  // Only show visible items, and strictly hide 'admin' for non-staff users
  const visibleItems = (navItems || []).filter(item => {
    if (!item.visible) return false;
    // Special rule: Only show 'Admin' tab to verified staff
    if (item.id === 'admin') return isAdmin || isSuperAdmin;
    return true;
  });

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
