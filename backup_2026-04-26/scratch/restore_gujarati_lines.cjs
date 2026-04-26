const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let lines = fs.readFileSync(path, 'utf8').split('\n');

// Restore Dummy Messages (Lines 21-93 approx)
// I'll use the indices found by searching for keys
function fixLine(pattern, newValue) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
            lines[i] = newValue;
        }
    }
}

// Fix Specific broken lines in the Admin Modal
lines[1051] = '                      <label>સત્તાવાર સહી (Gujarati)</label>';
lines[1052] = '                      <input type="text" placeholder="દા.ત., મુખ્ય સમિતિ CWC" value={formData.authorityGu} onChange={e => setFormData({...formData, authorityGu: e.target.value})} />';

lines[1063] = '                        <option value="poster">🖼️ Poster Announcement</option>';
lines[1064] = '                        <option value="video">🎥 Video Content (MP4/YouTube)</option>';
lines[1065] = '                        <option value="letter">📜 Official Letter</option>';
lines[1066] = '                        <option value="text">📝 General Text Message</option>';

lines[1073] = '                        <option value="high">🌟 High Priority (Featured Hero)</option>';

lines[1106] = '                        {(formData.isHighlight || formData.isHighlight1) && <span className="slot-pill highlight">📍 Pinned to TOP</span>}';
lines[1107] = '                        {(formData.isHighlight2 || formData.isQuickLink) && <span className="slot-pill quick">📍 Pinned to BOTTOM</span>}';

lines[1142] = '                    <h4 className="toolkit-title">🎨 Design Canvas</h4>';

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log("Restoration by line number completed.");
