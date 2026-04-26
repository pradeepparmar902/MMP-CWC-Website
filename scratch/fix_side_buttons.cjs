const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Replace Top Left
content = content.replace(
  /highlight1Post \? handleEdit\(highlight1Post\) : setShowModal\(true\);\s*}}\s*>\s*✏️\s*<\/button>/g,
  `highlight1Post ? handleEdit(highlight1Post) : setShowModal(true);
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
                  )}`
);

// 2. Replace Bottom Left
content = content.replace(
  /highlight2Post \? handleEdit\(highlight2Post\) : setShowModal\(true\);\s*}}\s*>\s*✏️\s*<\/button>/g,
  `highlight2Post ? handleEdit(highlight2Post) : setShowModal(true);
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
                  )}`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed side buttons.');
