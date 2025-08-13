'use client';

import { useEffect } from 'react';
import { pdfjs } from 'react-pdf';

// Set the worker source URL for PDF.js
// Using jsDelivr CDN which is more reliable than unpkg
pdfjs.GlobalWorkerOptions.workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfWorkerInit() {
  useEffect(() => {
    // Verify worker is set on mount
    console.log('PDF.js worker initialized with version:', pdfjs.version);
  }, []);
  
  return null;
}