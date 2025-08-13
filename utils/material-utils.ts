/**
 * Utility functions for material handling in the RAG system
 */

/**
 * Normalize materialId to consistent format
 * Handles various legacy formats and returns standard format
 */
export function normalizeMaterialId(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  
  // Remove any file extensions
  const cleanId = id.replace(/\.(html|pdf|txt)$/i, '');
  
  // Handle various formats for Study Companion
  if (cleanId.includes('StudyCompanion') || 
      cleanId.includes('Study_Companion') || 
      cleanId.includes('study_companion')) {
    return 'UKFR_ED32_Study_Companion';
  }
  
  // Handle various formats for Checkpoint
  if (cleanId.includes('Checkpoint') || 
      cleanId.includes('checkpoint')) {
    // Avoid matching backup files
    if (!cleanId.includes('backup')) {
      return 'UKFR_ED32_Checkpoint';
    }
  }
  
  // If already in correct format, return as-is
  if (id === 'UKFR_ED32_Study_Companion' || id === 'UKFR_ED32_Checkpoint') {
    return id;
  }
  
  // Log unrecognized format for debugging
  console.warn('[material-utils] Unrecognized materialId format:', id);
  return undefined;
}

/**
 * Validate page number for a given material
 */
export function validatePageNumber(materialId: string | undefined, pageNumber: number | undefined): boolean {
  if (!materialId || !pageNumber || pageNumber < 1) {
    return false;
  }
  
  const normalized = normalizeMaterialId(materialId);
  
  if (normalized === 'UKFR_ED32_Study_Companion') {
    // Study Companion has 117 pages (includes appendix)
    return pageNumber >= 1 && pageNumber <= 117;
  }
  
  if (normalized === 'UKFR_ED32_Checkpoint') {
    // Checkpoint has 44 pages
    return pageNumber >= 1 && pageNumber <= 44;
  }
  
  return false;
}

/**
 * Get PDF filename from materialId
 */
export function getPdfFilename(materialId: string | undefined): string | undefined {
  const normalized = normalizeMaterialId(materialId);
  
  if (normalized === 'UKFR_ED32_Study_Companion') {
    return 'UKFR_ED32_Study_Companion.pdf';
  }
  
  if (normalized === 'UKFR_ED32_Checkpoint') {
    return 'UKFR_ED32_Checkpoint.pdf';
  }
  
  return undefined;
}

/**
 * Infer materialId from page number (when materialId is missing)
 */
export function inferMaterialIdFromPage(pageNumber: number | undefined): string | undefined {
  if (!pageNumber || pageNumber < 1) {
    return undefined;
  }
  
  // Pages 1-44 could be either material
  // Pages 45-112 must be Study Companion
  if (pageNumber > 44) {
    return 'UKFR_ED32_Study_Companion';
  }
  
  // For pages 1-44, we can't be certain without more context
  // Default to Checkpoint as it's the shorter document
  return 'UKFR_ED32_Checkpoint';
}