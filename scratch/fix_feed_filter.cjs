const fs = require('fs');
const file = 'src/components/SamajJogSandesh.jsx';
let c = fs.readFileSync(file, 'utf8');

// Fix the broken feed filter - replace the broken block
const broken = `  const feed = activeMessages.filter(m => \r\n    m.id !== highlight1Post?.id && \r\n    m.id !== highlight2Post?.id && \r\n    // Hero post stays in feed\n  ).slice(0, 15);`;

const fixed = `  // Feed: All posts except Side Slot posts (Hero post ALSO shows in feed)
  const feed = activeMessages.filter(m =>
    m.id !== highlight1Post?.id &&
    m.id !== highlight2Post?.id
  ).slice(0, 15);`;

if (c.includes(broken)) {
  c = c.replace(broken, fixed);
  fs.writeFileSync(file, c, 'utf8');
  console.log('Feed filter fixed ✅');
} else {
  // Use index-based approach
  const startM = '  // 3. Feed: Everything else (Strictly excludes Top Slot, Bottom Slot, and Hero Banner)';
  const endM = '\r\n\r\n  // 4. Current display list';
  const si = c.indexOf(startM);
  const ei = c.indexOf(endM, si);
  if (si !== -1 && ei !== -1) {
    const replacement = `  // Feed: All posts except Side Slot posts (Hero post ALSO shows in feed)
  const feed = activeMessages.filter(m =>
    m.id !== highlight1Post?.id &&
    m.id !== highlight2Post?.id
  ).slice(0, 15);`;
    c = c.substring(0, si) + replacement + c.substring(ei);
    fs.writeFileSync(file, c, 'utf8');
    console.log('Feed filter fixed via index ✅');
  } else {
    console.log('Could not find marker ❌', si, ei);
  }
}
