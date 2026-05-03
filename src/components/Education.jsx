import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc,
  collection, 
  query, 
  where, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import DynamicForm from './common/DynamicForm';
import './Education.css';

export default function Education() {
  const { currentUser, isSuperAdmin, isEduAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isEduAdmin;

  // Form Config
  const [schema, setSchema] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  
  // Data States
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [formData, setFormData] = useState({});
  const [submissionId, setSubmissionId] = useState(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isListLoading, setIsListLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditable, setIsEditable] = useState(true);
  const [viewMode, setViewMode] = useState('form'); // 'form' or 'success'

  // 1. Initial Load: Form Schema & Submissions List
  useEffect(() => {
    let isMounted = true;
    
    const initEducation = async () => {
      // Clear previous errors and show loading
      if (isMounted) {
        setLoadError(null);
        setIsConfigLoading(true);
      }

      try {
        // Fetch Config with timeout
        const configPromise = getDoc(doc(db, 'site_settings', 'education_form_config'));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timeout")), 12000));
        
        const configSnap = await Promise.race([configPromise, timeoutPromise]);
        
        if (isMounted && configSnap.exists()) {
          const config = configSnap.data();
          setSchema(config.fields || []);
          setWebhookUrl(config.webhookUrl || '');
        }
        
        await fetchSubmissions();
      } catch (error) {
        console.error("Portal Init Error:", error);
        if (isMounted) setLoadError(error.message);
      } finally {
        if (isMounted) setIsConfigLoading(false);
      }
    };

    // ONLY start if we have a user. If no user, just stay in loading state
    // App.jsx handles the "Login Required" wall, so we don't need to show an error here.
    if (currentUser) {
      initEducation();
    }

    return () => { isMounted = false; };
  }, [currentUser]);

  // 2. Fetch Submissions (Sidebar List)
  const fetchSubmissions = async () => {
    setIsListLoading(true);
    try {
      let q;
      // Note: Composite index (userId + submittedAt) might be required in Firestore
      if (isAdmin) {
        q = query(collection(db, 'education_submissions'), orderBy('submittedAt', 'desc'));
      } else {
        q = query(
          collection(db, 'education_submissions'), 
          where('userId', '==', currentUser.uid),
          orderBy('submittedAt', 'desc')
        );
      }
      
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllSubmissions(list);

      if (!isAdmin && list.length > 0 && !submissionId) {
        loadSubmission(list[0]);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      // Fallback query without orderBy if index is missing
      try {
        const fallbackQ = isAdmin 
          ? query(collection(db, 'education_submissions'))
          : query(collection(db, 'education_submissions'), where('userId', '==', currentUser.uid));
        const fallbackSnap = await getDocs(fallbackQ);
        const list = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllSubmissions(list);
      } catch (e) {
        setLoadError("Failed to load submission history.");
      }
    } finally {
      setIsListLoading(false);
    }
  };

  const loadSubmission = (sub) => {
    // Reconstruct clean form data (strip drive links)
    const cleanData = { ...sub };
    schema.forEach(field => {
      if ((field.type === 'file' || field.type === 'doc') && cleanData[field.id]?.includes('Drive')) {
        delete cleanData[field.id];
      }
    });
    setFormData(cleanData);
    setSubmissionId(sub.id);
    setIsEditable((sub.isLocked !== true && sub.status !== 'Approved') || isAdmin);
    setViewMode('form');
  };

  const handleNewEntry = () => {
    setFormData({});
    setSubmissionId(null);
    setIsEditable(true);
    setViewMode('form');
  };

  const handleSubmit = async () => {
    if (!webhookUrl) {
      alert("Portal not configured.");
      return;
    }

    setLoading(true);
    try {
      // Identity Logic
      const nameField = schema.find(f => f.label.toLowerCase().includes('name') && f.type !== 'file' && f.type !== 'doc');
      let studentName = "Unknown";
      if (nameField) {
        const val = formData[nameField.id];
        studentName = typeof val === 'object' ? `${val.firstName || ''} ${val.lastName || ''}`.trim() : (val || "Unknown");
      }

      const phoneField = schema.find(f => f.type === 'tel_in' || f.label.toLowerCase().includes('mobile'));
      const userPhone = (phoneField ? formData[phoneField.id] : currentUser?.phoneNumber) || 'N/A';
      
      const currentFormId = submissionId || formData.formId || `EDU-${Date.now().toString().slice(-6)}`;

      const payload = {
        ...formData,
        studentName,
        userPhone,
        formId: currentFormId,
        submittedAt: new Date().toISOString(),
        userId: submissionId ? (allSubmissions.find(s => s.id === submissionId)?.userId || currentUser.uid) : currentUser.uid,
        submittedBy: currentUser?.uid,
        submittedByRole: isAdmin ? (isSuperAdmin ? 'super' : 'edu_admin') : 'user'
      };

      // 1. Webhook
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      // 2. Firebase
      const firestoreData = { ...payload };
      // We no longer strip the data: images so that admins can preview them directly
      // in the verification portal. Since they are compressed, the size is manageable.
      
      if (submissionId && !isAdmin) {
        await updateDoc(doc(db, 'education_submissions', submissionId), firestoreData);
      } else {
        const newDoc = await addDoc(collection(db, 'education_submissions'), firestoreData);
        setSubmissionId(newDoc.id);
      }

      await fetchSubmissions(); // Refresh list
      setViewMode('success');
    } catch (error) {
      console.error("Submit Error:", error);
      alert("Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  const filteredList = allSubmissions.filter(s => 
    s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.formId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.userPhone?.includes(searchTerm)
  );

  if (loadError) return (
    <div className="edu-dashboard-error">
      <h3>⚠️ Failed to load Dashboard</h3>
      <p>{loadError}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  if (isConfigLoading) return <div className="edu-dashboard-loading">Loading Dashboard...</div>;

  return (
    <div className="edu-dashboard">
      {/* PANEL 1 & 2: LEFT SIDEBAR */}
      <aside className="edu-sidebar">
        <div className="edu-sidebar-top">
          {(isAdmin || allSubmissions.length === 0) && (
            <button className="n-button-create" onClick={handleNewEntry}>
              ➕ Create New Form
            </button>
          )}
          <div className="list-search">
            <input 
              type="text" 
              placeholder="🔍 Search name or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="edu-sidebar-list">
          <div className="list-items">
            {isListLoading ? <div className="list-loader">Loading...</div> : (
              filteredList.map(sub => (
                <div 
                  key={sub.id} 
                  className={`list-item ${submissionId === sub.id ? 'active' : ''}`}
                  onClick={() => loadSubmission(sub)}
                >
                  <div className="item-details">
                    <span className="item-name">{sub.studentName}</span>
                    <span className="item-id">ID: {sub.formId}</span>
                  </div>
                  <div className={`item-status-indicator ${(sub.status || 'Pending').toLowerCase().replace(/ /g, '-')}`} title={sub.status || 'Pending'}>
                    <span className="status-icon-small">
                      {sub.status === 'Approved' ? '✅' : 
                       sub.status === 'Rejected' ? '❌' : 
                       sub.status === 'Required More Info' ? '⚠️' : '🕒'}
                    </span>
                    <span className="status-label-small">{sub.status || 'Pending'}</span>
                  </div>
                </div>
              ))
            )}
            {!isListLoading && filteredList.length === 0 && (
              <div className="list-empty">No forms found</div>
            )}
          </div>
        </div>

        {/* User Info Footer (Panel 1 - bottom) */}
        <div className="edu-sidebar-footer">
           <div className="edu-user-brief">
              <span className="avatar-circle">{currentUser.email[0].toUpperCase()}</span>
              <div className="user-text">
                <strong>{isAdmin ? "Admin" : "Student"}</strong>
                <span className="email-small">{currentUser.email}</span>
              </div>
           </div>
        </div>
      </aside>

      {/* PANEL 3: MAIN CONTENT AREA */}
      <main className="edu-main-content">
        {viewMode === 'success' ? (
          <div className="edu-success-view">
             <div className="success-banner">✅ Success</div>
             <h2>Form Saved Successfully</h2>
             <p>The information for <strong>{formData.studentName}</strong> has been synced.</p>
             <div className="success-actions">
               <button onClick={() => setViewMode('form')}>View/Edit Again</button>
               {isAdmin && <button className="primary" onClick={handleNewEntry}>Submit Another</button>}
             </div>
          </div>
        ) : (
          <div className="edu-form-container">
            <div className="form-header">
              <h2>{submissionId ? (formData.status || 'Pending') : 'New Enrollment'}</h2>
              <p>Form ID: {submissionId ? (allSubmissions.find(s => s.id === submissionId)?.formId) : 'New'}</p>
            </div>
            
            <div className="form-body">
              <DynamicForm 
                schema={schema}
                data={formData}
                setData={setFormData}
                onSubmit={handleSubmit}
                loading={loading}
                submitText={submissionId ? "Save Changes" : "Submit Entry"}
                showSubmit={isEditable}
                readOnly={!isEditable}
              />
              {!isEditable && <div className="locked-notice">🔒 This record is locked for editing.</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
