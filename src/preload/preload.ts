// src/preload/preload.ts
// Type declarations are in preload.d.ts
//
// This file uses modular bridge imports from ./bridges/
// Each bridge handles a specific domain (recording, AI, sessions, etc.)

const { contextBridge, ipcRenderer } = require('electron');

// Import bridge modules
// Note: Using require for CommonJS compatibility in preload context
const { appBridge, shellBridge, dialogBridge, storeBridge, powerBridge } = require('./bridges/systemBridge');
const { recordingBridge, audioBridge, transcriptionBridge } = require('./bridges/recordingBridge');
const { aiBridge } = require('./bridges/aiBridge');
const { sessionBridge } = require('./bridges/sessionBridge');
const { authBridge } = require('./bridges/authBridge');
const { syncBridge, driveBridge, canvasBridge } = require('./bridges/cloudBridge');
const { friendsBridge, studyRoomsBridge, chatBridge, messagesBridge, shareBridge } = require('./bridges/socialBridge');
const { gamesBridge } = require('./bridges/gamesBridge');
const { studyQuestBridge } = require('./bridges/studyQuestBridge');
const { devBridge } = require('./bridges/devBridge');

// Expose the API to the renderer process
const electronAPI = {
  // Generic invoke for any IPC channel (allows flexible IPC calls)
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  // System
  app: appBridge,
  shell: shellBridge,
  dialog: dialogBridge,
  store: storeBridge,
  power: powerBridge,

  // Recording & Media
  recording: recordingBridge,
  audio: audioBridge,
  transcription: transcriptionBridge,

  // AI
  ai: aiBridge,

  // Sessions
  session: sessionBridge,

  // Auth
  auth: authBridge,

  // Cloud & Integrations
  sync: syncBridge,
  drive: driveBridge,
  canvas: canvasBridge,

  // Social
  friends: friendsBridge,
  studyRooms: studyRoomsBridge,
  chat: chatBridge,
  messages: messagesBridge,
  share: shareBridge,

  // Games
  games: gamesBridge,

  // StudyQuest RPG
  studyQuest: studyQuestBridge,

  // Dev tools
  dev: devBridge,
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
