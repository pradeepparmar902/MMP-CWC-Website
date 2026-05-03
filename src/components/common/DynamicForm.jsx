import React from 'react';
import { compressImage } from '../../utils/imageUtils';
import './DynamicForm.css';

export default function DynamicForm({ 
  schema, 
  data, 
  setData, 
  onSubmit, 
  loading, 
  submitText = 'Submit',
  showSubmit = true
}) {
  
  const handleChange = (fieldId, value) => {
    setData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = async (fieldId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result;
      // Only compress if it's an image. PDFs should be uploaded directly.
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(result);
        handleChange(fieldId, compressed);
      } else {
        handleChange(fieldId, result);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderField = (field) => {
    const value = data[field.id] || '';

    switch (field.type) {
      case 'file':
      case 'doc':
        const isDoc = field.type === 'doc';
        return (
          <div key={field.id} className={`dynamic-field-${field.type}`}>
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <div className="file-upload-zone">
              <input 
                type="file" 
                accept={isDoc ? "image/*,application/pdf" : "image/*"}
                id={`file-${field.id}`}
                style={{display:'none'}}
                onChange={(e) => handleFileChange(field.id, e.target.files[0])}
              />
              {!value ? (
                <div className="file-uploader-box" onClick={() => document.getElementById(`file-${field.id}`).click()}>
                  <span>{isDoc ? '📄 Click to Upload Document (PDF/Image)' : '📷 Click to Upload Profile Photo'}</span>
                </div>
              ) : (
                <div className="file-preview-container">
                  {isDoc && value.startsWith('data:application/pdf') ? (
                    <div className="pdf-preview-placeholder">
                      <span className="pdf-icon">📄</span>
                      <span className="pdf-text">PDF Document Ready</span>
                    </div>
                  ) : (
                    <img src={value} alt={field.label} className={isDoc ? "doc-preview-img" : "file-preview-img"} />
                  )}
                  <button type="button" className="change-file-btn" onClick={() => document.getElementById(`file-${field.id}`).click()}>
                    Change {isDoc ? 'Document' : 'Photo'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              required={field.required}
            >
              <option value="">Select option...</option>
              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        );

      case 'fullname':
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <div className="fullname-inputs">
              <input 
                type="text"
                value={value.firstName || ''}
                onChange={(e) => handleChange(field.id, { ...value, firstName: e.target.value })}
                placeholder="First Name"
                required={field.required}
              />
              <input 
                type="text"
                value={value.middleName || ''}
                onChange={(e) => handleChange(field.id, { ...value, middleName: e.target.value })}
                placeholder="Middle Name"
                required={field.required}
              />
              <input 
                type="text"
                value={value.lastName || ''}
                onChange={(e) => handleChange(field.id, { ...value, lastName: e.target.value })}
                placeholder="Surname / Last Name"
                required={field.required}
              />
            </div>
          </div>
        );

      case 'address':
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <textarea 
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              required={field.required}
              placeholder={`Enter ${field.label}...`}
            />
          </div>
        );

      case 'tel_in':
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <div className="tel-input-wrapper">
              <span className="tel-prefix">+91</span>
              <input 
                type="tel"
                value={value}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  handleChange(field.id, val);
                }}
                required={field.required}
                placeholder="10-digit number"
              />
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <input 
              type="date"
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              required={field.required}
              max={new Date().toISOString().split('T')[0]} // Helpful for DOB (can't be in future)
            />
          </div>
        );

      default:
        return (
          <div key={field.id} className="dynamic-field-group">
            <label className="field-label">
              {field.label} {field.required && <span className="req-star">*</span>}
            </label>
            <input 
              type={field.type === 'email' ? 'email' : (field.type || 'text')}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              required={field.required}
              placeholder={field.placeholder || `Enter ${field.label}`}
            />
          </div>
        );
    }
  };

  return (
    <form className="dynamic-form" onSubmit={(e) => { e.preventDefault(); onSubmit(e); }}>
      {schema.map(renderField)}
      
      {showSubmit && (
        <button type="submit" className="dynamic-submit-btn" disabled={loading}>
          {loading ? <span className="spinner"></span> : submitText}
        </button>
      )}
    </form>
  );
}
