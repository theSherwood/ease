import { TaskConfig } from './types';

export const EASE_STORE = 'ease_store';

let maxId = 0;
export function getId() {
  return ++maxId;
}

export function getMaxIdForStore(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let store;
    try {
      const transaction = db.transaction(storeName, 'readonly');
      store = transaction.objectStore(storeName);
    } catch (e) {
      console.warn(e);
      resolve(0);
    }

    // Use the .openCursor() method with descending order on the primary key
    const request = store.openCursor(null, 'prev');

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        resolve(cursor.key); // Max ID
      } else {
        resolve(0); // No records found
      }
    };

    request.onerror = () => reject('Error retrieving max ID');
  });
}

export class KVStore<T> {
  db: IDBDatabase | null = null;
  readonly dbName: string;
  readonly storeName: string;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async set(key: string, value: T): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string): Promise<T | null> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

interface HasId {
  id?: number;
}

export class ListStore<T extends HasId> {
  db: IDBDatabase | null = null;
  readonly dbName: string;
  readonly storeName: string;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
    });
  }

  async add(record: T): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkAdd(records: T[]): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      for (const record of records) {
        store.add(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id: number): Promise<T | null> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAll(): Promise<T[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async delete(id: number): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async upsert(record: Partial<T>): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async *iterate(): AsyncGenerator<T> {
    const db = await this.connect();
    const tx = db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const request = store.openCursor();

    let cursor: IDBCursorWithValue | null = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });

    while (cursor) {
      yield cursor.value;
      cursor = await new Promise((resolve) => {
        cursor!.continue();
        request.onsuccess = () => resolve(request.result);
      });
    }
  }
}

export const taskStore = new ListStore<TaskConfig>(EASE_STORE, 'tasks');
export const audioStore = new ListStore<TaskConfig>(EASE_STORE, 'audio');

export async function setupStore() {
  await taskStore.connect();
  await audioStore.connect();
  let id = await getMaxIdForStore(taskStore.db!, 'tasks');
  if (id > maxId) maxId = id;
  id = await getMaxIdForStore(audioStore.db!, 'audio');
  if (id > maxId) maxId = id;
}
