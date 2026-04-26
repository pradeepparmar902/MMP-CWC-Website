const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'SamajJogSandesh.jsx');
let content = fs.readFileSync(file, 'utf8');

// Insert empty Hero placeholder before the right panel ticker comment
const insertBefore = '{/* 4. RIGHT PANEL: LIVE NEWS TICKER (Unified) */}';

const emptyHeroBlock = `{/* Hero empty state when no post is pinned */}
          {!featured && (
            <main className="bento-item middle center-feature" id="hero-empty">
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'14px',padding:'24px'}}>
                {canManage ? (
                  <>
                    <div style={{fontSize:'40px'}}>📢</div>
                    <div style={{color:'white',fontWeight:'bold',fontSize:'18px'}}>Hero Slot Empty</div>
                    <div style={{color:'rgba(255,255,255,0.75)',fontSize:'13px',textAlign:'center',maxWidth:'220px'}}>
                      {lang === 'gu' ? 'કોઈ પ્રકાશન Hero સ્લોટ પર પિન નથી' : 'No announcement pinned to Hero slot. Use the pencil icon on any post to pin it here.'}
                    </div>
                    <button className="add-highlight-btn" style={{marginTop:'8px'}} onClick={() => setShowModal(true)}>
                      ➕ {lang === 'gu' ? 'ઉમેરો' : 'Add Post'}
                    </button>
                  </>
                ) : (
                  <div style={{color:'rgba(255,255,255,0.5)',fontSize:'14px'}}>
                    {lang === 'gu' ? 'ટૂંક સમયમાં...' : 'Coming soon...'}
                  </div>
                )}
              </div>
            </main>
          )}

          `;

const idx = content.indexOf(insertBefore);
if (idx !== -1) {
  content = content.substring(0, idx) + emptyHeroBlock + content.substring(idx);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Empty Hero placeholder inserted ✅');
} else {
  console.log('Could not find ticker panel marker ❌');
}
