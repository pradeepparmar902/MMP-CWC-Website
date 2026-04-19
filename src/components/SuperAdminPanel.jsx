import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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

  // Form Builder State
  const [formSchema, setFormSchema] = useState([]);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [editingSchema, setEditingSchema] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);

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
          {isCwcSuper && (
            <button 
              className={`sap-tab ${activeTab === 'form_builder' ? 'active' : ''}`}
              onClick={() => setActiveTab('form_builder')}
            >
              📋 Join Form 
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
                        <React.Fragment key={user.uid}>
                          <tr className={expandedUser === user.uid ? 'row-expanded' : ''}>
                            <td className="page-label">
                              <button 
                                className="expand-row-btn" 
                                onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}
                              >
                                {expandedUser === user.uid ? '▼' : '▶'} {user.phone}
                              </button>
                            </td>
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
                                            ) : (
                                              <span>{fieldSchema?.type === 'tel_in' ? `+91 ${val}` : val}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {(!user.profile || Object.keys(user.profile).length === 0) && <p className="no-profile-msg">No extra profile data provided.</p>}
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
                      <React.Fragment key={user.uid}>
                        <tr className={expandedUser === user.uid ? 'row-expanded' : ''}>
                          <td className="user-phone">
                            <button 
                              className="expand-row-btn" 
                              onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}
                            >
                              {expandedUser === user.uid ? '▼' : '▶'} {user.phone}
                            </button>
                          </td>
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
                                          ) : (
                                            <span>{val}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {(!user.profile || Object.keys(user.profile).length === 0) && <p className="no-profile-msg">No extra profile data provided.</p>}
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

        {(activeTab === 'form_builder' && isCwcSuper) && (
          <div className="form-builder-view">
            <div className="view-header">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <h2>Registration Form Builder</h2>
                  <p>Define which fields users must fill during registration. Changes reflect instantly on the signup modal.</p>
                </div>
                <button 
                  className="save-schema-btn" 
                  disabled={isSavingSchema}
                  onClick={async () => {
                    setIsSavingSchema(true);
                    try {
                      await setDoc(doc(db, 'site_settings', 'registration_form'), { fields: formSchema });
                      alert('✅ Registration form updated successfully!');
                    } catch(e) { alert('❌ Failed to save'); }
                    setIsSavingSchema(false);
                  }}
                >
                  {isSavingSchema ? 'Saving...' : '💾 Save Form Layout'}
                </button>
              </div>
            </div>

            <div className="schema-builder-container">
              <div className="schema-tools">
                <button className="add-field-btn" onClick={() => {
                  const id = `field_${Date.now()}`;
                  setFormSchema([...formSchema, { id, label: 'New Field', type: 'text', required: false }]);
                }}>
                  ➕ Add New Field
                </button>
              </div>

              <div className="fields-grid">
                {formSchema.map((field, index) => (
                  <div key={field.id} className="field-card">
                    <div className="field-card-header">
                      <span className="field-index">Field #{index + 1}</span>
                      <button className="remove-field" onClick={() => setFormSchema(formSchema.filter(f => f.id !== field.id))}>✕</button>
                    </div>
                    
                    <div className="field-inputs">
                      <div className="f-input-group">
                        <label>Display Label</label>
                        <input 
                          type="text" 
                          value={field.label} 
                          onChange={(e) => {
                            const newSchema = [...formSchema];
                            newSchema[index].label = e.target.value;
                            setFormSchema(newSchema);
                          }}
                        />
                      </div>

                      <div className="f-input-group">
                        <label>Field Type</label>
                        <select 
                          value={field.type} 
                          onChange={(e) => {
                            const newSchema = [...formSchema];
                            newSchema[index].type = e.target.value;
                            if (e.target.value === 'select') newSchema[index].options = ['Option 1'];
                            setFormSchema(newSchema);
                          }}
                        >
                          <option value="text">Short Text</option>
                          <option value="date">Date Picker</option>
                          <option value="tel">Phone (Global)</option>
                          <option value="tel_in">India Mobile (+91)</option>
                          <option value="number">General Number</option>
                          <option value="select">Dropdown List</option>
                          <option value="file">Photo/File Upload</option>
                        </select>
                      </div>

                      <div className="f-checkbox-group">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={field.required} 
                            onChange={(e) => {
                              const newSchema = [...formSchema];
                              newSchema[index].required = e.target.checked;
                              setFormSchema(newSchema);
                            }}
                          />
                          Mandatory Field
                        </label>
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div className="field-options-manager">
                        <label>Dropdown Options ({field.options?.length || 0})</label>
                        <div className="bulk-upload-row">
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            id={`excel-upload-${field.id}`}
                            style={{display:'none'}}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const bstr = evt.target.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const wsname = wb.SheetNames[0];
                                const ws = wb.Sheets[wsname];
                                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                                const options = data.flat().filter(val => val !== null && val !== undefined && val !== '').map(String);
                                
                                const newSchema = [...formSchema];
                                newSchema[index].options = options;
                                setFormSchema(newSchema);
                                alert(`✅ Imported ${options.length} options from Excel!`);
                              };
                              reader.readAsBinaryString(file);
                            }}
                          />
                          <button 
                            className="excel-import-btn"
                            onClick={() => document.getElementById(`excel-upload-${field.id}`).click()}
                          >
                            📈 Import from Excel
                          </button>
                        </div>
                        <textarea 
                          placeholder="Or type options separated by commas..."
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => {
                            const newSchema = [...formSchema];
                            newSchema[index].options = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                            setFormSchema(newSchema);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
