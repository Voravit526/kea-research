/**
 * IndexedDB Manager for KEA Research
 */

export const KeaResearchDB = {
  dbName: 'KeaResearchDB',
  version: 4,
  db: null as IDBDatabase | null,

  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        this.db = request.result;
        await this.cleanupOldSettings();
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
          chatStore.createIndex('createdAt', 'createdAt', { unique: false });
          chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('type', 'type', { unique: false });
        }
        // Note: Research layers now use regular chats table with parentMessageId field
      };
    });
  },

  async cleanupOldSettings(): Promise<void> {
    try {
      const stored = await this.get('settings', 'userSettings');
      if (stored && stored.value) {
        const settings = stored.value;
        if (settings.premiumStorage !== undefined || settings.persistentStorage !== undefined) {
          delete settings.premiumStorage;
          delete settings.persistentStorage;
          if (!settings.storageLimit) {
            settings.storageLimit = 32;
          }
          await this.put('settings', { key: 'userSettings', value: settings, updatedAt: new Date().toISOString() });
        }
      }
    } catch (error) {
      console.error('Error cleaning up old settings:', error);
    }
  },

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  },

  async put<T>(storeName: string, data: T): Promise<IDBValidKey> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all records matching an index value (uses IndexedDB index for efficiency)
   */
  async getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete all records matching an index value (uses cursor for efficiency)
   */
  async deleteAllByIndex(storeName: string, indexName: string, value: IDBValidKey): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openCursor(IDBKeyRange.only(value));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getStorageEstimate(): Promise<{ used: number; quota: number; percentage: string } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
      const quotaMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(2);
      return {
        used: parseFloat(usedMB),
        quota: parseFloat(quotaMB),
        percentage: ((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(1)
      };
    }
    return null;
  }
};

// Make it globally available
declare global {
  interface Window {
    KeaResearchDB: typeof KeaResearchDB;
  }
}

window.KeaResearchDB = KeaResearchDB;
