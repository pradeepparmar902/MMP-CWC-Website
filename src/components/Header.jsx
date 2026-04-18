import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export default function Header({ config, onLoginClick, isCollapsed, navItems, activeSection, setActiveSection }) {
  const { userStatus, isAdmin, isSuperAdmin, currentUser, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const showTitle = config?.showHeaderTitle !== false;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIdentifier = () => {
    if (!currentUser) return null;
    if (currentUser.displayName) return currentUser.displayName;
    
    // Check for virtual email: phone@mmp-cwc.admin
    if (currentUser.email?.endsWith('@mmp-cwc.admin')) {
      const phonePart = currentUser.email.split('@')[0];
      return `+${phonePart}`;
    }
    
    return currentUser.email || currentUser.phoneNumber || 'User';
  };

  const identifier = getIdentifier();
  
  // Determine badge info
  let badgeLabel = null;
  let badgeClass = '';

  if (currentUser) {
    if (isSuperAdmin) {
      badgeLabel = 'Senior Admin';
      badgeClass = 'badge-super';
    } else if (isAdmin) {
      badgeLabel = 'Admin';
      badgeClass = 'badge-admin';
    } else if (userStatus === 'member') {
      badgeLabel = 'Member';
      badgeClass = 'badge-member';
    } else if (userStatus === 'pending') {
      badgeLabel = 'Pending';
      badgeClass = 'badge-pending';
    }
  }

  return (
    <header className={`header ${!showTitle ? 'header-hidden' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="header-container container">
        <button 
          className={`hamburger-btn ${!showTitle ? 'floating' : ''} ${isDrawerOpen ? 'active' : ''}`} 
          aria-label="Menu"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          {isDrawerOpen ? '✕' : '☰'}
        </button>

        {/* SIDE DRAWER */}
        <div className={`side-drawer-backdrop ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)} />
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <h3>Menu</h3>
            <button className="close-drawer" onClick={() => setIsDrawerOpen(false)}>✕</button>
          </div>
          <nav className="drawer-nav">
            {navItems.filter(item => {
              if (!item.visible) return false;
              if (item.id === 'admin') return isAdmin || isSuperAdmin;
              return true;
            }).map((item) => (
              <button
                key={item.id}
                className={`drawer-link ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveSection(item.id);
                  setIsDrawerOpen(false);
                }}
              >
                <span className="drawer-dot" style={{ background: item.color }}></span>
                {item.label}
                {item.isProtected && <span className="drawer-lock">🔒</span>}
              </button>
            ))}
          </nav>
          <div className="drawer-footer">
            <p>© {new Date().getFullYear()} MMP CWC</p>
          </div>
        </div>
        
        {showTitle && <h1 className="logo-title">Mumbai Meghwal Panchayat</h1>}
        
        <div className={`header-right ${!showTitle ? 'floating' : ''}`}>
          {badgeLabel && (
            <span className={`status-badge ${badgeClass}`}>
              {badgeLabel}
            </span>
          )}
          {identifier && (
            <span className="user-identifier">
              {identifier.length > 15 ? identifier.substring(0, 12) + '...' : identifier}
            </span>
          )}

          <div className="profile-wrapper" ref={dropdownRef}>
            <button 
              className={`profile-btn ${isDropdownOpen ? 'active' : ''}`} 
              aria-label="Profile" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="profile-dropdown">
                {currentUser ? (
                  <>
                    <div className="dropdown-header">
                      <p className="dropdown-label">Signed in as</p>
                      <p className="dropdown-user">{identifier}</p>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); /* Add profile link if needed */ }}>
                      👤 My Profile
                    </button>
                    <button className="dropdown-item logout-item" onClick={() => { logout(); setIsDropdownOpen(false); }}>
                      🚪 Logout
                    </button>
                  </>
                ) : (
                  <button className="dropdown-item login-item" onClick={() => { onLoginClick(); setIsDropdownOpen(false); }}>
                    🔑 Login / Sign Up
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
