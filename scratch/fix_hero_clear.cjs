const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the delete button in the Hero controls with a Clear/Unpin button
const deleteBtn = `{!featured.isSample && <button className="admin-delete-hero" onClick={() => handleDelete(featured.id)}>🗑️</button>}`;
const clearBtn = `{!featured.isSample && (
                        <button 
                          className="admin-delete-hero" 
                          title="Unpin from Hero (keeps the post)"
                          style={{background: 'rgba(251,191,36,0.2)', color: '#f59e0b'}}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { updateDoc, doc } = await import('firebase/firestore');
                            const { db } = await import('../firebase');
                            await updateDoc(doc(db, 'samaj_jog_sandesh', featured.id), { 
                              isHero: false, isHighlight1: false, isHighlight2: false, isQuickLink: false 
                            });
                          }}
                        >✕</button>
                      )}`;

if (content.includes(deleteBtn)) {
  content = content.replace(deleteBtn, clearBtn);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Hero delete button replaced with Clear/Unpin button ✅');
} else {
  console.log('Could not find delete button marker ❌');
}
