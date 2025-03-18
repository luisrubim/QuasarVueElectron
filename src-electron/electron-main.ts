import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | undefined;

async function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION,
        ),
      ),
    },
  });

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL);
  } else {
    await mainWindow.loadFile('index.html');
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

void app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    void createWindow();
  }
});

// Lidar com o canal IPC para listar os arquivos do diretório
ipcMain.handle('list-directory', async (_, dirPath) => {
  try {
    // Verifica se o diretório existe
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Diretório não encontrado: ${dirPath}`);
    }

    // Lê o conteúdo do diretório
    const items = fs.readdirSync(dirPath);

    // Formata as informações de cada arquivo/pasta
    const fileInfos = items.map((item) => {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      return {
        name: item,
        path: fullPath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modifiedAt: stats.mtime.toISOString(),
      };
    });

    // Ordena: primeiro as pastas, depois os arquivos, ambos em ordem alfabética
    return fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Erro ao listar diretório:', error);
    throw error;
  }
});

// Lidar com o canal IPC para abrir arquivos
ipcMain.on('open-file', (_, filePath) => {
  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Abre o arquivo com o aplicativo padrão do sistema
    shell.openPath(filePath);
  } catch (error) {
    console.error('Erro ao abrir arquivo:', error);
  }
});
