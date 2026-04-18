import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import AdminPanel from './AdminPanel';
import './SuperAdminPanel.css';

export default function SuperAdminPanel({ config, setConfig, syncStatus, assets, setAssets }) {
  const { currentUser } = useAuth();
  const isCwcSuper = currentUser?.email === 'admin@cwc.com';
  
  const [activeTab, setActiveTab] = useState(isCwcSuper ? 'access' : 'config');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  
  // Manual Add State
  const [manualPhone, setManualPhone] = useState('');
  const [manualRole, setManualRole] = useState('member');
  const [isAddingUser, setIsAddingUser] = useState(false);

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
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovedUsers(users);
    });
    return unsubscribe;
  }, []);

  // 1. Real-time listener for pending users
  useEffect(() => {
    const q = query(collection(db, 'pending_users'), orderBy('registeredAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    if (!manualPhone.trim()) return;
    
    setIsAddingUser(true);
    try {
      // Find a unique ID (we use a hash of the phone if it's manual)
      const userId = `manual_${manualPhone.replace(/\D/g, '')}`;
      
      await setDoc(doc(db, 'admins', userId), {
        uid: userId,
        phone: manualPhone.trim(),
        role: manualRole,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        isManual: true
      });
      
      alert(`✅ User ${manualPhone} added successfully!`);
      setManualPhone('');
    } catch (error) {
      console.error("Error adding user:", error);
      alert('❌ Failed to add user');
    } finally {
      setIsAddingUser(false);
    }
  };

  return (
    <div className="super-admin-panel container">
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
          <button 
            className={`sap-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Website Control
          </button>
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
                      <td className="page-label">{item.label}</td>
                      <td>
                        <span className={`status-pill ${item.id === 'admin' ? 'admin-only' : item.isProtected ? 'protected' : 'public'}`}>
                          {item.id === 'admin' ? '🛡️ Admin Only' : item.isProtected ? '🔒 Member Only' : '🔓 Public Access'}
                        </span>
                      </td>
                      <td>
                        <span className={`visibility-indicator ${item.visible ? 'visible' : 'hidden'}`}>
                          {item.visible ? '👁️ Shown' : '🕶️ Hidden'}
                        </span>
                      </td>
                      <td>
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
                <div className="access-table-wrapper">
                  <table className="access-table">
                    <thead>
                      <tr>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Current Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map(user => (
                        <tr key={user.uid}>
                          <td className="page-label">{user.phone}</td>
                          <td style={{color:'#64748b', fontSize:'13px'}}>{user.email || '—'}</td>
                          <td>
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
                          <td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
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
              <div className="approvals-table-wrapper">
                <table className="approvals-table">
                  <thead>
                    <tr>
                      <th>Phone Number</th>
                      <th>Registered Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map(user => (
                      <tr key={user.uid}>
                        <td className="user-phone">{user.phone}</td>
                        <td className="user-date">
                          {new Date(user.registeredAt).toLocaleDateString()} 
                          <span className="user-time">{new Date(user.registeredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${user.status}`}>
                            {user.status}
                          </span>
                        </td>
                        <td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
      </div>
    </div>
  );
}
