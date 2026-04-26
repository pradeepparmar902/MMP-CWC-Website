const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

const startMarker = '    // ── Border logic ────────────────────────────────────────────────';
const endMarker = '    // Shadow / Glow';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `    // ── Background & Border logic ────────────────────────────────────────────────
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
    }

`;
  
  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Successfully replaced background logic via precise indexing.');
} else {
  console.log('Could not find markers:', startIndex, endIndex);
}
