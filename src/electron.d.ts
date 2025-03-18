// src/electron.d.ts
interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    send(channel: string, ...args: any[]): void;
    on(channel: string, func: (...args: any[]) => void): void;
  };
}

// Interface para dados de impressão
interface PrintFileListData {
  title: string;
  date: string;
  files: Array<{
    name: string;
    size: string;
    date: string;
    type: string;
  }>;
  silent: boolean; // Opção para impressão silenciosa
}

declare interface Window {
  electron: ElectronAPI;
}
