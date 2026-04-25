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
import BorderEditor from './BorderEditor';
import ColorPicker from './ColorPicker';
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
  const { isSamajAdmin, isSuperAdmin, currentUser } = useAuth();
  const canManage = isSamajAdmin || isSuperAdmin;



  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [maximizedId, setMaximizedId] = useState(null); // Full-screen Reader State
  
  // Admin Editing State
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // 📦 Archive & Bulk Mode State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    type: 'poster',
    priority: 'normal',
    titleEn: '', titleGu: '',
    subtitleEn: '', subtitleGu: '',
    contentEn: '', contentGu: '',
    authorityEn: '', authorityGu: '',
    bannerUrl: '',
    videoUrl: '',
    tagsEn: ['General'],
    tagsGu: ['સામાન્ય'],
    hasAttachment: false,
    isHighlight1: false,
    isHighlight2: false,
    // 🎨 Styling Canvas Fields
    bgColor: '',
    textColor: '',
    accentColor: '',
    // 🖊 Border Editor Fields
    borderColor: '',
    borderStyle: 'solid',
    borderWidth: '1',
    borderRadius: '12',
    borderRadiusTL: '',
    borderRadiusTR: '',
    borderRadiusBL: '',
    borderRadiusBR: '',
    shadowEnabled: false,
    shadowX: '0',
    shadowY: '4',
    shadowBlur: '12',
    shadowSpread: '0',
    shadowColor: 'rgba(0,0,0,0.1)',
    gradientBorder: false,
    gradientColor1: '#7c3aed',
    gradientColor2: '#3b82f6',
    gradientAngle: '135'
  });

  // 1. REAL-TIME DATA FETCH
  useEffect(() => {
    const q = query(collection(db, 'samaj_jog_sandesh'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(data.length > 0 ? data : DUMMY_MESSAGES.map(dm => ({ ...dm, isSample: true })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const applyStyle = (field, command, value) => {
    const el = document.getElementById(`editor-${field}`);
    if (!el) return;
    
    // Proactively focus the editor to ensure selection is active
    el.focus();
    
    // Robust value handling for colors
    let finalValue = value;
    if (command === 'foreColor' && !value) finalValue = '#1e3a8a'; // Default Blue
    if (command === 'backColor' && !value) finalValue = '#fbbf24'; // Default Yellow
    
    document.execCommand(command, false, finalValue);
    
    // Sync the HTML back to state
    setFormData(prev => ({ ...prev, [field]: el.innerHTML }));
  };

  // 2. MODAL BODY LOCK & BANNER SUPPRESSION
  useEffect(() => {
    if (showModal || maximizedId) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showModal, maximizedId]);

  const handlePost = async (e) => {
    e.preventDefault();
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
    const post = messages.find(m => m.id === id);
    if (!post) return;

    const createdMs = post.createdAt?.toDate
      ? post.createdAt.toDate().getTime()
      : post.createdAt?.seconds * 1000 || 0;
    const isOlderThan24h = createdMs > 0 && (Date.now() - createdMs) > 24 * 60 * 60 * 1000;

    if (isOlderThan24h && !isSuperAdmin) {
      // Samaj Admin: post is old — escalate to Super Admin
      if (!window.confirm('This post is older than 24 hours.\n\nA DELETE REQUEST will be sent to Super Admin for review.\n\nProceed?')) return;
      try {
        await addDoc(collection(db, 'samaj_delete_requests'), {
          postId: id,
          postData: post,
          requestedBy: currentUser?.uid || 'unknown',
          requestedAt: serverTimestamp(),
          status: 'pending'
        });
        alert('📬 Delete request sent to Super Admin for review.');
      } catch (err) {
        alert('Error sending request: ' + err.message);
      }
    } else {
      // Super Admin (any age) OR any admin (< 24h): direct delete
      if (!window.confirm('Permanently delete this announcement?')) return;
      try {
        await deleteDoc(doc(db, 'samaj_jog_sandesh', id));
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    }
  };

  // 📦 Archive a post (hides from public, reversible)
  const handleArchive = async (id) => {
    try {
      await updateDoc(doc(db, 'samaj_jog_sandesh', id), { isArchived: true });
    } catch (err) { alert('Error archiving: ' + err.message); }
  };

  // ♻️ Restore an archived post back to live
  const handleRestore = async (id) => {
    try {
      await updateDoc(doc(db, 'samaj_jog_sandesh', id), { isArchived: false });
    } catch (err) { alert('Error restoring: ' + err.message); }
  };

  // 📋 Clone/Duplicate a post
  const handleClone = async (item) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    try {
      await addDoc(collection(db, 'samaj_jog_sandesh'), {
        ...rest,
        titleEn: `📋 Copy: ${rest.titleEn || ''}`,
        titleGu: `📋 નકલ: ${rest.titleGu || ''}`,
        isHighlight: false,
        isHighlight1: false,
        isHighlight2: false,
        isQuickLink: false,
        isArchived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('✅ Post cloned successfully!');
    } catch (err) { alert('Error cloning: ' + err.message); }
  };

  // ☑ Bulk selection toggle
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 📦 Bulk archive selected
  const handleBulkArchive = async () => {
    if (!window.confirm(`Archive ${selectedIds.size} selected posts?`)) return;
    try {
      for (const id of selectedIds) {
        await updateDoc(doc(db, 'samaj_jog_sandesh', id), { isArchived: true });
      }
    } catch (err) { alert('Error: ' + err.message); }
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  // 🗑️ Bulk delete selected
  const handleBulkDelete = async () => {
    if (!window.confirm(`Permanently delete ${selectedIds.size} selected posts? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'samaj_jog_sandesh', id));
      }
    } catch (err) { alert('Error: ' + err.message); }
    setSelectedIds(new Set());
    setBulkMode(false);
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
      videoUrl: item.videoUrl || '',
      tagsEn: item.tagsEn || ['General'],
      tagsGu: item.tagsGu || ['સામાન્ય'],
      hasAttachment: item.hasAttachment || false,
      isHighlight1: item.isHighlight1 || false,
      isHighlight2: item.isHighlight2 || false,
      bgColor: item.bgColor || '',
      textColor: item.textColor || '',
      accentColor: item.accentColor || '',
      borderColor: item.borderColor || '',
      borderStyle: item.borderStyle || 'solid',
      borderWidth: item.borderWidth || '1',
      borderRadius: item.borderRadius || '12',
      borderRadiusTL: item.borderRadiusTL || '',
      borderRadiusTR: item.borderRadiusTR || '',
      borderRadiusBL: item.borderRadiusBL || '',
      borderRadiusBR: item.borderRadiusBR || '',
      shadowEnabled: item.shadowEnabled || false,
      shadowX: item.shadowX || '0',
      shadowY: item.shadowY || '4',
      shadowBlur: item.shadowBlur || '12',
      shadowSpread: item.shadowSpread || '0',
      shadowColor: item.shadowColor || 'rgba(0,0,0,0.1)',
      gradientBorder: item.gradientBorder || false,
      gradientColor1: item.gradientColor1 || '#7c3aed',
      gradientColor2: item.gradientColor2 || '#3b82f6',
      gradientAngle: item.gradientAngle || '135'
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
      videoUrl: '',
      tagsEn: ['General'], tagsGu: ['સામાન્ય'],
      hasAttachment: false,
      isHighlight1: false,
      isHighlight2: false,
      bgColor: '',
      textColor: '',
      accentColor: '',
      borderColor: '',
      borderStyle: 'solid',
      borderWidth: '1',
      borderRadius: '12',
      borderRadiusTL: '',
      borderRadiusTR: '',
      borderRadiusBL: '',
      borderRadiusBR: '',
      shadowEnabled: false,
      shadowX: '0',
      shadowY: '4',
      shadowBlur: '12',
      shadowSpread: '0',
      shadowColor: 'rgba(0,0,0,0.1)',
      gradientBorder: false,
      gradientColor1: '#7c3aed',
      gradientColor2: '#3b82f6',
      gradientAngle: '135'
    });
  };

  /* ── buildCardStyle: compute inline styles from any item's border fields ── */
  const buildCardStyle = (item) => {
    if (!item) return {};
    const s = { color: item.textColor || undefined };

    // Border radius (per-corner overrides, else global)
    const r  = item.borderRadius || '12';
    const tl = item.borderRadiusTL !== '' && item.borderRadiusTL != null ? `${item.borderRadiusTL}px` : `${r}px`;
    const tr = item.borderRadiusTR !== '' && item.borderRadiusTR != null ? `${item.borderRadiusTR}px` : `${r}px`;
    const br = item.borderRadiusBR !== '' && item.borderRadiusBR != null ? `${item.borderRadiusBR}px` : `${r}px`;
    const bl = item.borderRadiusBL !== '' && item.borderRadiusBL != null ? `${item.borderRadiusBL}px` : `${r}px`;
    s.borderRadius = `${tl} ${tr} ${br} ${bl}`;

    // ── Border logic ────────────────────────────────────────────────
    if (item.gradientBorder && Number(item.borderWidth) > 0) {
      // 1. Gradient border (uses padding-box / border-box trick)
      const bg  = item.bgColor || 'white';
      const ang = item.gradientAngle  || '135';
      const c1  = item.gradientColor1 || '#7c3aed';
      const c2  = item.gradientColor2 || '#3b82f6';
      s.background = `linear-gradient(${bg}, ${bg}) padding-box, linear-gradient(${ang}deg, ${c1}, ${c2}) border-box`;
      s.border = `${item.borderWidth}px solid transparent`;
      if (item.bgColor) {} // bg already handled above
    } else if (item.borderStyle === 'none') {
      // 2. User explicitly chose "None" style → remove border
      s.border = 'none';
      if (item.bgColor) s.backgroundColor = item.bgColor;
    } else if (item.borderColor && item.borderStyle && Number(item.borderWidth || 1) > 0) {
      // 3. User configured a custom solid/dashed/dotted/etc border
      s.borderColor = item.borderColor;
      s.borderWidth = `${item.borderWidth || 1}px`;
      s.borderStyle = item.borderStyle || 'solid';
      if (item.bgColor) s.backgroundColor = item.bgColor;
    } else {
      // 4. No custom border configured — let CSS class default apply
      if (item.bgColor) s.backgroundColor = item.bgColor;
    }

    // Shadow / Glow
    if (item.shadowEnabled) {
      s.boxShadow = `${item.shadowX || 0}px ${item.shadowY || 4}px ${item.shadowBlur || 12}px ${item.shadowSpread || 0}px ${item.shadowColor || 'rgba(0,0,0,0.1)'}`;
    }

    return s;
  };

  // 2. DATA PROCESSING
  // NOTE: messages already contains DUMMY_MESSAGES as fallback when DB is empty
  // (set in the Firebase onSnapshot listener above). No need to append them again.
  const allAvailable = messages || [];
  
  const activeMessages = allAvailable.filter(m => !m?.isArchived);

  // Archived posts (real posts only, no samples)
  const archivedMessages = messages.filter(m => m?.isArchived);
  
  // 🔥 HERO FIREWALL: Only consider posts that are NOT pinned to any Side Slot (Top or Bottom)
  const heroCandidates = activeMessages.filter(m => 
    !m.isHighlight && !m.isHighlight1 && !m.isHighlight2 && !m.isQuickLink
  );

  // Find featured post: Real High Priority > Sample Posts > Latest Normal Post
  const featured = heroCandidates.find(m => m.priority === 'high' && !m.isSample) || 
                   heroCandidates.find(m => m.isSample) || 
                   heroCandidates[0] ||
                   activeMessages.find(m => m.isSample) ||
                   activeMessages[0];


  // 1. Find the latest Highlight for Slot 1 (Top)
  const highlight1Post = activeMessages.find(m => m.isHighlight1 || m.isHighlight) || null;

  // 2. Find the latest Highlight for Slot 2 (Bottom) - STRICTLY EXCLUDES whatever is in Slot 1
  const highlight2Post = activeMessages.find(m => 
    (m.isHighlight2 || m.isQuickLink) && m.id !== highlight1Post?.id
  ) || null;
  
  // 3. Feed: Everything else (Strictly excludes Top Slot, Bottom Slot, and Hero Banner)
  const feed = activeMessages.filter(m => 
    m.id !== highlight1Post?.id && 
    m.id !== highlight2Post?.id && 
    m.id !== featured?.id
  ).slice(0, 15);

  // 4. Current display list (live or archived view)
  const displayFeed = showArchived ? archivedMessages : feed;

  const getT = (item, field) => {
    const preferredKey = field + (lang === 'gu' ? 'Gu' : 'En');
    const fallbackKey = field + (lang === 'gu' ? 'En' : 'Gu');
    return <span dangerouslySetInnerHTML={{ __html: item[preferredKey] || item[fallbackKey] || '' }} />;
  };

  if (loading) {
    return (
      <div className="sandesh-loader">
        <div className="spinner"></div>
        <p>{lang === 'gu' ? 'જાહેરાતો લોડ થઈ રહી છે...' : 'Loading Announcements...'}</p>
      </div>
    );
  }

  return (
    <div className="samaj-jog-sandesh-root">
      <div className="sandesh-layout-wrapper">
        <div className="hero-bento-grid">
          {/* 1. TOP LEFT: HIGHLIGHT 1 (Top Slot) */}
          <aside 
            className="bento-item side top-left"
            onClick={() => highlight1Post && setMaximizedId(highlight1Post.id)}
            style={buildCardStyle(highlight1Post || {})}
          >
            <div className="side-bucket-content">
              {canManage && (
                <div className="admin-bucket-controls">
                  <button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight1Post ? handleEdit(highlight1Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>
                </div>
              )}
              {highlight1Post ? (
                <>
                  <div className="highlight-badge-pill" style={{backgroundColor: highlight1Post.accentColor}}>{lang === 'gu' ? 'નવી હાઇલાઇટ' : 'LATEST HIGHLIGHT'}</div>
                  <h3 className="card-html-title">{getT(highlight1Post, 'title')}</h3>
                  <div className="card-html-desc">{getT(highlight1Post, 'subtitle')}</div>
                  <div className="highlight-visit-cta">{lang === 'gu' ? 'વધુ વાંચો →' : 'Read More →'}</div>
                </>
              ) : (
                <>
                  <div className="stat-icon pink">⭐</div>
                  <div className="stat-value">25+</div>
                  <div className="stat-label">{lang === 'gu' ? 'વિભાગો' : 'Vibhags'}</div>
                  <button className="add-highlight-btn" onClick={() => setShowModal(true)}>➕</button>
                </>
              )}
            </div>
          </aside>

          {/* 2. BOTTOM LEFT: HIGHLIGHT 2 (Bottom Slot) */}
          <aside 
            className="bento-item side bottom-left"
            onClick={() => highlight2Post && setMaximizedId(highlight2Post.id)}
            style={buildCardStyle(highlight2Post || {})}
          >
            <div className="side-bucket-content">
              {canManage && (
                <div className="admin-bucket-controls">
                  <button 
                    className="admin-edit-pill" 
                    onClick={(e) => {
                      e.stopPropagation();
                      highlight2Post ? handleEdit(highlight2Post) : setShowModal(true);
                    }}
                  >
                    ✏️
                  </button>
                </div>
              )}
              {highlight2Post ? (
                <>
                  <div className="highlight-badge-pill blue" style={{backgroundColor: highlight2Post.accentColor}}>{lang === 'gu' ? 'મુખ્ય સમાચાર' : 'TOP UPDATE'}</div>
                  <h3 className="card-html-title">{getT(highlight2Post, 'title')}</h3>
                  <div className="card-html-desc">{getT(highlight2Post, 'subtitle')}</div>
                  <div className="highlight-visit-cta">{lang === 'gu' ? 'વધુ વાંચો →' : 'Read More →'}</div>
                </>
              ) : (
                <>
                  <div className="stat-icon blue">📖</div>
                  <div className="stat-value">1500+</div>
                  <div className="stat-label">{lang === 'gu' ? 'મેસેજ' : 'Announcements'}</div>
                  <button className="add-highlight-btn" onClick={() => setShowModal(true)}>➕</button>
                </>
              )}
            </div>
          </aside>

          {/* 3. CENTER: MAIN FEATURED */}
          {featured && (
            <main 
              className="bento-item middle center-feature" 
              id={`card-${featured.id}`}
              style={buildCardStyle(featured)}
            >
              <div className="hero-inner">
                <div className="hero-text">
                  <div className="hero-badge">
                    {featured.isSample && <span className="sample-pill">SAMPLE</span>}
                    {lang === 'gu' ? '📢 લેટેસ્ટ જાહેરાત' : '📢 LATEST ANNOUNCEMENT'}
                  </div>
                  
                  {canManage && (
                    <div className="admin-hero-controls">
                      <button className="admin-edit-hero" onClick={() => handleEdit(featured)}>✏️</button>
                      {!featured.isSample && <button className="admin-delete-hero" onClick={() => handleDelete(featured.id)}>🗑️</button>}
                    </div>
                  )}

                  <span className="hero-authority">{getT(featured, 'authority')}</span>
                  <h1>{getT(featured, 'title')}</h1>
                  <p className="hero-p-desc">{getT(featured, 'content')}</p>
                  
                  <div className="hero-footer-row">
                    <span className="hero-date">📅 {getT(featured, 'date')}</span>
                    <button className="hero-btn-cta">{lang === 'gu' ? 'સંપૂર્ણ વાંચો →' : 'Read Full →'}</button>
                  </div>
                </div>

                <div className="hero-visual">
                  {featured.bannerUrl ? <img src={featured.bannerUrl} alt="Hero" /> : <div className="hero-visual-fallback">🖼️</div>}
                  <div className="visual-overlay"></div>
                </div>
              </div>
            </main>
          )}

          {/* 4. RIGHT PANEL: LIVE NEWS TICKER (Unified) */}
          <aside className="bento-item ticker-panel right">
            <div className="ticker-header">
               <span>🔥 {lang === 'gu' ? 'લાઇવ સમાચાર' : 'LIVE TICKER'}</span>
            </div>
            <div className="ticker-container">
              <div className="ticker-scroll">
                {[...activeMessages].slice(0, 15).map((item, idx) => (
                  <div 
                    key={`ticker-${item.id}-${idx}`} 
                    className="ticker-item"
                    onClick={() => {
                      setExpandedId(item.id);
                      const el = document.getElementById(`card-${item.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <span className="ticker-bullet">•</span>
                    <span className="ticker-text">{getT(item, 'title')}</span>
                    <span className="ticker-time">{getT(item, 'date')}</span>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {[...activeMessages].slice(0, 5).map((item, idx) => (
                  <div key={`dup-${item.id}-${idx}`} className="ticker-item">
                    <span className="ticker-bullet">•</span>
                    <span className="ticker-text">{getT(item, 'title')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ticker-footer">
               {lang === 'gu' ? 'તમામ પોસ્ટ જોવા માટે નીચે જાઓ' : 'Scroll down for all posts'}
            </div>
          </aside>
        </div>
      </div>

      {/* 📋 MAIN LAYOUT: SIDEBAR + FEED */}
      <div className="samaj-main-layout">
        <aside className="samaj-sidebar">
          <div className="sidebar-section">
            <h4>{lang === 'gu' ? 'શ્રેણીઓ' : 'Categories'}</h4>
            <div className="sidebar-filters">
              <button className="filter-pill active">
                <span className="icon">🏛️</span> {lang === 'gu' ? 'બધા' : 'All Updates'}
              </button>
              <button className="filter-pill">
                <span className="icon">📸</span> {lang === 'gu' ? 'પોસ્ટર્સ' : 'Posters'}
              </button>
              <button className="filter-pill">
                <span className="icon">📜</span> {lang === 'gu' ? 'પત્રો' : 'Letters'}
              </button>
              <button className="filter-pill">
                <span className="icon">🎥</span> {lang === 'gu' ? 'વીડિયો' : 'Videos'}
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>{lang === 'gu' ? 'વિભાગ ફિલ્ટર' : 'Vibhag Filters'}</h4>
            <div className="sidebar-vibhags">
              <span>{lang === 'gu' ? 'બધા વિભાગ' : 'All Districts'}</span>
              <span>Central</span>
              <span>Western</span>
              <span>Harbour</span>
            </div>
          </div>

          <div className="sidebar-promo">
            <div className="promo-card">
              <h5>{lang === 'gu' ? 'મદદ જોઈએ છે?' : 'Need Help?'}</h5>
              <p>{lang === 'gu' ? 'તકનીકી સહાય માટે સંપર્ક કરો' : 'Contact for tech support'}</p>
              <button onClick={() => window.open('https://wa.me/917208579149', '_blank')}>Contact Admin</button>
            </div>
          </div>
        </aside>

        <div className={`samaj-feed ${lang === 'gu' ? 'lang-gu' : ''}`}>
          <div className="feed-header">
            <h2>
              {showArchived ? (lang === 'gu' ? '📦 આર્કાઇવ' : '📦 Archived Posts') : (lang === 'gu' ? 'તાજેતરના અપડેટ્સ' : 'Recent Updates')}
              {showArchived && <span className="archive-count-badge">{archivedMessages.length}</span>}
            </h2>
            
            <div className="header-actions">
              {canManage && (
                <>
                  <button
                    className={`archive-view-btn ${showArchived ? 'active' : ''}`}
                    onClick={() => { setShowArchived(!showArchived); setBulkMode(false); setSelectedIds(new Set()); }}
                  >
                    {showArchived ? '📢 Live Posts' : '📦 Archived'}
                    {!showArchived && archivedMessages.length > 0 && <span className="archive-notif">{archivedMessages.length}</span>}
                  </button>
                  <button
                    className={`bulk-mode-btn ${bulkMode ? 'active' : ''}`}
                    onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                  >
                    {bulkMode ? '✕ Cancel' : '☑ Bulk Select'}
                  </button>
                  {!showArchived && (
                    <button className="admin-add-btn" onClick={() => setShowModal(true)}>
                      ➕ {lang === 'gu' ? 'નવો સંદેશ મૂકો' : 'Post New Announcement'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={`feed-grid ${bulkMode ? 'bulk-mode-active' : ''}`}>
            {displayFeed.length === 0 && (
              <div className="empty-archive-state">
                {showArchived ? '📦 No archived posts yet.' : '📭 No posts available.'}
              </div>
            )}
            {displayFeed.map(item => (
              <div
                key={item.id}
                id={`card-${item.id}`}
                className={`sandesh-card ${item.type} ${item.isSample ? 'sample-card' : ''} ${selectedIds.has(item.id) ? 'card-selected' : ''} ${item.isArchived ? 'card-archived' : ''}`}
                style={buildCardStyle(item)}
                onClick={bulkMode && !item.isSample ? () => toggleSelect(item.id) : undefined}
              >
                {/* Bulk Checkbox */}
                {bulkMode && !item.isSample && (
                  <div className="bulk-checkbox-wrap">
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Archive badge for archived view */}
                {item.isArchived && canManage && (
                  <div className="archived-badge">📦 Archived</div>
                )}

                {/* Media Section */}
                <div className="card-media">
                  {item.priority === 'high' && <div className="priority-pill">{lang === 'gu' ? 'મહત્વપૂર્ણ' : 'OFFER'}</div>}
                  <div className="type-pill">{item.type.toUpperCase()}</div>
                  
                  {item.type === 'video' ? (
                    <div className="video-container">
                      {item.videoUrl?.includes('youtube.com') || item.videoUrl?.includes('youtu.be') ? (
                        <iframe 
                          src={`https://www.youtube.com/embed/${item.videoUrl.split('v=')[1] || item.videoUrl.split('/').pop()}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <video src={item.videoUrl} controls poster={item.bannerUrl} />
                      )}
                    </div>
                  ) : item.bannerUrl ? (
                    <div className="card-image">
                        <img src={item.bannerUrl} alt={item[`title${lang === 'gu' ? 'Gu' : 'En'}`] || item[`title${lang === 'gu' ? 'En' : 'Gu'}`] || ''} />
                    </div>
                  ) : (
                    <div className="card-text-icon">
                       <span className="media-placeholder-icon">{item.type === 'letter' ? '📜' : '📝'}</span>
                    </div>
                  )}

                  {!bulkMode && <button className="card-quick-action" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>+</button>}
                </div>

                <div className="card-body">
                  <div className="deal-label">{item.priority === 'high' ? (lang === 'gu' ? 'મર્યાદિત સમયની જાહેરાત' : 'Limited time deal') : ''}</div>
                  
                  <h3 className="card-title" title={item[`title${lang === 'gu' ? 'Gu' : 'En'}`] || item[`title${lang === 'gu' ? 'En' : 'Gu'}`] || ''}>{getT(item, 'title')}</h3>

                  <div className="card-date">
                     {getT(item, 'date')} • {getT(item, 'authority')}
                  </div>

                  <p className={`card-text ${expandedId === item.id ? 'expanded' : ''}`}>
                    {getT(item, 'content')}
                  </p>

                  <div className="card-footer-actions">
                    {!bulkMode && (
                      <button className="full-reader-btn" onClick={() => setMaximizedId(item.id)}>
                        🔍 {lang === 'gu' ? 'વાંચો' : 'Read'}
                      </button>
                    )}
                    {!bulkMode && (
                      <span className="read-more-link" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                        {expandedId === item.id ? (lang === 'gu' ? 'ઓછામાં જુઓ' : 'Close Details') : (lang === 'gu' ? 'સંપૂર્ણ સંદેશ વાંચો' : 'Read Details')}
                      </span>
                    )}

                    {canManage && !bulkMode && (
                      <div className="admin-actions-inline">
                        {!item.isArchived && <button onClick={() => handleEdit(item)} title="Edit">✏️</button>}
                        {!item.isSample && <button onClick={() => handleClone(item)} title="Clone post" className="clone-action-btn">📋</button>}
                        {!item.isSample && !item.isArchived && (
                          <button onClick={() => handleArchive(item.id)} title="Archive" className="archive-action-btn">📦</button>
                        )}
                        {!item.isSample && item.isArchived && (
                          <button onClick={() => handleRestore(item.id)} title="Restore" className="restore-action-btn">♻️</button>
                        )}
                        {!item.isSample && (
                          <button onClick={() => handleDelete(item.id)} title="Delete" className="delete-action-btn">🗑️</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 🧲 FLOATING BULK ACTION BAR */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="bulk-action-bar">
              <span className="bulk-count">{selectedIds.size} {lang === 'gu' ? 'પોસ્ટ પસંદ' : 'posts selected'}</span>
              <button className="bulk-select-all-btn" onClick={() => {
                const allIds = displayFeed.filter(i => !i.isSample).map(i => i.id);
                setSelectedIds(new Set(allIds));
              }}>✅ Select All</button>
              {!showArchived && <button className="bulk-archive-btn" onClick={handleBulkArchive}>📦 {lang === 'gu' ? 'આર્કાઇવ' : 'Archive All'}</button>}
              <button className="bulk-delete-btn" onClick={handleBulkDelete}>🗑️ {lang === 'gu' ? 'ડિલીટ' : 'Delete All'}</button>
              <button className="bulk-cancel-btn" onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}>✕ Cancel</button>
            </div>
          )}
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
                <button type="button" className="magic-pill-btn" onClick={() => handleSuggestDraft('en')} disabled={isTranslating}>
                  🪄 Suggest Gujarati (Draft ➡️)
                </button>
                <button type="button" className="magic-pill-btn" onClick={() => handleSuggestDraft('gu')} disabled={isTranslating}>
                  🪄 Suggest English (Draft ⬅️)
                </button>
              </div>

              <div className="modal-content-wrapper">
                <div className="modal-grid">
                  <div className={`form-column ${isTranslating ? 'translating' : ''}`}>
                    <h4>English Content</h4>
                    <div className="field-with-canvas">
                      <label>Title (English)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleEn', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleEn', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleEn', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-titleEn" className="canvas-painter" contentEditable onBlur={(e) => setFormData({...formData, titleEn: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.titleEn }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>Subtitle (English)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleEn', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleEn', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-subtitleEn" className="canvas-painter" contentEditable onBlur={(e) => setFormData({...formData, subtitleEn: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.subtitleEn }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>Message Body (English)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-contentEn" className="canvas-painter content-body" contentEditable onBlur={(e) => setFormData({...formData, contentEn: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.contentEn }} />
                    </div>
 
                    <div className="form-group">
                      <label>Issuing Authority (English)</label>
                      <input type="text" placeholder="e.g., CWC Main Committee" value={formData.authorityEn} onChange={e => setFormData({...formData, authorityEn: e.target.value})} />
                    </div>
                  </div>

                  <div className={`form-column gujarati-column ${isTranslating ? 'translating' : ''}`}>
                    <h4>ગુજરાતી સામગ્રી (Gujarati)</h4>
                    <div className="field-with-canvas">
                      <label>શીર્ષક (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-titleGu" className="canvas-painter gu-font" contentEditable onBlur={(e) => setFormData({...formData, titleGu: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.titleGu }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>પેટાશીર્ષક (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-subtitleGu" className="canvas-painter gu-font" contentEditable onBlur={(e) => setFormData({...formData, subtitleGu: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.subtitleGu }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>સંદેશ વિગત (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-contentGu" className="canvas-painter content-body gu-font" contentEditable onBlur={(e) => setFormData({...formData, contentGu: e.target.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.contentGu }} />
                    </div>
 
                    <div className="form-group">
                      <label>સત્તાવાર સહી (Gujarati)</label>
                      <input type="text" placeholder="દા.ત., મુખ્ય સમિતિ CWC" value={formData.authorityGu} onChange={e => setFormData({...formData, authorityGu: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

               <div className="modal-settings">
                 <div className="settings-left">
                   <div className="form-group">
                     <label>Announcement Type</label>
                     <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                       <option value="poster">🖼️ Poster Announcement</option>
                       <option value="video">🎥 Video Content (MP4/YouTube)</option>
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
                     <label>Media Source (URL or Upload)</label>
                     <input 
                       type="text" 
                       placeholder="YouTube URL or Image Link" 
                       value={formData.bannerUrl || formData.videoUrl} 
                       onChange={e => {
                         const val = e.target.value;
                         if (val.includes('youtube.com') || val.includes('youtu.be')) {
                           setFormData({...formData, videoUrl: val, type: 'video'});
                         } else {
                           setFormData({...formData, bannerUrl: val});
                         }
                       }} 
                     />
                     <input type="file" accept="image/*,video/mp4" style={{marginTop: '10px'}} onChange={async (e) => {
                       const file = e.target.files[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = async () => {
                           const result = reader.result;
                           if (file.type.startsWith('video/')) {
                             setFormData({...formData, videoUrl: result, type: 'video'});
                           } else {
                             const compressed = await compressImage(result);
                             setFormData({...formData, bannerUrl: compressed});
                           }
                         };
                         reader.readAsDataURL(file);
                       }
                     }} />
                   </div>
 
                   <div className="form-group highlight-toggle">
                     <div className="slot-indicator">
                       {(formData.isHighlight || formData.isHighlight1) && <span className="slot-pill highlight">📍 Pinned to TOP</span>}
                       {(formData.isHighlight2 || formData.isQuickLink) && <span className="slot-pill quick">📍 Pinned to BOTTOM</span>}
                     </div>
                     <label className="checkbox-label">
                       <input 
                         type="checkbox" 
                         checked={formData.isHighlight1 || formData.isHighlight} 
                         onChange={e => setFormData({
                           ...formData, 
                           isHighlight1: e.target.checked, 
                           isHighlight: e.target.checked,
                           isHighlight2: false,
                           isQuickLink: false
                         })} 
                       />
                       ⭐ Slot 1 (Top)
                     </label>
                     <label className="checkbox-label" style={{marginTop: '8px'}}>
                       <input 
                         type="checkbox" 
                         checked={formData.isHighlight2 || formData.isQuickLink} 
                         onChange={e => setFormData({
                           ...formData, 
                           isHighlight2: e.target.checked, 
                           isQuickLink: e.target.checked,
                           isHighlight1: false,
                           isHighlight: false
                         })} 
                       />
                       🔗 Slot 2 (Bottom)
                     </label>
                   </div>
                 </div>
 
                 {/* 🎨 COLOR + BORDER CANVAS TOOLKIT */}
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
      {/* 📖 FULL-SCREEN READER MODAL */}
      {maximizedId && (
        <div className="reader-overlay" onClick={() => setMaximizedId(null)}>
          <div className="reader-modal" onClick={e => e.stopPropagation()}>
            <button className="reader-close-btn" onClick={() => setMaximizedId(null)}>×</button>
            
            {(() => {
              const item = activeMessages.find(m => m.id === maximizedId);
              if (!item) return null;
              return (
                <div className="reader-content-wrap">
                  <div className="reader-header">
                    <span className="reader-category">{getT(item, 'subtitle')}</span>
                    <h2>{getT(item, 'title')}</h2>
                    <div className="reader-meta">
                      <span>👤 {getT(item, 'authority')}</span>
                      <span>📅 {getT(item, 'date')}</span>
                    </div>
                  </div>

                  <div className="reader-body">
                    {item.bannerUrl && (
                      <div className="reader-media">
                        <img src={item.bannerUrl} alt="Visual" />
                      </div>
                    )}
                    <div className="reader-text-box" dangerouslySetInnerHTML={{ __html: item[`content${lang === 'gu' ? 'Gu' : 'En'}`] || item[`content${lang === 'gu' ? 'En' : 'Gu'}`] || '' }} />

                  </div>

                  <div className="reader-footer">
                    <div className="reader-source-tag">
                       Source: Official {getT(item, 'authority')} Channel
                    </div>
                    <button className="reader-exit-cta" onClick={() => setMaximizedId(null)}>
                       {lang === 'gu' ? 'બંધ કરો' : 'Close Reader'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
