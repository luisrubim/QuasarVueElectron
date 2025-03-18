// src/electron.d.ts
interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    send(channel: string, ...args: any[]): void;
    on(channel: string, func: (...args: any[]) => void): void;
  };
}

declare interface Window {
  electron: ElectronAPI;
}
