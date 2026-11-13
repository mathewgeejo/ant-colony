// Minimal IndexedDB wrapper (usable from the worker). Metadata and data are kept in
// separate stores so listing saves does not load whole worlds.
const DB = 'ant-colony-sandbox';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      for (const s of ['saves', 'meta']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'slot' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('Could not open local storage (IndexedDB).'));
    r.onblocked = () => rej(new Error('Local storage is blocked by another open game tab. Close that tab and try again.'));
  });
}

function run<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((res, rej) => {
    const t = db.transaction(stores, mode);
    const req = fn(t);
    let out: T | undefined;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = () => { db.close(); rej(t.error ?? new Error('Storage error.')); };
    t.onabort = () => { db.close(); rej(t.error ?? new Error('Storage transaction aborted (storage may be full or blocked).')); };
  }));
}

export interface SaveMeta { slot: string; name: string; savedAt: string; summary: any }

export const db = {
  put: (meta: SaveMeta, data: any) => run(['saves', 'meta'], 'readwrite', (t) => { t.objectStore('saves').put({ slot: meta.slot, data }); t.objectStore('meta').put(meta); }),
  get: (slot: string) => run<{ slot: string; data: any }>(['saves'], 'readonly', (t) => t.objectStore('saves').get(slot)),
  del: (slot: string) => run(['saves', 'meta'], 'readwrite', (t) => { t.objectStore('saves').delete(slot); t.objectStore('meta').delete(slot); }),
  list: () => run<SaveMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').getAll()).then((x) => x ?? []),
};
