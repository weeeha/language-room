// The browser database. One database, one object store per kind of record.
// Version 1 held "sessions". Version 2 adds "scenarios" for scenarios made in the browser.
export const DB_NAME = "language-room";
export const DB_VERSION = 2;
export const STORE_NAMES = ["sessions", "scenarios"] as const;

/** The stores to create during an upgrade. Stores that already exist are never touched. */
export function missingStores(existing: Iterable<string>): string[] {
  const have = new Set(existing);
  return STORE_NAMES.filter((name) => !have.has(name));
}

const opened = new Map<string, Promise<IDBDatabase>>();

export function openDb(dbName: string = DB_NAME): Promise<IDBDatabase> {
  let p = opened.get(dbName);
  if (!p) {
    p = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of missingStores(Array.from(req.result.objectStoreNames))) {
          req.result.createObjectStore(name, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB could not open"));
    });
    opened.set(dbName, p);
  }
  return p;
}
