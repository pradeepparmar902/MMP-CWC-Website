const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// FIX 1: Add missing gradient fields to handleEdit (after gradientAngle line)
const editMarker = "      gradientAngle: item.gradientAngle || '135'\r\n    });\r\n    setShowModal(true);";
const editReplacement = `      gradientAngle: item.gradientAngle || '135',
      isHero: item.isHero || false,
      gradientBg: item.gradientBg || false,
      gradientBgColor1: item.gradientBgColor1 || '',
      gradientBgColor2: item.gradientBgColor2 || '',
      gradientBgAngle: item.gradientBgAngle || '135'
    });
    setShowModal(true);`;

if (content.includes(editMarker)) {
  content = content.replace(editMarker, editReplacement);
  console.log('FIX 1: handleEdit updated ✅');
} else {
  console.log('FIX 1: Could not find marker in handleEdit ❌');
}

// FIX 2: Fix buildCardStyle - only apply gradient bg if colors are actually set
const bgLogicStart = '    // ── Background & Border logic ────────────────────────────────────────────────';
const bgLogicEnd = '    // Shadow / Glow';

const startIdx = content.indexOf(bgLogicStart);
const endIdx = content.indexOf(bgLogicEnd);
if (startIdx !== -1 && endIdx !== -1) {
  const newBgLogic = `    // ── Background & Border logic ────────────────────────────────────────────────
    const hasGradientColors = item.gradientBg && (item.gradientBgColor1 || item.gradientBgColor2);
    let baseBg = null;
    if (hasGradientColors) {
      baseBg = \`linear-gradient(\${item.gradientBgAngle || '135'}deg, \${item.gradientBgColor1 || '#7c3aed'}, \${item.gradientBgColor2 || '#4f46e5'})\`;
    } else if (item.bgColor) {
      baseBg = item.bgColor;
    }

    if (item.gradientBorder && Number(item.borderWidth) > 0) {
      // 1. Gradient border (uses padding-box / border-box trick)
      const ang = item.gradientAngle  || '135';
      const c1  = item.gradientColor1 || '#7c3aed';
      const c2  = item.gradientColor2 || '#3b82f6';
      const paddingBoxBg = baseBg ? baseBg : 'white';
      const paddingBoxBgWrapped = hasGradientColors ? paddingBoxBg : \`linear-gradient(\${paddingBoxBg}, \${paddingBoxBg})\`;
      s.background = \`\${paddingBoxBgWrapped} padding-box, linear-gradient(\${ang}deg, \${c1}, \${c2}) border-box\`;
      s.border = \`\${item.borderWidth}px solid transparent\`;
    } else {
      if (item.borderStyle === 'none') {
        s.border = 'none';
      } else if (item.borderColor && item.borderStyle && Number(item.borderWidth || 1) > 0) {
        s.borderColor = item.borderColor;
        s.borderWidth = \`\${item.borderWidth || 1}px\`;
        s.borderStyle = item.borderStyle || 'solid';
      }
      // Only override CSS background if a custom bg is actually set
      if (baseBg) {
        s.background = baseBg;
      }
    }

`;
  content = content.substring(0, startIdx) + newBgLogic + content.substring(endIdx);
  console.log('FIX 2: buildCardStyle updated ✅');
} else {
  console.log('FIX 2: Could not find buildCardStyle markers ❌', startIdx, endIdx);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done.');
