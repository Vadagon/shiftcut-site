// Generic IndexedDB key/value adapter. Interface adapted from OpenCut (MIT).
// One object store per (dbName, storeName).

export class IndexedDBAdapter<T> {
  constructor(
    private dbName: string,
    private storeName: string,
    private version = 1,
  ) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private run<R>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> {
    return this.open().then(
      (db) =>
        new Promise<R>((resolve, reject) => {
          const tx = db.transaction(this.storeName, mode);
          const req = fn(tx.objectStore(this.storeName));
          tx.oncomplete = () => resolve(req.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  }

  get(key: string): Promise<T | undefined> {
    return this.run("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  }
  set(key: string, value: T): Promise<IDBValidKey> {
    return this.run("readwrite", (s) => s.put(value, key));
  }
  remove(key: string): Promise<undefined> {
    return this.run("readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
  }
  getAll(): Promise<T[]> {
    return this.run("readonly", (s) => s.getAll() as IDBRequest<T[]>);
  }
  keys(): Promise<IDBValidKey[]> {
    return this.run("readonly", (s) => s.getAllKeys() as IDBRequest<IDBValidKey[]>);
  }
}
