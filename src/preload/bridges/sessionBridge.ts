/**
 * Session IPC Bridge
 *
 * IPC bindings for session CRUD, export, trash, and study set operations
 */

const { ipcRenderer } = require('electron');

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
    ipcRenderer.invoke('sessions:list', sortOrder),
  listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') =>
    ipcRenderer.invoke('sessions:listWithTags', tags, sortOrder),

  // CRUD operations
  delete: (sessionId: string) =>
    ipcRenderer.invoke('sessions:delete', sessionId),
  deleteMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke('sessions:deleteMultiple', sessionIds),
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
  ) => ipcRenderer.invoke('sessions:update', sessionId, updates),

  // Export
  export: (sessionId: string, format: string, outputPath: string, options?: ExportOptions) =>
    ipcRenderer.invoke('session:export', sessionId, format, outputPath, options),
  exportWithDefaults: (sessionId: string, format: string, outputPath: string) =>
    ipcRenderer.invoke('session:exportWithDefaults', sessionId, format, outputPath),
  getAvailableFormats: () =>
    ipcRenderer.invoke('export:getAvailableFormats'),

  // Content updates
  updateTranscription: (
    sessionId: string,
    transcriptionText: string,
    provider?: string,
    timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>
  ) => ipcRenderer.invoke('session:updateTranscription', sessionId, transcriptionText, provider, timestampedEntries),
  updateNotes: (sessionId: string, notes: string) =>
    ipcRenderer.invoke('session:updateNotes', sessionId, notes),
  updateSummary: (sessionId: string, summary: string) =>
    ipcRenderer.invoke('session:updateSummary', sessionId, summary),

  // Draft & metrics
  createDraft: () =>
    ipcRenderer.invoke('session:createDraft'),
  addStudyModeTime: (sessionId: string, seconds: number) =>
    ipcRenderer.invoke('session:addStudyModeTime', sessionId, seconds),
  incrementAIToolUsage: (sessionId: string) =>
    ipcRenderer.invoke('session:incrementAIToolUsage', sessionId),
  incrementAIChatMessages: (sessionId: string, count: number) =>
    ipcRenderer.invoke('session:incrementAIChatMessages', sessionId, count),

  // Trash operations
  getDeleted: (userId?: string) =>
    ipcRenderer.invoke('sessions:getDeleted', userId),
  restore: (sessionId: string) =>
    ipcRenderer.invoke('sessions:restore', sessionId),
  restoreMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke('sessions:restoreMultiple', sessionIds),
  permanentlyDelete: (sessionId: string) =>
    ipcRenderer.invoke('sessions:permanentlyDelete', sessionId),
  permanentlyDeleteMultiple: (sessionIds: string[]) =>
    ipcRenderer.invoke('sessions:permanentlyDeleteMultiple', sessionIds),

  // Multi-session study sets
  createMultiSessionStudySet: (sessionIds: string[], title: string) =>
    ipcRenderer.invoke('sessions:createMultiSessionStudySet', sessionIds, title),
};
