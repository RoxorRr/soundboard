// Robust IndexedDB persistent store for Pelham Arena custom MP3s & sound presets
// Bypasses browser localStorage 5MB quotas so high-bitrate MP3s are never truncated or lost
import { StoredGoalHornData, MixerSettings } from '../types';

const DB_NAME = 'pelham_arena_audio_v1';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

function openAudioDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB open error:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB not supported or accessible:', err);
      resolve(null);
    }
  });
}

export async function saveAudioToIdb(key: string, value: any): Promise<boolean> {
  const db = await openAudioDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('IDB put error for', key, req.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('IDB write error:', err);
      resolve(false);
    }
  });
}

export async function getAudioFromIdb<T = any>(key: string): Promise<T | null> {
  const db = await openAudioDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

export async function deleteAudioFromIdb(key: string): Promise<boolean> {
  const db = await openAudioDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}
