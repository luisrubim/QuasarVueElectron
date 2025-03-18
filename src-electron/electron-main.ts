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

// Lidar com o canal IPC para imprimir arquivos
ipcMain.on('print-file', (event, filePath, silent = true) => {
  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error('Janela não encontrada');
    }

    // Verifica a extensão do arquivo
    const ext = path.extname(filePath).toLowerCase();

    // Para arquivos PDF e imagens, usamos o recurso de impressão do Electron
    if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      // Cria uma janela temporária invisível
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          javascript: true,
        },
      });

      // Conteúdo HTML para imagens
      let htmlContent = '';

      if (ext === '.pdf') {
        // Para PDFs, carregamos diretamente o arquivo
        printWindow.loadURL(`file://${filePath}`);
      } else {
        // Para imagens, criamos uma página HTML com a imagem e script para impressão direta se necessário
        htmlContent = `
          <html>
            <head>
              <title>Impressão de Imagem</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                }
                img {
                  max-width: 100%;
                  max-height: 100vh;
                  object-fit: contain;
                }
                @media print {
                  body { margin: 0; }
                  img { max-height: 100%; }
                }
              </style>
              ${
                silent
                  ? `
              <script>
                // Script para impressão direta sem diálogo
                document.addEventListener('DOMContentLoaded', function() {
                  setTimeout(() => {
                    window.print();
                  }, 300);
                });
              </script>
              `
                  : ''
              }
            </head>
            <body>
              <img src="file://${filePath}" alt="Imagem para impressão">
            </body>
          </html>
        `;

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      }

      // Se for um PDF ou não estiver no modo silencioso, usamos a API padrão do Electron
      if (ext === '.pdf' || !silent) {
        printWindow.webContents.on('did-finish-load', () => {
          printWindow.webContents.print(
            {
              silent: silent,
              printBackground: true,
            },
            (success) => {
              if (!success) {
                console.error('Falha ao imprimir');
              }
              printWindow.close();
            },
          );
        });
      } else {
        // Para imagens no modo silencioso, usamos window.print() através do script injetado
        printWindow.webContents.on('did-finish-load', () => {
          // Defina um tempo limite para fechar a janela após a impressão
          setTimeout(() => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
            }
          }, 1000);
        });
      }
    } else {
      // Para outros tipos de arquivo, abrimos com o aplicativo padrão
      // e deixamos o aplicativo lidar com a impressão
      shell.openPath(filePath);
    }
  } catch (error) {
    console.error('Erro ao imprimir arquivo:', error);
  }
});

// Lidar com o canal IPC para imprimir lista de arquivos
ipcMain.on('print-file-list', (event, printData) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error('Janela não encontrada');
    }

    // Cria uma janela temporária invisível
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
      },
    });

    // Gera o HTML para a lista de arquivos
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${printData.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 10px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #f2f2f2;
          }
          .footer {
            margin-top: 20px;
            font-size: 12px;
            text-align: center;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${printData.title}</h1>
          <div>Data: ${printData.date}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Tamanho</th>
              <th>Data de Modificação</th>
            </tr>
          </thead>
          <tbody>
            ${printData.files
              .map(
                (file) => `
              <tr>
                <td>${file.name}</td>
                <td>${file.type}</td>
                <td>${file.size}</td>
                <td>${file.date}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          Gerado por Downloads Explorer em ${printData.date}
        </div>
      </body>
      </html>
    `;

    // Carrega o HTML
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Quando o conteúdo for carregado, imprime
    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        { silent: printData.silent, printBackground: true },
        (success) => {
          if (!success) {
            console.error('Falha ao imprimir lista');
          }
          printWindow.close();
        },
      );
    });
  } catch (error) {
    console.error('Erro ao imprimir lista de arquivos:', error);
  }
});
