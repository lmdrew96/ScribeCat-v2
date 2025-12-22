/**
 * Session IPC Bridge
 *
 * IPC bindings for session CRUD, export, trash, and study set operations
 */

const { ipcRenderer } = require('electron');

import { SessionChannels, ExportChannels } from '../../shared/IpcChannels.js';

interface ExportOptions {
  includeAudio?: boolean;
  includeTranscription?: boolean;
  includeNotes?: boolean;
  includeSummary?: boolean;
  format?: string;
}

export const sessionBridge = {
  // List & query
  list: (sortOrder?: 'asc' | 'desc') =>
    ipcRenderer.invoke(SessionChannels.LIST, sortOrder),
  listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') =>
    ipcRenderer.invoke(SessionChannels.LIST_WITH_TAGS, tags, sortOrder),

  // CRUD operations
  delete: (sessionId: string) =>
    ipcRenderer.invoke(SessionChannels.DELETE, sessionId),
  deleteMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke(SessionChannels.DELETE_MULTIPLE, sessionIds),
  update: (
    sessionId: string,
    updates: {
      title?: string;
      notes?: string;
      tags?: string[];
      courseId?: string;
      courseTitle?: string;
      courseNumber?: string;
    }
  ) => ipcRenderer.invoke(SessionChannels.UPDATE, sessionId, updates),

  // Export
  export: (sessionId: string, format: string, outputPath: string, options?: ExportOptions) =>
    ipcRenderer.invoke(SessionChannels.EXPORT, sessionId, format, outputPath, options),
  exportWithDefaults: (sessionId: string, format: string, outputPath: string) =>
    ipcRenderer.invoke(SessionChannels.EXPORT_WITH_DEFAULTS, sessionId, format, outputPath),
  getAvailableFormats: () =>
    ipcRenderer.invoke(ExportChannels.GET_AVAILABLE_FORMATS),

  // Content updates
  updateTranscription: (
    sessionId: string,
    transcriptionText: string,
    provider?: string,
    timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>
  ) => ipcRenderer.invoke(SessionChannels.UPDATE_TRANSCRIPTION, sessionId, transcriptionText, provider, timestampedEntries),
  updateNotes: (sessionId: string, notes: string) =>
    ipcRenderer.invoke(SessionChannels.UPDATE_NOTES, sessionId, notes),
  updateSummary: (sessionId: string, summary: string) =>
    ipcRenderer.invoke(SessionChannels.UPDATE_SUMMARY, sessionId, summary),

  // Draft & metrics
  createDraft: () =>
    ipcRenderer.invoke(SessionChannels.CREATE_DRAFT),
  addStudyModeTime: (sessionId: string, seconds: number) =>
    ipcRenderer.invoke(SessionChannels.ADD_STUDY_MODE_TIME, sessionId, seconds),
  incrementAIToolUsage: (sessionId: string) =>
    ipcRenderer.invoke(SessionChannels.INCREMENT_AI_TOOL_USAGE, sessionId),
  incrementAIChatMessages: (sessionId: string, count: number) =>
    ipcRenderer.invoke(SessionChannels.INCREMENT_AI_CHAT_MESSAGES, sessionId, count),

  // Trash operations
  getDeleted: (userId?: string) =>
    ipcRenderer.invoke(SessionChannels.GET_DELETED, userId),
  restore: (sessionId: string) =>
    ipcRenderer.invoke(SessionChannels.RESTORE, sessionId),
  restoreMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke(SessionChannels.RESTORE_MULTIPLE, sessionIds),
  permanentlyDelete: (sessionId: string) =>
    ipcRenderer.invoke(SessionChannels.PERMANENTLY_DELETE, sessionId),
  permanentlyDeleteMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke(SessionChannels.PERMANENTLY_DELETE_MULTIPLE, sessionIds),

  // Multi-session study sets
  createMultiSessionStudySet: (sessionIds: string[], title: string) =>
    ipcRenderer.invoke(SessionChannels.CREATE_MULTI_SESSION_STUDY_SET, sessionIds, title),
};
