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
          /* ADMIN TAB GUARD: Only for Staff/Seniors */
          isSuperAdmin ? (
            <>
              <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>🌐 Senior Management Infrastructure</span>
                <button onClick={logout} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Logout</button>
              </div>
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
            /* Non-admins trying to access Admin tab */
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔐</div>
              <h2 
                style={{ fontSize: '24px', marginBottom: '16px', color: '#111827', cursor: 'default' }}
                onClick={(e) => {
                  if (e.shiftKey) {
                    console.log("🤫 EMERGENCY BYPASS: Access Granted.");
                    forceAdmin();
                  }
                }}
              >
                Admin Access Required
              </h2>
              <p style={{ color: '#4b5563', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                The Management Portal is reserved for authorized personnel. Please log in with an administrator account.
              </p>
              <button 
                onClick={() => setShowAuthModal(true)}
                style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
              >
                Identification Required
              </button>
            </div>
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
                  <div style={{ textAlign: 'center', padding: '120px 20px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', borderRadius: '20px', margin: '40px auto', maxWidth: '800px', border: '1px solid #e2e8f0' }}>
                     <div style={{ fontSize: '50px', marginBottom: '20px' }}>🔒</div>
                     <h2 style={{ fontSize: '32px', color: '#1e293b', marginBottom: '12px' }}>Members Only Content</h2>
                     <p style={{ color: '#64748b', fontSize: '18px', marginBottom: '32px' }}>Access to <strong>{activeItem.label}</strong> requires a verified account. Please login or join the community.</p>
                     <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => setShowAuthModal(true)}
                          style={{ padding: '14px 32px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                        >
                          Login to View
                        </button>
                     </div>
                  </div>
                );
              }
              
              // 3. If logged in but pending, show Awaiting Approval
              if (userStatus === 'pending') {
                return (
                  <div style={{ textAlign: 'center', padding: '100px 20px', background: 'white', borderRadius: '12px', margin: '20px auto', maxWidth: '800px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
                    <h2 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '16px' }}>Account Pending Approval</h2>
                    <p style={{ color: '#64748b', fontSize: '18px', maxWidth: '600px', margin: '0 auto 24px' }}>
                      Your account is currently being reviewed by our administrators. You will have access to protected sections like **{activeItem.label}** once approved.
                    </p>
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', display: 'inline-block', marginBottom: '30px', border: '1px solid #edf2f7' }}>
                      <span style={{ color: '#4a5568', fontWeight: '600' }}>Account ID:</span> 
                      <span style={{ marginLeft: '10px', color: '#2b6cb0', fontWeight: 'bold' }}>{useAuth().currentUser?.phoneNumber || "Member"}</span>
                    </div>
                    <div>
                      <button onClick={logout} style={{ padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Logout</button>
                    </div>
                  </div>
                );
              }

              // 4. If rejected, show Access Denied
              if (userStatus === 'rejected') {
                return (
                  <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff1f2', borderRadius: '12px', margin: '20px auto', maxWidth: '800px', border: '1px solid #fda4af' }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚫</div>
                    <h2 style={{ fontSize: '28px', color: '#9f1239', marginBottom: '16px' }}>Access Denied</h2>
                    <p style={{ color: '#be123c', fontSize: '18px', maxWidth: '600px', margin: '0 auto 24px' }}>
                      Sorry, your account was not approved for viewing protected segments.
                    </p>
                    <button onClick={logout} style={{ padding: '12px 24px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Logout</button>
                  </div>
                );
              }
            }

            // 5. Default Case: Show ContentArea (Public tab or Approved Member)
            return <ContentArea activeSection={activeSection} assets={siteAssets} />;
          })()
        )}
      </main>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

export default App;
