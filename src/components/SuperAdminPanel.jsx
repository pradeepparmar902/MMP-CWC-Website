import { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('approvals');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });

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

  const handleApprove = async (user) => {
    try {
      if (!confirm(`Approve ${user.phone}? They will have standard Admin access.`)) return;

      // 1. Add to 'admins' collection
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        phone: user.phone,
        email: user.email,
        virtualEmail: user.virtualEmail,
        status: 'approved',
        approvedAt: new Date().toISOString()
      });

      // 2. Remove from 'pending_users'
      await deleteDoc(doc(db, 'pending_users', user.uid));
      
      alert('✅ User approved successfully!');
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

  return (
    <div className="super-admin-panel container">
      <div className="sap-header">
        <div className="sap-title-row">
          <h1>Senior Admin Portal</h1>
          <div className="sap-badge">Level: Super Admin</div>
        </div>
        
        <nav className="sap-tabs">
          <button 
            className={`sap-tab ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            User Approvals {pendingUsers.length > 0 && <span className="notif-dot">{pendingUsers.length}</span>}
          </button>
          <button 
            className={`sap-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Website Control
          </button>
        </nav>
      </div>

      <div className="sap-content">
        {activeTab === 'approvals' && (
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
                          <div className="action-btns">
                            {user.status !== 'approved' && (
                              <button className="approve-btn" onClick={() => handleApprove(user)}>Approve</button>
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
