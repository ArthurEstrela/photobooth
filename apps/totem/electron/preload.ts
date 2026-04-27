import { contextBridge, ipcRenderer } from 'electron';

export interface PhotoData {
  sessionId: string;
  photoBase64: string;
}

contextBridge.exposeInMainWorld('totemAPI', {
  printPhoto: (photoUrl: string) => ipcRenderer.send('print-photo', photoUrl),
  saveOfflinePhoto: (data: PhotoData) => ipcRenderer.send('save-offline-photo', data),
  getPrinters: (): Promise<Array<{ name: string }>> => ipcRenderer.invoke('get-printers'),
  getCredentials: (): Promise<{ boothId: string; boothToken: string } | null> =>
    ipcRenderer.invoke('store-get-credentials'),
  setCredentials: (data: { boothId: string; boothToken: string }): Promise<void> =>
    ipcRenderer.invoke('store-set-credentials', data),
  clearCredentials: (): Promise<void> =>
    ipcRenderer.invoke('store-clear-credentials'),
});
