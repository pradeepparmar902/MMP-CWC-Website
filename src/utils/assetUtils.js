/**
 * Universal Utility for handling Assets (Images, PDFs) from multiple sources.
 */

/**
 * Transforms a variety of URL formats (especially Google Drive) into 
 * direct, viewable, or downloadable links for the web.
 */
export const getDirectUrl = (url) => {
  if (!url) return '';
  
  // 1. Handle Google Drive Sharing Links
  // Matches formats like:
  // - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // - https://drive.google.com/open?id=FILE_ID
  // - https://docs.google.com/file/d/FILE_ID/edit
  const gDriveRegex = /(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/;
  const match = url.match(gDriveRegex);
  
  if (match && match[1]) {
    const fileId = match[1];
    // This format works for both images (previews) and small PDFs (downloads)
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  // 2. Handle standard Firebase / External URLs
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
