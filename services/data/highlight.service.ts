import { Highlight, HighlightAnchor } from '@/types';
import { safeLocalStorage } from '@/utils/storage-utils';
import { getDeviceId } from '@/utils/device-utils';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  writeBatch,
  Unsubscribe 
} from 'firebase/firestore';
import { db, isFirebaseAvailable } from '@/lib/firebase';

const HIGHLIGHTS_LOCAL_KEY = 'userHighlights';

class HighlightService {
  private userId: string;
  private deviceId: string;

  constructor(userId: string) {
    if (!userId) {
      throw new Error('HighlightService requires a user ID.');
    }
    this.userId = userId;
    this.deviceId = getDeviceId();
  }

  async save(highlight: Omit<Highlight, 'versions' | 'updatedAt'> & { versions?: Record<string, number> }): Promise<Highlight> {
    const now = new Date().toISOString();
    const currentVersion = (highlight.versions?.[this.deviceId] ?? 0) + 1;

    const newHighlight: Highlight = {
      ...highlight,
      updatedAt: now,
      versions: {
        ...highlight.versions,
        [this.deviceId]: currentVersion,
      },
    };

    // Save to local storage first
    this.saveToLocal(newHighlight);

    // Save to Firestore if available
    if (isFirebaseAvailable() && db) {
      try {
        const highlightRef = doc(db!, 'users', this.userId, 'highlights', newHighlight.id);
        await setDoc(highlightRef, newHighlight);
        console.log('Highlight saved to Firestore:', newHighlight.id);
      } catch (error) {
        console.error('Failed to save highlight to Firestore:', error);
        // Continue with local storage only
      }
    }

    return newHighlight;
  }

  async delete(highlightId: string): Promise<void> {
    // Delete from local storage first
    this.deleteFromLocal(highlightId);

    // Delete from Firestore if available
    if (isFirebaseAvailable() && db) {
      try {
        const highlightRef = doc(db!, 'users', this.userId, 'highlights', highlightId);
        await deleteDoc(highlightRef);
        console.log('Highlight deleted from Firestore:', highlightId);
      } catch (error) {
        console.error('Failed to delete highlight from Firestore:', error);
        // Continue with local storage only
      }
    }
  }

  private saveToLocal(highlight: Highlight): void {
    const allHighlights = this.getAllFromLocal();
    allHighlights[highlight.id] = highlight;
    safeLocalStorage.setItem(`${HIGHLIGHTS_LOCAL_KEY}_${this.userId}`, allHighlights);
  }

  private deleteFromLocal(highlightId: string): void {
    const allHighlights = this.getAllFromLocal();
    delete allHighlights[highlightId];
    safeLocalStorage.setItem(`${HIGHLIGHTS_LOCAL_KEY}_${this.userId}`, allHighlights);
  }

  private getAllFromLocal(): Record<string, Highlight> {
    return safeLocalStorage.getItem<Record<string, Highlight>>(`${HIGHLIGHTS_LOCAL_KEY}_${this.userId}`) || {};
  }


  async getForMaterial(materialId: string): Promise<Highlight[]> {
    // Try to fetch from Firestore first
    if (isFirebaseAvailable() && db) {
      try {
        const highlightsRef = collection(db!, 'users', this.userId, 'highlights');
        const q = query(highlightsRef, where('materialId', '==', materialId));
        const querySnapshot = await getDocs(q);
        
        const firestoreHighlights: Highlight[] = [];
        querySnapshot.forEach((doc) => {
          firestoreHighlights.push(doc.data() as Highlight);
        });

        // Merge with local highlights (local takes precedence for conflicts)
        const localHighlights = this.getAllFromLocal();
        const mergedHighlights: Record<string, Highlight> = {};

        // Add Firestore highlights first
        firestoreHighlights.forEach(highlight => {
          mergedHighlights[highlight.id] = highlight;
        });

        // Override with local highlights (they might be more recent)
        Object.values(localHighlights)
          .filter(h => h.materialId === materialId)
          .forEach(highlight => {
            const existing = mergedHighlights[highlight.id];
            if (!existing || this.isNewerVersion(highlight, existing)) {
              mergedHighlights[highlight.id] = highlight;
            }
          });

        return Object.values(mergedHighlights);
      } catch (error) {
        console.error('Failed to fetch highlights from Firestore:', error);
        // Fall back to local storage
      }
    }

    // Fall back to local storage
    const allHighlights = this.getAllFromLocal();
    const materialHighlights = Object.values(allHighlights).filter(
      (h) => h.materialId === materialId
    );
    return materialHighlights;
  }

  subscribeToMaterial(materialId: string, callback: (highlights: Highlight[]) => void): () => void {
    // Initial fetch
    this.getForMaterial(materialId).then(highlights => {
      callback(highlights);
    });

    // Set up real-time sync if Firestore is available
    if (isFirebaseAvailable() && db) {
      try {
        const highlightsRef = collection(db!, 'users', this.userId, 'highlights');
        const q = query(highlightsRef, where('materialId', '==', materialId));
        
        const unsubscribe = onSnapshot(q, 
          (querySnapshot) => {
            const firestoreHighlights: Highlight[] = [];
            querySnapshot.forEach((doc) => {
              firestoreHighlights.push(doc.data() as Highlight);
            });

            // Merge with local highlights
            const localHighlights = this.getAllFromLocal();
            const mergedHighlights: Record<string, Highlight> = {};

            // Add Firestore highlights first
            firestoreHighlights.forEach(highlight => {
              mergedHighlights[highlight.id] = highlight;
            });

            // Override with local highlights (they might be more recent)
            Object.values(localHighlights)
              .filter(h => h.materialId === materialId)
              .forEach(highlight => {
                const existing = mergedHighlights[highlight.id];
                if (!existing || this.isNewerVersion(highlight, existing)) {
                  mergedHighlights[highlight.id] = highlight;
                }
              });

            callback(Object.values(mergedHighlights));
          },
          (error) => {
            console.error('Firestore subscription error:', error);
            // Fall back to local storage only
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Failed to set up Firestore subscription:', error);
      }
    }

    // Fall back to no-op if Firestore is not available
    console.warn('Real-time subscription is limited without Firestore.');
    return () => {};
  }

  /**
   * Updates the anchor information for a highlight when it's been found at a new location.
   * This is part of the self-healing capability.
   * @param highlightId The ID of the highlight to update.
   * @param newAnchor The new anchor information.
   */
  async updateAnchor(highlightId: string, newAnchor: HighlightAnchor): Promise<Highlight> {
    const allHighlights = this.getAllFromLocal();
    const highlight = allHighlights[highlightId];
    
    if (!highlight) {
      throw new Error(`Highlight with ID ${highlightId} not found`);
    }
    
    // Update the highlight with the new anchor
    const updatedHighlight: Highlight = {
      ...highlight,
      anchor: newAnchor,
      updatedAt: new Date().toISOString(),
      versions: {
        ...highlight.versions,
        [this.deviceId]: (highlight.versions[this.deviceId] || 0) + 1
      }
    };
    
    // Save the updated highlight
    return this.save(updatedHighlight);
  }
/**
   * Adds or updates a note on a highlight.
   * @param highlightId The ID of the highlight.
   * @param noteContent The text content of the note.
   */
  async saveNote(highlightId: string, noteContent: string): Promise<Highlight> {
    // Get the highlight from local storage
    const allHighlights = this.getAllFromLocal();
    const highlight = allHighlights[highlightId];
    
    if (!highlight) {
      throw new Error(`Highlight with ID ${highlightId} not found`);
    }
    
    // Update the highlight with the note
    const updatedHighlight: Highlight = {
      ...highlight,
      note: {
        content: noteContent,
        updatedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    
    // Save the updated highlight
    return this.save(updatedHighlight);
  }

  /**
   * Deletes a note from a highlight.
   * @param highlightId The ID of the highlight.
   */
  async deleteNote(highlightId: string): Promise<Highlight> {
    // Get the highlight from local storage
    const allHighlights = this.getAllFromLocal();
    const highlight = allHighlights[highlightId];
    
    if (!highlight) {
      throw new Error(`Highlight with ID ${highlightId} not found`);
    }
    
    // Remove the note property
    const { note, ...highlightWithoutNote } = highlight;
    const updatedHighlight: Highlight = {
      ...highlightWithoutNote,
      updatedAt: new Date().toISOString()
    };
    
    // Save the updated highlight
    return this.save(updatedHighlight);
  }

  /**
   * Determines if highlight1 is newer than highlight2 based on version numbers.
   * @param highlight1 The first highlight to compare.
   * @param highlight2 The second highlight to compare.
   * @returns true if highlight1 is newer, false otherwise.
   */
  private isNewerVersion(highlight1: Highlight, highlight2: Highlight): boolean {
    // Compare device-specific versions
    const version1 = highlight1.versions[this.deviceId] || 0;
    const version2 = highlight2.versions[this.deviceId] || 0;
    
    if (version1 !== version2) {
      return version1 > version2;
    }
    
    // If versions are equal, compare update timestamps
    return highlight1.updatedAt > highlight2.updatedAt;
  }

  /**
   * Syncs all local highlights to Firestore.
   * This is useful for initial sync or recovery scenarios.
   */
  async syncAllToFirestore(): Promise<void> {
    if (!isFirebaseAvailable() || !db) {
      console.warn('Firebase is not available. Cannot sync to Firestore.');
      return;
    }

    const localHighlights = this.getAllFromLocal();
    const batch = writeBatch(db!);
    
    Object.values(localHighlights).forEach(highlight => {
      const highlightRef = doc(db!, 'users', this.userId, 'highlights', highlight.id);
      batch.set(highlightRef, highlight, { merge: true });
    });

    try {
      await batch.commit();
      console.log('All highlights synced to Firestore');
    } catch (error) {
      console.error('Failed to sync highlights to Firestore:', error);
      throw error;
    }
  }
}

export default HighlightService;
