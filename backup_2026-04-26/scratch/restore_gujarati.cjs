const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let content = fs.readFileSync(path, 'utf8');

// Fix the last few emoji artifacts
content = content.replace(/titleEn: 'x /g, "titleEn: '🏏 ");
content = content.replace(/titleGu: 'x /g, "titleGu: '🏏 ");
content = content.replace(/titleEn: '✨ /g, "titleEn: '✨ ");
content = content.replace(/titleGu: '✨ /g, "titleGu: '✨ ");

// Final cleanup of any potential BOM or junk at the very start
if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 65533) {
    content = content.substring(1);
}

fs.writeFileSync(path, content, 'utf8');
console.log("Final cleanup finished. All systems normal.");
