import { useState, useEffect } from 'react';
import Header from './components/Header';
import Banner from './components/Banner';
import Navigation from './components/Navigation';
import ContentArea from './components/ContentArea';
import AdminPanel from './components/AdminPanel';

const DEFAULT_BANNER_CONFIG = {
  elements: [
    { id: '1', name: 'Left Logo', url: '', width: 100, height: 100, x: 5, y: 10, scale: 1 },
    { id: '2', name: 'Center Title', url: '', width: 500, height: 120, x: 30, y: 5, scale: 1 },
    { id: '3', name: 'Right Portrait', url: '', width: 100, height: 100, x: 85, y: 10, scale: 1 }
  ],
  bannerHeight: 180,
  bgColor: '#ffffff',
  showHeaderTitle: true
};

function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [bannerConfig, setBannerConfig] = useState(() => {
    const saved = localStorage.getItem('mmp_banner_config');
    if (!saved) return DEFAULT_BANNER_CONFIG;
    
    const parsed = JSON.parse(saved);
    // Migration: If it's the old object format, convert to array format
    if (parsed.left || parsed.center || parsed.right) {
      return {
        elements: [
          { id: '1', name: 'Left Logo', ...parsed.left, x: 5, y: 10 },
          { id: '2', name: 'Center Title', ...parsed.center, x: 30, y: 5 },
          { id: '3', name: 'Right Portrait', ...parsed.right, x: 85, y: 10 }
        ],
        bannerHeight: parsed.bannerHeight,
        bgColor: parsed.bgColor,
        showHeaderTitle: true
      };
    }
    // Ensure showHeaderTitle exists in newer formats too
    if (parsed.showHeaderTitle === undefined) {
      return { ...parsed, showHeaderTitle: true };
    }
    return parsed;
  });

  useEffect(() => {
    localStorage.setItem('mmp_banner_config', JSON.stringify(bannerConfig));
  }, [bannerConfig]);

  return (
    <div className="app-container">
      <Header config={bannerConfig} />
      <main>
        <Banner config={bannerConfig} />
        <Navigation activeSection={activeSection} setActiveSection={setActiveSection} />
        {activeSection === 'admin' ? (
          <AdminPanel config={bannerConfig} setConfig={setBannerConfig} />
        ) : (
          <ContentArea activeSection={activeSection} />
        )}
      </main>
    </div>
  );
}

export default App;
