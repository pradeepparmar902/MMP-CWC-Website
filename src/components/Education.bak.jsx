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
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import DynamicForm from './common/DynamicForm';
import './Education.css';

export default function Education() {
  const { currentUser, isSuperAdmin, isEduAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isEduAdmin;

  const [schema, setSchema] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [isEditable, setIsEditable] = useState(true);

  // 1. Fetch Form Structure and User's Existing Submission
  useEffect(() => {
    const initPortal = async () => {
      try {
        // Fetch Form Config
        const configSnap = await getDoc(doc(db, 'site_settings', 'education_form_config'));
        if (configSnap.exists()) {
          const config = configSnap.data();
          setSchema(config.fields || []);
          setWebhookUrl(config.webhookUrl || '');
        }

        // Fetch User's Submission (Filter by UID or Phone)
        let q = query(
          collection(db, 'education_submissions'), 
          where('userId', '==', currentUser.uid)
        );
        
        let querySnapshot = await getDocs(q);

        // Fallback: Match by Phone Number (if no UID match)
        if (querySnapshot.empty && (currentUser.phoneNumber || formData.userPhone)) {
          const searchPhone = (currentUser.phoneNumber || formData.userPhone || '').replace('+91', '');
          if (searchPhone) {
            const qPhone = query(
              collection(db, 'education_submissions'),
              where('userPhone', '==', searchPhone)
            );
            querySnapshot = await getDocs(qPhone);
          }
        }
        
        if (!querySnapshot.empty && !isAdmin) {
          const subDoc = querySnapshot.docs[0];
          const subData = subDoc.data();
          
          const cleanData = { ...subData };
          schema.forEach(field => {
            if ((field.type === 'file' || field.type === 'doc') && cleanData[field.id]?.includes('Drive')) {
              delete cleanData[field.id];
            }
          });

          setFormData(cleanData);
          setSubmissionId(subDoc.id);
          setSubmitted(true);
          setIsEditable(subData.isLocked !== true || isAdmin);
        }
      } catch (error) {
        console.error("Portal Init Error:", error);
      } finally {
        setIsConfigLoading(false);
      }
    };

    if (currentUser) initPortal();
  }, [currentUser, schema.length]);

  const handleSubmit = async () => {
    if (!webhookUrl) {
      alert("Education form is not yet configured.");
      return;
    }

    setLoading(true);
    try {
      // 1. Identify Student Name from form
      const studentNameField = schema.find(f => 
        f.label.toLowerCase().includes('name') && f.type !== 'file' && f.type !== 'doc'
      );
      let studentName = "Unknown";
      if (studentNameField) {
        const val = formData[studentNameField.id];
        studentName = typeof val === 'object' ? `${val.firstName || ''} ${val.lastName || ''}`.trim() : (val || "Unknown");
      } else {
        studentName = currentUser?.displayName || "Student";
      }

      // 2. Identify Mobile Number from form
      const phoneField = schema.find(f => 
        f.type === 'tel_in' || f.label.toLowerCase().includes('mobile') || f.label.toLowerCase().includes('phone')
      );
      const userPhone = (phoneField ? formData[phoneField.id] : currentUser?.phoneNumber) || 'N/A';

      // 3. Persistent Form ID Logic
      // If updating, keep the same ID. If new, Firestore will generate one.
      const currentFormId = submissionId || `EDU-${Date.now().toString().slice(-6)}`;

      const payload = {
        ...formData,
        studentName,
        userPhone,
        formId: currentFormId, // This is the unique anchor
        submittedAt: new Date().toISOString(),
        userEmail: currentUser?.email || 'N/A',
        userId: currentUser?.uid,
        submittedBy: currentUser?.uid,
        submittedByRole: isAdmin ? (isSuperAdmin ? 'super' : 'edu_admin') : 'user'
      };

      // 1. Webhook (Google Sheets/Drive)
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      // 2. Firebase Record
      const firestoreData = { ...payload };
      Object.keys(firestoreData).forEach(key => {
        if (typeof firestoreData[key] === 'string' && firestoreData[key].startsWith('data:')) {
          firestoreData[key] = "[File Uploaded to Drive]"; 
        }
      });

      if (submissionId && !isAdmin) {
        await updateDoc(doc(db, 'education_submissions', submissionId), firestoreData);
      } else {
        const newDoc = await addDoc(collection(db, 'education_submissions'), firestoreData);
        if (!isAdmin) setSubmissionId(newDoc.id);
      }

      setSubmitted(true);
      if (isAdmin) {
        setFormData({});
        setSubmissionId(null);
      }
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (isConfigLoading) {
    return <div className="edu-container"><div className="spinner"></div><p>Loading Portal...</p></div>;
  }

  if (submitted && !isAdmin) {
    return (
      <div className="edu-container">
        <div className="edu-success-card">
          <div className="success-icon">✅</div>
          <h2>Submission Received</h2>
          <p>Hi {formData.studentName || 'Student'}, your details are securely stored.</p>
          <div className="submission-summary">
             <p><strong>Form ID:</strong> {formData.formId || submissionId || 'N/A'}</p>
             <p><strong>Mobile:</strong> {formData.userPhone || 'N/A'}</p>
          </div>
          {isEditable && (
            <button className="edit-submission-btn" onClick={() => setSubmitted(false)}>
              ✏️ Update My Information
            </button>
          )}
          <p className="submission-note">Your Form ID remains the same even if you update your mobile number.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edu-container">
      <div className="edu-header">
        <h1>Educational Portal</h1>
        <p>{isAdmin ? "Admin Mode: Submitting on behalf of student" : "Fill your academic details below"}</p>
      </div>

      <div className="edu-form-wrapper">
        <DynamicForm 
          schema={schema}
          data={formData}
          setData={setFormData}
          onSubmit={handleSubmit}
          loading={loading}
          submitText={submissionId && !isAdmin ? "Update Information" : "Submit Information"}
        />
        
        {isAdmin && submitted && (
          <button className="reset-admin-form" onClick={() => { setSubmitted(false); setFormData({}); setSubmissionId(null); }}>
            ➕ Submit Another Entry (Admin Only)
          </button>
        )}
      </div>
    </div>
  );
}
