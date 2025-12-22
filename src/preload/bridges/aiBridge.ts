/**
 * AI IPC Bridge
 *
 * IPC bindings for Claude AI operations: chat, streaming, transcription polish, etc.
 */

const { ipcRenderer } = require('electron');
import { AIChannels } from '../../shared/IpcChannels.js';

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
    ipcRenderer.invoke(AIChannels.CHAT, message, history, options),

  chatStream: async (
    message: string,
    history: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void
  ) => {
    // Remove any existing listeners first to prevent leaks
    ipcRenderer.removeAllListeners(AIChannels.CHAT_CHUNK);

    // Set up listener for chunks
    const chunkHandler = (_event: Electron.IpcRendererEvent, chunk: string) => onChunk(chunk);
    ipcRenderer.on(AIChannels.CHAT_CHUNK, chunkHandler);

    try {
      // Start the stream
      const result = await ipcRenderer.invoke(AIChannels.CHAT_STREAM, message, history, options);
      return result;
    } finally {
      // Clean up listener after stream completes
      ipcRenderer.removeListener(AIChannels.CHAT_CHUNK, chunkHandler);
    }
  },

  removeChatStreamListener: () => {
    ipcRenderer.removeAllListeners(AIChannels.CHAT_CHUNK);
  },

  polishTranscription: (
    text: string,
    options?: Partial<{ grammar: boolean; punctuation: boolean; clarity: boolean; preserveMeaning: boolean }>
  ) => ipcRenderer.invoke(AIChannels.POLISH_TRANSCRIPTION, text, options),

  generateSummary: (
    transcription: string,
    notes?: string,
    options?: Partial<{ style: string; maxLength: number }>
  ) => ipcRenderer.invoke(AIChannels.GENERATE_SUMMARY, transcription, notes, options),

  generateTitle: (
    transcription: string,
    notes?: string,
    options?: Partial<{ maxLength: number; format: string }>
  ) => ipcRenderer.invoke(AIChannels.GENERATE_TITLE, transcription, notes, options),

  isConfigured: () => ipcRenderer.invoke(AIChannels.IS_CONFIGURED),
  testConnection: () => ipcRenderer.invoke(AIChannels.TEST_CONNECTION),
  setApiKey: (apiKey: string) => ipcRenderer.invoke(AIChannels.SET_API_KEY, apiKey),
};
