/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.ts you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expõe as APIs seguras para o processo de renderização
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      // Lista de canais permitidos para invoke
      const validChannels = ['list-directory'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Canal IPC não permitido: ${channel}`));
    },
    send: (channel: string, ...args: any[]) => {
      // Lista de canais permitidos para send
      const validChannels = ['open-file'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      // Lista de canais permitidos para on
      const validChannels = ['file-opened'];
      if (validChannels.includes(channel)) {
        // Remove o ouvinte existente para evitar duplicações
        ipcRenderer.removeAllListeners(channel);
        // Adiciona o novo ouvinte
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
});

console.log('Preload script carregado com sucesso!');
