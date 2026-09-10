const fs = require('fs');
let content = fs.readFileSync('trust-frontend/src/CharitableTrust.jsx', 'utf8');

const old_pdf = \              if (key.startsWith("[TEXT] ")) {
                  val = key.replace("[TEXT] ", "");
              } else if (!val) {\;
const new_pdf = \              if (pos && (pos.isStatic || key.includes("Static_Text_"))) {
                  val = pos.text || '';
              } else if (key.startsWith("[TEXT] ")) {
                  val = key.replace("[TEXT] ", "");
              } else if (!val) {\;

if (content.includes(old_pdf)) {
  content = content.replace(old_pdf, new_pdf);
} else {
  console.log('Failed to find old_pdf');
}

const old_badge = \                          {/* Badge Header: Variable Tag + [+ Connect] Drill-Down Option + [? Close] */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                            <span style={{display:"flex",alignItems:"center",gap:4}}>
                              {isPivotBadge && <span>??</span>}
                              <span>{isPivotBadge ? (connectedDims.join(" | ") + " | Total Count") : key}</span>
                            </span>

                            <div style={{display:"flex",alignItems:"center",gap:3}} onPointerDown={e => e.stopPropagation()}>
                              {/* ?? Option near the red circle to add another variable and drill down */}
                              <button
                                type="button"\;

const new_badge = \                          {/* Badge Header: Variable Tag + [+ Connect] Drill-Down Option + [? Close] */}
                          <div style={{display:"flex",alignItems: (pos.isStatic || key.includes("Static_Text")) ? "flex-start" : "center",justifyContent:"space-between",gap:6}}>
                            
                            {(pos.isStatic || key.includes("Static_Text")) ? (
                              <textarea
                                value={pos.text || ""}
                                onChange={(e) => {
                                  handleUpdateActivePdf("map", { ...activePdf.map, [key]: { ...pos, text: e.target.value } });
                                }}
                                onPointerDown={e => e.stopPropagation()} 
                                style={{
                                   width: (300 * canvasScale), minHeight: (80 * canvasScale), resize: "both",
                                   background: "rgba(0,0,0,0.4)", color: "white",
                                   border: "1px dashed rgba(255,255,255,0.5)", outline: "none",
                                   borderRadius: 4, padding: "4px 8px",
                                   fontFamily: "inherit", fontSize: "inherit",
                                   lineHeight: 1.4
                                }}
                                placeholder="Type your custom paragraph here..."
                              />
                            ) : (
                              <span style={{display:"flex",alignItems:"center",gap:4}}>
                                {isPivotBadge && <span>??</span>}
                                <span>{isPivotBadge ? (connectedDims.join(" | ") + " | Total Count") : key}</span>
                              </span>
                            )}

                            <div style={{display:"flex",alignItems:"center",gap:3}} onPointerDown={e => e.stopPropagation()}>
                              {/* ?? Option near the red circle to add another variable and drill down */}
                              {!(pos.isStatic || key.includes("Static_Text")) && (
                                <button
                                  type="button"\;

if (content.includes(old_badge)) {
  content = content.replace(old_badge, new_badge);
} else {
  console.log('Failed to find old_badge');
}

const old_controls = \                  {Object.keys(activePdf.map || {}).length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleUpdateActivePdf("map", {})}
                      style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontWeight:700,fontSize:".72rem"}}
                    >
                      Clear All Fields
                    </button>
                  )}
                </div>\;

const new_controls = \                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <button
                      type="button"
                      onClick={() => {
                        const ts = Date.now();
                        const key = \\\{Static_Text_\\\}\\\;
                        handleUpdateActivePdf("map", { ...activePdf.map, [key]: { x: 50, y: 50, isStatic: true, text: "Enter your custom paragraph here..." } });
                      }}
                      style={{background:"#10B981",border:"none",color:"white",cursor:"pointer",fontWeight:800,fontSize:".72rem",padding:"4px 10px",borderRadius:6,boxShadow:"0 2px 4px rgba(16, 185, 129, 0.3)"}}
                      title="Add a custom text block to type a paragraph onto the template"
                    >
                      + Add Custom Text Block
                    </button>
                    {Object.keys(activePdf.map || {}).length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUpdateActivePdf("map", {})}
                        style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontWeight:700,fontSize:".72rem"}}
                      >
                        Clear All Fields
                      </button>
                    )}
                  </div>
                </div>\;

if (content.includes(old_controls)) {
  content = content.replace(old_controls, new_controls);
} else {
  console.log('Failed to find old_controls');
}

fs.writeFileSync('trust-frontend/src/CharitableTrust.jsx', content, 'utf8');
console.log('Successfully patched!');
