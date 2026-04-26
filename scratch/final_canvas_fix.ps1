$file = "src/components/SamajJogSandesh.jsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

# Match the canvas-toolkit section precisely
$pattern = '(?s)\s*<div className="canvas-toolkit">.*?</div>\s*</div>\s*(?=<div className="modal-actions">)'
$replacement = @'

                  <div className="canvas-toolkit">
                    <h4 className="toolkit-title">🎨 Design Canvas</h4>

                    {/* Basic color pickers row */}
                    <div className="color-grid">
                      <div className="color-pick-item">
                        <label>Background</label>
                        <ColorPicker
                          value={formData.bgColor || ''}
                          onChange={val => setFormData({...formData, bgColor: val})}
                          defaultColor="#ffffff"
                          allowNoFill={true}
                        />
                      </div>
                      <div className="color-pick-item">
                        <label>Text</label>
                        <ColorPicker
                          value={formData.textColor || ''}
                          onChange={val => setFormData({...formData, textColor: val})}
                          defaultColor="#1e3a8a"
                          allowNoFill={false}
                        />
                      </div>
                      <div className="color-pick-item">
                        <label>Highlighter</label>
                        <ColorPicker
                          value={formData.accentColor || ''}
                          onChange={val => setFormData({...formData, accentColor: val})}
                          defaultColor="#fbbf24"
                          allowNoFill={false}
                        />
                      </div>
                    </div>

                    {/* 🌈 Background Gradient Section */}
                    <div className="bg-gradient-controls" style={{marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                      <label className="checkbox-label" style={{marginBottom: '10px', fontWeight: 'bold'}}>
                        <input 
                          type="checkbox" 
                          checked={formData.gradientBg} 
                          onChange={e => setFormData({...formData, gradientBg: e.target.checked})} 
                        />
                        🌈 Enable Background Gradient
                      </label>
                      
                      {formData.gradientBg && (
                        <div className="gradient-config-row" style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                          <ColorPicker
                            value={formData.gradientBgColor1}
                            onChange={val => setFormData({...formData, gradientBgColor1: val})}
                            defaultColor="#7c3aed"
                          />
                          <ColorPicker
                            value={formData.gradientBgColor2}
                            onChange={val => setFormData({...formData, gradientBgColor2: val})}
                            defaultColor="#4f46e5"
                          />
                          <div style={{flex: 1}}>
                            <label style={{fontSize: '10px', display: 'block'}}>Angle: {formData.gradientBgAngle}°</label>
                            <input 
                              type="range" min="0" max="360" 
                              value={formData.gradientBgAngle} 
                              onChange={e => setFormData({...formData, gradientBgAngle: e.target.value})}
                              style={{width: '100%'}}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 🖊 Full Border Editor */}
                    <div style={{marginTop: '14px'}}>
                      <div className="be-section-heading">🖊 Border &amp; Frame</div>
                      <BorderEditor
                        formData={formData}
                        onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
                      />
                    </div>

                    <button
                      type="button"
                      className="reset-canvas-btn"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        bgColor: '', textColor: '', accentColor: '',
                        gradientBg: false, gradientBgColor1: '#7c3aed', gradientBgColor2: '#4f46e5', gradientBgAngle: '135',
                        borderColor: '', borderStyle: 'solid', borderWidth: '1',
                        borderRadius: '12', borderRadiusTL: '', borderRadiusTR: '', borderRadiusBL: '', borderRadiusBR: '',
                        shadowEnabled: false, shadowX: '0', shadowY: '4', shadowBlur: '12', shadowSpread: '0', shadowColor: 'rgba(0,0,0,0.1)',
                        gradientBorder: false, gradientColor1: '#7c3aed', gradientColor2: '#3b82f6', gradientAngle: '135'
                      }))}
                    >
                      🧹 Clear Design
                    </button>
                  </div>
                </div>
'@

$newContent = [Regex]::Replace($content, $pattern, $replacement)
[System.IO.File]::WriteAllText((Resolve-Path $file), $newContent)
