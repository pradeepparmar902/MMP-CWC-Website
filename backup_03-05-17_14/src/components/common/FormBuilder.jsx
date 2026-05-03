import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './FormBuilder.css';

export default function FormBuilder({ fields, setFields, onSave, isSaving }) {
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const addField = () => {
    const newField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: ''
    };
    setFields([...fields, newField]);
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id, key, value) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const handleDragStart = (index) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (index) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newFields = [...fields];
    const itemToMove = newFields.splice(draggedItemIndex, 1)[0];
    newFields.splice(index, 0, itemToMove);
    setFields(newFields);
    setDraggedItemIndex(null);
  };

  const handleExcelImport = (e, fieldId) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const options = data.flat().filter(Boolean).map(String);
      updateField(fieldId, 'options', options);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="form-builder">
      <div className="builder-header">
        <button className="add-field-btn" onClick={addField}>➕ Add New Field</button>
        <button className="save-schema-btn" onClick={onSave} disabled={isSaving}>
          {isSaving ? '⏳ Saving...' : '💾 Save Form Structure'}
        </button>
      </div>

      <div className="fields-grid">
        {fields.map((field, index) => (
          <div 
            key={field.id} 
            className={`field-card ${draggedItemIndex === index ? 'dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
          >
            <div className="field-card-header">
              <span className="drag-handle">⠿</span>
              <span className="field-index">Field #{index + 1}</span>
              <button className="remove-field" onClick={() => removeField(field.id)}>&times;</button>
            </div>

            <div className="field-inputs">
              <div className="f-input-group">
                <label>Field Label</label>
                <input 
                  type="text" 
                  value={field.label} 
                  onChange={(e) => updateField(field.id, 'label', e.target.value)}
                  placeholder="e.g. Student Name"
                />
              </div>

              <div className="f-input-group">
                <label>Field Type</label>
                <select 
                  value={field.type} 
                  onChange={(e) => updateField(field.id, 'type', e.target.value)}
                >
                  <option value="text">Short Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="tel_in">Phone (+91)</option>
                  <option value="select">Dropdown List</option>
                  <option value="date">Date</option>
                  <option value="address">Large Text / Address</option>
                  <option value="fullname">Full Name (F/M/L Split)</option>
                  <option value="file">Profile Photo Upload</option>
                  <option value="doc">Document Upload (PDF/Image)</option>
                </select>
              </div>

              <div className="f-checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={field.required} 
                    onChange={(e) => updateField(field.id, 'required', e.target.checked)}
                  />
                  Mandatory Field
                </label>
              </div>

              {field.type === 'select' && (
                <div className="field-options-manager">
                  <label>Dropdown Options (One per line)</label>
                  <div className="bulk-upload-row">
                    <label className="excel-import-btn">
                      📈 Import from Excel
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        style={{display:'none'}} 
                        onChange={(e) => handleExcelImport(e, field.id)}
                      />
                    </label>
                  </div>
                  <textarea 
                    value={field.options?.join('\n') || ''} 
                    onChange={(e) => updateField(field.id, 'options', e.target.value.split('\n'))}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
