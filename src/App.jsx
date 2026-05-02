import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import Banner from './components/Banner';
import Navigation from './components/Navigation';
import ContentArea from './components/ContentArea';
import AdminPanel from './components/AdminPanel';
import SuperAdminPanel from './components/SuperAdminPanel';
import { useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import AccessWall from './components/AccessWall';
import { SplashScreen } from '@capacitor/splash-screen';

const DEFAULT_NAV_ITEMS = [
  { id: 'home', label: 'Home', color: '#3B82F6', visible: true, isProtected: false },
  { id: 'education', label: 'Education', color: '#10B981', visible: true, isProtected: true },
  { id: 'matrimony', label: 'Matrimony', color: '#EC4899', visible: true, isProtected: true },
  { id: 'meghpush', label: 'MeghPush (News)', color: '#F59E0B', visible: true, isProtected: false },
  { id: 'election', label: 'Election Card', color: '#6366F1', visible: true, isProtected: true },
  { id: 'samaj', label: 'Samaj Jog Sandesh', color: '#8B5CF6', visible: true, isProtected: false },
  { id: 'admin', label: 'Admin', color: '#374151', visible: true, isProtected: true }
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
  const { isAdmin, isSuperAdmin, userStatus, forceAdmin, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [siteAssets, setSiteAssets] = useState([]);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [authInitialView, setAuthInitialView] = useState('login');
  const [language, setLanguage] = useState(() => localStorage.getItem('mmp_language') || 'gu');

  useEffect(() => {
    localStorage.setItem('mmp_language', language);
  }, [language]);
  const [bannerConfig, setBannerConfig] = useState(() => {
    const saved = localStorage.getItem('mmp_banner_config');
    if (!saved) return DEFAULT_BANNER_CONFIG;
    
    const parsed = JSON.parse(saved);
  
    // Migration and initialization for new properties
    const migratedItems = (parsed.navItems || DEFAULT_NAV_ITEMS).map(item => {
      // Ensure 'isProtected' exists, migrating from old 'protected' if needed
      return { 
        ...item, 
        isProtected: item.isProtected ?? item.protected ?? false 
      };
    });

    return {
      ...parsed,
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
            
            // Apply protected status only to 'admin' section if missing
            const finalizedNavItems = mergedNavItems.map(item => {
              if (item.id === 'admin') {
                return { ...item, isProtected: true }; // Force admin to be protected
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
        try {
          await SplashScreen.hide();
        } catch (e) {
          // Ignore error if not running in Capacitor/native context
        }
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
    <>
      <div className={`app-container ${isHeaderCollapsed ? 'header-collapsed' : ''}`} style={{ backgroundColor: bannerConfig.bodyBgColor || '#f9fafb', minHeight: '100vh' }}>
        <Header 
          config={bannerConfig} 
        onLoginClick={(view) => {
          setShowAuthModal(true);
          setAuthInitialView(view || 'login');
        }} 
        isCollapsed={isHeaderCollapsed} 
        navItems={bannerConfig.navItems || []}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        language={language}
        setLanguage={setLanguage}
      />
      <main>
        <Banner config={bannerConfig} isSticky={activeSection === 'admin'} isCollapsed={isHeaderCollapsed} />
        <Navigation 
          activeSection={activeSection} 
          setActiveSection={setActiveSection} 
          navItems={bannerConfig.navItems || []} 
          isHeaderCollapsed={isHeaderCollapsed}
          setIsHeaderCollapsed={setIsHeaderCollapsed}
          language={language}
          setLanguage={setLanguage}
        />
        {activeSection === 'admin' ? (
          /* ADMIN TAB GUARD: Only for Staff/Seniors */
          isSuperAdmin ? (
            <>
              <SuperAdminPanel 
                config={bannerConfig} 
                setConfig={setBannerConfig} 
                syncStatus={syncStatus}
                assets={siteAssets}
                setAssets={setSiteAssets}
              />
            </>
          ) : isAdmin ? (
            <>
              <AdminPanel 
                config={bannerConfig} 
                setConfig={setBannerConfig} 
                syncStatus={syncStatus}
                assets={siteAssets}
                setAssets={setSiteAssets}
              />
            </>
          ) : (
            /* Non-admins trying to access Admin tab */
            <AccessWall 
              type="admin-only" 
              sectionLabel="Management Portal" 
              onLoginClick={() => setShowAuthModal(true)} 
            />
          )
        ) : (
          /* PUBLIC & PROTECTED CONTENT SECTIONS */
          (() => {
            const activeItem = bannerConfig.navItems.find(i => i.id === activeSection);
            
            // 1. Check if section is protected
            if (activeItem?.isProtected) {
              // 2. If guest, show Login Wall
              if (!userStatus) {
                return (
                  <AccessWall 
                    type="login" 
                    sectionLabel={activeItem.label} 
                    onLoginClick={() => setShowAuthModal(true)} 
                  />
                );
              }
              
              // 3. If logged in but pending, show Awaiting Approval
              if (userStatus === 'pending') {
                return (
                  <AccessWall 
                    type="pending" 
                    sectionLabel={activeItem.label} 
                  />
                );
              }

              // 4. If rejected, show Access Denied
              if (userStatus === 'rejected') {
                return (
                  <AccessWall 
                    type="rejected" 
                    sectionLabel={activeItem.label} 
                  />
                );
              }
            }

            // 5. Default Case: Show ContentArea (Public tab or Approved Member)
            return <ContentArea activeSection={activeSection} assets={siteAssets} language={language} />;
          })()
        )}
      </main>
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)} 
          initialView={authInitialView}
        />
      )}
    </div>
    </>
  );
}

export default App;
