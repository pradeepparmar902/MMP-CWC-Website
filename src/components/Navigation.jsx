import './Navigation.css';

export default function Navigation({ activeSection, setActiveSection, navItems }) {
  // Only show visible items in the public navigation bar
  const visibleItems = (navItems || []).filter(item => item.visible);

  return (
    <nav className="navigation">
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
    </nav>
  );
}
