import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import Banner from './components/Banner';
import Navigation from './components/Navigation';
import ContentArea from './components/ContentArea';
import AdminPanel from './components/AdminPanel';
import { useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';

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
  const { isAdmin, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [siteAssets, setSiteAssets] = useState([]);
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
          const cloudData = docSnap.data();
          console.log("Cloud config loaded:", cloudData);
          
          // Ensure we merge in default properties if they are missing in the cloud (like navItems)
          setBannerConfig(prev => {
            const mergedNavItems = cloudData.navItems || prev.navItems || DEFAULT_NAV_ITEMS;
            
            // Apply protected status to home and admin if they don't have it
            const finalizedNavItems = mergedNavItems.map(item => {
              if (item.id === 'home' || item.id === 'admin') {
                return { ...item, protected: true };
              }
              return item;
            });

            return {
              ...DEFAULT_BANNER_CONFIG,
              ...cloudData,
              navItems: finalizedNavItems
            };
          });
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

  // 1b. Fetch Site Assets from Firestore
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'site_assets'));
        const assets = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setSiteAssets(assets);
      } catch (err) {
        console.error('Failed to fetch assets:', err);
      }
    };
    fetchAssets();
  }, []);

  // 1c. Sync assets to Firestore whenever they change
  useEffect(() => {
    if (!isCloudLoaded) return;
    const syncAssets = async () => {
      try {
        const docRef = doc(db, 'site_settings', 'site_assets');
        await setDoc(docRef, { assets: siteAssets });
      } catch (err) {
        console.error('Failed to sync assets:', err);
      }
    };
    const timer = setTimeout(syncAssets, 2000);
    return () => clearTimeout(timer);
  }, [siteAssets, isCloudLoaded]);

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

    setSyncStatus('saving');
    const timeoutId = setTimeout(async () => {
      try {
        const docRef = doc(db, "site_settings", "banner_config");
        await setDoc(docRef, bannerConfig);
        console.log("Cloud config synced!");
        setSyncStatus('synced');
      } catch (error) {
        console.error("Error saving to cloud:", error);
        setSyncStatus(`error: ${error.message || 'Check connection'}`);
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
          isAdmin ? (
            <>
              <div style={{ background: '#111827', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Admin Control Panel Verified</span>
                <button onClick={logout} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Logout</button>
              </div>
              <AdminPanel 
                config={bannerConfig} 
                setConfig={setBannerConfig} 
                syncStatus={syncStatus}
                assets={siteAssets}
                setAssets={setSiteAssets}
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#111827' }}>Admin Access Required</h2>
              <p style={{ color: '#4b5563', marginBottom: '24px' }}>You must verify your identity to access the management portal.</p>
              <button 
                onClick={() => setShowAuthModal(true)}
                style={{ padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
              >
                Login as Admin
              </button>
            </div>
          )
        ) : (
          <ContentArea activeSection={activeSection} assets={siteAssets} />
        )}
      </main>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

export default App;
