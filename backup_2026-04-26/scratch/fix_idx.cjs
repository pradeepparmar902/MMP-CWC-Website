const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let content = fs.readFileSync(path, 'utf8');

// Fix the mangled variable names in keys and maps
// This regex looks for 'id' followed by one or more junk characters in a template literal key
content = content.replace(/\$\{item\.id\}-\$\{id[^}]+\}/g, '${item.id}-${idx}');
content = content.replace(/\$\{item\.id\}-\$\{idx[^}]+\}/g, '${item.id}-${idx}');

// Fix the maps too just in case
content = content.replace(/\(item, id[^)]+\) =>/g, '(item, idx) =>');

// Fix common junk artifacts in the ticker
content = content.replace(/â¬¢/g, '⬢');
content = content.replace(/લા!વ/g, 'લાઇવ');
content = content.replace(/સમાaાર/g, 'સમાચાર');

fs.writeFileSync(path, content, 'utf8');
console.log("Variable names and ticker UI repaired.");
