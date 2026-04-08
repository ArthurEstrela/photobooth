// apps/totem/electron/database.ts

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'photobooth_offline.db');
const db = new Database(dbPath);

export interface IOfflinePhoto {
  id?: number;
  sessionId: string;
  photoBase64: string;
  status: 'PENDING' | 'UPLOADED';
  createdAt?: string;
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS offline_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      photoBase64 TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Local SQLite initialized at:', dbPath);
}

export function savePhotoOffline(photo: IOfflinePhoto) {
  const stmt = db.prepare(
    'INSERT INTO offline_photos (sessionId, photoBase64, status) VALUES (?, ?, ?)'
  );
  return stmt.run(photo.sessionId, photo.photoBase64, photo.status);
}

export default db;
