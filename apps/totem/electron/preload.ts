// apps/totem/electron/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

export interface PhotoData {
  sessionId: string;
  photoBase64: string;
}

contextBridge.exposeInMainWorld('totemAPI', {
  printPhoto: () => ipcRenderer.send('print-photo'),
  saveOfflinePhoto: (data: PhotoData) => ipcRenderer.send('save-offline-photo', data),
  getPrinters: (): Promise<Array<{ name: string }>> => ipcRenderer.invoke('get-printers'),
});
