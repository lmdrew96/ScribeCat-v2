/**
 * IPC Channel Constants
 *
 * Centralized constants for all IPC communication channels between
 * main and renderer processes. This prevents typos and makes refactoring easier.
 */

export const IPC_CHANNELS = {
  // Dialog
  DIALOG_SHOW_SAVE: 'dialog:showSaveDialog',

  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',
  RECORDING_GET_STATUS: 'recording:getStatus',

  // Audio
  AUDIO_SAVE_FILE: 'audio:save-file',
  AUDIO_GET_METADATA: 'audio:get-metadata',

  // Transcription
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_SIMULATION_START: 'transcription:simulation:start',
  TRANSCRIPTION_SIMULATION_STOP: 'transcription:simulation:stop',
  TRANSCRIPTION_SIMULATION_PAUSE: 'transcription:simulation:pause',
  TRANSCRIPTION_SIMULATION_RESUME: 'transcription:simulation:resume',
  TRANSCRIPTION_ASSEMBLYAI_GET_TOKEN: 'transcription:assemblyai:getToken',

  // Settings
  SETTINGS_GET_SIMULATION_MODE: 'settings:get-simulation-mode',
  SETTINGS_SET_SIMULATION_MODE: 'settings:set-simulation-mode',

  // Store
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',

  // AI
  AI_CHAT: 'ai:chat',
  AI_CHAT_STREAM: 'ai:chatStream',
  AI_CHAT_CHUNK: 'ai:chatChunk',
  AI_POLISH_TRANSCRIPTION: 'ai:polishTranscription',
  AI_GENERATE_SUMMARY: 'ai:generateSummary',
  AI_GENERATE_TITLE: 'ai:generateTitle',
  AI_IS_CONFIGURED: 'ai:isConfigured',
  AI_TEST_CONNECTION: 'ai:testConnection',
  AI_SET_API_KEY: 'ai:setApiKey',

  // Sessions
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_LIST_WITH_TAGS: 'sessions:listWithTags',
  SESSIONS_DELETE: 'sessions:delete',
  SESSIONS_DELETE_MULTIPLE: 'sessions:deleteMultiple',
  SESSIONS_UPDATE: 'sessions:update',
  SESSION_EXPORT: 'session:export',
  SESSION_EXPORT_WITH_DEFAULTS: 'session:exportWithDefaults',
  SESSION_UPDATE_TRANSCRIPTION: 'session:updateTranscription',
  SESSION_UPDATE_NOTES: 'session:updateNotes',
  SESSION_CREATE_DRAFT: 'session:createDraft',
  EXPORT_GET_AVAILABLE_FORMATS: 'export:getAvailableFormats',

  // Google Drive
  DRIVE_CONFIGURE: 'drive:configure',
  DRIVE_IS_AUTHENTICATED: 'drive:isAuthenticated',
  DRIVE_GET_AUTH_URL: 'drive:getAuthUrl',
  DRIVE_EXCHANGE_CODE_FOR_TOKENS: 'drive:exchangeCodeForTokens',
  DRIVE_SET_CREDENTIALS: 'drive:setCredentials',
  DRIVE_GET_USER_EMAIL: 'drive:getUserEmail',
  DRIVE_DISCONNECT: 'drive:disconnect',
  DRIVE_UPLOAD_FILE: 'drive:uploadFile',
  DRIVE_LIST_FILES: 'drive:listFiles',
  DRIVE_CREATE_FOLDER: 'drive:createFolder',

  // Canvas LMS
  CANVAS_CONFIGURE: 'canvas:configure',
  CANVAS_TEST_CONNECTION: 'canvas:test-connection',
  CANVAS_GET_COURSES: 'canvas:get-courses',
  CANVAS_IS_CONFIGURED: 'canvas:is-configured',
  CANVAS_GET_CONFIG: 'canvas:get-config',
  CANVAS_DISCONNECT: 'canvas:disconnect',
  CANVAS_IMPORT_COURSES: 'canvas:import-courses',
  CANVAS_GET_IMPORTED_COURSES: 'canvas:get-imported-courses',
  CANVAS_DELETE_IMPORTED_COURSE: 'canvas:delete-imported-course',

  // Dev
  DEV_HOT_RELOAD_NOTIFICATION: 'dev:hot-reload-notification',
} as const;

// Type for all channel names
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
