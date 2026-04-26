const fs = require('fs');
const file = 'src/components/SamajJogSandesh.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix garbled emojis
content = content.replace(/Â°/g, '°');
content = content.replace(/ðŸ–Š/g, '🖊');
content = content.replace(/ðŸ§¹/g, '🧹');
content = content.replace(/ðŸŒˆ/g, '🌈');
content = content.replace(/ðŸŽ¨/g, '🎨');
content = content.replace(/ðŸ‘‘/g, '👑');
content = content.replace(/ðŸ‘ /g, '👑');

// Fix the missing newline
content = content.replace(/<\/div><\/div>\s*<div className="modal-actions">/, '</div>\n                </div>\n\n              <div className="modal-actions">');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed file.');
