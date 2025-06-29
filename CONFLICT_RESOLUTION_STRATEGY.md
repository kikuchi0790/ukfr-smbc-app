# Data Sync & Conflict Resolution Strategy (Task 6.3)

This document outlines the strategy for synchronizing user data (progress, highlights, etc.) between multiple devices and handling conflicts that may arise from offline work.

## 1. The Problem with the Current Sync Logic

The existing synchronization in `firebase-sync.ts` uses a naive merge strategy (e.g., `Math.max(local.value, remote.value)`). This can lead to data loss. For example:

*   **Scenario:** A user completes 10 questions on Device A (total: 50) and 5 different questions on Device B (total: 45) while offline.
*   **Outcome:** If Device A syncs first, the total becomes 50. When Device B syncs, its local total of 45 is lower, so the remote value of 50 is kept. The 5 questions answered on Device B are effectively lost from the statistics.

## 2. Proposed Strategy: Hybrid Logical Clock & State-based CRDT

We will adopt a strategy inspired by **Conflict-free Replicated Data Types (CRDTs)**, specifically using a hybrid approach that combines version vectors (as a logical clock) and state-based merging.

### Core Concepts

1.  **Version Vector (`versions`):**
    *   A map of `[deviceId: versionNumber]` will be added to the main `userProgress` object and to each individual `highlight` object.
    *   Each device has a unique ID (generated and stored in `LocalStorage`).
    *   Whenever a device modifies a piece of data, it increments its *own* version number in the vector.

2.  **State-based Merging:**
    *   When syncing, the client sends its local data (with its version vector) to the server.
    *   The server (or a serverless function) compares the version vector of the incoming data with the one stored in Firestore.
    *   **Conflict Detection:** A conflict exists if the stored data has version numbers from other devices that the client has not yet seen.
    *   **Conflict Resolution:** The resolution logic will be defined per data type:
        *   **Counters (e.g., `correctAnswers`):** Instead of storing just the total, we store an object of counts per device: `{ deviceA: 50, deviceB: 45 }`. The total is the sum of these values. This is a basic **PN-Counter** (Positive-Negative Counter) CRDT.
        *   **Sets (e.g., `incorrectQuestions`):** We use a **2P-Set** (Two-Phase Set) by maintaining both an `add` set and a `remove` set. An item is in the final set if it's in the `add` set and not in the `remove` set. This correctly handles concurrent additions and removals.
        *   **Highlights:** Each highlight will have its own version vector. Updates to a highlight (e.g., changing color, adding a note) will increment the device's version for that specific highlight. The version with the highest vector values (or latest timestamp as a tie-breaker) wins.

### New Data Structures (Example)

```typescript
// UserProgress
interface UserProgress {
  // ... other fields
  versions: Record<string, number>; // { [deviceId]: version }
  
  // Example of a CRDT-friendly counter
  correctAnswers: Record<string, number>; // { [deviceId]: count }
}

// Highlight
interface Highlight {
  // ... other fields
  versions: Record<string, number>; // { [deviceId]: version }
}
```

## 3. Sync Flow

1.  **Client:** Before syncing, the client increments its `deviceId` version in the data's `versions` vector.
2.  **Client -> Server:** The client sends the entire updated object to a dedicated sync endpoint.
3.  **Server:**
    *   Retrieves the current version from Firestore.
    *   Compares the version vectors to detect concurrency.
    *   If no concurrency, it's a fast-forward update. The new data is saved.
    *   If there is concurrency, the server applies the specific merge logic for each field (summing counters, merging sets, etc.).
    *   The merged data is saved to Firestore.
4.  **Server -> Client:** The server returns the fully merged and resolved data to the client.
5.  **Client:** The client replaces its local data with the resolved data from the server.

## 4. Advantages

*   **No Data Loss:** Concurrent edits from different devices are correctly merged.
*   **Offline Support:** The logic works perfectly with offline changes. When a device comes back online, its changes can be correctly merged.
*   **Idempotent:** The sync operation can be safely retried without causing issues.
*   **Scalable:** This approach is more scalable and robust than the previous one.
