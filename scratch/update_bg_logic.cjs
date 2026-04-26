const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

const findBlock = `    // ── Border logic ────────────────────────────────────────────────
    if (item.gradientBorder && Number(item.borderWidth) > 0) {
      // 1. Gradient border (uses padding-box / border-box trick)
      const bg  = item.bgColor || 'white';
      const ang = item.gradientAngle  || '135';
      const c1  = item.gradientColor1 || '#7c3aed';
      const c2  = item.gradientColor2 || '#3b82f6';
      s.background = \`linear-gradient(\${bg}, \${bg}) padding-box, linear-gradient(\${ang}deg, \${c1}, \${c2}) border-box\`;
      s.border = \`\${item.borderWidth}px solid transparent\`;
      if (item.bgColor) {} // bg already handled above
    } else if (item.borderStyle === 'none') {
      // 2. User explicitly chose "None" style → remove border
      s.border = 'none';
      if (item.bgColor) s.backgroundColor = item.bgColor;
    } else if (item.borderColor && item.borderStyle && Number(item.borderWidth || 1) > 0) {
      // 3. User configured a custom solid/dashed/dotted/etc border
      s.borderColor = item.borderColor;
      s.borderWidth = \`\${item.borderWidth || 1}px\`;
      s.borderStyle = item.borderStyle || 'solid';
      if (item.bgColor) s.backgroundColor = item.bgColor;
    } else {
      // 4. No custom border configured — let CSS class default apply
      if (item.bgColor) s.backgroundColor = item.bgColor;
    }`;

const replaceBlock = `    // ── Background & Border logic ────────────────────────────────────────────────
    let baseBg = item.bgColor || 'white';
    if (item.gradientBg) {
      baseBg = \`linear-gradient(\${item.gradientBgAngle || '135'}deg, \${item.gradientBgColor1 || '#7c3aed'}, \${item.gradientBgColor2 || '#4f46e5'})\`;
    } else if (item.bgColor) {
      baseBg = item.bgColor;
    }

    if (item.gradientBorder && Number(item.borderWidth) > 0) {
      // 1. Gradient border (uses padding-box / border-box trick)
      const ang = item.gradientAngle  || '135';
      const c1  = item.gradientColor1 || '#7c3aed';
      const c2  = item.gradientColor2 || '#3b82f6';
      
      // Wrap solid colors in linear-gradient for the padding-box trick
      const paddingBoxBg = item.gradientBg ? baseBg : \`linear-gradient(\${baseBg}, \${baseBg})\`;
      s.background = \`\${paddingBoxBg} padding-box, linear-gradient(\${ang}deg, \${c1}, \${c2}) border-box\`;
      s.border = \`\${item.borderWidth}px solid transparent\`;
    } else {
      if (item.borderStyle === 'none') {
        s.border = 'none';
      } else if (item.borderColor && item.borderStyle && Number(item.borderWidth || 1) > 0) {
        s.borderColor = item.borderColor;
        s.borderWidth = \`\${item.borderWidth || 1}px\`;
        s.borderStyle = item.borderStyle || 'solid';
      }
      
      // Override CSS class background gradients if any custom bg is set
      if (item.gradientBg || item.bgColor) {
        s.background = baseBg;
      }
    }`;

if (content.includes(findBlock)) {
  content = content.replace(findBlock, replaceBlock);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Background logic updated successfully.');
} else {
  console.log('Could not find the exact target block. Maybe whitespace differences.');
  
  // Regex fallback since exact match might fail on CR/LF
  const regex = /\/\/ ── Border logic ─+[\s\S]*?if \(item\.bgColor\) s\.backgroundColor = item\.bgColor;\n\s*\}/;
  if (regex.test(content)) {
    content = content.replace(regex, replaceBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Background logic updated via regex successfully.');
  } else {
    console.log('Regex fallback also failed.');
  }
}
