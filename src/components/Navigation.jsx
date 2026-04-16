import './Navigation.css';

const navItems = [
  { id: 'home', label: 'Home', color: '#3B82F6' },
  { id: 'education', label: 'Education', color: '#10B981' },
  { id: 'matrimony', label: 'Matrimony', color: '#EC4899' },
  { id: 'meghpush', label: 'MeghPush (News)', color: '#F59E0B' },
  { id: 'election', label: 'Election Card', color: '#6366F1' },
  { id: 'samaj', label: 'Samaj Jog Sandesh', color: '#8B5CF6' },
  { id: 'admin', label: 'Admin', color: '#374151' }
];

export default function Navigation({ activeSection, setActiveSection }) {
  return (
    <nav className="navigation">
      <div className="nav-bar">
        <ul className="nav-list">
          {navItems.map((item) => (
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
