import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { StoredGoalHornData, MixerSettings, GoalHornItem, PeriodAlertAudio, PeriodAlertKey } from '../types';

let dbInstance: ReturnType<typeof getFirestore> | null = null;

export function getFirebaseDb() {
  if (dbInstance) return dbInstance;
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = (firebaseConfig as any).firestoreDatabaseId;
    dbInstance = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    return dbInstance;
  } catch (err) {
    console.warn('Firebase init notice:', err);
    return null;
  }
}

// Error handling conforming to Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let authUser: any = null;
  try {
    const auth = getAuth();
    authUser = auth?.currentUser;
  } catch (_) {}

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authUser?.uid,
      email: authUser?.email,
      emailVerified: authUser?.emailVerified,
      isAnonymous: authUser?.isAnonymous,
      tenantId: authUser?.tenantId,
      providerInfo: authUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial connection validation probe
export async function validateFirebaseConnection(): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline');
    }
    return false;
  }
}

const GOAL_HORN_DOC = 'goal_horn';
const CHUNK_SIZE = 400000; // ~400KB per chunk to safely remain well under 1MB Firestore document limit

/**
 * Save custom goal horn and mixer settings to Firestore cloud so all devices (phone, laptop, arena computer)
 * have instant, persistent access to the audio file across Vercel deployments.
 */
export async function saveGoalHornToCloud(
  hornData: StoredGoalHornData | null,
  mixerSettings?: MixerSettings
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  const docPath = `settings/${GOAL_HORN_DOC}`;

  try {
    const docRef = doc(db, 'settings', GOAL_HORN_DOC);
    const existing = await getDoc(docRef);
    const existingData = existing.exists() ? existing.data() : null;

    const payload: any = {
      updatedAt: Date.now(),
    };

    if (hornData && hornData.hasCustomHorn && hornData.audioBase64) {
      payload.hasCustomHorn = true;
      payload.mimeType = hornData.mimeType || 'audio/mpeg';
      payload.filename = hornData.filename || 'custom_goal_horn.mp3';
      payload.fileSize = hornData.fileSize || 0;
      payload.duration = hornData.duration || 0;

      const rawBase64 = hornData.audioBase64;
      if (rawBase64.length > 500000) {
        // Chunk large MP3s across subcollection documents
        const totalChunks = Math.ceil(rawBase64.length / CHUNK_SIZE);
        payload.isChunked = true;
        payload.totalChunks = totalChunks;
        payload.audioBase64 = null; // Stored in subcollection

        for (let i = 0; i < totalChunks; i++) {
          const chunkStr = rawBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkRef = doc(db, 'settings', GOAL_HORN_DOC, 'chunks', `chunk_${i}`);
          await setDoc(chunkRef, {
            index: i,
            chunk: chunkStr,
            updatedAt: Date.now(),
          });
        }
      } else {
        payload.isChunked = false;
        payload.totalChunks = 0;
        payload.audioBase64 = rawBase64;
      }
    } else if (hornData === null) {
      // Explicit deletion requested
      payload.hasCustomHorn = false;
      payload.audioBase64 = null;
      payload.isChunked = false;
      payload.totalChunks = 0;
      payload.filename = '';
      payload.fileSize = 0;
    } else if (existingData?.hasCustomHorn) {
      // Preserve existing audio file if only updating settings
      payload.hasCustomHorn = true;
      payload.filename = existingData.filename || 'custom_goal_horn.mp3';
      payload.fileSize = existingData.fileSize || 0;
      payload.duration = existingData.duration || 0;
      payload.mimeType = existingData.mimeType || 'audio/mpeg';
      payload.isChunked = Boolean(existingData.isChunked);
      payload.totalChunks = existingData.totalChunks || 0;
      if (!existingData.isChunked) {
        payload.audioBase64 = existingData.audioBase64;
      }
    }

    if (mixerSettings) {
      payload.mixerSettings = {
        ...((existingData?.mixerSettings as any) || {}),
        ...mixerSettings,
      };
    }

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save goal horn to Firebase cloud:', err);
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Dedicated function to save ONLY mixer settings without ever modifying the custom audio file
 */
export async function saveMixerSettingsToCloud(mixerSettings: MixerSettings): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  const docPath = `settings/${GOAL_HORN_DOC}`;
  try {
    const docRef = doc(db, 'settings', GOAL_HORN_DOC);
    await setDoc(
      docRef,
      {
        mixerSettings,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Failed to sync mixer settings to Firestore cloud:', err);
    try {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Fetch stored goal horn and mixer settings from Firebase Firestore, assembling chunks if needed
 */
export async function loadGoalHornFromCloud(): Promise<{
  horn: StoredGoalHornData | null;
  mixerSettings: MixerSettings | null;
} | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  const docPath = `settings/${GOAL_HORN_DOC}`;
  try {
    const docRef = doc(db, 'settings', GOAL_HORN_DOC);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    let horn: StoredGoalHornData | null = null;

    if (data.hasCustomHorn) {
      let assembledBase64: string | null = data.audioBase64 || null;

      if (data.isChunked && data.totalChunks > 0) {
        const chunkPromises: Promise<string>[] = [];
        for (let i = 0; i < data.totalChunks; i++) {
          const chunkRef = doc(db, 'settings', GOAL_HORN_DOC, 'chunks', `chunk_${i}`);
          chunkPromises.push(
            getDoc(chunkRef).then((snap) => (snap.exists() ? snap.data().chunk || '' : ''))
          );
        }
        const chunks = await Promise.all(chunkPromises);
        assembledBase64 = chunks.join('');
      }

      if (assembledBase64 && assembledBase64.length > 50) {
        horn = {
          hasCustomHorn: true,
          audioBase64: assembledBase64,
          mimeType: data.mimeType || 'audio/mpeg',
          filename: data.filename || 'goal_horn.mp3',
          fileSize: data.fileSize || 0,
          duration: data.duration,
          updatedAt: data.updatedAt || Date.now(),
        };
      }
    }

    return {
      horn,
      mixerSettings: data.mixerSettings || null,
    };
  } catch (err) {
    console.warn('Failed to load goal horn from Firebase cloud:', err);
    try {
      handleFirestoreError(err, OperationType.GET, docPath);
    } catch (_) {}
    return null;
  }
}

/**
 * Real-time listener for goal horn and mixer settings across all user devices
 */
export function subscribeGoalHornFromCloud(
  callback: (horn: StoredGoalHornData | null, mixerSettings: MixerSettings | null) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  const docPath = `settings/${GOAL_HORN_DOC}`;
  try {
    const docRef = doc(db, 'settings', GOAL_HORN_DOC);
    return onSnapshot(
      docRef,
      async (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        let horn: StoredGoalHornData | null = null;

        if (data.hasCustomHorn) {
          let assembledBase64: string | null = data.audioBase64 || null;

          if (data.isChunked && data.totalChunks > 0) {
            try {
              const chunkPromises: Promise<string>[] = [];
              for (let i = 0; i < data.totalChunks; i++) {
                const chunkRef = doc(db, 'settings', GOAL_HORN_DOC, 'chunks', `chunk_${i}`);
                chunkPromises.push(
                  getDoc(chunkRef).then((snap) => (snap.exists() ? snap.data().chunk || '' : ''))
                );
              }
              const chunks = await Promise.all(chunkPromises);
              assembledBase64 = chunks.join('');
            } catch (_) {}
          }

          if (assembledBase64 && assembledBase64.length > 50) {
            horn = {
              hasCustomHorn: true,
              audioBase64: assembledBase64,
              mimeType: data.mimeType || 'audio/mpeg',
              filename: data.filename || 'goal_horn.mp3',
              fileSize: data.fileSize || 0,
              duration: data.duration,
              updatedAt: data.updatedAt || Date.now(),
            };
          }
        }
        callback(horn, data.mixerSettings || null);
      },
      (error) => {
        console.warn('Firebase goal horn sync subscription notice:', error);
        try {
          handleFirestoreError(error, OperationType.GET, docPath);
        } catch (_) {}
      }
    );
  } catch (_) {
    return () => {};
  }
}

const GOAL_HORNS_COLLECTION = 'goal_horns';

/**
 * Save an uploaded goal horn to Firestore collection so all devices can select and play it
 */
export async function saveGoalHornItemToCloud(horn: GoalHornItem): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const docPath = `${GOAL_HORNS_COLLECTION}/${horn.id}`;
  try {
    const docRef = doc(db, GOAL_HORNS_COLLECTION, horn.id);
    const payload: any = {
      id: horn.id,
      name: horn.name,
      filename: horn.filename,
      mimeType: horn.mimeType || 'audio/mpeg',
      fileSize: horn.fileSize || 0,
      duration: horn.duration || 0,
      isDefault: Boolean(horn.isDefault),
      isBuiltin: Boolean(horn.isBuiltin),
      createdAt: horn.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const rawBase64 = horn.audioBase64 || '';
    if (rawBase64.length > 500000) {
      const totalChunks = Math.ceil(rawBase64.length / CHUNK_SIZE);
      payload.isChunked = true;
      payload.totalChunks = totalChunks;
      payload.audioBase64 = null;

      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = rawBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, GOAL_HORNS_COLLECTION, horn.id, 'chunks', `chunk_${i}`);
        await setDoc(chunkRef, {
          index: i,
          chunk: chunkStr,
          updatedAt: Date.now(),
        });
      }
    } else {
      payload.isChunked = false;
      payload.totalChunks = 0;
      payload.audioBase64 = rawBase64;
    }

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Failed to save goal horn ${horn.id} to cloud:`, err);
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Delete a goal horn from Firestore collection
 */
export async function deleteGoalHornItemFromCloud(hornId: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const docPath = `${GOAL_HORNS_COLLECTION}/${hornId}`;
  try {
    const docRef = doc(db, GOAL_HORNS_COLLECTION, hornId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn(`Failed to delete goal horn ${hornId} from cloud:`, err);
    try {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Load all stored goal horns from Firestore cloud
 */
export async function loadAllGoalHornsFromCloud(): Promise<GoalHornItem[]> {
  const db = getFirebaseDb();
  if (!db) return [];
  const colPath = GOAL_HORNS_COLLECTION;
  try {
    const colRef = collection(db, GOAL_HORNS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: GoalHornItem[] = [];

    for (const d of snapshot.docs) {
      const data = d.data();
      let audio = data.audioBase64 || null;
      if (data.isChunked && data.totalChunks > 0) {
        try {
          const chunkPromises: Promise<string>[] = [];
          for (let i = 0; i < data.totalChunks; i++) {
            const chunkRef = doc(db, GOAL_HORNS_COLLECTION, d.id, 'chunks', `chunk_${i}`);
            chunkPromises.push(
              getDoc(chunkRef).then((snap) => (snap.exists() ? snap.data().chunk || '' : ''))
            );
          }
          const chunks = await Promise.all(chunkPromises);
          audio = chunks.join('');
        } catch (_) {}
      }

      list.push({
        id: data.id || d.id,
        name: data.name || data.filename || 'Custom Goal Horn',
        filename: data.filename || 'goal_horn.mp3',
        mimeType: data.mimeType || 'audio/mpeg',
        fileSize: data.fileSize || 0,
        duration: data.duration,
        isDefault: Boolean(data.isDefault),
        isBuiltin: Boolean(data.isBuiltin),
        audioBase64: audio,
        createdAt: data.createdAt || Date.now(),
      });
    }

    return list;
  } catch (err) {
    console.warn('Failed to load goal horns collection from cloud:', err);
    try {
      handleFirestoreError(err, OperationType.GET, colPath);
    } catch (_) {}
    return [];
  }
}

/**
 * Real-time listener for the goal horns library across all devices
 */
export function subscribeGoalHornsCollectionFromCloud(
  callback: (horns: GoalHornItem[]) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const colPath = GOAL_HORNS_COLLECTION;
  try {
    const colRef = collection(db, GOAL_HORNS_COLLECTION);
    return onSnapshot(
      colRef,
      async (snapshot) => {
        const list: GoalHornItem[] = [];
        for (const d of snapshot.docs) {
          const data = d.data();
          let audio = data.audioBase64 || null;
          if (data.isChunked && data.totalChunks > 0) {
            try {
              const chunkPromises: Promise<string>[] = [];
              for (let i = 0; i < data.totalChunks; i++) {
                const chunkRef = doc(db, GOAL_HORNS_COLLECTION, d.id, 'chunks', `chunk_${i}`);
                chunkPromises.push(
                  getDoc(chunkRef).then((snap) => (snap.exists() ? snap.data().chunk || '' : ''))
                );
              }
              const chunks = await Promise.all(chunkPromises);
              audio = chunks.join('');
            } catch (_) {}
          }
          list.push({
            id: data.id || d.id,
            name: data.name || data.filename || 'Custom Goal Horn',
            filename: data.filename || 'goal_horn.mp3',
            mimeType: data.mimeType || 'audio/mpeg',
            fileSize: data.fileSize || 0,
            duration: data.duration,
            isDefault: Boolean(data.isDefault),
            isBuiltin: Boolean(data.isBuiltin),
            audioBase64: audio,
            createdAt: data.createdAt || Date.now(),
          });
        }
        callback(list);
      },
      (error) => {
        console.warn('Subscription error on goal_horns:', error);
        try {
          handleFirestoreError(error, OperationType.GET, colPath);
        } catch (_) {}
      }
    );
  } catch (_) {
    return () => {};
  }
}

// ==========================================
// PERIOD ALERTS VOICE RECORDINGS COLLECTION
// ==========================================

const PERIOD_ALERTS_COLLECTION = 'period_alerts';
const VALID_PERIOD_KEYS: PeriodAlertKey[] = ['first', 'second', 'third', 'overtime'];

function isPeriodAlertKey(val: string): val is PeriodAlertKey {
  return VALID_PERIOD_KEYS.includes(val as PeriodAlertKey);
}

/**
 * Save a custom voice recording for a specific period alert slot to Firestore (chunked if > 500KB)
 */
export async function savePeriodAlertToCloud(alert: PeriodAlertAudio): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const docPath = `${PERIOD_ALERTS_COLLECTION}/${alert.period}`;
  try {
    const docRef = doc(db, PERIOD_ALERTS_COLLECTION, alert.period);
    const payload: Record<string, any> = {
      period: alert.period,
      filename: alert.filename || `period_${alert.period}_alert.mp3`,
      mimeType: alert.mimeType || 'audio/mpeg',
      fileSize: alert.fileSize || 0,
      duration: alert.duration || 0,
      updatedAt: alert.updatedAt || Date.now(),
    };

    const rawBase64 = alert.audioBase64 || '';
    if (rawBase64.length > 500000) {
      const totalChunks = Math.ceil(rawBase64.length / CHUNK_SIZE);
      payload.isChunked = true;
      payload.totalChunks = totalChunks;
      payload.audioBase64 = null;

      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = rawBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, PERIOD_ALERTS_COLLECTION, alert.period, 'chunks', `chunk_${i}`);
        await setDoc(chunkRef, {
          index: i,
          chunk: chunkStr,
          updatedAt: payload.updatedAt,
        });
      }
    } else {
      payload.isChunked = false;
      payload.totalChunks = 0;
      payload.audioBase64 = rawBase64;
    }

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Failed to save period alert ${alert.period} to cloud:`, err);
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Delete a custom voice recording for a period alert slot from Firestore
 */
export async function deletePeriodAlertFromCloud(period: PeriodAlertKey): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const docPath = `${PERIOD_ALERTS_COLLECTION}/${period}`;
  try {
    const docRef = doc(db, PERIOD_ALERTS_COLLECTION, period);
    // Clean up any chunks subcollection documents
    try {
      const chunksCol = collection(db, PERIOD_ALERTS_COLLECTION, period, 'chunks');
      const chunkSnap = await getDocs(chunksCol);
      await Promise.all(chunkSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (_) {}
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn(`Failed to delete period alert ${period} from cloud:`, err);
    try {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    } catch (_) {}
    return false;
  }
}

async function hydratePeriodAlertDoc(
  db: ReturnType<typeof getFirestore>,
  periodId: string,
  data: Record<string, any>
): Promise<PeriodAlertAudio | null> {
  if (!isPeriodAlertKey(periodId)) return null;
  let audio = data.audioBase64 || '';
  if (data.isChunked && data.totalChunks > 0) {
    try {
      const chunkPromises: Promise<string>[] = [];
      for (let i = 0; i < data.totalChunks; i++) {
        const chunkRef = doc(db, PERIOD_ALERTS_COLLECTION, periodId, 'chunks', `chunk_${i}`);
        chunkPromises.push(
          getDoc(chunkRef).then((snap) => (snap.exists() ? snap.data().chunk || '' : ''))
        );
      }
      const chunks = await Promise.all(chunkPromises);
      audio = chunks.join('');
    } catch (_) {}
  }
  if (!audio) return null;
  return {
    period: periodId,
    filename: data.filename || `period_${periodId}_alert.mp3`,
    mimeType: data.mimeType || 'audio/mpeg',
    fileSize: data.fileSize || 0,
    duration: data.duration,
    audioBase64: audio,
    updatedAt: data.updatedAt || Date.now(),
  };
}

/**
 * Load all custom period alert voice recordings from Firestore
 */
export async function loadAllPeriodAlertsFromCloud(): Promise<Partial<Record<PeriodAlertKey, PeriodAlertAudio>>> {
  const db = getFirebaseDb();
  if (!db) return {};
  const colPath = PERIOD_ALERTS_COLLECTION;
  try {
    const colRef = collection(db, PERIOD_ALERTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const result: Partial<Record<PeriodAlertKey, PeriodAlertAudio>> = {};

    for (const d of snapshot.docs) {
      const hydrated = await hydratePeriodAlertDoc(db, d.id, d.data());
      if (hydrated) {
        result[hydrated.period] = hydrated;
      }
    }
    return result;
  } catch (err) {
    console.warn('Failed to load period alerts from cloud:', err);
    try {
      handleFirestoreError(err, OperationType.GET, colPath);
    } catch (_) {}
    return {};
  }
}

/**
 * Real-time listener for period alert voice recordings across devices
 */
export function subscribePeriodAlertsFromCloud(
  callback: (alerts: Partial<Record<PeriodAlertKey, PeriodAlertAudio>>, fromCache: boolean) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const colPath = PERIOD_ALERTS_COLLECTION;
  try {
    const colRef = collection(db, PERIOD_ALERTS_COLLECTION);
    return onSnapshot(
      colRef,
      async (snapshot) => {
        const result: Partial<Record<PeriodAlertKey, PeriodAlertAudio>> = {};
        for (const d of snapshot.docs) {
          const hydrated = await hydratePeriodAlertDoc(db, d.id, d.data());
          if (hydrated) {
            result[hydrated.period] = hydrated;
          }
        }
        callback(result, snapshot.metadata.fromCache);
      },
      (error) => {
        console.warn('Subscription error on period_alerts:', error);
        try {
          handleFirestoreError(error, OperationType.GET, colPath);
        } catch (_) {}
      }
    );
  } catch (_) {
    return () => {};
  }
}


