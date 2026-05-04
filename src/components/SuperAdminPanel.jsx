import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  addDoc,
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import AdminPanel from './AdminPanel';
import { compressImage } from '../utils/imageUtils';
import FormBuilder from './common/FormBuilder';
import DynamicForm from './common/DynamicForm';
import './SuperAdminPanel.css';

export default function SuperAdminPanel({ config, setConfig, syncStatus, assets, setAssets }) {
  const { currentUser, isSuperAdmin, isEduAdmin } = useAuth();
  const isCwcSuper = currentUser?.email === 'admin@cwc.com';
  
  const [activeTab, setActiveTab] = useState(
    isCwcSuper ? 'access' : 
    (isEduAdmin && !isSuperAdmin) ? 'form_builder' : 'config'
  );
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  
  // Manual Add State
  const [manualPhone, setManualPhone] = useState('');
  const [manualRole, setManualRole] = useState('member');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Form Builder State
  const [formSchema, setFormSchema] = useState([]);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingSchema, setEditingSchema] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [previewData, setPreviewData] = useState({});
  const [previewErrors, setPreviewErrors] = useState([]);
  const [eduFormSchema, setEduFormSchema] = useState([]);
  const [eduWebhookUrl, setEduWebhookUrl] = useState('');
  const [builderMode, setBuilderMode] = useState('registration'); // 'registration' or 'education'
  const [isSavingEduSchema, setIsSavingEduSchema] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [registryData, setRegistryData] = useState([]);
  const [isRegistryLoading, setIsRegistryLoading] = useState(false);
  const [registryUrl, setRegistryUrl] = useState('');
  const [isSavingRegistryUrl, setIsSavingRegistryUrl] = useState(false);
  const [registrySearch, setRegistrySearch] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [approvalsSearch, setApprovalsSearch] = useState('');
  // 🗑️ Delete Requests State
  const [deleteRequests, setDeleteRequests] = useState([]);

  // Friendly role names
  const ROLE_MAP = {
    'super': '🛡️ Site Owner',
    'admin': '⚙️ Full Admin',
    'samaj_admin': '📣 Samaj Jog Admin',
    'edu_admin': '📚 Education Admin',
    'member': '👤 Normal Member'
  };

  // Real-time listener for approved users
  useEffect(() => {
    const q = query(collection(db, 'admins'), orderBy('approvedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, uid: d.id, ...data };
      });
      setApprovedUsers(users);
    });
    return unsubscribe;
  }, []);

  // 1. Fetch Registration Schema
  useEffect(() => {
    const fetchSchema = async () => {
      const docSnap = await getDoc(doc(db, 'site_settings', 'registration_form'));
      if (docSnap.exists()) {
        setFormSchema(docSnap.data().fields || []);
      } else {
        // Initial defaults if none exist
        setFormSchema([
          { id: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your full name' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true },
          { id: 'location', label: 'Current Location', type: 'text', required: false, placeholder: 'City/Area' }
        ]);
      }
    };
    fetchSchema();
  }, []);

  // 2. Fetch Education Schema & Config
  useEffect(() => {
    const fetchEduConfig = async () => {
      const docSnap = await getDoc(doc(db, 'site_settings', 'education_form_config'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEduFormSchema(data.fields || []);
        setEduWebhookUrl(data.webhookUrl || '');
      }
    };
    fetchEduConfig();
  }, []);

  // 1. Real-time listener for pending users
  useEffect(() => {
    const q = query(collection(db, 'pending_users'), orderBy('registeredAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: doc.id, ...data };
      });
      setPendingUsers(users);
      setStats(prev => ({ ...prev, pending: users.length }));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Simple stats fetch
  useEffect(() => {
    const fetchStats = async () => {
      const adminSnap = await query(collection(db, 'admins'));
      // Note: This is a simple count, for very large datasets we would use a counter doc
      // but for this scale, collection size is fine. 
      // (Using a placeholder for now as we don't have a count query utility here)
    };
    fetchStats();
  }, [pendingUsers]);

  // Real-time listener for delete requests
  useEffect(() => {
    const q = query(
      collection(db, 'samaj_delete_requests'),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeleteRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {}); // Silently ignore if collection doesn't exist yet
    return unsubscribe;
  }, []);

  const fetchRegistry = async () => {
    setIsRegistryLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'site_settings', 'election_config'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRegistryUrl(data.sheetUrl || '');
        if (data.sheetUrl) {
          const response = await fetch(data.sheetUrl);
          const csvText = await response.text();
          const { rows } = parseCSV(csvText);
          setRegistryData(rows);
          console.log(`✅ Loaded ${rows.length} registry records for validation.`);
        }
      }
    } catch (e) {
      console.error("Registry fetch failed:", e);
    } finally {
      setIsRegistryLoading(false);
    }
  };

  // 2. Real-time listener for registry configuration and data
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site_settings', 'election_config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRegistryUrl(data.sheetUrl || '');
        if (data.sheetUrl) {
          fetch(data.sheetUrl)
            .then(res => res.text())
            .then(csvText => {
              const { rows } = parseCSV(csvText);
              setRegistryData(rows);
              console.log(`✅ Auto-loaded ${rows.length} registry records.`);
            })
            .catch(err => console.error("Auto-fetch registry failed:", err));
        }
      }
    });
    return unsub;
  }, []);

  /** Parse a published Google Sheet CSV string into array of row objects */
  function parseCSV(csvText) {
    const rows = [];
    let inQuote = false;
    let cur = '';
    let row = [];
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const nextCh = csvText[i + 1];
      if (ch === '"') {
        if (inQuote && nextCh === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        row.push(cur.trim()); cur = '';
      } else if ((ch === '\n' || (ch === '\r' && nextCh === '\n')) && !inQuote) {
        row.push(cur.trim());
        if (row.length > 0 && row.some(c => c !== '')) rows.push(row);
        row = []; cur = '';
        if (ch === '\r') i++;
      } else { cur += ch; }
    }
    if (cur !== '' || row.length > 0) {
      row.push(cur.trim());
      if (row.length > 0 && row.some(c => c !== '')) rows.push(row);
    }
    if (rows.length < 2) return { headers: [], rows: [] };
    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] || ''; });
      return obj;
    });
    return { headers, rows: data };
  }

  const handleApprove = async (user, role) => {
    try {
      const roleName = ROLE_MAP[role] || role;
      if (!confirm(`Approve ${user.phone} as ${roleName}?`)) return;

      // 1. Add to 'admins' collection with specific role
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        phone: user.phone,
        email: user.email,
        virtualEmail: user.virtualEmail,
        status: 'approved',
        role: role,
        profile: user.profile || {}, // PRESERVE ALL REGISTRATION DATA
        approvedAt: new Date().toISOString()
      });

      // 2. Remove from 'pending_users'
      await deleteDoc(doc(db, 'pending_users', user.uid));
      
      alert(`✅ User approved as ${roleName} successfully!`);
    } catch (error) {
      console.error("Error approving user:", error);
      alert('❌ Failed to approve user');
    }
  };

  const handleReject = async (user) => {
    try {
      if (!confirm(`Reject ${user.phone}?`)) return;

      // Update status to 'rejected'
      await setDoc(doc(db, 'pending_users', user.uid), {
        ...user,
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      });
      
      alert('❌ User rejected.');
    } catch (error) {
      console.error("Error rejecting user:", error);
    }
  };

  const moveField = (index, delta) => {
    const newSchema = [...formSchema];
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= newSchema.length) return;
    
    const temp = newSchema[index];
    newSchema[index] = newSchema[targetIndex];
    newSchema[targetIndex] = temp;
    setFormSchema(newSchema);
  };

  const handleDragStart = (index) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (index) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newSchema = [...formSchema];
    const itemToMove = newSchema.splice(draggedItemIndex, 1)[0];
    newSchema.splice(index, 0, itemToMove);
    
    setFormSchema(newSchema);
    setDraggedItemIndex(null);
  };

  // Universal Smart Renderer for dynamic table cells
  const renderDynamicCell = (field, profile) => {
    const val = profile ? profile[field.id] : null;
    
    // Debug helper: If we see "No Name" or dashes, check if the data exists under a different key
    if (!val && profile && Object.keys(profile).length > 0) {
      // console.log(`🔍 Field ${field.id} missing in profile keys:`, Object.keys(profile));
    }

    if (!val && field.type !== 'file') return <span className="cell-empty">—</span>;

    switch (field.type) {
      case 'file':
        return val ? (
          <div className="mini-profile">
             <img src={val} className="mini-avatar" alt="" />
          </div>
        ) : (
          <div className="mini-avatar-placeholder">👤</div>
        );
      
      case 'fullname':
        if (typeof val === 'object') {
          return <span className="mini-name">{( `${val.firstName || ''} ${val.middleName || ''} ${val.lastName || ''}`.trim() ) || 'No Name'}</span>;
        }
        return <span className="mini-name">{val || 'No Name'}</span>;

      case 'address':
        return <div className="cell-address-preview" title={val}>{val}</div>;

      case 'tel_in':
        return <span className="cell-tel">+91 {val}</span>;

      default:
        return <span>{typeof val === 'object' ? JSON.stringify(val) : val}</span>;
    }
  };

  const handleDelete = async (user) => {
    if (!confirm('Permanently delete this registration attempt?')) return;
    await deleteDoc(doc(db, 'pending_users', user.uid));
  };

  const handleChangeRole = async (user, newRole) => {
    const roleName = newRole === 'admin' ? 'Admin' : 'Normal Member';
    if (!confirm(`Change ${user.phone} role to ${roleName}?`)) return;
    try {
      await setDoc(doc(db, 'admins', user.uid), { ...user, role: newRole }, { merge: true });
      alert(`✅ Role changed to ${roleName}!`);
    } catch (err) {
      alert('❌ Failed to change role.');
    }
  };

  const handleRevokeAccess = async (user) => {
    if (!confirm(`Revoke all access for ${user.phone}? They will need to re-register.`)) return;
    try {
      await deleteDoc(doc(db, 'admins', user.uid));
      alert('✅ Access revoked. User removed from system.');
    } catch (err) {
      alert('❌ Failed to revoke access.');
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    const sanitized = manualPhone.trim();
    if (!sanitized) return;
    
    setIsAddingUser(true);
    try {
      // 1. Sanitize for ID (digits only)
      const numericPart = sanitized.replace(/\D/g, '');
      const userId = `manual_${numericPart}`;
      
      // 2. DUPLICATE CHECK: Prevent hang by verifying if user exists in local list first
      const exists = [...approvedUsers, ...pendingUsers].some(u => 
        u.uid === userId || 
        (u.phone && u.phone.replace(/\D/g, '').endsWith(numericPart.slice(-10)))
      );

      if (exists) {
        alert(`⚠️ User with phone ${sanitized} already exists in the system.`);
        setIsAddingUser(false);
        return;
      }

      // 3. SECURE SAVE
      await setDoc(doc(db, 'admins', userId), {
        uid: userId,
        phone: sanitized,
        role: manualRole,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        isManual: true
      });
      
      alert(`✅ User ${sanitized} added successfully!`);
      setManualPhone('');
    } catch (error) {
      console.error("Error adding user:", error);
      alert(`❌ Failed to add user: ${error.message}`);
    } finally {
      setIsAddingUser(false);
    }
  };

  return (
    <div className="super-admin-panel sap-container-wide">
      <div className="sap-header">
        <div className="sap-title-row">
          <h1>Senior Admin Portal</h1>
          <div className="sap-badge">Level: Super Admin</div>
        </div>
        
        <nav className="sap-tabs">
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'access' ? 'active' : ''}`}
              onClick={() => setActiveTab('access')}
            >
              Access Rights
            </button>
          )}
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Manage Users {approvedUsers.length > 0 && <span className="notif-dot" style={{background:'#10b981'}}>{approvedUsers.length}</span>}
            </button>
          )}
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => setActiveTab('approvals')}
            >
              User Approvals {pendingUsers.length > 0 && <span className="notif-dot">{pendingUsers.length}</span>}
            </button>
          )}
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'registry' ? 'active' : ''}`}
              onClick={() => setActiveTab('registry')}
            >
              🗳️ Election Registry
            </button>
          )}
          {isSuperAdmin && (
            <button 
              className={`sap-tab ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              Website Control
            </button>
          )}

          {(isSuperAdmin || isEduAdmin) && (
            <button 
              className={`sap-tab ${activeTab === 'form_builder' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('form_builder');
                if (isEduAdmin && !isSuperAdmin) setBuilderMode('education');
              }}
            >
              📋 {isEduAdmin && !isSuperAdmin ? 'Education' : 'Form Builder'}
            </button>
          )}
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'delete_requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('delete_requests')}
            >
              🗑️ Delete Requests {deleteRequests.length > 0 && <span className="notif-dot" style={{background:'#ef4444'}}>{deleteRequests.length}</span>}
            </button>
          )}
        </nav>
      </div>

      <div className="sap-content">
        {(activeTab === 'access' && isCwcSuper) && (
          <div className="access-view">
            <div className="view-header">
              <h2>Page Access Configuration</h2>
              <p>Control which sections require a user login. Public pages are visible to everyone.</p>
            </div>

            <div className="access-table-wrapper">
              <table className="access-table">
                <thead>
                  <tr>
                    <th>Navigation Label</th>
                    <th>Current Status</th>
                    <th>Visibility</th>
                    <th>Security Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(config.navItems || []).map(item => (
                    <tr key={item.id} className={item.isProtected ? 'row-protected' : 'row-public'}>
                      <td data-label="Page Label" className="page-label">{item.label}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${item.id === 'admin' ? 'admin-only' : item.isProtected ? 'protected' : 'public'}`}>
                          {item.id === 'admin' ? '🛡️ Admin Only' : item.isProtected ? '🔒 Member Only' : '🔓 Public Access'}
                        </span>
                      </td>
                      <td data-label="Visibility">
                        <span className={`visibility-indicator ${item.visible ? 'visible' : 'hidden'}`}>
                          {item.visible ? '👁️ Shown' : '🕶️ Hidden'}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="action-btns">
                          <button 
                            className={`toggle-security-btn ${item.isProtected ? 'make-public' : 'make-protected'}`}
                            onClick={() => {
                              const newItems = config.navItems.map(ni => 
                                ni.id === item.id ? { ...ni, isProtected: !ni.isProtected } : ni
                              );
                              setConfig({ ...config, navItems: newItems });
                            }}
                            disabled={item.id === 'admin'}
                          >
                            {item.isProtected ? 'Unlock (Set Public)' : 'Lock (Set Member Only)'}
                          </button>
                          <button 
                            className="toggle-visibility-btn"
                            onClick={() => {
                                const newItems = config.navItems.map(ni => 
                                  ni.id === item.id ? { ...ni, visible: !ni.visible } : ni
                                );
                                setConfig({ ...config, navItems: newItems });
                            }}
                            disabled={item.id === 'admin'}
                          >
                            {item.visible ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'users' && isCwcSuper) && (() => {
          // Merge all users into one unified list
          const allUsers = [
            ...approvedUsers.map(u => ({ ...u, _source: 'approved' })),
            ...pendingUsers.map(u => ({ ...u, _source: 'pending' }))
          ];
          return (
            <div className="users-view">
              <div className="view-header">
                <h2>Manage All Users</h2>
                <p>View every registered user and assign/change Admin or Member access at any time.</p>
              </div>

              <div className="manual-add-section">
                <form onSubmit={handleManualAdd} className="manual-add-form">
                  <div className="input-group">
                    <label>Phone Number/Identifier</label>
                    <input 
                      type="text" 
                      placeholder="e.g. +91 98765 43210" 
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Assigned Role</label>
                    <select 
                      value={manualRole} 
                      onChange={(e) => setManualRole(e.target.value)}
                      className="manual-input"
                    >
                      {Object.entries(ROLE_MAP).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="add-now-btn" disabled={isAddingUser}>
                    {isAddingUser ? 'Adding...' : '➕ Add to System'}
                  </button>
                </form>
              </div>

              {allUsers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>No registered users yet</h3>
                  <p>Users who register will appear here.</p>
                </div>
              ) : (
                <React.Fragment>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                    <h3 style={{fontSize:'16px', color:'#1e293b', margin:0}}>👥 System Users ({allUsers.length})</h3>
                    <div className="search-box" style={{width:'300px'}}>
                      <input 
                        type="text"
                        placeholder="🔍 Search users (Name, Phone, ID...)"
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        style={{width:'100%', padding:'10px 15px', borderRadius:'20px', border:'1px solid #e2e8f0', fontSize:'14px'}}
                      />
                    </div>
                  </div>

                  {(() => {
                const normalize = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                const searchNorm = normalize(usersSearch);
                const filtered = allUsers.filter(u => {
                  if (!usersSearch) return true;
                  if (normalize(u.phone || '').includes(searchNorm)) return true;
                  if (u.membershipNo && normalize(u.membershipNo).includes(searchNorm)) return true;
                  if (u.profile) {
                    return Object.values(u.profile).some(v => v && normalize(v).includes(searchNorm));
                  }
                  return false;
                });

                if (filtered.length === 0) return (
                  <div className="empty-state" style={{padding:'40px'}}>
                    <p>No users match your search "<strong>{usersSearch}</strong>"</p>
                  </div>
                );

                return (
                  <div className="access-table-wrapper">
                    <table className="access-table">
                      <thead>
                        <tr>
                          <th>Expand</th>
                          {formSchema.map(field => (
                            <th key={field.id}>{field.label.replace('Emal', 'Email')}</th>
                          ))}
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(user => (
                        <React.Fragment key={user.uid}>
                          <tr className={expandedUser === user.uid ? 'row-expanded' : ''}>
                             <td data-label="Expand" className="page-label">
                               <button 
                                 className="expand-row-btn" 
                                 onClick={() => {
                                   console.log("👤 INSIDE USER DOC:", user);
                                   setExpandedUser(expandedUser === user.uid ? null : user.uid);
                                 }}
                               >
                                 {expandedUser === user.uid ? '▼' : '▶'}
                               </button>
                             </td>
                             
                             {formSchema.map(field => (
                               <td key={field.id} data-label={field.label} className="dynamic-cell">
                                 {renderDynamicCell(field, user.profile)}
                               </td>
                             ))}

                            <td data-label="Phone" className="user-date" style={{fontSize:'12px', color:'#64748b'}}>
                               {user.phone}
                            </td>
                            <td data-label="Status">
                              {user._source === 'approved' ? (
                                <span className={`role-pill ${user.role}`}>
                                  {ROLE_MAP[user.role] || user.role}
                                </span>
                              ) : (
                                <span className={`status-pill ${user.status === 'rejected' ? 'rejected' : 'pending'}`}>
                                  {user.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                </span>
                              )}
                            </td>
                            <td data-label="Actions">
                              <div className="action-btns">
                                {/* Grant/Promote to Admin */}
                                {user.role !== 'admin' && (
                                  <button
                                    className="approve-btn"
                                    style={{background:'#4338ca', fontSize:'12px', padding:'6px 10px'}}
                                    onClick={async () => {
                                      if (!confirm(`Grant Admin access to ${user.phone}?`)) return;
                                      try {
                                        await setDoc(doc(db, 'admins', user.uid), {
                                          uid: user.uid, phone: user.phone,
                                          email: user.email || null,
                                          virtualEmail: user.virtualEmail || null,
                                          status: 'approved', role: 'admin',
                                          profile: user.profile || {},
                                          approvedAt: new Date().toISOString()
                                        });
                                        if (user._source === 'pending') await deleteDoc(doc(db, 'pending_users', user.uid));
                                        alert('✅ Admin access granted!');
                                      } catch(e) { alert('❌ Failed'); }
                                    }}
                                  >
                                    🛡️ Set as Admin
                                  </button>
                                )}
                                {/* Grant/Demote to Member */}
                                {user.role !== 'member' && (
                                  <button
                                    className="approve-btn"
                                    style={{background:'#3b82f6', fontSize:'12px', padding:'6px 10px'}}
                                    onClick={async () => {
                                      if (!confirm(`Set ${user.phone} as Normal Member?`)) return;
                                      try {
                                        await setDoc(doc(db, 'admins', user.uid), {
                                          uid: user.uid, phone: user.phone,
                                          email: user.email || null,
                                          virtualEmail: user.virtualEmail || null,
                                          status: 'approved', role: 'member',
                                          profile: user.profile || {},
                                          approvedAt: new Date().toISOString()
                                        });
                                        if (user._source === 'pending') await deleteDoc(doc(db, 'pending_users', user.uid));
                                        alert('✅ Set as Normal Member!');
                                      } catch(e) { alert('❌ Failed'); }
                                    }}
                                  >
                                    👤 Set as Member
                                  </button>
                                )}
                                {/* Revoke */}
                                {user._source === 'approved' && (
                                  <button
                                    className="delete-btn-sap"
                                    style={{color:'#ef4444', fontWeight:'700'}}
                                    onClick={() => handleRevokeAccess(user)}
                                  >
                                    Revoke
                                  </button>
                                )}
                                {/* Delete pending */}
                                {user._source === 'pending' && (
                                  <button
                                    className="delete-btn-sap"
                                    style={{color:'#ef4444', fontWeight:'700'}}
                                    onClick={() => handleDelete(user)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedUser === user.uid && (
                            <tr className="detail-row">
                              <td colSpan="4">
                                <div className="user-profile-details">
                                  <h4>Dynamic Profile Details</h4>
                                  <div className="profile-grid">
                                    {Object.entries(user.profile || {}).map(([key, val]) => {
                                      const fieldSchema = formSchema.find(f => f.id === key);
                                      if (!val) return null;
                                      return (
                                        <div key={key} className="profile-item">
                                          <label>{fieldSchema?.label || key}:</label>
                                          <div className="profile-value">
                                            {fieldSchema?.type === 'file' ? (
                                              <img src={val} alt="Identity Photo" className="profile-preview-img" />
                                            ) : fieldSchema?.type === 'fullname' ? (
                                              <span>{val?.firstName || ''} {val?.middleName || ''} {val?.lastName || ''}</span>
                                            ) : fieldSchema?.type === 'address' ? (
                                              <div style={{whiteSpace: 'pre-line', color: '#334155', fontStyle: 'italic'}}>{val}</div>
                                            ) : (
                                              <span>{fieldSchema?.type === 'tel_in' ? `+91 ${val}` : val}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {(!user.profile || Object.keys(user.profile).length === 0) && <p className="no-profile-msg">No extra profile data provided.</p>}
                                  </div>

                                  {/* ── Registry Cross-Check ── */}
                                  <div className="cross-check-section">
                                     <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
                                       <h4 style={{display:'flex', alignItems:'center', gap:'8px', color: '#1e293b', margin: 0}}>
                                         🔍 Registry Data Verification
                                       </h4>
                                       <button 
                                         className={`refresh-registry-btn ${isRegistryLoading ? 'spinning' : ''}`}
                                         onClick={(e) => { e.stopPropagation(); fetchRegistry(); }}
                                         disabled={isRegistryLoading}
                                       >
                                         {isRegistryLoading ? 'Refreshing...' : 'Refresh Registry'}
                                       </button>
                                     </div>

                                     {isRegistryLoading ? (
                                       <div className="loading-check">Searching official election registry...</div>
                                     ) : (() => {
                                        // Recursively extract all strings from an object
                                        const getAllValues = (obj) => {
                                          let values = [];
                                          if (!obj) return values;
                                          for (const val of Object.values(obj)) {
                                            if (typeof val === 'string' || typeof val === 'number') {
                                              values.push(val.toString());
                                            } else if (typeof val === 'object') {
                                              values = values.concat(getAllValues(val));
                                            }
                                          }
                                          return values;
                                        };

                                        const normalize = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                                        
                                        // Deep Cross-Check: Look at ALL data points
                                        const userValues = [
                                          user.membershipNo,
                                          user.profile?.membershipNo,
                                          user.fullName,
                                          user.name,
                                          user.email,
                                          user.phoneNumber,
                                          ...getAllValues(user.profile)
                                        ].filter(v => v && v.toString().length > 3); 
                                        
                                        const userValuesNorm = [...new Set(userValues.map(v => normalize(v)))];
                                        
                                        const match = registryData.find(row => {
                                          const rowValuesNorm = Object.values(row).map(v => v ? normalize(v) : '');
                                          // Match if any user value is in this row
                                          return userValuesNorm.some(uv => uv && rowValuesNorm.some(rv => rv === uv || (uv.length > 8 && rv.includes(uv)) || (rv.length > 8 && uv.includes(rv))));
                                        });

                                        const displayId = user.membershipNo || user.profile?.membershipNo || user.fullName || "Profile Data";

                                       if (match) {
                                         return (
                                           <div className="registry-match-card" style={{background:'#f0fdf4', border:'1px solid #bcf0da', padding:'20px', borderRadius:'10px'}}>
                                             <div style={{color:'#166534', fontWeight:'700', fontSize: '15px', marginBottom:'15px', display:'flex', justifyContent:'space-between', borderBottom: '1px solid #bcf0da', paddingBottom: '10px'}}>
                                               <span>✅ OFFICIAL REGISTRY MATCH FOUND</span>
                                               <span>Match Target: {displayId}</span>
                                             </div>
                                             <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'20px'}}>
                                               {Object.entries(match).map(([k, v]) => (
                                                 v && k !== 'Card Link' && (
                                                   <div key={k} className="match-data-item">
                                                     <label style={{display:'block', fontSize:'11px', color:'#64748b', textTransform:'uppercase', fontWeight: 'bold', marginBottom: '4px'}}>{k}</label>
                                                     <span style={{fontSize:'14px', color:'#0f172a', fontWeight:'600'}}>{v}</span>
                                                   </div>
                                                 )
                                               ))}
                                             </div>
                                             <div style={{marginTop:'20px', padding:'12px', background:'rgba(255,255,255,0.7)', borderRadius:'6px', fontSize:'13px', color:'#1e293b', border:'1px dashed #22c55e'}}>
                                               <strong>Validation Step:</strong> Compare the <b>Full Name</b> and <b>Vibhag</b> in this green box with the user's provided details above. If they match, the user is a verified genuine member.
                                             </div>
                                           </div>
                                         );
                                       }

                                       return (
                                         <div className="registry-match-card" style={{background:'#fff1f2', border:'1px solid #fecaca', padding:'20px', borderRadius:'10px', color:'#991b1b'}}>
                                           <div style={{fontWeight:'700', fontSize: '15px', marginBottom:'10px'}}>❌ NO REGISTRY MATCH FOUND</div>
                                           <p style={{fontSize:'14px', lineHeight:'1.5', marginBottom:'15px'}}>
                                             The provided profile data was not found in the official election database records. 
                                           </p>
                                           
                                           <div style={{background:'rgba(0,0,0,0.05)', padding:'10px', borderRadius:'6px', fontSize:'12px', border:'1px solid rgba(0,0,0,0.1)'}}>
                                             <div style={{fontWeight:'bold', marginBottom:'5px', color:'#475569'}}>DEBUG INFO (Search Targets):</div>
                                             <ul style={{margin:'0', paddingLeft:'15px', color:'#64748b'}}>
                                               <li style={{color: registryData.length === 0 ? '#ef4444' : 'inherit', fontWeight: registryData.length === 0 ? 'bold' : 'normal'}}>
                                                 Registry Records Loaded: {registryData.length} {registryData.length === 0 && "(Spreadsheet link might be broken or not public)"}
                                               </li>
                                               <li style={{wordBreak:'break-all', fontSize:'10px'}}>Registry URL: {registryUrl || 'None set'}</li>
                                               <li>Searching for values: {userValues.join(', ') || 'None found'}</li>
                                               <li>Normalized forms: {userValuesNorm.join(', ') || 'None'}</li>
                                             </ul>
                                             <div style={{marginTop:'5px', fontSize:'11px', color:'#94a3b8'}}>
                                               If "Records Loaded" is 0, the registry connection is broken. Check your Google Sheet "Publish to Web" settings.
                                             </div>
                                           </div>


                                         </div>
                                       );
                                     })()}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
                </React.Fragment>
            )}
          </div>
        );
      })()}

        {(activeTab === 'approvals' && isCwcSuper) && (
          <div className="approvals-view">
            <div className="view-header">
              <h2>Pending Access Requests</h2>
              <p>Review and approve new admin registrations here.</p>
            </div>

            {loading ? (
              <div className="sap-loader">Loading requests...</div>
            ) : pendingUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>No pending requests</h3>
                <p>All registration requests have been processed.</p>
              </div>
            ) : (
              <React.Fragment>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                  <h3 style={{fontSize:'16px', color:'#1e293b', margin:0}}>📋 Pending Requests ({pendingUsers.length})</h3>
                  <div className="search-box" style={{width:'300px'}}>
                    <input 
                      type="text"
                      placeholder="🔍 Search requests (Name, Phone, ID...)"
                      value={approvalsSearch}
                      onChange={(e) => setApprovalsSearch(e.target.value)}
                      style={{width:'100%', padding:'10px 15px', borderRadius:'20px', border:'1px solid #e2e8f0', fontSize:'14px'}}
                    />
                  </div>
                </div>

                {(() => {
              const normalize = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
              const searchNorm = normalize(approvalsSearch);
              const filtered = pendingUsers.filter(u => {
                if (!approvalsSearch) return true;
                if (normalize(u.phone || '').includes(searchNorm)) return true;
                if (u.membershipNo && normalize(u.membershipNo).includes(searchNorm)) return true;
                if (u.profile) {
                  return Object.values(u.profile).some(v => v && normalize(v).includes(searchNorm));
                }
                return false;
              });

              if (filtered.length === 0) return (
                <div className="empty-state" style={{padding:'40px'}}>
                  <p>No pending requests match your search "<strong>{approvalsSearch}</strong>"</p>
                </div>
              );

              return (
                <div className="approvals-table-wrapper">
                  <table className="approvals-table">
                    <thead>
                      <tr>
                        <th>Details</th>
                        {formSchema.map(field => (
                           <th key={field.id}>{field.label.replace('Emal', 'Email')}</th>
                        ))}
                        <th>Base Phone</th>
                        <th>Reg. Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(user => (
                      <React.Fragment key={user.uid}>
                        <tr className={expandedUser === user.uid ? 'row-expanded' : ''}>
                          <td data-label="Expand">
                            <button 
                              className="expand-row-btn" 
                              onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}
                            >
                              {expandedUser === user.uid ? '▼' : '▶'}
                            </button>
                          </td>

                          {formSchema.map(field => (
                             <td key={field.id} data-label={field.label} className="dynamic-cell">
                               {renderDynamicCell(field, user.profile)}
                             </td>
                          ))}

                          <td data-label="Phone" className="user-phone">
                             {user.phone}
                          </td>
                          <td data-label="Date" className="user-date">
                            {(() => {
                              try {
                                const d = user.registeredAt?.toDate ? user.registeredAt.toDate() : new Date(user.registeredAt);
                                return isNaN(d) ? 'Recent' : `${d.toLocaleDateString()}`;
                              } catch(e) { return 'Recent'; }
                            })()}
                          </td>
                          <td data-label="Status">
                            <span className={`status-pill ${user.status}`}>
                              {user.status}
                            </span>
                          </td>
                          <td data-label="Actions">
                            <div className="action-btns" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {user.status !== 'approved' && (
                                <>
                                  <button className="approve-btn" style={{ background: '#3b82f6' }} onClick={() => handleApprove(user, 'member')}>Approve as Member</button>
                                  <button className="approve-btn" style={{ background: '#10b981' }} onClick={() => handleApprove(user, 'admin')}>Approve as Admin</button>
                                </>
                              )}
                              {user.status === 'pending' && (
                                <button className="reject-btn" onClick={() => handleReject(user)}>Reject</button>
                              )}
                              <button className="delete-btn-sap" onClick={() => handleDelete(user)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                        {expandedUser === user.uid && (
                          <tr className="detail-row">
                            <td colSpan="4">
                              <div className="user-profile-details">
                                <h4>Dynamic Profile Details</h4>
                                <div className="profile-grid">
                                    {Object.entries(user.profile || {}).map(([key, val]) => {
                                      const fieldSchema = formSchema.find(f => f.id === key);
                                      if (!val) return null;
                                      return (
                                        <div key={key} className="profile-item">
                                          <label>{fieldSchema?.label || key}:</label>
                                          <div className="profile-value">
                                            {fieldSchema?.type === 'file' ? (
                                              <img src={val} alt="Identity Photo" className="profile-preview-img" />
                                            ) : fieldSchema?.type === 'fullname' ? (
                                              <span>{val?.firstName || ''} {val?.middleName || ''} {val?.lastName || ''}</span>
                                            ) : fieldSchema?.type === 'address' ? (
                                              <div style={{whiteSpace: 'pre-line', color: '#334155', fontStyle: 'italic'}}>{val}</div>
                                            ) : (
                                              <span>{fieldSchema?.type === 'tel_in' ? `+91 ${val}` : (typeof val === 'object' ? JSON.stringify(val) : val)}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  {(!user.profile || Object.keys(user.profile).length === 0) && <p className="no-profile-msg">No extra profile data provided.</p>}
                                </div>

                                {/* ── Registry Cross-Check ── */}
                                <div className="cross-check-section">
                                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
                                     <h4 style={{display:'flex', alignItems:'center', gap:'8px', color: '#1e293b', margin: 0}}>
                                       🔍 Registry Data Verification
                                     </h4>
                                     <button 
                                       className={`refresh-registry-btn ${isRegistryLoading ? 'spinning' : ''}`}
                                       onClick={(e) => { e.stopPropagation(); fetchRegistry(); }}
                                       disabled={isRegistryLoading}
                                     >
                                       {isRegistryLoading ? 'Refreshing...' : 'Refresh Registry'}
                                    </button>
                                   </div>

                                   {isRegistryLoading ? (
                                     <div className="loading-check">Searching official election registry...</div>
                                   ) : (() => {
                                      // Recursively extract all strings from an object
                                      const getAllValues = (obj) => {
                                        let values = [];
                                        if (!obj) return values;
                                        for (const val of Object.values(obj)) {
                                          if (typeof val === 'string' || typeof val === 'number') {
                                            values.push(val.toString());
                                          } else if (typeof val === 'object') {
                                            values = values.concat(getAllValues(val));
                                          }
                                        }
                                        return values;
                                      };

                                      const normalize = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                                      
                                      // Deep Cross-Check: Look at ALL data points (Robust search)
                                      const userValues = [
                                        user.membershipNo,
                                        user.profile?.membershipNo,
                                        user.fullName,
                                        user.name,
                                        user.email,
                                        user.phoneNumber,
                                        ...getAllValues(user.profile)
                                      ].filter(v => v && v.toString().length > 3); 
                                      
                                      const userValuesNorm = [...new Set(userValues.map(v => normalize(v)))];
                                      
                                      const match = registryData.find(row => {
                                        const rowValuesNorm = Object.values(row).map(v => v ? normalize(v) : '');
                                        // Match if any user value is in this row (allow partial matches for long strings)
                                        return userValuesNorm.some(uv => uv && rowValuesNorm.some(rv => rv === uv || (uv.length > 8 && rv.includes(uv)) || (rv.length > 8 && uv.includes(rv))));
                                      });

                                      const displayId = user.membershipNo || user.profile?.membershipNo || user.fullName || "Profile Data";

                                     if (match) {
                                       return (
                                         <div className="registry-match-card" style={{background:'#f0fdf4', border:'1px solid #bcf0da', padding:'20px', borderRadius:'10px'}}>
                                           <div style={{color:'#166534', fontWeight:'700', fontSize: '15px', marginBottom:'15px', display:'flex', justifyContent:'space-between', borderBottom: '1px solid #bcf0da', paddingBottom: '10px'}}>
                                             <span>✅ OFFICIAL REGISTRY MATCH FOUND</span>
                                             <span>Match Target: {displayId}</span>
                                           </div>
                                           <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'20px'}}>
                                             {Object.entries(match).map(([k, v]) => (
                                               v && k !== 'Card Link' && (
                                                 <div key={k} className="match-data-item">
                                                   <label style={{display:'block', fontSize:'11px', color:'#64748b', textTransform:'uppercase', fontWeight: 'bold', marginBottom: '4px'}}>{k}</label>
                                                   <span style={{fontSize:'14px', color:'#0f172a', fontWeight:'600'}}>{v}</span>
                                                 </div>
                                               )
                                             ))}
                                           </div>
                                           <div style={{marginTop:'20px', padding:'12px', background:'rgba(255,255,255,0.7)', borderRadius:'6px', fontSize:'13px', color:'#1e293b', border:'1px dashed #22c55e'}}>
                                             <strong>Validation Step:</strong> Compare the <b>Full Name</b> and <b>Vibhag</b> in this green box with the user's provided details above. If they match, the user is a verified genuine member.
                                           </div>
                                         </div>
                                       );
                                     }

                                     return (
                                       <div className="registry-match-card" style={{background:'#fff1f2', border:'1px solid #fecaca', padding:'20px', borderRadius:'10px', color:'#991b1b'}}>
                                         <div style={{fontWeight:'700', fontSize: '15px', marginBottom:'10px'}}>❌ NO REGISTRY MATCH FOUND</div>
                                         <p style={{fontSize:'14px', lineHeight:'1.5', marginBottom:'15px'}}>
                                           The provided profile data was not found in the official election database records. 
                                         </p>
                                         
                                         <div style={{background:'rgba(0,0,0,0.05)', padding:'10px', borderRadius:'6px', fontSize:'12px', border:'1px solid rgba(0,0,0,0.1)'}}>
                                           <div style={{fontWeight:'bold', marginBottom:'5px', color:'#475569'}}>DEBUG INFO (Search Targets):</div>
                                           <ul style={{margin:'0', paddingLeft:'15px', color:'#64748b'}}>
                                             <li style={{color: registryData.length === 0 ? '#ef4444' : 'inherit', fontWeight: registryData.length === 0 ? 'bold' : 'normal'}}>
                                               Registry Records Loaded: {registryData.length} {registryData.length === 0 && "(Spreadsheet link might be broken or not public)"}
                                             </li>
                                             <li style={{wordBreak:'break-all', fontSize:'10px'}}>Registry URL: {registryUrl || 'None set'}</li>
                                             <li>Searching for values: {userValues.join(', ') || 'None found'}</li>
                                             <li>Normalized forms: {userValuesNorm.join(', ') || 'None'}</li>
                                           </ul>
                                           <div style={{marginTop:'5px', fontSize:'11px', color:'#94a3b8'}}>
                                             If "Records Loaded" is 0, the registry connection is broken. Check your Google Sheet "Publish to Web" settings.
                                           </div>
                                         </div>


                                       </div>
                                     );
                                   })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
              </React.Fragment>
            )}
          </div>
        )}

      {(activeTab === 'registry' && isCwcSuper) && (
        <div className="registry-view">
          <div className="view-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <h2>🗳️ Election Registry Management</h2>
              <p>Configure the official member database used for registration cross-checks.</p>
            </div>
            <button 
              className={`refresh-registry-btn ${isRegistryLoading ? 'spinning' : ''}`}
              onClick={fetchRegistry}
              disabled={isRegistryLoading}
              style={{padding:'10px 20px', fontSize:'13px'}}
            >
              {isRegistryLoading ? 'Syncing...' : '🔄 Sync with Google Sheets'}
            </button>
          </div>

          <div className="registry-config-card" style={{background:'#f8fafc', padding:'25px', borderRadius:'12px', border:'1px solid #e2e8f0', marginBottom:'30px'}}>
            <h3 style={{fontSize:'16px', marginBottom:'15px', color:'#1e293b'}}>🔗 Registry Source Configuration</h3>
            <div style={{display:'flex', gap:'15px'}}>
              <div style={{flex:1}}>
                <label style={{display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'8px'}}>Google Sheet CSV URL (Published to Web)</label>
                <input 
                  type="text"
                  className="manual-input"
                  placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                  value={registryUrl}
                  onChange={(e) => setRegistryUrl(e.target.value)}
                  style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #cbd5e1'}}
                />
              </div>
              <button 
                className="add-now-btn"
                onClick={async () => {
                  setIsSavingRegistryUrl(true);
                  try {
                    await setDoc(doc(db, 'site_settings', 'election_config'), { sheetUrl: registryUrl }, { merge: true });
                    alert("✅ Registry URL updated!");
                    fetchRegistry();
                  } catch (e) { alert("❌ Failed: " + e.message); }
                  finally { setIsSavingRegistryUrl(false); }
                }}
                disabled={isSavingRegistryUrl}
                style={{alignSelf: 'flex-end', height: '42px', padding: '0 25px'}}
              >
                {isSavingRegistryUrl ? 'Saving...' : 'Save URL'}
              </button>
            </div>
          </div>

          <div className="registry-explorer" style={{background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden'}}>
            <div style={{padding:'20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{fontSize:'16px', margin:0}}>📑 All Election Cards Registry</h3>
              <div className="search-box" style={{width:'300px'}}>
                <input 
                  type="text"
                  placeholder="🔍 Search registry (Name, ID, Phone...)"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  style={{width:'100%', padding:'10px 15px', borderRadius:'20px', border:'1px solid #e2e8f0', fontSize:'14px'}}
                />
              </div>
            </div>

            {isRegistryLoading ? (
              <div className="sap-loader" style={{padding:'50px'}}>Loading registry data...</div>
            ) : registryData.length === 0 ? (
              <div className="empty-state" style={{padding:'50px'}}>
                <div className="empty-icon">📭</div>
                <h3>Registry is empty</h3>
                <p>Check the URL above or click Sync to fetch data.</p>
              </div>
            ) : (
              <div className="access-table-wrapper" style={{maxHeight:'600px', overflowY:'auto'}}>
                <table className="access-table">
                  <thead style={{position:'sticky', top:0, zIndex:10}}>
                    <tr>
                      {registryData.length > 0 && Object.keys(registryData[0]).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const normalize = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const searchNorm = normalize(registrySearch);
                      const filtered = registryData.filter(row => {
                        if (!registrySearch) return true;
                        return Object.values(row).some(val => 
                          val && normalize(val.toString()).includes(searchNorm)
                        );
                      });

                      if (filtered.length === 0) return (
                        <tr>
                          <td colSpan={Object.keys(registryData[0]).length} style={{textAlign:'center', padding:'40px', color:'#64748b'}}>
                            No registry records match your search "<strong>{registrySearch}</strong>"
                          </td>
                        </tr>
                      );

                      return filtered.slice(0, 100).map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, i) => (
                            <td key={i} style={{fontSize:'13px'}}>{val}</td>
                          ))}
                        </tr>
                      ));
                    })()}
                    {registryData.length > 100 && (
                      <tr>
                        <td colSpan={Object.keys(registryData[0]).length} style={{textAlign:'center', padding:'20px', color:'#64748b', fontStyle:'italic'}}>
                          Showing first 100 matches. Use search to find specific members.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

        {activeTab === 'config' && (
          <div className="config-view">
             <AdminPanel 
                config={config} 
                setConfig={setConfig} 
                syncStatus={syncStatus}
                assets={assets}
                setAssets={setAssets}
             />
          </div>
        )}

        {(activeTab === 'delete_requests' && isCwcSuper) && (
          <div className="delete-requests-view">
            <div className="view-header">
              <h2>🗑️ Delete Requests</h2>
              <p>These posts were flagged for deletion by Samaj Admins but are older than 24 hours. Review and decide.</p>
            </div>

            {deleteRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>No pending delete requests</h3>
                <p>All clear! No posts are awaiting deletion approval.</p>
              </div>
            ) : (
              <div className="dr-list">
                {deleteRequests.map(req => {
                  const post = req.postData || {};
                  const reqDate = req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date();
                  const postDate = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000) : null;
                  const ageHours = postDate ? Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60)) : '?';

                  return (
                    <div key={req.id} className="dr-card">
                      <div className="dr-card-header">
                        <div className="dr-meta">
                          <span className="dr-type-pill">{post.type?.toUpperCase() || 'POST'}</span>
                          <span className="dr-age">📅 {ageHours}h old</span>
                          <span className="dr-requested">Requested: {reqDate.toLocaleDateString()}</span>
                        </div>
                        <div className="dr-actions">
                          <button
                            className="dr-approve-btn"
                            onClick={async () => {
                              if (!window.confirm('Permanently delete this post?')) return;
                              try {
                                await deleteDoc(doc(db, 'samaj_jog_sandesh', req.postId));
                                await deleteDoc(doc(db, 'samaj_delete_requests', req.id));
                              } catch(e) { alert('Error: ' + e.message); }
                            }}
                          >
                            ✅ Approve Delete
                          </button>
                          <button
                            className="dr-reject-btn"
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'samaj_delete_requests', req.id), { status: 'rejected' });
                              } catch(e) { alert('Error: ' + e.message); }
                            }}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                      <div className="dr-card-body">
                        <h4 className="dr-title">{post.titleEn || post.titleGu || 'Untitled Post'}</h4>
                        {post.subtitleEn && <p className="dr-subtitle">{post.subtitleEn}</p>}
                        <p className="dr-content">{(post.contentEn || post.contentGu || '').substring(0, 150)}...</p>
                        <div className="dr-footer">
                          <span>By: {post.authorityEn || '—'}</span>
                          <span>Requested by UID: {req.requestedBy?.substring(0, 12)}...</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'form_builder' && (isCwcSuper || currentUser?.role === 'edu_admin')) && (
          <div className="form-builder-view">
            <div className="view-header">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <h2>{builderMode === 'registration' ? 'Registration' : 'Education'} Form Builder</h2>
                  <p>
                    {builderMode === 'registration' 
                      ? 'Define which fields users must fill during registration.' 
                      : 'Define fields for student data collection (Marks, Certificates, etc.).'}
                  </p>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  {isCwcSuper && (
                    <select 
                      className="builder-mode-select"
                      value={builderMode}
                      onChange={(e) => setBuilderMode(e.target.value)}
                      style={{padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1'}}
                    >
                      <option value="registration">Registration Form</option>
                      <option value="education">Education Form</option>
                    </select>
                  )}
                  <button 
                    className="preview-form-btn"
                    onClick={() => setShowPreview(true)}
                  >
                    👁️ Preview Form
                  </button>
                </div>
              </div>
            </div>

            {builderMode === 'education' && (
              <div className="webhook-settings" style={{marginBottom:'20px', padding:'15px', background:'#f8fafc', borderRadius:'12px', border:'1px solid #e2e8f0'}}>
                <label style={{display:'block', fontSize:'13px', fontWeight:'700', marginBottom:'8px'}}>Google Sheets Webhook URL</label>
                <input 
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={eduWebhookUrl}
                  onChange={(e) => setEduWebhookUrl(e.target.value)}
                  style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1'}}
                />
                <p style={{fontSize:'11px', color:'#64748b', marginTop:'5px'}}>Data submitted by students will be sent to this Google Apps Script endpoint.</p>
              </div>
            )}

            <FormBuilder 
              fields={builderMode === 'registration' ? formSchema : eduFormSchema}
              setFields={builderMode === 'registration' ? setFormSchema : setEduFormSchema}
              isSaving={builderMode === 'registration' ? isSavingSchema : isSavingEduSchema}
              onSave={async () => {
                if (builderMode === 'registration') {
                  setIsSavingSchema(true);
                  try {
                    await setDoc(doc(db, 'site_settings', 'registration_form'), { fields: formSchema });
                    alert('✅ Registration form updated successfully!');
                  } catch(e) { alert('❌ Failed to save'); }
                  setIsSavingSchema(false);
                } else {
                  setIsSavingEduSchema(true);
                  try {
                    await setDoc(doc(db, 'site_settings', 'education_form_config'), { 
                      fields: eduFormSchema,
                      webhookUrl: eduWebhookUrl 
                    });
                    alert('✅ Education form updated successfully!');
                  } catch(e) { alert('❌ Failed to save'); }
                  setIsSavingEduSchema(false);
                }
              }}
            />
          </div>
        )}

        {/* PREVIEW MODAL */}
        {showPreview && (
          <div className="builder-preview-overlay">
            <div className="builder-preview-modal">
              <div className="preview-header">
                <h3>Registration Form Preview</h3>
                <button className="close-preview" onClick={() => {
                  setShowPreview(false);
                  setPreviewData({});
                  setPreviewErrors([]);
                }}>&times;</button>
              </div>
              <div className="preview-content">
                <p className="preview-tip">🚀 This is an interactive preview. You can test inputs!</p>
                <div style={{background:'#f8fafc', padding:'20px', borderRadius:'12px', border:'1px solid #e2e8f0'}}>
                  <DynamicForm 
                    schema={builderMode === 'registration' ? formSchema : eduFormSchema}
                    data={previewData}
                    setData={setPreviewData}
                    onSubmit={() => alert('✅ Preview Submission Successful!')}
                    submitText="Test Submit"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
