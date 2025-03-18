<template>
  <q-page padding>
    <div class="q-pa-md">
      <h5 class="q-mt-none q-mb-md">Arquivos em Downloads</h5>

      <div class="q-mb-md row items-center">
        <q-btn
          color="primary"
          icon="print"
          label="Imprimir Lista"
          @click="printFileList"
          class="q-mr-sm"
        />
        <q-toggle v-model="silentPrint" label="Impressão silenciosa" />
      </div>

      <q-list bordered separator>
        <q-item v-for="file in files" :key="file.name" clickable v-ripple>
          <q-item-section avatar>
            <q-icon :name="getIconByFileType(file)" :color="getColorByFileType(file)" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ file.name }}</q-item-label>
            <q-item-label caption>
              {{ formatFileSize(file.size) }} | {{ formatDate(file.modifiedAt) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center">
              <q-btn
                flat
                round
                icon="print"
                size="sm"
                @click="printFile(file)"
                class="q-mr-xs"
                color="primary"
              />
              <q-btn flat round icon="open_in_new" @click="openFile(file.path)" />
            </div>
          </q-item-section>
        </q-item>

        <q-inner-loading :showing="loading">
          <q-spinner-dots size="50px" color="primary" />
        </q-inner-loading>
      </q-list>

      <div v-if="!loading && files.length === 0" class="text-center q-pa-lg">
        <q-icon name="folder_open" size="4rem" color="grey-5" />
        <p class="text-grey-7">Nenhum arquivo encontrado</p>
      </div>

      <div v-if="error" class="text-center text-negative q-pa-md">
        <q-icon name="error" size="2rem" />
        <p>{{ error }}</p>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
// Removendo temporariamente a dependência de date-fns
// import { format } from 'date-fns';
// import { ptBR } from 'date-fns/locale';

// Interface para representar os arquivos
interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: Date;
  extension: string;
}

// Estados reativos
const files = ref<FileInfo[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const silentPrint = ref(true); // Opção para impressão silenciosa, padrão true

// Carregar os arquivos quando o componente for montado
onMounted(async () => {
  try {
    await loadFiles();
  } catch (err) {
    error.value = `Erro ao carregar arquivos: ${err.message}`;
  } finally {
    loading.value = false;
  }
});

// Função para carregar os arquivos usando a API do Electron
const loadFiles = async () => {
  // Usamos a API do electron exposta pelo preload.ts através do contextBridge
  // Não podemos usar window.require, devemos usar as APIs expostas
  const result = await window.electron.ipcRenderer.invoke(
    'list-directory',
    'C:\\Users\\ConectaControl\\Downloads',
  );

  // Transformar os resultados no formato necessário
  files.value = result.map((file: any) => ({
    name: file.name,
    path: file.path,
    size: file.size,
    isDirectory: file.isDirectory,
    modifiedAt: new Date(file.modifiedAt),
    extension: file.name.split('.').pop()?.toLowerCase() || '',
  }));
};

// Função para formatar o tamanho do arquivo
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Função para formatar a data sem usar date-fns
const formatDate = (date: Date): string => {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Função para abrir o arquivo usando o Electron
const openFile = (path: string) => {
  window.electron.ipcRenderer.send('open-file', path);
};

// Função para imprimir um arquivo específico
const printFile = (file: FileInfo) => {
  window.electron.ipcRenderer.send('print-file', file.path, silentPrint.value);
};

// Função para imprimir a lista de arquivos
const printFileList = () => {
  // Preparar os dados para impressão
  const printData = {
    title: 'Lista de Arquivos - Downloads',
    date: new Date().toLocaleString('pt-BR'),
    files: files.value.map((file) => ({
      name: file.name,
      size: formatFileSize(file.size),
      date: formatDate(file.modifiedAt),
      type: file.isDirectory ? 'Pasta' : `Arquivo ${file.extension.toUpperCase()}`,
    })),
    silent: silentPrint.value, // Incluir a opção de impressão silenciosa
  };

  window.electron.ipcRenderer.send('print-file-list', printData);
};

// Função para determinar o ícone com base no tipo de arquivo
const getIconByFileType = (file: FileInfo): string => {
  if (file.isDirectory) return 'folder';

  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'gif',
    doc: 'description',
    docx: 'description',
    xls: 'table_chart',
    xlsx: 'table_chart',
    ppt: 'slideshow',
    pptx: 'slideshow',
    txt: 'article',
    mp3: 'audio_file',
    mp4: 'video_file',
    zip: 'folder_zip',
    rar: 'folder_zip',
    exe: 'smart_button',
  };

  return iconMap[file.extension] || 'insert_drive_file';
};

// Função para determinar a cor com base no tipo de arquivo
const getColorByFileType = (file: FileInfo): string => {
  if (file.isDirectory) return 'amber';

  const colorMap: Record<string, string> = {
    pdf: 'red',
    jpg: 'green',
    jpeg: 'green',
    png: 'green',
    gif: 'purple',
    doc: 'blue',
    docx: 'blue',
    xls: 'green-8',
    xlsx: 'green-8',
    ppt: 'deep-orange',
    pptx: 'deep-orange',
    txt: 'grey-7',
    mp3: 'cyan',
    mp4: 'teal',
    zip: 'brown',
    rar: 'brown',
    exe: 'indigo',
  };

  return colorMap[file.extension] || 'grey';
};
</script>
