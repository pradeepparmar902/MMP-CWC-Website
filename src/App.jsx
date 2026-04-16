import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import Banner from './components/Banner';
import Navigation from './components/Navigation';
import ContentArea from './components/ContentArea';
import AdminPanel from './components/AdminPanel';

const DEFAULT_NAV_ITEMS = [
  { id: 'home', label: 'Home', color: '#3B82F6', visible: true, protected: true },
  { id: 'education', label: 'Education', color: '#10B981', visible: true },
  { id: 'matrimony', label: 'Matrimony', color: '#EC4899', visible: true },
  { id: 'meghpush', label: 'MeghPush (News)', color: '#F59E0B', visible: true },
  { id: 'election', label: 'Election Card', color: '#6366F1', visible: true },
  { id: 'samaj', label: 'Samaj Jog Sandesh', color: '#8B5CF6', visible: true },
  { id: 'admin', label: 'Admin', color: '#374151', visible: true, protected: true }
];

const DEFAULT_BANNER_CONFIG = {
  elements: [
    { id: '1', name: 'Left Logo', url: '', width: 100, height: 100, x: 5, y: 10, scale: 1 },
    { id: '2', name: 'Center Title', url: '', width: 500, height: 120, x: 30, y: 5, scale: 1 },
    { id: '3', name: 'Right Portrait', url: '', width: 100, height: 100, x: 85, y: 10, scale: 1 }
  ],
  bannerHeight: 180,
  bannerBgColor: '#ffffff',
  bodyBgColor: '#f9fafb',
  showHeaderTitle: true,
  navItems: DEFAULT_NAV_ITEMS
};

function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [bannerConfig, setBannerConfig] = useState(() => {
    const saved = localStorage.getItem('mmp_banner_config');
    if (!saved) return DEFAULT_BANNER_CONFIG;
    
    const parsed = JSON.parse(saved);
  
    // Migration and initialization for new properties
    const migratedItems = (parsed.navItems || DEFAULT_NAV_ITEMS).map(item => {
      if (item.id === 'home' || item.id === 'admin') {
        return { ...item, protected: true };
      }
      return item;
    });

    return {
      ...parsed,
      showHeaderTitle: parsed.showHeaderTitle ?? true,
      bannerBgColor: parsed.bannerBgColor || parsed.bgColor || '#ffffff',
      bodyBgColor: parsed.bodyBgColor || '#f9fafb',
      navItems: migratedItems
    };
  });

  // 1. Initial Cloud Load
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "site_settings", "banner_config");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log("Cloud config loaded:", docSnap.data());
          setBannerConfig(docSnap.data());
        } else {
          console.log("No cloud config found, using local/default.");
        }
      } catch (error) {
        console.error("Error fetching cloud config:", error);
      } finally {
        setIsCloudLoaded(true);
      }
    };
    fetchConfig();
  }, []);

  // 2. Debounced Cloud Save & Local Persistence
  useEffect(() => {
    // Save to localStorage immediately for UI performance
    localStorage.setItem('mmp_banner_config', JSON.stringify(bannerConfig));
    
    // Apply body background
    if (bannerConfig.bodyBgColor) {
      document.body.style.backgroundColor = bannerConfig.bodyBgColor;
    }

    // Only save to cloud if we've successfully checked the cloud state first
    if (!isCloudLoaded) return;

    const timeoutId = setTimeout(async () => {
      try {
        const docRef = doc(db, "site_settings", "banner_config");
        await setDoc(docRef, bannerConfig);
        console.log("Cloud config synced!");
      } catch (error) {
        console.error("Error saving to cloud:", error);
      }
    }, 2000); // 2-second debounce

    return () => clearTimeout(timeoutId);
  }, [bannerConfig, isCloudLoaded]);

  return (
    <div className="app-container" style={{ backgroundColor: bannerConfig.bodyBgColor || '#f9fafb', minHeight: '100vh' }}>
      <Header config={bannerConfig} />
      <main>
        <Banner config={bannerConfig} isSticky={activeSection === 'admin'} />
        <Navigation 
          activeSection={activeSection} 
          setActiveSection={setActiveSection} 
          navItems={bannerConfig.navItems || []} 
        />
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
