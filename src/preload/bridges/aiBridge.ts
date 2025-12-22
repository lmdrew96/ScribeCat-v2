/**
 * AI IPC Bridge
 *
 * IPC bindings for Claude AI operations: chat, streaming, transcription polish, etc.
 */

const { ipcRenderer } = require('electron');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  transcriptionContext?: string;
  notesContext?: string;
}

export const aiBridge = {
  chat: (message: string, history: ChatMessage[], options?: ChatOptions) =>
    ipcRenderer.invoke('ai:chat', message, history, options),

  chatStream: async (
    message: string,
    history: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void
  ) => {
    // Remove any existing listeners first to prevent leaks
    ipcRenderer.removeAllListeners('ai:chatChunk');

    // Set up listener for chunks
    const chunkHandler = (_event: Electron.IpcRendererEvent, chunk: string) => onChunk(chunk);
    ipcRenderer.on('ai:chatChunk', chunkHandler);

    try {
      // Start the stream
      const result = await ipcRenderer.invoke('ai:chatStream', message, history, options);
      return result;
    } finally {
      // Clean up listener after stream completes
      ipcRenderer.removeListener('ai:chatChunk', chunkHandler);
    }
  },

  removeChatStreamListener: () => {
    ipcRenderer.removeAllListeners('ai:chatChunk');
  },

  polishTranscription: (
    text: string,
    options?: Partial<{ grammar: boolean; punctuation: boolean; clarity: boolean; preserveMeaning: boolean }>
  ) => ipcRenderer.invoke('ai:polishTranscription', text, options),

  generateSummary: (
    transcription: string,
    notes?: string,
    options?: Partial<{ style: string; maxLength: number }>
  ) => ipcRenderer.invoke('ai:generateSummary', transcription, notes, options),

  generateTitle: (
    transcription: string,
    notes?: string,
    options?: Partial<{ maxLength: number; format: string }>
  ) => ipcRenderer.invoke('ai:generateTitle', transcription, notes, options),

  isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
  testConnection: () => ipcRenderer.invoke('ai:testConnection'),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('ai:setApiKey', apiKey),
};
