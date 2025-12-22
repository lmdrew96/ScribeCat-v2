/**
 * Preload Bridge Index
 *
 * Assembles all IPC bridge modules into the unified electronAPI object
 * that gets exposed to the renderer process via contextBridge.
 */

// System bridges
export { appBridge, shellBridge, dialogBridge, storeBridge, powerBridge } from './systemBridge.js';

// Recording & media bridges
export { recordingBridge, audioBridge, transcriptionBridge } from './recordingBridge.js';

// AI bridge
export { aiBridge } from './aiBridge.js';

// Session bridge
export { sessionBridge } from './sessionBridge.js';

// Auth bridge
export { authBridge } from './authBridge.js';

// Cloud & integrations bridges
export { syncBridge, driveBridge, canvasBridge } from './cloudBridge.js';

// Social bridges
export { friendsBridge, studyRoomsBridge, chatBridge, messagesBridge, shareBridge } from './socialBridge.js';

// Games bridge
export { gamesBridge } from './gamesBridge.js';

// StudyQuest bridge
export { studyQuestBridge } from './studyQuestBridge.js';

// Dev tools bridge
export { devBridge } from './devBridge.js';
