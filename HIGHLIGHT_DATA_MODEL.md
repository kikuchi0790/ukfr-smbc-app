# Highlight Data Model Redesign (Task 3.1)

This document outlines the redesigned data model for highlights, addressing the critical fragility of the current offset-based system.

## 1. Core Problem with the Old Model

The existing model uses `startOffset` and `endOffset` (character counts from the beginning of the document) to locate highlights. This breaks entirely if the source text is modified, as all subsequent offsets become invalid.

## 2. Proposed New Data Model: "Contextual Anchoring"

We will move to a more resilient model that anchors highlights using a combination of structural information (CSS Selectors) and content-based context. This makes the location logic far more tolerant of minor text edits, layout changes, or re-renders.

### New `Highlight` Interface

```typescript
interface Highlight {
  // Core Fields
  id: string; // Unique ID for the highlight (e.g., UUID)
  userId: string; // ID of the user who created it
  materialId: string; // ID of the material (e.g., 'UKFR_ED32_Checkpoint.pdf')
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp

  // --- NEW ANCHORING FIELDS ---
  anchor: HighlightAnchor;

  // Data Fields
  text: string; // The actual highlighted text content (for display and search)
  color: 'yellow' | 'green' | 'red' | 'blue'; // Highlight color

  // Optional Note
  note?: {
    content: string;
    updatedAt: string;
  };
  
  // Optional link to a question
  relatedQuestionId?: string;
}

interface HighlightAnchor {
  // Structural Path (Primary Locator)
  startSelector: string; // CSS selector for the starting element
  endSelector: string;   // CSS selector for the ending element

  // Character Offsets within Elements
  startOffset: number; // Offset within the start element's text content
  endOffset: number;   // Offset within the end element's text content

  // Content-based Fallback (Secondary Locator)
  prefix: string; // A short snippet of text immediately preceding the highlight
  suffix: string; // A short snippet of text immediately following the highlight
}
```

### 3. How It Works

**Creating a Highlight:**

1.  When a user selects text, the browser provides a `Range` object.
2.  **Generate Selectors:** We create unique and stable CSS selectors for the `startContainer` and `endContainer` of the range.
    *   A good strategy is to use element IDs if available, or a path of tag names and `nth-child` indices (e.g., `div.prose > p:nth-child(3) > span:nth-child(1)`). Libraries like `unique-selector` can help generate these.
3.  **Get Offsets:** We record the `startOffset` and `endOffset` within those start/end elements.
4.  **Capture Context:** We extract a small, fixed number of characters (e.g., 20) of the text content immediately before (`prefix`) and after (`suffix`) the selected range.
5.  These pieces of information form the `HighlightAnchor` object, which is saved along with the rest of the highlight data.

**Applying a Highlight (Rendering):**

1.  **Primary Method (Selectors):**
    *   Use `document.querySelector(startSelector)` and `document.querySelector(endSelector)` to find the start and end elements.
    *   If found, use the `startOffset` and `endOffset` to reconstruct the `Range` and apply the visual highlight. This is fast and precise.

2.  **Fallback Method (Contextual Search):**
    *   If the selectors fail (e.g., the DOM structure changed), we initiate the fallback.
    *   Search the entire document's text content for the string `prefix + highlight.text + suffix`.
    *   This search is much more likely to find the correct location even if class names, element tags, or nesting levels have changed.
    *   Once found, a new `Range` is created for the `highlight.text` portion, and the highlight is applied.
    *   **Self-Healing:** Optionally, once the highlight is found via the fallback method, we can generate *new, valid* CSS selectors for its current location and update the `Highlight` object in the database. This makes the system resilient and self-correcting over time.

## 4. Note Data Model (Task 3.2)

The note functionality will be directly integrated into the `Highlight` object. This simplifies the data structure and ensures a tight coupling between a highlight and its corresponding note.

### `Highlight.note` field

The `note` field will be an optional object within the `Highlight` interface:

```typescript
// From the Highlight interface above...
  note?: {
    content: string; // The text content of the note (can be Markdown)
    updatedAt: string; // ISO 8601 timestamp, updated on each edit
  };
```

**Design Rationale:**

*   **Simplicity:** No need for a separate `Notes` table or collection in the database. This reduces complexity and avoids the need to manage relationships between two different data models.
*   **Data Locality:** When a highlight is fetched, its note comes with it automatically. This is efficient and aligns with the primary UI pattern where notes are displayed in the context of a selected highlight.
*   **Atomicity:** Updates to a highlight and its note can be performed in a single atomic operation, ensuring data consistency.

## 5. Material Metadata Model (Task 3.3)

To support features like a table of contents and efficient navigation, we need a standardized way to represent the structure of each study material.

### `MaterialMetadata` Interface

A JSON file corresponding to each material (e.g., `UKFR_ED32_Checkpoint.metadata.json`) will be created.

```typescript
interface MaterialMetadata {
  id: string; // e.g., "UKFR_ED32_Checkpoint.pdf"
  title: string; // e.g., "UKFR ED32 Checkpoint"
  version: string; // e.g., "1.0.0"
  tableOfContents: TocItem[];
}

interface TocItem {
  title: string;
  pageNumber?: number; // For PDF-based documents
  anchorSelector?: string; // For HTML-based documents (CSS selector to the section header)
  children?: TocItem[]; // For nested sections
}
```

**How It Will Be Used:**

*   **Table of Contents:** The `tableOfContents` array will be used to dynamically generate a navigable TOC in the UI.
*   **Page Jumps:** Clicking a `TocItem` will trigger a jump to the specified `pageNumber` (for PDFs) or scroll to the element matching the `anchorSelector` (for HTML).
*   **Future-Proof:** This structure is flexible enough to accommodate different types of materials and can be extended with more metadata fields as needed (e.g., author, publication date).

## 6. Advantages of this Model

*   **Resilience:** Tolerant to changes in class names, styling, and non-content-related DOM structure.
*   **Robustness:** The contextual fallback provides a strong safety net if the primary selector method fails.
*   **Performance:** The primary selector-based method is very fast. The fallback is slower but used only when necessary.
*   **Self-Healing:** The model can be updated automatically when the fallback is used, improving future performance.
*   **Extensibility:** This model is robust enough to support the planned note-taking and other future features.
