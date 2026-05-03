import React, { useState, useEffect, useRef, useMemo } from 'react';
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

export default function SectionPage({
  lang = 'en',
  collectionName = 'samaj_jog_sandesh',
  bilingual = true,
  adminRoles = ['isSamajAdmin', 'isSuperAdmin']
}) {
  const auth = useAuth();
  const { currentUser, isSuperAdmin } = auth;
  const canManage = adminRoles.some(role => auth[role]);



  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true); // 🌐 Connection Monitor
  const [expandedId, setExpandedId] = useState(null);
  const [maximizedId, setMaximizedId] = useState(null); // Full-screen Reader State
  
  // Admin Editing State
  const [showModal, setShowModal] = useState(false);
  const [styleOnlyMode, setStyleOnlyMode] = useState(false);
  const [formattingContext, setFormattingContext] = useState('feed');
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroIntervalRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  // Toggle body class to hide main app header when reader is open
  useEffect(() => {
    if (maximizedId) {
      document.body.classList.add('reader-active');
    } else {
      document.body.classList.remove('reader-active');
    }
    return () => document.body.classList.remove('reader-active');
  }, [maximizedId]);

  
  // 📏 Swipe Sensitivity
  const MIN_SWIPE_DISTANCE = 50;
  
  // Hero Drag & Drop State
  const [draggedHeroBlock, setDraggedHeroBlock] = useState(null);
  const [dragOverBlock, setDragOverBlock] = useState(null);
  const [localHeroOrder, setLocalHeroOrder] = useState(null);
  const draggedBlockRef = useRef(null);
  
  const GRANULAR_HERO_BLOCKS = ['visual', 'badge', 'authority', 'title', 'body', 'footer'];
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
    isHero: false,
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
    gradientAngle: '135',
    // 🍱 Hero Multi-Column Layout Fields
    heroLayout: '1-col', // '1-col', '2-col', '3-col'
    heroColRatio: 'wide-center', 
    col2TitleEn: '', col2TitleGu: '',
    col2ContentEn: '', col2ContentGu: '',
    col2BannerUrl: '',
    col3TitleEn: '', col3TitleGu: '',
    col3ContentEn: '', col3ContentGu: '',
    col3BannerUrl: '',
    // 🖼️ Hero Image Manipulation
    heroImgZoom: 1.0,
    heroImgShiftY: 0,
    heroImgShiftX: 0,
    heroImgFit: 'cover'
  });

  // 1. REAL-TIME DATA FETCH
  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(data.length > 0 ? data : []);
      setLoading(false);
      setIsOnline(true);
    }, (error) => {
      console.error("Firebase error:", error);
      setIsOnline(false);
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
      // 📏 Size Check: Firestore limit is 1MB
      const payloadString = JSON.stringify(formData);
      const sizeInBytes = new Blob([payloadString]).size;
      
      if (sizeInBytes > 1000000) {
        alert(lang === 'gu' 
          ? 'ભૂલ: આ પોસ્ટ ખૂબ મોટી છે (1MB થી વધુ). કૃપા કરીને નાની છબી વાપરો અથવા વિડિઓ માટે YouTube લિંકનો ઉપયોગ કરો.' 
          : 'Error: This post is too large (over 1MB). Please use a smaller image or a YouTube link for videos.');
        setIsSaving(false);
        return;
      }

      // Extract style-related fields if we are in Hero context
      let styleFields = {};
      if (formattingContext === 'hero') {
        styleFields = {
          bgColor: formData.bgColor,
          textColor: formData.textColor,
          accentColor: formData.accentColor,
          borderColor: formData.borderColor,
          borderStyle: formData.borderStyle,
          borderWidth: formData.borderWidth,
          borderRadius: formData.borderRadius,
          borderRadiusTL: formData.borderRadiusTL,
          borderRadiusTR: formData.borderRadiusTR,
          borderRadiusBL: formData.borderRadiusBL,
          borderRadiusBR: formData.borderRadiusBR,
          shadowEnabled: formData.shadowEnabled,
          shadowX: formData.shadowX,
          shadowY: formData.shadowY,
          shadowBlur: formData.shadowBlur,
          shadowSpread: formData.shadowSpread,
          shadowColor: formData.shadowColor,
          gradientBorder: formData.gradientBorder,
          gradientColor1: formData.gradientColor1,
          gradientColor2: formData.gradientColor2,
          gradientAngle: formData.gradientAngle,
          gradientBg: formData.gradientBg,
          gradientBgColor1: formData.gradientBgColor1,
          gradientBgColor2: formData.gradientBgColor2,
          gradientBgAngle: formData.gradientBgAngle
        };
      }

      const basePayload = {
        ...formData,
        dateEn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        dateGu: new Date().toLocaleDateString('gu-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        updatedAt: serverTimestamp()
      };

      const payload = formattingContext === 'hero' 
        ? { heroStyle: styleFields } 
        : basePayload;

      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), payload);
      } else {
        await addDoc(collection(db, collectionName), {
          ...basePayload,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false);
      resetForm();
      alert(lang === 'gu' ? '✅ સંદેશ સફળતાપૂર્વક પ્રકાશિત થયો!' : '✅ Message published successfully!');
    } catch (err) {
      console.error("Save error:", err);
      alert('Error saving message: ' + (err.code || err.message));
    } finally {
      setIsSaving(false);
    }
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
        await addDoc(collection(db, `${collectionName}_delete_requests`), {
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
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    }
  };

  // 📦 Archive a post (hides from public, reversible)
  // --- ATOMIC SLOT MANAGEMENT ---


  const handleArchive = async (id) => {
    try {
      await updateDoc(doc(db, collectionName, id), { isArchived: true });
    } catch (err) { alert('Error archiving: ' + err.message); }
  };

  // ♻️ Restore an archived post back to live
  const handleRestore = async (id) => {
    try {
      await updateDoc(doc(db, collectionName, id), { isArchived: false });
    } catch (err) { alert('Error restoring: ' + err.message); }
  };

  // 📋 Clone/Duplicate a post
  const handleClone = async (item) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    try {
      await addDoc(collection(db, collectionName), {
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
        await updateDoc(doc(db, collectionName, id), { isArchived: true });
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

  const handleStyle = (item, context = 'feed') => {
    handleEdit(item);
    setStyleOnlyMode(true);
    setFormattingContext(context);
    
    // If editing hero context, load ONLY from item.heroStyle to prevent inheriting feed card styles
    const source = context === 'hero' ? (item.heroStyle || {}) : item;

    setFormData(prev => ({
      ...prev,
      bgColor: source.bgColor || '',
      textColor: source.textColor || '',
      accentColor: source.accentColor || '',
      borderColor: source.borderColor || '',
      borderStyle: source.borderStyle || 'solid',
      borderWidth: source.borderWidth || '1',
      borderRadius: source.borderRadius || '12',
      borderRadiusTL: source.borderRadiusTL || '',
      borderRadiusTR: source.borderRadiusTR || '',
      borderRadiusBL: source.borderRadiusBL || '',
      borderRadiusBR: source.borderRadiusBR || '',
      shadowEnabled: source.shadowEnabled || false,
      shadowX: source.shadowX || '0',
      shadowY: source.shadowY || '4',
      shadowBlur: source.shadowBlur || '12',
      shadowSpread: source.shadowSpread || '0',
      shadowColor: source.shadowColor || 'rgba(0,0,0,0.1)',
      gradientBorder: source.gradientBorder || false,
      gradientColor1: source.gradientColor1 || '#7c3aed',
      gradientColor2: source.gradientColor2 || '#3b82f6',
      gradientAngle: source.gradientAngle || '135',
      gradientBg: source.gradientBg || false,
      gradientBgColor1: source.gradientBgColor1 || '',
      gradientBgColor2: source.gradientBgColor2 || '',
      gradientBgAngle: source.gradientBgAngle || '135'
    }));
  };

  const handleToggleHero = async (item) => {
    try {
      const docRef = doc(db, collectionName, item.id);
      await updateDoc(docRef, { isHero: !item.isHero });
    } catch (error) {
      console.error("Error toggling hero status:", error);
    }
  };

  const handleEdit = (item) => {
    setStyleOnlyMode(false);
    setFormattingContext('feed'); // Reset context
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
      gradientAngle: item.gradientAngle || '135',
      isHero: item.isHero || false,
      gradientBg: item.gradientBg || false,
      gradientBgColor1: item.gradientBgColor1 || '',
      gradientBgColor2: item.gradientBgColor2 || '',
      gradientBgAngle: item.gradientBgAngle || '135'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setStyleOnlyMode(false);
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
  const buildCardStyle = (item, context = 'feed') => {
    if (!item) return {};
    // If context is hero, ONLY use heroStyle. If it doesn't exist, return empty object (uses CSS defaults).
    if (context === 'hero' && !item.heroStyle) return {};
    const source = context === 'hero' ? item.heroStyle : item;

    const s = { color: source.textColor || undefined };

    // Border radius (per-corner overrides, else global)
    const r  = source.borderRadius || '12';
    const tl = source.borderRadiusTL !== '' && source.borderRadiusTL != null ? `${source.borderRadiusTL}px` : `${r}px`;
    const tr = source.borderRadiusTR !== '' && source.borderRadiusTR != null ? `${source.borderRadiusTR}px` : `${r}px`;
    const br = source.borderRadiusBR !== '' && source.borderRadiusBR != null ? `${source.borderRadiusBR}px` : `${r}px`;
    const bl = source.borderRadiusBL !== '' && source.borderRadiusBL != null ? `${source.borderRadiusBL}px` : `${r}px`;
    s.borderRadius = `${tl} ${tr} ${br} ${bl}`;

    // ── Background & Border logic ────────────────────────────────────────────────
    const hasGradientColors = source.gradientBg && (source.gradientBgColor1 || source.gradientBgColor2);
    let baseBg = null;
    if (hasGradientColors) {
      baseBg = `linear-gradient(${source.gradientBgAngle || '135'}deg, ${source.gradientBgColor1 || '#7c3aed'}, ${source.gradientBgColor2 || '#4f46e5'})`;
    } else if (source.bgColor) {
      baseBg = source.bgColor;
    }

    if (source.gradientBorder && Number(source.borderWidth) > 0) {
      // 1. Gradient border (uses padding-box / border-box trick)
      const ang = source.gradientAngle  || '135';
      const c1  = source.gradientColor1 || '#7c3aed';
      const c2  = source.gradientColor2 || '#3b82f6';
      const paddingBoxBg = baseBg ? baseBg : 'white';
      const paddingBoxBgWrapped = hasGradientColors ? paddingBoxBg : `linear-gradient(${paddingBoxBg}, ${paddingBoxBg})`;
      s.background = `${paddingBoxBgWrapped} padding-box, linear-gradient(${ang}deg, ${c1}, ${c2}) border-box`;
      s.border = `${source.borderWidth}px solid transparent`;
    } else {
      if (source.borderStyle === 'none') {
        s.border = 'none';
      } else if (source.borderColor && source.borderStyle && Number(source.borderWidth || 1) > 0) {
        s.borderColor = source.borderColor;
        s.borderWidth = `${source.borderWidth || 1}px`;
        s.borderStyle = source.borderStyle || 'solid';
      }
      // Only override CSS background if a custom bg is actually set
      if (baseBg) {
        s.background = baseBg;
      }
    }

    // Shadow / Glow
    if (source.shadowEnabled) {
      s.boxShadow = `${source.shadowX || 0}px ${source.shadowY || 4}px ${source.shadowBlur || 12}px ${source.shadowSpread || 0}px ${source.shadowColor || 'rgba(0,0,0,0.1)'}`;
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
  
  // Feed: All posts (including those previously marked as highlights, since side slots are removed)
  const feed = activeMessages;

  // 4. Current display list (live or archived view)
  const displayFeed = showArchived ? archivedMessages : feed;

  // 🎢 Hero Slider Logic - Only items explicitly marked by admin
  const heroMessages = useMemo(() => {
    if (!activeMessages) return [];
    // Filter for items with isHero: true, or fallback to High Priority items if none marked
    const markedHero = activeMessages.filter(m => m?.isHero);
    const source = markedHero.length > 0 ? markedHero : activeMessages.filter(m => m?.priority === 'high');
    
    return source.filter(m => m && (m.titleEn || m.titleGu)).slice(0, 5); // Allow up to 5 items
  }, [activeMessages]);

  useEffect(() => {
    // 🔒 SAFETY LOCK: Pause timer if admin is typing or reader is open
    if (heroMessages.length <= 1 || showModal || maximizedId) {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
      return;
    }
    
    heroIntervalRef.current = setInterval(() => {
      setCurrentHeroIndex(prev => (prev + 1) % heroMessages.length);
    }, 5000);
    return () => clearInterval(heroIntervalRef.current);
  }, [heroMessages, showModal, maximizedId]);

  const onTouchStart = (e) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
    const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

    if (isLeftSwipe) {
      setCurrentHeroIndex(prev => (prev + 1) % heroMessages.length);
    } else if (isRightSwipe) {
      setCurrentHeroIndex(prev => (prev - 1 + heroMessages.length) % heroMessages.length);
    }
  };

  const getT = (item, field) => {
    if (!item) return null;
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
    <div className="samaj-container">
      {/* 🎢 PREMIUM HERO SLIDER */}
      {!showArchived && heroMessages.length > 0 && (
        <div 
          className="hero-slider-container"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="hero-slider-indicators">
            {heroMessages.map((_, idx) => (
              <div 
                key={idx} 
                className={`indicator-bar ${idx === currentHeroIndex ? 'active' : (idx < currentHeroIndex ? 'passed' : '')}`}
                onClick={() => setCurrentHeroIndex(idx)}
              >
                <div className="indicator-progress" style={{ animationDuration: '5s' }}></div>
              </div>
            ))}
          </div>

          <div className="hero-slider-track" style={{ transform: `translateX(-${currentHeroIndex * 100}%)` }}>
            {heroMessages.map((item, idx) => (
              <div 
                key={item.id} 
                className={`hero-slide ${idx === currentHeroIndex ? 'active' : ''}`}
                onClick={() => setMaximizedId(item.id)}
              >
                <div className="hero-slide-bg" style={{ backgroundImage: `url(${item.bannerUrl || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop'})` }}></div>
                <div className="hero-slide-overlay" onClick={(e) => { e.stopPropagation(); setMaximizedId(item.id); }}>
                  <div className="hero-slide-content">
                    <span className="hero-slide-tag">{getT(item, 'subtitle')}</span>
                    <h2 className="hero-slide-title">{getT(item, 'title')}</h2>
                    <button 
                      className="hero-slide-cta"
                      onClick={(e) => { e.stopPropagation(); setMaximizedId(item.id); }}
                    >
                      {lang === 'gu' ? 'વધુ વાંચો' : 'Read More'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📋 MAIN LAYOUT: SIDEBAR + FEED (Filter row removed as requested) */}
      <div className="samaj-main-layout">

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

          {/* 🚀 AUTO-SCROLLING MARQUEE */}
          {displayFeed.length > 0 && !showArchived && (
            <div className="marquee-wrapper">
              <div className="marquee-track">
                {displayFeed.map(item => (
                  <div 
                    key={`mq-${item.id}`} 
                    className="marquee-item"
                    onClick={() => setMaximizedId(item.id)}
                  >
                    <span className="mq-icon">{item.type === 'video' ? '🎥' : item.type === 'letter' ? '📜' : '🖼️'}</span>
                    <span className="mq-title">{item[`title${lang === 'gu' ? 'Gu' : 'En'}`] || item[`title${lang === 'gu' ? 'En' : 'Gu'}`] || 'Update'}</span>
                  </div>
                ))}
                {/* Duplicate for seamless infinite scrolling */}
                {displayFeed.map(item => (
                  <div 
                    key={`mq-dup-${item.id}`} 
                    className="marquee-item"
                    onClick={() => setMaximizedId(item.id)}
                  >
                    <span className="mq-icon">{item.type === 'video' ? '🎥' : item.type === 'letter' ? '📜' : '🖼️'}</span>
                    <span className="mq-title">{item[`title${lang === 'gu' ? 'Gu' : 'En'}`] || item[`title${lang === 'gu' ? 'En' : 'Gu'}`] || 'Update'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`feed-grid ${bulkMode ? 'bulk-mode-active' : ''}`}>
            {displayFeed.length === 0 && (
              <div className="empty-archive-state">
                {showArchived ? '📦 No archived posts yet.' : '📭 No posts available.'}
              </div>
            )}
            {displayFeed.filter(m => m && m.id).map(item => (
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
                          {!item.isArchived && (
                            <button onClick={() => handleEdit(item)} className="admin-btn edit-btn">
                              ✏️ <span className="admin-btn-label">{lang === 'gu' ? 'સુધારો' : 'Edit'}</span>
                            </button>
                          )}
                          {!item.isSample && (
                            <button onClick={() => handleClone(item)} className="admin-btn clone-btn">
                              📋 <span className="admin-btn-label">{lang === 'gu' ? 'નકલ' : 'Clone'}</span>
                            </button>
                          )}
                          {!item.isSample && !item.isArchived && (
                            <button 
                              onClick={() => handleToggleHero(item)} 
                              className={`admin-btn hero-btn ${item.isHero ? 'active' : ''}`}
                            >
                              {item.isHero ? '⭐' : '☆'} <span className="admin-btn-label">{lang === 'gu' ? 'બેનર' : 'Hero'}</span>
                            </button>
                          )}
                          {!item.isSample && !item.isArchived && (
                            <button onClick={() => handleArchive(item.id)} className="admin-btn archive-btn">
                              📦 <span className="admin-btn-label">{lang === 'gu' ? 'આર્કાઇવ' : 'Archive'}</span>
                            </button>
                          )}
                          {!item.isSample && item.isArchived && (
                            <button onClick={() => handleRestore(item.id)} className="admin-btn restore-btn">
                              ♻️ <span className="admin-btn-label">{lang === 'gu' ? 'રીસ્ટોર' : 'Restore'}</span>
                            </button>
                          )}
                          {!item.isSample && (
                            <button onClick={() => handleDelete(item.id)} className="admin-btn delete-btn">
                              🗑️ <span className="admin-btn-label">{lang === 'gu' ? 'કાઢી નાખો' : 'Del'}</span>
                            </button>
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
              {bilingual && (
              <div className="modal-magic-actions">
                <button type="button" className="magic-pill-btn" onClick={() => handleSuggestDraft('en')} disabled={isTranslating}>
                  🪄 Suggest Gujarati (Draft ➡️)
                </button>
                <button type="button" className="magic-pill-btn" onClick={() => handleSuggestDraft('gu')} disabled={isTranslating}>
                  🪄 Suggest English (Draft ⬅️)
                </button>
              </div>
              )}

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
                      <div id="editor-titleEn" className="canvas-painter" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, titleEn: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.titleEn }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>Subtitle (English)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleEn', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleEn', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-subtitleEn" className="canvas-painter" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, subtitleEn: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.subtitleEn }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>Message Body (English)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentEn', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-contentEn" className="canvas-painter content-body" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, contentEn: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.contentEn }} />
                    </div>
 
                    <div className="form-group">
                      <label>Issuing Authority (English)</label>
                      <input type="text" placeholder="e.g., CWC Main Committee" value={formData.authorityEn} onChange={e => setFormData({...formData, authorityEn: e.target.value})} />
                    </div>
                  </div>

                  {bilingual && (
                  <div className={`form-column gujarati-column ${isTranslating ? 'translating' : ''}`}>
                    <h4>ગુજરાતી સામગ્રી (Gujarati)</h4>
                    <div className="field-with-canvas">
                      <label>શીર્ષક (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('titleGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-titleGu" className="canvas-painter gu-font" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, titleGu: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.titleGu }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>પેટાશીર્ષક (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('subtitleGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-subtitleGu" className="canvas-painter gu-font" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, subtitleGu: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.subtitleGu }} />
                    </div>
 
                    <div className="field-with-canvas">
                      <label>સંદેશ વિગત (Gujarati)</label>
                      <div className="canvas-toolbar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'bold')}><b>B</b> Bold</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'foreColor', formData.textColor)} className="tool-pen">🎨 Pen</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle('contentGu', 'backColor', formData.accentColor)} className="tool-brush">🖌️ Highlight</button>
                      </div>
                      <div id="editor-contentGu" className="canvas-painter content-body gu-font" contentEditable suppressContentEditableWarning onBlur={(e) => setFormData({...formData, contentGu: e.currentTarget.innerHTML})} dangerouslySetInnerHTML={{ __html: formData.contentGu }} />
                    </div>
 
                    <div className="form-group">
                      <label>સત્તાવાર સહી (Gujarati)</label>
                      <input type="text" placeholder="દા.ત., મુખ્ય સમિતિ CWC" value={formData.authorityGu} onChange={e => setFormData({...formData, authorityGu: e.target.value})} />
                    </div>
                  </div>
                  )}
                </div>
              </div>

               <div className="modal-settings">
                  {!styleOnlyMode && (
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
 
                 )}
                  {/* 🎨 COLOR + BORDER CANVAS TOOLKIT */}
                  <div className="canvas-toolkit" style={styleOnlyMode ? {width: "100%", margin: 0} : {}}>
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
                <div className="reader-content-wrap" onScroll={e => {
                  const scroll = e.target.scrollTop;
                  const height = e.target.scrollHeight - e.target.clientHeight;
                  const progress = (scroll / height) * 100;
                  const bar = document.getElementById('reading-progress');
                  if (bar) bar.style.width = `${progress}%`;
                }}>
                  {/* Reading Progress Bar */}
                  <div id="reading-progress" className="reading-progress-bar"></div>

                  {/* 🖼️ HERO BANNER (Full Width) */}
                  {item.bannerUrl ? (
                    <div className="reader-top-banner">
                       <img src={item.bannerUrl} alt="Banner" className="banner-img" />
                    </div>
                  ) : (
                    <div className={`reader-top-banner themed ${item.type}`}>
                       <div className="banner-placeholder-icon">
                         {item.type === 'video' ? '🎥' : item.type === 'letter' ? '📜' : '📢'}
                       </div>
                    </div>
                  )}

                  <div className="reader-article-area">
                    {/* 🏷️ META CHIPS */}
                    <div className="article-meta-row">
                      <span className="article-chip-premium">{getT(item, 'subtitle')}</span>
                      <div className="meta-info-item">
                        <span className="meta-icon">👤</span>
                        <span className="meta-text">{getT(item, 'authority')}</span>
                      </div>
                      <div className="meta-info-item">
                        <span className="meta-icon">📅</span>
                        <span className="meta-text">{getT(item, 'date')}</span>
                      </div>
                    </div>

                    {/* 📰 MAIN TITLE */}
                    <h1 className="article-main-title">{getT(item, 'title')}</h1>

                    {/* 🖋️ ARTICLE BODY */}
                    <div className="article-rich-content" dangerouslySetInnerHTML={{ __html: item[`content${lang === 'gu' ? 'Gu' : 'En'}`] || item[`content${lang === 'gu' ? 'En' : 'Gu'}`] || '' }} />
                  </div>

                  <div className="reader-footer">
                    <span className="footer-source">
                       {lang === 'gu' ? 'સત્તાવાર સ્ત્રોત:' : 'Official Source:'} {getT(item, 'authority')}
                    </span>
                    <button className="footer-exit-btn" onClick={() => setMaximizedId(null)}>
                       {lang === 'gu' ? 'વાંચન પૂર્ણ' : 'Done Reading'}
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
