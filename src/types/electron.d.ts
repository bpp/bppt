/**
 * Type definitions for Electron API exposed via preload script
 */

interface ElectronAPI {
  openFileDialog: () => Promise<string | null>;
  onFileSelected: (callback: (filePath: string) => void) => void;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
