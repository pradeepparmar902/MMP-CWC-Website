/**
 * Universal Utility for handling Assets (Images, PDFs) from multiple sources.
 * 
 * Google Drive URL formats supported:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID (already a direct link)
 */

/**
 * Extracts the Google Drive File ID from any sharing URL format.
 */
export const extractGDriveId = (url) => {
  if (!url) return null;

  // Format: /file/d/FILE_ID/
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // Format: ?id=FILE_ID or &id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  return null;
};

/**
 * Transforms any URL (especially Google Drive) into a direct, embeddable URL.
 * Uses the thumbnail API for images — the most reliable method for Google Drive.
 */
export const getDirectUrl = (url) => {
  if (!url) return '';

  // Check if it's a Google Drive URL
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileId = extractGDriveId(url);
    if (fileId) {
      // Use lh3.googleusercontent.com CDN — works WITHOUT Google login (Android safe)
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // For everything else (Firebase Storage, base64, direct URLs), return as-is
  return url;
};

/**
 * Returns a direct download/open link for PDFs from Google Drive.
 * Different from getDirectUrl which is optimized for image display.
 */
export const getOpenUrl = (url) => {
  if (!url) return '';

  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileId = extractGDriveId(url);
    if (fileId) {
      // This opens the file in Google Drive viewer — works for PDFs too
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
  }

  return url;
};

/**
 * Identifies the source type for internal labeling/iconography
 */
export const getSourceType = (url) => {
  if (!url) return 'none';
  if (url.includes('firebasestorage.googleapis.com')) return 'firebase';
  if (url.includes('google.com')) return 'gdrive';
  if (url.startsWith('data:image')) return 'local';
  return 'external';
};
