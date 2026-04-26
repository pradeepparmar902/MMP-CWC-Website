const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variable
content = content.replace(
  'const [showModal, setShowModal] = useState(false);',
  'const [showModal, setShowModal] = useState(false);\n  const [styleOnlyMode, setStyleOnlyMode] = useState(false);'
);

// 2. Add handleStyle function
content = content.replace(
  'const handleEdit = (item) => {',
  `const handleStyle = (item) => {
    handleEdit(item);
    setStyleOnlyMode(true);
  };

  const handleEdit = (item) => {
    setStyleOnlyMode(false);`
);

content = content.replace(
  'const resetForm = () => {',
  `const resetForm = () => {
    setStyleOnlyMode(false);`
);

// 3. Add buttons to Top Left container
const tlFind = `<button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight1Post ? handleEdit(highlight1Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>`;
const tlRep = `<button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight1Post ? handleEdit(highlight1Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>
                  {highlight1Post && (
                    <button 
                      className="admin-edit-pill" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStyle(highlight1Post);
                      }}
                    >
                      🎨
                    </button>
                  )}`;
content = content.replace(tlFind, tlRep);

// 4. Add buttons to Bottom Left container
const blFind = `<button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight2Post ? handleEdit(highlight2Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>`;
const blRep = `<button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight2Post ? handleEdit(highlight2Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>
                  {highlight2Post && (
                    <button 
                      className="admin-edit-pill" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStyle(highlight2Post);
                      }}
                    >
                      🎨
                    </button>
                  )}`;
content = content.replace(blFind, blRep);

// 5. Add buttons to Hero container
content = content.replace(
  '<button className="admin-edit-hero" onClick={() => handleEdit(featured)}>✏️</button>',
  `<button className="admin-edit-hero" onClick={() => handleEdit(featured)}>✏️</button>
                      <button className="admin-edit-hero" style={{marginLeft: '8px'}} onClick={(e) => { e.stopPropagation(); handleStyle(featured); }}>🎨</button>`
);

// 6. Conditionally render modal settings
content = content.replace(
  '<div className="modal-settings">',
  `<div className="modal-settings">
                  {!styleOnlyMode && (`
);

content = content.replace(
  '{/* 🎨 COLOR + BORDER CANVAS TOOLKIT */}',
  `)}
                  {/* 🎨 COLOR + BORDER CANVAS TOOLKIT */}`
);

content = content.replace(
  '<div className="canvas-toolkit">',
  '<div className="canvas-toolkit" style={styleOnlyMode ? {width: "100%", margin: 0} : {}}>'
);

// 7. Update Modal Header
const headerFind = `<h3>{editingId ? (lang === 'gu' ? 'સંદેશ સંપાદિત કરો' : 'Edit Announcement') : (lang === 'gu' ? 'નવો સંદેશ ઉમેરો' : 'Add New Announcement')}</h3>`;
const headerRep = `<h3>
                {styleOnlyMode ? (lang === 'gu' ? 'ડિઝાઇન કેનવાસ' : 'Design Container') : 
                (editingId ? (lang === 'gu' ? 'સંદેશ સંપાદિત કરો' : 'Edit Announcement') : (lang === 'gu' ? 'નવો સંદેશ ઉમેરો' : 'Add New Announcement'))}
              </h3>`;
content = content.replace(headerFind, headerRep);

fs.writeFileSync(file, content, 'utf8');
console.log('Script ran. Changes saved.');
