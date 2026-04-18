import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { VideoRecord } from './types';

interface AppDB extends DBSchema {
  videos: {
    key: number;
    value: VideoRecord;
    indexes: {
      'by-videoId': string;
      'by-channelId': string;
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'YouTubeHistoryMapperDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('videos')) {
          const store = db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-videoId', 'videoId');
          store.createIndex('by-channelId', 'channelId');
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveVideoRecord(record: Omit<VideoRecord, 'id'> | VideoRecord): Promise<number> {
  const db = await initDB();
  return db.put('videos', record as VideoRecord);
}

export async function getAllVideoRecords(): Promise<VideoRecord[]> {
  const db = await initDB();
  return db.getAll('videos');
}

export async function getVideoRecordsSince(timestamp: number): Promise<VideoRecord[]> {
  const db = await initDB();
  const index = db.transaction('videos').store.index('by-timestamp');
  const range = IDBKeyRange.lowerBound(timestamp);
  return index.getAll(range);
}
