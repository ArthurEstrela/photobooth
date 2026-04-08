// apps/totem/electron/sync-engine.ts

import axios from 'axios';
import db from './database';
import { Logger } from 'electron-log'; // Assuming logger or console

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

let isSyncing = false;

export function startSyncEngine() {
  console.log('Sync Engine started...');

  setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;

    try {
      // 1. Find PENDING photos in SQLite
      const pendingPhotos = db.prepare("SELECT * FROM offline_photos WHERE status = 'PENDING' LIMIT 5").all() as any[];

      if (pendingPhotos.length === 0) return;

      console.log(`Sync Engine: Found ${pendingPhotos.length} pending photos to upload.`);

      for (const photo of pendingPhotos) {
        try {
          // 2. Upload to NestJS API
          const response = await axios.post(`${API_URL}/photos/sync`, {
            sessionId: photo.sessionId,
            photoBase64: photo.photoBase64,
          }, {
            timeout: 30000, // 30s timeout for large images
          });

          if (response.status === 201 || response.status === 200) {
            // 3. Update status to UPLOADED
            db.prepare("UPDATE offline_photos SET status = 'UPLOADED' WHERE id = ?").run(photo.id);
            console.log(`Sync Engine: Photo ${photo.id} uploaded successfully for session ${photo.sessionId}`);
          }
        } catch (uploadError: any) {
          console.error(`Sync Engine: Failed to upload photo ${photo.id}. Will retry in next cycle.`, uploadError.message);
          // Don't throw, just continue to next photo or wait for next interval
        }
      }
    } catch (dbError) {
      console.error('Sync Engine: Database error', dbError);
    } finally {
      isSyncing = false;
    }
  }, 10000); // Run every 10 seconds
}
