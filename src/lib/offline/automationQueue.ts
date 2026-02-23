/**
 * Offline queue for automation schedule payloads.
 * When the trainer saves a schedule while offline, the payload is stored here
 * and flushed by calling createAutomationAssignment for each item when back online.
 */

const DB_NAME = "milo-automation-queue";
const STORE_NAME = "pending_automations";
const DB_VERSION = 1;

export type QueuedAutomationPayload = {
  client_id: string;
  workout_template_id: string | null;
  meal_template_id: string | null;
  generate_on_dow: number;
  auto_meals_enabled: boolean;
  auto_workouts_enabled: boolean;
};

export type QueuedAutomationItem = {
  id: string;
  payload: QueuedAutomationPayload;
  createdAt: number;
};

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB only available in browser"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Add a payload to the queue (when offline). */
export async function addToAutomationQueue(
  payload: QueuedAutomationPayload
): Promise<string> {
  const db = await openDB();
  const id = generateId();
  const item: QueuedAutomationItem = { id, payload, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(id);
    tx.oncomplete = () => db.close();
  });
}

/** Get all queued items (oldest first). */
export async function getAutomationQueue(): Promise<QueuedAutomationItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const list = (req.result as QueuedAutomationItem[]).sort(
        (a, b) => a.createdAt - b.createdAt
      );
      resolve(list);
    };
    tx.oncomplete = () => db.close();
  });
}

/** Remove one item by id after successful sync. */
export async function removeFromAutomationQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/** Clear all items (e.g. after flushing). */
export async function clearAutomationQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}
