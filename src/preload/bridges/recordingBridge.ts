/**
 * Recording & Audio IPC Bridges
 *
 * IPC bindings for recording, audio file operations, and transcription
 */

const { ipcRenderer } = require('electron');

import { RecordingChannels, AudioChannels, TranscriptionChannels } from '../../shared/IpcChannels.js';

export const recordingBridge = {
  start: () => ipcRenderer.invoke(RecordingChannels.START),
  stop: (
    audioData: ArrayBuffer,
    duration: number,
    courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string },
    userId?: string | null,
    transcription?: string,
    title?: string,
    bookmarks?: Array<{ timestamp: number; label?: string; createdAt: Date }>
  ) => ipcRenderer.invoke(RecordingChannels.STOP, audioData, duration, courseData, userId, transcription, title, bookmarks),
  pause: () => ipcRenderer.invoke(RecordingChannels.PAUSE),
  resume: () => ipcRenderer.invoke(RecordingChannels.RESUME),
  getStatus: () => ipcRenderer.invoke(RecordingChannels.GET_STATUS),
};

export const audioBridge = {
  saveFile: (audioData: number[], fileName: string, folderPath: string) =>
    ipcRenderer.invoke(AudioChannels.SAVE_FILE, audioData, fileName, folderPath),
  getMetadata: (filePath: string) =>
    ipcRenderer.invoke(AudioChannels.GET_METADATA, filePath),
};

export const transcriptionBridge = {
  assemblyai: {
    getToken: (apiKey: string) => ipcRenderer.invoke(TranscriptionChannels.ASSEMBLYAI_GET_TOKEN, apiKey),
    batchTranscribe: (apiKey: string, audioFilePath: string) =>
      ipcRenderer.invoke(TranscriptionChannels.ASSEMBLYAI_BATCH, apiKey, audioFilePath),
  },
};
