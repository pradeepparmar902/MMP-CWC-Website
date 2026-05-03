import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  orderBy,
  where
} from 'firebase/firestore';
import './EduVerify.css';

export default function EduVerify() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState(null); 
  const [schema, setSchema] = useState([]);
  const [activeDocTab, setActiveDocTab] = useState(0); // For tabbed doc view in modal

  useEffect(() => {
    fetchSubmissions();
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const configSnap = await getDoc(doc(db, 'site_settings', 'education_form_config'));
      if (configSnap.exists()) {
        setSchema(configSnap.data().fields || []);
      }
    } catch (err) {
      console.error("Schema Fetch Error:", err);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'education_submissions'), orderBy('submittedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(data);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const docRef = doc(db, 'education_submissions', id);
      await updateDoc(docRef, { 
        status: newStatus,
        verifiedAt: new Date().toISOString(),
        isLocked: newStatus === 'Approved'
      });
      
      // Update local state
      setSubmissions(submissions.map(s => s.id === id ? { ...s, status: newStatus } : s));
      if (selectedDoc && selectedDoc.id === id) {
        setSelectedDoc({ ...selectedDoc, status: newStatus });
      }
    } catch (error) {
      alert("Error updating status: " + error.message);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.formId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.userPhone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="verify-loading">Loading submissions...</div>;

  return (
    <div className="edu-verify-container">
      <header className="verify-header">
        <div className="header-title">
          <h1>Education Verification Dashboard</h1>
          <p>Review and verify student marksheets ({submissions.length} total)</p>
        </div>
        
        <div className="verify-controls">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search name, ID or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Required More Info">Required More Info</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button className="refresh-btn" onClick={fetchSubmissions}>🔄 Refresh</button>
        </div>
      </header>

      {/* DESKTOP TABLE VIEW */}
      <div className="verify-table-container">
        <table className="verify-table">
          <thead>
            <tr>
              <th>Form ID</th>
              <th>Student Name</th>
              <th>Phone Number</th>
              <th>Submitted At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmissions.map(sub => (
              <tr key={sub.id}>
                <td><span className="id-badge">{sub.formId}</span></td>
                <td><strong>{sub.studentName}</strong></td>
                <td>{sub.userPhone}</td>
                <td>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <span className={`status-pill ${(sub.status || 'Pending').toLowerCase().replace(/ /g, '-')}`}>
                    {sub.status || 'Pending'}
                  </span>
                </td>
                <td>
                  <button className="view-doc-btn" onClick={() => setSelectedDoc(sub)}>
                    👁️ View Info
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSubmissions.length === 0 && (
          <div className="table-empty">No matching submissions found.</div>
        )}
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="verify-mobile-list">
        {filteredSubmissions.map(sub => (
          <div key={sub.id} className="verify-mobile-card" onClick={() => setSelectedDoc(sub)}>
            <div className="card-top">
              <span className="mobile-id">{sub.formId}</span>
              <span className={`status-pill mini ${(sub.status || 'Pending').toLowerCase().replace(/ /g, '-')}`}>
                {sub.status || 'Pending'}
              </span>
            </div>
            <div className="card-main">
              <h3>{sub.studentName}</h3>
              <p className="mobile-date">Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="card-footer-mobile">
              <span className="mobile-phone">📞 {sub.userPhone}</span>
              <button className="mobile-review-btn">Review</button>
            </div>
          </div>
        ))}
        {filteredSubmissions.length === 0 && (
          <div className="mobile-empty">No submissions found.</div>
        )}
      </div>

      {/* STUDENT REVIEW MODAL (REWORKED) */}
      {selectedDoc && (
        <div className="doc-modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="doc-modal-content wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-main">
                <h2>Student Review: {selectedDoc.studentName}</h2>
                <span className={`status-badge-inline ${(selectedDoc.status || 'Pending').toLowerCase().replace(/ /g, '-')}`}>
                  {selectedDoc.status || 'Pending'}
                </span>
              </div>
              <button className="close-modal" onClick={() => setSelectedDoc(null)}>✕</button>
            </div>
            
            <div className="modal-body-reworked">
               {/* LEFT SIDE: DATA FIELDS */}
               <div className="modal-left-section">
                  <h3>📝 Submitted Information</h3>
                  <div className="data-field-list">
                    {schema.map(field => {
                      const val = selectedDoc[field.id];
                      // Skip file fields as they go on the right, and skip if value is missing
                      if (val === undefined || field.type === 'file' || field.type === 'doc') return null;
                      
                      return (
                        <div key={field.id} className="review-field-item">
                          <label>{field.label}</label>
                          <div className="field-value-box">
                            {typeof val === 'object' ? 
                              Object.values(val).filter(v => v).join(' ') : 
                              (val || 'N/A')}
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="metadata-divider"></div>
                    <div className="review-field-item metadata">
                      <label>System Metadata</label>
                      <div className="metadata-grid">
                        <span><strong>Form ID:</strong> {selectedDoc.formId}</span>
                        <span><strong>UID:</strong> {selectedDoc.userId}</span>
                        <span><strong>Submitted:</strong> {selectedDoc.submittedAt ? new Date(selectedDoc.submittedAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
               </div>

               {/* RIGHT SIDE: DOCUMENTS (TABBED ON MOBILE) */}
               <div className="modal-right-section">
                  <div className="document-section">
                    <div className="doc-section-header">
                      <h3>📂 Uploaded Documents</h3>
                      {/* TAB SWITCHER */}
                      <div className="doc-tabs">
                        {schema.filter(f => f.type === 'file' || f.type === 'doc').map((field, idx) => (
                          <button 
                            key={field.id}
                            className={`doc-tab-btn ${activeDocTab === idx ? 'active' : ''}`}
                            onClick={() => setActiveDocTab(idx)}
                          >
                            {field.label.includes('Photo') ? 'Photo' : 'Marksheet'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="doc-preview-list tabbed">
                      {schema.filter(f => f.type === 'file' || f.type === 'doc').map((field, idx) => {
                        if (activeDocTab !== idx) return null; // ONLY SHOW ACTIVE TAB
                        
                        const val = selectedDoc[field.id];
                        const isPlaceholder = val === "[File Uploaded to Drive]";
                        const isDoc = field.type === 'doc' || field.label.toLowerCase().includes('marksheet');
                        
                        return (
                          <div key={field.id} className={`doc-preview-card ${isDoc ? 'large' : 'small'}`}>
                            <div className="doc-preview-header">
                              <span className="doc-label">{field.label}</span>
                              {isPlaceholder && <span className="drive-label">Google Drive</span>}
                            </div>
                            
                            <div className="doc-preview-body">
                              {isPlaceholder ? (
                                <div className="placeholder-content">
                                  <div className="placeholder-icon">📂</div>
                                  <p>File synced to Drive</p>
                                  <code className="id-match-hint">ID: {selectedDoc.formId}</code>
                                </div>
                              ) : val ? (
                                <img src={val} alt={field.label} className={isDoc ? "preview-img-xl" : "preview-img-small"} />
                              ) : (
                                <div className="no-doc-hint">Not Uploaded</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="modal-footer-reworked">
              <div className="footer-actions-left">
                <button 
                  className="btn-modal-approve" 
                  onClick={() => handleStatusUpdate(selectedDoc.id, 'Approved')}
                  disabled={selectedDoc.status === 'Approved'}
                >
                  Approve Application
                </button>
                <button 
                  className="btn-modal-query" 
                  onClick={() => handleStatusUpdate(selectedDoc.id, 'Required More Info')}
                >
                  Ask for More Info
                </button>
                <button 
                  className="btn-modal-reject" 
                  onClick={() => handleStatusUpdate(selectedDoc.id, 'Rejected')}
                >
                  Reject Application
                </button>
              </div>
              <button className="done-btn" onClick={() => setSelectedDoc(null)}>Done Reviewing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
