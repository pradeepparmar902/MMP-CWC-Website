const fs = require('fs');
const path = 'src/components/SamajJogSandesh.jsx';

let lines = fs.readFileSync(path, 'utf8').split('\n');

// Add label fields to formData (line 118, 0-indexed is 117)
lines.splice(117, 0, "    labelEn: '', labelGu: '',");

// Find Admin Modal Title (English) and add Label input above it
const titleIndex = lines.findIndex(l => l.includes('<label>Title (English)</label>'));
if (titleIndex !== -1) {
    const labelInput = `                    <div className="form-group">
                      <label>Category Label (English) [Appears at Top]</label>
                      <input type="text" placeholder="e.g., NOTICE, EVENT" value={formData.labelEn} onChange={e => setFormData({...formData, labelEn: e.target.value})} />
                    </div>`;
    lines.splice(titleIndex - 1, 0, labelInput);
}

// Find Admin Modal Title (Gujarati) and add Label input above it
const titleGuIndex = lines.findIndex(l => l.includes('<label>Title (Gujarati)</label>'));
if (titleGuIndex !== -1) {
    const labelInputGu = `                    <div className="form-group">
                      <label>Category Label (Gujarati) [Top Badge]</label>
                      <input type="text" placeholder="દા.ત. સૂચના, કાર્યક્રમ" value={formData.labelGu} onChange={e => setFormData({...formData, labelGu: e.target.value})} />
                    </div>`;
    lines.splice(titleGuIndex - 1, 0, labelInputGu);
}

// Render the label at the top of each card (above the media section)
const cardMediaIndex = lines.findIndex(l => l.includes('<div className={`card-media ${item.type}-media`}>'));
if (cardMediaIndex !== -1) {
    const topLabelRender = `                {getT(item, 'label') && (
                  <div className="card-top-label-badge">
                    {getT(item, 'label')}
                  </div>
                )}`;
    lines.splice(cardMediaIndex, 0, topLabelRender);
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log("Label fields added to State, UI, and Card Rendering.");
