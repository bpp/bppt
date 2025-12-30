/**
 * Electron preload script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods for the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Open file dialog and return file path
  openFileDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('open-file-dialog');
  },

  // Listen for file selected from menu
  onFileSelected: (callback: (filePath: string) => void): void => {
    ipcRenderer.on('file-selected', (_event, filePath) => {
      callback(filePath);
    });
  },

  // Check if running in Electron
  isElectron: true
});
