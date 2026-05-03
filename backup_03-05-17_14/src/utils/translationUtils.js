/**
 * 🪄 AI Translation Utility
 * Uses a standard free-tier endpoint to provide draft suggestions for the committee.
 * These are drafts only and must be reviewed by a human before publishing.
 */

export const fetchTranslation = async (text, targetLang = 'gu') => {
  if (!text || text.trim().length === 0) return '';
  
  try {
    const sourceLang = targetLang === 'gu' ? 'en' : 'gu';
    
    // 🛡️ PRESERVE HTML TAGS: Extract tags and replace with placeholders
    const placeholders = [];
    const htmlRegex = /<[^>]+>/g;
    let index = 0;
    
    const maskedText = text.replace(htmlRegex, (match) => {
      const placeholder = `__TAG_${index}__`;
      placeholders.push({ placeholder, original: match });
      index++;
      return ` ${placeholder} `; // Add spaces to prevent API from merging with text
    });

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(maskedText)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation fetch failed');
    
    const data = await response.json();
    
    if (data && data[0]) {
      let translated = data[0].map(item => item[0]).join('');
      
      // 🛠️ RESTORE HTML TAGS: Replace placeholders back with original tags
      placeholders.forEach(({ placeholder, original }) => {
        // Use a global regex to replace all instances (in case the API duplicated any)
        const pRegex = new RegExp(`\\s*${placeholder}\\s*`, 'g');
        translated = translated.replace(pRegex, original);
      });
      
      return translated;
    }
    
    return '';
  } catch (error) {
    console.error("Translation Magic failed:", error);
    return '';
  }
};
