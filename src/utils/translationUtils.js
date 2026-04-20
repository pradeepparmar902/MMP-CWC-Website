/**
 * 🪄 AI Translation Utility
 * Uses a standard free-tier endpoint to provide draft suggestions for the committee.
 * These are drafts only and must be reviewed by a human before publishing.
 */

export const fetchTranslation = async (text, targetLang = 'gu') => {
  if (!text || text.trim().length === 0) return '';
  
  try {
    const sourceLang = targetLang === 'gu' ? 'en' : 'gu';
    
    // Using simple Google Translate single-shot endpoint for 'suggestions'
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation fetch failed');
    
    const data = await response.json();
    
    // The data format is [[["translatedText", "originalText", ...]]]
    if (data && data[0]) {
      return data[0].map(item => item[0]).join('');
    }
    
    return '';
  } catch (error) {
    console.error("Translation Magic failed:", error);
    return ''; // Return empty so the user doesn't get weird error text in their boxes
  }
};
