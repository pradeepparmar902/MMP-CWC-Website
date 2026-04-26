const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// Replace dynamic imports with static ones (already imported at top)
const dynamicImportBtn = `onClick={async (e) => {
                            e.stopPropagation();
                            const { updateDoc, doc } = await import('firebase/firestore');
                            const { db } = await import('../firebase');
                            await updateDoc(doc(db, 'samaj_jog_sandesh', featured.id), { 
                              isHero: false, isHighlight1: false, isHighlight2: false, isQuickLink: false 
                            });
                          }}`;

const staticImportBtn = `onClick={async (e) => {
                            e.stopPropagation();
                            await updateDoc(doc(db, 'samaj_jog_sandesh', featured.id), { 
                              isHero: false, isHighlight1: false, isHighlight2: false, isQuickLink: false 
                            });
                          }}`;

if (content.includes(dynamicImportBtn)) {
  content = content.replace(dynamicImportBtn, staticImportBtn);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed: dynamic imports replaced with static imports ✅');
} else {
  console.log('Could not find dynamic import block ❌');
}
