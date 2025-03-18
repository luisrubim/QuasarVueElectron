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
      const validChannels = ['open-file', 'print-file', 'print-file-list'];
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
