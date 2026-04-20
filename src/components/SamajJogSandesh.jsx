import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { compressImage } from '../utils/imageUtils';
import { fetchTranslation } from '../utils/translationUtils';
import './SamajJogSandesh.css';

const DUMMY_MESSAGES = [
  {
    id: 'msg_1',
    type: 'poster',
    priority: 'high',
    titleEn: '📢 Mega Health Camp 2026',
    titleGu: '📢 મેગા હેલ્થ કેમ્પ 2026',
    subtitleEn: 'Main Committee Announcement',
    subtitleGu: 'મુખ્ય સમિતિની જાહેરાત',
    dateEn: '19 April 2026',
    dateGu: '19 એપ્રિલ 2026',
    contentEn: 'The Mumbai Meghwal Panchayat is organizing a free health check-up camp for all community members. Specialist doctors from top hospitals will be available for consultations.',
    contentGu: 'મુંબઈ મેઘવાળ પંચાયત તમામ સમુદાયના સભ્યો માટે મફત આરોગ્ય તપાસ શિબિરનું આયોજન કરી રહી છે. ટોચની હોસ્પિટલોના નિષ્ણાત ડોકટરો પરામર્શ માટે ઉપલબ્ધ રહેશે.',
    bannerUrl: 'https://images.unsplash.com/photo-1576091160550-217359f42f8c?auto=format&fit=crop&q=80&w=1200',
    tagsEn: ['Health', 'Important'],
    tagsGu: ['આરોગ્ય', 'મહત્વપૂર્ણ'],
    authorityEn: 'Main Committee CWC',
    authorityGu: 'મુખ્ય સમિતિ CWC'
  },
  {
    id: 'msg_2',
    type: 'letter',
    priority: 'normal',
    titleEn: '📜 Official Election Notification',
    titleGu: '📜 સત્તાવાર ચૂંટણી સૂચના',
    subtitleEn: 'Likhit Sandesh (Written Message)',
    subtitleGu: 'લિખિત સંદેશ',
    dateEn: '18 April 2026',
    dateGu: '18 એપ્રિલ 2026',
    contentEn: 'Important notification regarding the upcoming Vibhag-level committee selection. Please download the PDF letter to read the full guidelines and eligibility criteria.',
    contentGu: 'આગામી વિભાગ સ્તરીય સમિતિની પસંદગી અંગે મહત્વની સૂચના. સંપૂર્ણ માર્ગદર્શિકા વાંચવા માટે કૃપા કરીને PDF પત્ર ડાઉનલોડ કરો.',
    tagsEn: ['Election', 'Official'],
    tagsGu: ['ચૂંટણી', 'સત્તાવાર'],
    authorityEn: 'Election Commission',
    authorityGu: 'ચૂંટણી પંચ',
    hasAttachment: true
  },
  {
    id: 'msg_3',
    type: 'text',
    priority: 'normal',
    titleEn: '✨ Congratulations to Students',
    titleGu: '✨ વિદ્યાર્થીઓને અભિનંદન',
    subtitleEn: 'Recognition Alert',
    subtitleGu: 'ગૌરવ નોંધ',
    dateEn: '15 April 2026',
    dateGu: '15 એપ્રિલ 2026',
    contentEn: 'MMP congratulates all students who have achieved top scores in the recent board exams. We are proud of your dedication and hard work. Your awards will be presented at the Annual Meet.',
    contentGu: 'MMP એ તમામ વિદ્યાર્થીઓને અભિનંદન પાઠવે છે જેમણે તાજેતરની બોર્ડ પરીક્ષાઓમાં ઉચ્ચ સ્કોર મેળવ્યો છે. અમને તમારા સમર્પણ અને મહેનત પર ગર્વ છે.',
    tagsEn: ['Education', 'Celebration'],
    tagsGu: ['શિક્ષણ', 'અભિનંદન'],
    authorityEn: 'Education Wing',
    authorityGu: 'શિક્ષણ વિભાગ'
  },
  {
    id: 'msg_4',
    type: 'poster',
    priority: 'normal',
    titleEn: '🏏 Community Cricket League',
    titleGu: '🏏 કોમ્યુનિટી ક્રિકેટ લીગ',
    subtitleEn: 'Sports Event Flyer',
    subtitleGu: 'રમતગમત કાર્યક્રમ',
    dateEn: '12 April 2026',
    dateGu: '12 એપ્રિલ 2026',
    contentEn: 'Registration is now open for the MMP Premier League! Form your teams and register at the local Vibhag office by the end of this month.',
    contentGu: 'MMP પ્રીમિયર લીગ માટે રજીસ્ટ્રેશન હવે ખુલ્લું છે! તમારી ટીમો બનાવો અને આ મહિનાના અંત સુધીમાં સ્થાનિક વિભાગ કચેરીએ નોંધણી કરાવો.',
    bannerUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=800',
    tagsEn: ['Sports', 'Youth'],
    tagsGu: ['રમતગમત', 'યુવા'],
    authorityEn: 'Youth Committee',
    authorityGu: 'યુવા સમિતિ'
  }
];

export default function SamajJogSandesh({ lang }) {
  const { isSamajAdmin, isSuperAdmin } = useAuth();
  const canManage = isSamajAdmin || isSuperAdmin;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  
  // Admin Editing State
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'poster',
    priority: 'normal',
    titleEn: '', titleGu: '',
    subtitleEn: '', subtitleGu: '',
    contentEn: '', contentGu: '',
    authorityEn: '', authorityGu: '',
    bannerUrl: '',
    tagsEn: ['General'],
    tagsGu: ['સામાન્ય'],
    hasAttachment: false
  });

  // 1. REAL-TIME DATA FETCH
  useEffect(() => {
    const q = query(collection(db, 'samaj_jog_sandesh'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(data.length > 0 ? data : DUMMY_MESSAGES); // Fallback to dummy if empty
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    
    // VALIDATION: Ensure at least one version of Title and Content exists
    const hasTitle = formData.titleEn.trim() || formData.titleGu.trim();
    const hasContent = formData.contentEn.trim() || formData.contentGu.trim();
    const hasAuthority = formData.authorityEn.trim() || formData.authorityGu.trim();

    if (!hasTitle || !hasContent || !hasAuthority) {
      alert(lang === 'gu' ? 'કૃપા કરીને રજૂ કરવા માટે ઓછામાં ઓછા એક ભાષામાં શીર્ષક અને સામગ્રી ભરો.' : 'Please provide at least one language version (English or Gujarati) for the Title, Content, and Authority.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        dateEn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        dateGu: new Date().toLocaleDateString('gu-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'samaj_jog_sandesh', editingId), payload);
      } else {
        await addDoc(collection(db, 'samaj_jog_sandesh'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false);
      resetForm();
    } catch (err) {
      alert('Error saving message: ' + err.message);
    }
    setIsSaving(false);
  };

  const handleSuggestDraft = async (sourceLang) => {
    if (isTranslating) return;
    
    const targetLang = sourceLang === 'en' ? 'gu' : 'en';
    const fields = ['title', 'subtitle', 'content', 'authority'];
    
    setIsTranslating(true);
    try {
      const updates = { ...formData };
      
      for (const field of fields) {
        const sourceKey = field + (sourceLang === 'en' ? 'En' : 'Gu');
        const targetKey = field + (targetLang === 'gu' ? 'Gu' : 'En');
        
        if (formData[sourceKey] && formData[sourceKey].trim()) {
           const suggestion = await fetchTranslation(formData[sourceKey], targetLang);
           if (suggestion) updates[targetKey] = suggestion;
        }
      }
      
      setFormData(updates);
    } catch (err) {
      console.error("Translation logic error:", err);
    }
    setIsTranslating(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this announcement?')) {
      await deleteDoc(doc(db, 'samaj_jog_sandesh', id));
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      type: item.type || 'poster',
      priority: item.priority || 'normal',
      titleEn: item.titleEn || '',
      titleGu: item.titleGu || '',
      subtitleEn: item.subtitleEn || '',
      subtitleGu: item.subtitleGu || '',
      contentEn: item.contentEn || '',
      contentGu: item.contentGu || '',
      authorityEn: item.authorityEn || '',
      authorityGu: item.authorityGu || '',
      bannerUrl: item.bannerUrl || '',
      tagsEn: item.tagsEn || ['General'],
      tagsGu: item.tagsGu || ['સામાન્ય'],
      hasAttachment: item.hasAttachment || false
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      type: 'poster', priority: 'normal',
      titleEn: '', titleGu: '',
      subtitleEn: '', subtitleGu: '',
      contentEn: '', contentGu: '',
      authorityEn: '', authorityGu: '',
      bannerUrl: '',
      tagsEn: ['General'], tagsGu: ['સામાન્ય'],
      hasAttachment: false
    });
  };

  // 🪄 SMART MIXING: Real messages + Dummy samples to keep the grid full
  const activeMessages = [
    ...messages,
    ...DUMMY_MESSAGES.map(dm => ({ ...dm, isSample: true }))
  ].slice(0, 9); // Keep a nice grid of 9 total

  const featured = messages.find(m => m.priority === 'high') || 
                   messages[0] || 
                   activeMessages.find(m => m.isSample && m.priority === 'high') || 
                   activeMessages[0];

  const feed = activeMessages.filter(m => m.id !== featured?.id);

  const getT = (item, field) => {
    const preferredKey = field + (lang === 'gu' ? 'Gu' : 'En');
    const fallbackKey = field + (lang === 'gu' ? 'En' : 'Gu');
    return item[preferredKey] || item[fallbackKey] || '';
  };

  return (
    <div className="samaj-container">
      {/* 🚀 HERO SECTION: FEATURED MESSAGE */}
      {loading ? (
        <div className="samaj-hero loading-hero">
          <div className="shimmer-badge"></div>
          <div className="shimmer-title"></div>
          <div className="shimmer-text"></div>
        </div>
      ) : featured && (
        <div className="samaj-hero">
          <div className="hero-badge">
            {featured.isSample && <span className="sample-pill">SAMPLE</span>}
            {lang === 'gu' ? '📢 લેટેસ્ટ જાહેરાત' : '📢 LATEST ANNOUNCEMENT'}
          </div>
          
          {canManage && !featured.isSample && (
            <div className="admin-hero-controls">
              <button className="admin-edit-hero" onClick={() => handleEdit(featured)}>✏️</button>
              <button className="admin-delete-hero" onClick={() => handleDelete(featured.id)}>🗑️</button>
            </div>
          )}

          <div className="hero-content">
            <div className="hero-inner">
              <div className="hero-text">
                <span className="hero-authority">{getT(featured, 'authority')}</span>
                <h1>{getT(featured, 'title')}</h1>
                <p>{getT(featured, 'content')}</p>
                <div className="hero-footer">
                  <span className="hero-date">📅 {getT(featured, 'date')}</span>
                  <button className="hero-btn">{lang === 'gu' ? 'સંપૂર્ણ સંદેશ વાંચો →' : 'Read Full Message →'}</button>
                </div>
              </div>
              <div className="hero-visual">
                <img src={featured.bannerUrl} alt="Featured Poster" />
                <div className="visual-overlay"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📋 TIMELINE FEED */}
      <div className={`samaj-feed ${lang === 'gu' ? 'lang-gu' : ''}`}>
        <div className="feed-header">
          <h2>{lang === 'gu' ? 'તાજેતરના અપડેટ્સ' : 'Recent Updates'}</h2>
          
          <div className="header-actions">
            {canManage && (
              <button className="admin-add-btn" onClick={() => setShowModal(true)}>
                ➕ {lang === 'gu' ? 'નવો સંદેશ મૂકો' : 'Post New Announcement'}
              </button>
            )}
            <div className="feed-controls">
              <span className="active">{lang === 'gu' ? 'બધા' : 'All'}</span>
              <span>{lang === 'gu' ? 'પત્રો' : 'Letters'}</span>
              <span>{lang === 'gu' ? 'પોસ્ટર્સ' : 'Posters'}</span>
            </div>
          </div>
        </div>

        <div className="feed-grid">
          {feed.map(item => (
            <div key={item.id} className={`sandesh-card ${item.type} ${item.isSample ? 'sample-card' : ''}`}>
              {item.isSample && <div className="sample-label">SAMPLE</div>}
              
              {canManage && !item.isSample && (
                <div className="admin-card-controls">
                  <button 
                    className="admin-edit-pill" 
                    onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                  >
                    ✏️
                  </button>
                  <button 
                    className="admin-delete-pill" 
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    🗑️
                  </button>
                </div>
              )}
               {item.type === 'poster' && (
                 <div className="card-image">
                    <img src={item.bannerUrl} alt={item.title} />
                    <div className="type-badge">🖼️ POSTER</div>
                 </div>
               )}
                              <div className="card-body">
                  <div className="card-top">
                    <span className="card-tag">{getT(item, 'tags')[0]}</span>
                    <span className="card-date">{getT(item, 'date')}</span>
                  </div>
                  
                  <h3 className="card-title">{getT(item, 'title')}</h3>
                  <p className={`card-text ${expandedId === item.id ? 'expanded' : ''}`}>
                    {getT(item, 'content')}
                  </p>
                  
                  <div className="card-footer">
                     <span className="card-authority">✍️ {getT(item, 'authority')}</span>
                     <div className="card-actions">
                        {canManage && (
                          <button className="admin-action-btn delete" onClick={() => handleDelete(item.id)}>🗑️</button>
                        )}
                        {item.hasAttachment && <button className="attach-btn" title={lang === 'gu' ? 'જોડાણ ડાઉનલોડ કરો' : 'Download Attachment'}>📄</button>}
                        <button 
                          className="read-more-btn"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                          {expandedId === item.id ? (lang === 'gu' ? 'બંધ કરો' : 'Close') : (lang === 'gu' ? 'વિગત જુઓ' : 'View Detail')}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📝 ADMIN EDITOR MODAL */}
      {showModal && (
        <div className="sandesh-modal-overlay">
          <div className="sandesh-modal">
            <div className="modal-header">
              <h3>{editingId ? (lang === 'gu' ? 'જાહેરાતમાં ફેરફાર કરો' : 'Edit Announcement') : (lang === 'gu' ? 'નવી જાહેરાત બનાવો' : 'Create New Announcement')}</h3>
              <button className="close-modal" onClick={() => { setShowModal(false); resetForm(); }}>&times;</button>
            </div>
            
            <form onSubmit={handlePost}>
              <div className="modal-magic-actions">
                <button 
                  type="button" 
                  className="magic-pill-btn" 
                  onClick={() => handleSuggestDraft('en')}
                  disabled={isTranslating}
                >
                  🪄 Suggest Gujarati (Draft ➡️)
                </button>
                <button 
                  type="button" 
                  className="magic-pill-btn" 
                  onClick={() => handleSuggestDraft('gu')}
                  disabled={isTranslating}
                >
                  🪄 Suggest English (Draft ⬅️)
                </button>
              </div>

              <div className="modal-content-wrapper">
                <div className="modal-grid">
                  {/* 🇬🇧 ENGLISH SECTION */}
                  <div className={`form-column ${isTranslating ? 'translating' : ''}`}>
                    <h4>English Content</h4>
                    <div className="form-group">
                      <label>Title (English)</label>
                      <input type="text" placeholder="e.g. Mega Health Camp" value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Subtitle (English)</label>
                      <input type="text" placeholder="e.g. Health Alert" value={formData.subtitleEn} onChange={e => setFormData({...formData, subtitleEn: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Message Body (English)</label>
                      <textarea rows="4" value={formData.contentEn} onChange={e => setFormData({...formData, contentEn: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Issuing Authority (English)</label>
                      <input type="text" placeholder="CWC Main Committee" value={formData.authorityEn} onChange={e => setFormData({...formData, authorityEn: e.target.value})} />
                    </div>
                  </div>

                  {/* 🇮🇳 GUJARATI SECTION */}
                  <div className={`form-column gujarati-column ${isTranslating ? 'translating' : ''}`}>
                    <h4>ગુજરાતી સામગ્રી (Gujarati)</h4>
                    <div className="form-group">
                      <label>શીર્ષક (Gujarati)</label>
                      <input type="text" placeholder="દા.ત. મેગા હેલ્થ કેમ્પ" value={formData.titleGu} onChange={e => setFormData({...formData, titleGu: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>પેટાશીર્ષક (Gujarati)</label>
                      <input type="text" placeholder="દા.ત. આરોગ્ય ચેતવણી" value={formData.subtitleGu} onChange={e => setFormData({...formData, subtitleGu: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>સંદેશ વિગત (Gujarati)</label>
                      <textarea rows="4" value={formData.contentGu} onChange={e => setFormData({...formData, contentGu: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>સત્તાવાર સહી (Gujarati)</label>
                      <input type="text" placeholder="મુખ્ય સમિતિ CWC" value={formData.authorityGu} onChange={e => setFormData({...formData, authorityGu: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-settings">
                <div className="form-group">
                  <label>Announcement Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="poster">🖼️ Poster Announcement</option>
                    <option value="letter">📜 Official Letter</option>
                    <option value="text">📝 General Text Message</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="normal">Normal Card</option>
                    <option value="high">🌟 High Priority (Featured Hero)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Poster Image (Optional)</label>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const compressed = await compressImage(reader.result);
                        setFormData({...formData, bannerUrl: compressed});
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="publish-btn" disabled={isSaving}>
                  {isSaving ? 'Publishing...' : '🚀 Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
