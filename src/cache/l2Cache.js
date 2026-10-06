// L2 Cache: IndexedDB
const DB_NAME = 'NiFashionL2Cache';
const STORE_NAME = 'api_responses';
const DB_VERSION = 1;
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const TARGET_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function getL2Cache(key) {
  if (import.meta.env.VITE_BROWSER_CACHE_ENABLED !== 'true') return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => resolve(null); // Fail open
      request.onsuccess = () => {
        const record = request.result;
        if (!record) return resolve(null);
        if (Date.now() - record.timestamp > MAX_AGE_MS) {
          deleteL2Cache(key).catch(() => {}); // fire and forget cleanup
          return resolve(null);
        }
        resolve({ data: record.data, timestamp: record.timestamp });
      };
    });
  } catch {
    return null;
  }
}

export async function setL2Cache(key, data) {
  if (import.meta.env.VITE_BROWSER_CACHE_ENABLED !== 'true') return;
  try {
    const db = await getDB();
    const size = new Blob([JSON.stringify(data)]).size;
    const record = { key, data, timestamp: Date.now(), size };
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // Fire and forget size management
    enforceSizeLimit();
  } catch {
    // Fail open: if IDB fails (e.g. quota), we just skip caching
  }
}

export async function deleteL2Cache(key) {
  try {
    const db = await getDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {}
}

export async function clearL2Cache() {
  try {
    const db = await getDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {}
}

async function enforceSizeLimit() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    const request = index.openCursor();
    let totalSize = 0;
    const toDelete = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        totalSize += cursor.value.size || 0;
        // Also queue expired for deletion
        if (Date.now() - cursor.value.timestamp > MAX_AGE_MS) {
          toDelete.push(cursor.value.key);
        } else if (totalSize > TARGET_SIZE_BYTES) {
          toDelete.push(cursor.value.key);
        }
        cursor.continue();
      } else {
        // Cursor finished
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        const delStore = delTx.objectStore(STORE_NAME);
        toDelete.forEach((k) => delStore.delete(k));
      }
    };
  } catch {}
}
