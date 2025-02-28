import { Audio, SessionSegment, Task } from './types';

const DB_VERSION = 1;

export const EASE_STORE = 'ease_store';

const TASKS_STORE = 'tasks';
const AUDIO_STORE = 'audio';
const SESSION_SEGMENTS_STORE = 'sessionSegments';

let maxSessionId = 0;
export function getSessionId() {
  return ++maxSessionId;
}

let maxTaskId = 0;
let maxAudioId = 0;
let maxSessionSegmentId = 0;
export function getTaskId() {
  return ++maxTaskId;
}
export function getAudioId() {
  return ++maxAudioId;
}
export function getSessionSegmentId() {
  return ++maxSessionSegmentId;
}

export function getColumnMax(db: IDBDatabase, storeName: string, column: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let store;
    try {
      const transaction = db.transaction(storeName, 'readonly');
      store = transaction.objectStore(storeName);
    } catch (e) {
      console.warn(e);
      resolve(0);
    }
    let index = store.index('myColumn');
    // Use the .openCursor() method with descending order on the primary key
    const request = index.openCursor(null, 'prev');
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        resolve(cursor.value[column]); // Max value
      } else {
        resolve(0); // No records found
      }
    };
    request.onerror = () => reject(`Error retrieving max "${column}"`);
  });
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

interface HasId {
  id?: number;
}

export class ListStore<T extends HasId> {
  db: IDBDatabase;
  storeName: string;
  constructor(storeName: string) {
    this.storeName = storeName;
  }

  connect(db: IDBDatabase) {
    this.db = db;
  }

  async add(record: T): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      console.log('add', this.storeName, record, db);
      console.log('Object Stores:', Array.from(db.objectStoreNames));
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkAdd(records: T[]): Promise<void> {
    const db = this.db!;
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
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAll(): Promise<T[]> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async delete(id: number): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async upsert(record: Partial<T>): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async *iterate(): AsyncGenerator<T> {
    const db = this.db!;
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

export const taskStore = new ListStore<Task>(TASKS_STORE);
export const audioStore = new ListStore<Audio>(AUDIO_STORE);
export const sessionSegmentStore = new ListStore<SessionSegment>(SESSION_SEGMENTS_STORE);

const options = {
  [TASKS_STORE]: { indexes: [{ name: 'id', unique: true }] },
  [AUDIO_STORE]: { indexes: [{ name: 'id', unique: true }] },
  [SESSION_SEGMENTS_STORE]: { indexes: [{ name: 'sessionId', unique: false }] },
};

export async function setupStore() {
  let db: IDBDatabase;
  const p = new Promise((resolve, reject) => {
    const request = indexedDB.open(EASE_STORE, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      for (const storeName of [TASKS_STORE, AUDIO_STORE, SESSION_SEGMENTS_STORE]) {
        console.log('onupgradeneeded', storeName, options);
        if (!db.objectStoreNames.contains(storeName)) {
          let store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          for (const { name, unique } of options[storeName].indexes) {
            if (!store.indexNames.contains(name)) {
              store.createIndex(name, name, { unique });
            }
          }
        }
      }
    };
  });
  await p;

  taskStore.connect(db!);
  audioStore.connect(db!);
  sessionSegmentStore.connect(db!);
  console.log('Object Stores:', Array.from(db!.objectStoreNames));

  let id = await getMaxIdForStore(taskStore.db!, 'tasks');
  if (id > maxTaskId) maxTaskId = id;
  id = await getMaxIdForStore(audioStore.db!, 'audio');
  if (id > maxAudioId) maxAudioId = id;
  id = await getMaxIdForStore(sessionSegmentStore.db!, 'sessionSegments');
  if (id > maxSessionSegmentId) maxSessionSegmentId = id;

  console.log('maxTaskId', maxTaskId);
  console.log('maxAudioId', maxAudioId);
  console.log('maxSessionId', maxSessionId);
}
