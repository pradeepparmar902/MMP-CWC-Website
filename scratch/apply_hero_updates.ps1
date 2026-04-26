$file = "src/components/SamajJogSandesh.jsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

# 1. Update formData state
$content = $content -replace '(isHighlight2:\s*false,)', "$1`n    isHero: false,`n    gradientBg: false,`n    gradientBgColor1: '#7c3aed',`n    gradientBgColor2: '#4f46e5',`n    gradientBgAngle: '135',"

# 2. Update handleEdit
$content = $content -replace '(isHighlight2:\s*item\.isHighlight2\s*\|\|\s*false,)', "$1`n      isHero: item.isHero || false,`n      gradientBg: item.gradientBg || false,`n      gradientBgColor1: item.gradientBgColor1 || '#7c3aed',`n      gradientBgColor2: item.gradientBgColor2 || '#4f46e5',`n      gradientBgAngle: item.gradientBgAngle || '135',"

# 3. Update resetForm
$content = $content -replace '(isHighlight2:\s*false,)', "$1`n      isHero: false,`n      gradientBg: false,`n      gradientBgColor1: '#7c3aed',`n      gradientBgColor2: '#4f46e5',`n      gradientBgAngle: '135',"

# 4. Update featured logic
$content = $content -replace '(const featured = )', '${1}activeMessages.find(m => m.isHero) || '

# 5. Fix card style logic
$oldStyle = '  const buildCardStyle = \(item\) => \{[\s\S]+?return s;\s+?\};'
$newStyle = @'
  const buildCardStyle = (item) => {
    if (!item) return {};
    const s = { color: item.textColor || undefined };

    const r  = item.borderRadius || '12';
    const tl = item.borderRadiusTL !== '' && item.borderRadiusTL != null ? `${item.borderRadiusTL}px` : `${r}px`;
    const tr = item.borderRadiusTR !== '' && item.borderRadiusTR != null ? `${item.borderRadiusTR}px` : `${r}px`;
    const br = item.borderRadiusBR !== '' && item.borderRadiusBR != null ? `${item.borderRadiusBR}px` : `${r}px`;
    const bl = item.borderRadiusBL !== '' && item.borderRadiusBL != null ? `${item.borderRadiusBL}px` : `${r}px`;
    s.borderRadius = `${tl} ${tr} ${br} ${bl}`;

    let bgStyle = '';
    if (item.gradientBg) {
      const ang = item.gradientBgAngle || '135';
      const c1 = item.gradientBgColor1 || '#7c3aed';
      const c2 = item.gradientBgColor2 || '#4f46e5';
      bgStyle = `linear-gradient(${ang}deg, ${c1}, ${c2})`;
    } else if (item.bgColor) {
      bgStyle = `linear-gradient(${item.bgColor}, ${item.bgColor})`;
    }

    if (item.gradientBorder && Number(item.borderWidth) > 0) {
      const ang = item.gradientAngle || '135';
      const c1  = item.gradientColor1 || '#7c3aed';
      const c2  = item.gradientColor2 || '#3b82f6';
      const finalBg = bgStyle || `linear-gradient(white, white)`;
      s.background = `${finalBg} padding-box, linear-gradient(${ang}deg, ${c1}, ${c2}) border-box`;
      s.border = `${item.borderWidth}px solid transparent`;
    } else if (item.borderStyle === 'none') {
      s.border = 'none';
      if (bgStyle) s.background = bgStyle;
    } else if (item.borderColor && item.borderStyle && Number(item.borderWidth || 1) > 0) {
      s.borderColor = item.borderColor;
      s.borderWidth = `${item.borderWidth || 1}px`;
      s.borderStyle = item.borderStyle || 'solid';
      if (bgStyle) s.background = bgStyle;
    } else {
      if (bgStyle) s.background = bgStyle;
    }

    if (item.shadowEnabled) {
      s.boxShadow = `${item.shadowX || 0}px ${item.shadowY || 4}px ${item.shadowBlur || 12}px ${item.shadowSpread || 0}px ${item.shadowColor || 'rgba(0,0,0,0.1)'}`;
    }
    return s;
  };
'@
$content = [Regex]::Replace($content, $oldStyle, $newStyle)

# 6. Modal UI updates (Inject Slot 0 checkbox)
$pill = '                        {formData.isHero && <span className="slot-pill hero">👑 Pinned to HERO</span>}'
$content = $content -replace '(<div className="slot-indicator">)', "$1`n$pill"

$heroCheckbox = @'
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={formData.isHero} 
                          onChange={e => setFormData({
                            ...formData, 
                            isHero: e.target.checked,
                            isHighlight1: false,
                            isHighlight: false,
                            isHighlight2: false,
                            isQuickLink: false
                          })} 
                        />
                        👑 Slot 0 (Hero Center)
                      </label>
'@
$content = $content -replace '(<label className="checkbox-label">)', "$heroCheckbox`n$1"

# 7. Add Gradient Controls
$gradControls = @'
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
'@
$content = $content -replace '(</div>\s*</div>\s*\{/\* 🖊 Full Border Editor)', "$gradControls`n$1"

# 8. Update Reset Button
$content = $content -replace "(bgColor: '', textColor: '', accentColor: '',)", "$1`n                        gradientBg: false, gradientBgColor1: '#7c3aed', gradientBgColor2: '#4f46e5', gradientBgAngle: '135',"

[System.IO.File]::WriteAllText((Resolve-Path $file), $content)
