/**
 * IpcChannels - Centralized IPC Channel Constants
 *
 * Single source of truth for all IPC channel names used between
 * main process and renderer (via preload).
 *
 * Naming convention: DOMAIN_ACTION or DOMAIN_SUBDOMAIN_ACTION
 * Channel format: 'domain:action' or 'domain:subdomain:action'
 */

// ============================================================================
// APP & SYSTEM
// ============================================================================

export const AppChannels = {
  GET_VERSION: 'app:getVersion',
} as const;

export const ShellChannels = {
  OPEN_EXTERNAL: 'shell:openExternal',
} as const;

export const DialogChannels = {
  SHOW_SAVE_DIALOG: 'dialog:showSaveDialog',
  GET_TEMP_PATH: 'dialog:getTempPath',
  DELETE_FILE: 'dialog:deleteFile',
  FILE_EXISTS: 'dialog:fileExists',
} as const;

export const StoreChannels = {
  GET: 'store:get',
  SET: 'store:set',
} as const;

export const PowerChannels = {
  PREVENT_SLEEP: 'power:preventSleep',
  ALLOW_SLEEP: 'power:allowSleep',
  IS_PREVENTING_SLEEP: 'power:isPreventingSleep',
} as const;

// ============================================================================
// RECORDING & AUDIO
// ============================================================================

export const RecordingChannels = {
  START: 'recording:start',
  STOP: 'recording:stop',
  PAUSE: 'recording:pause',
  RESUME: 'recording:resume',
  GET_STATUS: 'recording:getStatus',
} as const;

export const AudioChannels = {
  SAVE_FILE: 'audio:save-file',
  GET_METADATA: 'audio:get-metadata',
} as const;

export const TranscriptionChannels = {
  ASSEMBLYAI_GET_TOKEN: 'transcription:assemblyai:getToken',
  ASSEMBLYAI_BATCH: 'transcription:assemblyai:batch',
} as const;

// ============================================================================
// AI
// ============================================================================

export const AIChannels = {
  CHAT: 'ai:chat',
  CHAT_STREAM: 'ai:chatStream',
  CHAT_CHUNK: 'ai:chatChunk',
  POLISH_TRANSCRIPTION: 'ai:polishTranscription',
  GENERATE_SUMMARY: 'ai:generateSummary',
  GENERATE_TITLE: 'ai:generateTitle',
  SET_API_KEY: 'ai:setApiKey',
  IS_CONFIGURED: 'ai:isConfigured',
  TEST_CONNECTION: 'ai:testConnection',
} as const;

// ============================================================================
// SESSIONS
// ============================================================================

export const SessionChannels = {
  // Single session operations
  CREATE_DRAFT: 'session:createDraft',
  LOAD: 'session:load',
  LOAD_ALL: 'session:loadAll',
  UPDATE_NOTES: 'session:updateNotes',
  UPDATE_SUMMARY: 'session:updateSummary',
  UPDATE_TRANSCRIPTION: 'session:updateTranscription',
  ADD_STUDY_MODE_TIME: 'session:addStudyModeTime',
  INCREMENT_AI_CHAT_MESSAGES: 'session:incrementAIChatMessages',
  INCREMENT_AI_TOOL_USAGE: 'session:incrementAIToolUsage',
  EXPORT: 'session:export',
  EXPORT_WITH_DEFAULTS: 'session:exportWithDefaults',

  // Multiple sessions operations
  LIST: 'sessions:list',
  LIST_WITH_TAGS: 'sessions:listWithTags',
  UPDATE: 'sessions:update',
  DELETE: 'sessions:delete',
  DELETE_MULTIPLE: 'sessions:deleteMultiple',
  GET_DELETED: 'sessions:getDeleted',
  RESTORE: 'sessions:restore',
  RESTORE_MULTIPLE: 'sessions:restoreMultiple',
  PERMANENTLY_DELETE: 'sessions:permanentlyDelete',
  PERMANENTLY_DELETE_MULTIPLE: 'sessions:permanentlyDeleteMultiple',
  CREATE_MULTI_SESSION_STUDY_SET: 'sessions:createMultiSessionStudySet',
} as const;

// ============================================================================
// AUTH
// ============================================================================

export const AuthChannels = {
  SIGN_IN_WITH_EMAIL: 'auth:signInWithEmail',
  SIGN_UP_WITH_EMAIL: 'auth:signUpWithEmail',
  SIGN_IN_WITH_GOOGLE: 'auth:signInWithGoogle',
  SIGN_OUT: 'auth:signOut',
  GET_CURRENT_USER: 'auth:getCurrentUser',
  IS_AUTHENTICATED: 'auth:isAuthenticated',
  GET_ACCESS_TOKEN: 'auth:getAccessToken',
  SESSION_CHANGED: 'auth:sessionChanged',
  CHECK_USERNAME_AVAILABILITY: 'auth:checkUsernameAvailability',
  SET_USERNAME: 'auth:setUsername',
  OPEN_OAUTH_WINDOW: 'auth:openOAuthWindow',
} as const;

export const OAuthChannels = {
  SHOW_WAITING_WINDOW: 'oauth:showWaitingWindow',
  CLOSE_WAITING_WINDOW: 'oauth:closeWaitingWindow',
  SUBMIT_CODE: 'oauth:submit-code',
  CODE_RECEIVED: 'oauth:code-received',
  CANCEL: 'oauth:cancel',
  CANCELLED: 'oauth:cancelled',
} as const;

// ============================================================================
// SYNC & CLOUD
// ============================================================================

export const SyncChannels = {
  GET_STATUS: 'sync:getStatus',
  UPLOAD_SESSION: 'sync:uploadSession',
  SYNC_ALL_FROM_CLOUD: 'sync:syncAllFromCloud',
  RETRY_SYNC: 'sync:retrySync',
} as const;

export const DriveChannels = {
  CONFIGURE: 'drive:configure',
  DISCONNECT: 'drive:disconnect',
  DISCONNECT_LOCAL: 'drive:disconnectLocal',
  IS_AUTHENTICATED: 'drive:isAuthenticated',
  GET_AUTH_URL: 'drive:getAuthUrl',
  EXCHANGE_CODE_FOR_TOKENS: 'drive:exchangeCodeForTokens',
  SET_CREDENTIALS: 'drive:setCredentials',
  GET_USER_EMAIL: 'drive:getUserEmail',
  LIST_FILES: 'drive:listFiles',
  CREATE_FOLDER: 'drive:createFolder',
  UPLOAD_FILE: 'drive:uploadFile',
  RESTORE_FROM_CLOUD: 'drive:restoreFromCloud',
  AUTO_RECONNECTED: 'drive:auto-reconnected',
} as const;

export const CanvasChannels = {
  CONFIGURE: 'canvas:configure',
  DISCONNECT: 'canvas:disconnect',
  IS_CONFIGURED: 'canvas:is-configured',
  GET_CONFIG: 'canvas:get-config',
  TEST_CONNECTION: 'canvas:test-connection',
  GET_COURSES: 'canvas:get-courses',
  IMPORT_COURSES: 'canvas:import-courses',
  GET_IMPORTED_COURSES: 'canvas:get-imported-courses',
  DELETE_IMPORTED_COURSE: 'canvas:delete-imported-course',
} as const;

// ============================================================================
// SHARING
// ============================================================================

export const ShareChannels = {
  CREATE: 'share:create',
  REMOVE: 'share:remove',
  UPDATE_PERMISSION: 'share:updatePermission',
  GET_SESSION_SHARES: 'share:getSessionShares',
  GET_SHARED_WITH_ME: 'share:getSharedWithMe',
  CHECK_ACCESS: 'share:checkAccess',
  ACCEPT_INVITATION: 'share:acceptInvitation',
} as const;

// ============================================================================
// EXPORT
// ============================================================================

export const ExportChannels = {
  GET_AVAILABLE_FORMATS: 'export:getAvailableFormats',
} as const;

// ============================================================================
// SOCIAL: FRIENDS
// ============================================================================

export const FriendsChannels = {
  SEARCH_USERS: 'friends:searchUsers',
  SEND_REQUEST: 'friends:sendRequest',
  ACCEPT_REQUEST: 'friends:acceptRequest',
  REJECT_REQUEST: 'friends:rejectRequest',
  CANCEL_REQUEST: 'friends:cancelRequest',
  REMOVE_FRIEND: 'friends:removeFriend',
  GET_FRIENDS: 'friends:getFriends',
  GET_FRIENDS_COUNT: 'friends:getFriendsCount',
  GET_FRIEND_REQUESTS: 'friends:getFriendRequests',
  GET_INCOMING_REQUESTS: 'friends:getIncomingRequests',
  GET_INCOMING_REQUESTS_COUNT: 'friends:getIncomingRequestsCount',
  GET_OUTGOING_REQUESTS: 'friends:getOutgoingRequests',
  GET_MUTUAL_FRIENDS_COUNT: 'friends:getMutualFriendsCount',
  ARE_FRIENDS: 'friends:areFriends',
  GET_USER_PROFILE: 'friends:getUserProfile',
  UPDATE_PRESENCE: 'friends:updatePresence',
  SET_OFFLINE: 'friends:setOffline',
  GET_USER_PRESENCE: 'friends:getUserPresence',
  GET_FRIENDS_PRESENCE: 'friends:getFriendsPresence',
} as const;

// ============================================================================
// SOCIAL: STUDY ROOMS
// ============================================================================

export const RoomsChannels = {
  CREATE_ROOM: 'rooms:createRoom',
  GET_USER_ROOMS: 'rooms:getUserRooms',
  GET_ROOM_BY_ID: 'rooms:getRoomById',
  UPDATE_ROOM: 'rooms:updateRoom',
  CLOSE_ROOM: 'rooms:closeRoom',
  JOIN_ROOM: 'rooms:joinRoom',
  LEAVE_ROOM: 'rooms:leaveRoom',
  IS_USER_IN_ROOM: 'rooms:isUserInRoom',
  GET_ROOM_PARTICIPANTS: 'rooms:getRoomParticipants',
  GET_PARTICIPANT_COUNT: 'rooms:getParticipantCount',
  REMOVE_PARTICIPANT: 'rooms:removeParticipant',
  GET_REJOINABLE_ROOMS: 'rooms:getRejoinableRooms',
  SEND_INVITATION: 'rooms:sendInvitation',
  CANCEL_INVITATION: 'rooms:cancelInvitation',
  ACCEPT_INVITATION: 'rooms:acceptInvitation',
  DECLINE_INVITATION: 'rooms:declineInvitation',
  GET_USER_INVITATIONS: 'rooms:getUserInvitations',
  GET_PENDING_INVITATIONS: 'rooms:getPendingInvitations',
} as const;

// ============================================================================
// SOCIAL: CHAT
// ============================================================================

export const ChatChannels = {
  SEND_MESSAGE: 'chat:sendMessage',
  GET_ROOM_MESSAGES: 'chat:getRoomMessages',
  DELETE_MESSAGE: 'chat:deleteMessage',
} as const;

// ============================================================================
// SOCIAL: MESSAGES (DMs)
// ============================================================================

export const MessagesChannels = {
  SEND: 'messages:send',
  GET_INBOX: 'messages:getInbox',
  GET_SENT: 'messages:getSent',
  GET_MESSAGE: 'messages:getMessage',
  GET_CONVERSATION: 'messages:getConversation',
  MARK_AS_READ: 'messages:markAsRead',
  MARK_CONVERSATION_AS_READ: 'messages:markConversationAsRead',
  GET_UNREAD_COUNT: 'messages:getUnreadCount',
  DELETE: 'messages:delete',
  UPLOAD_ATTACHMENT: 'messages:uploadAttachment',
} as const;

// ============================================================================
// GAMES (Multiplayer)
// ============================================================================

export const GamesChannels = {
  CREATE_SESSION: 'games:create-session',
  GET_SESSION: 'games:get-session',
  GET_ACTIVE_GAME: 'games:get-active-game',
  START: 'games:start',
  COMPLETE: 'games:complete',
  CANCEL: 'games:cancel',
  NEXT_QUESTION: 'games:next-question',
  CREATE_QUESTIONS: 'games:create-questions',
  GET_CURRENT_QUESTION: 'games:get-current-question',
  GET_QUESTIONS: 'games:get-questions',
  GET_QUESTION: 'games:get-question',
  GET_CORRECT_ANSWER: 'games:get-correct-answer',
  SUBMIT_ANSWER: 'games:submit-answer',
  GET_LEADERBOARD: 'games:get-leaderboard',
  GET_PLAYER_SCORES: 'games:get-player-scores',
} as const;

export const GamesJeopardyChannels = {
  SELECT_QUESTION: 'games:jeopardy:select-question',
  BUZZ_IN: 'games:jeopardy:buzz-in',
  GET_BUZZERS: 'games:jeopardy:get-buzzers',
  GET_FIRST_BUZZER: 'games:jeopardy:get-first-buzzer',
  CLEAR_BUZZERS: 'games:jeopardy:clear-buzzers',
  GET_BOARD: 'games:jeopardy:get-board',
  SET_CURRENT_PLAYER: 'games:jeopardy:set-current-player',
  GET_LOWEST_SCORING_PLAYER: 'games:jeopardy:get-lowest-scoring-player',
  ADVANCE_TO_FINAL: 'games:jeopardy:advance-to-final',
  IS_BOARD_COMPLETE: 'games:jeopardy:is-board-complete',
  SUBMIT_ANSWER: 'games:jeopardy:submit-answer',
  SKIP_QUESTION: 'games:jeopardy:skip-question',
  SUBMIT_FJ_WAGER: 'games:jeopardy:submit-fj-wager',
  ALL_FJ_WAGERS_SUBMITTED: 'games:jeopardy:all-fj-wagers-submitted',
  GET_FJ_WAGERS: 'games:jeopardy:get-fj-wagers',
  GET_PLAYER_FJ_WAGER: 'games:jeopardy:get-player-fj-wager',
  ALL_FJ_ANSWERS_SUBMITTED: 'games:jeopardy:all-fj-answers-submitted',
} as const;

// ============================================================================
// STUDYQUEST (RPG Game)
// ============================================================================

export const StudyQuestChannels = {
  // Character
  GET_CLASSES: 'studyquest:get-classes',
  GET_CHARACTER: 'studyquest:get-character',
  CREATE_CHARACTER: 'studyquest:create-character',
  DELETE_CHARACTER: 'studyquest:delete-character',
  DELETE_CHARACTER_BY_USER: 'studyquest:delete-character-by-user',
  HEAL_CHARACTER: 'studyquest:heal-character',
  HEAL_DIRECT: 'studyquest:heal-direct',
  TAKE_DAMAGE: 'studyquest:take-damage',
  ADD_XP: 'studyquest:add-xp',
  ADD_GOLD: 'studyquest:add-gold',
  AWARD_STUDY_REWARDS: 'studyquest:award-study-rewards',

  // Inventory & Items
  GET_INVENTORY: 'studyquest:get-inventory',
  GET_EQUIPPED_ITEMS: 'studyquest:get-equipped-items',
  EQUIP_ITEM: 'studyquest:equip-item',
  UNEQUIP_ITEM: 'studyquest:unequip-item',
  USE_ITEM: 'studyquest:use-item',
  DROP_ITEM: 'studyquest:drop-item',
  GET_SHOP_ITEMS: 'studyquest:get-shop-items',
  BUY_ITEM: 'studyquest:buy-item',

  // Dungeons
  GET_DUNGEONS: 'studyquest:get-dungeons',
  START_DUNGEON: 'studyquest:start-dungeon',
  GET_CURRENT_DUNGEON_RUN: 'studyquest:get-current-dungeon-run',
  ADVANCE_DUNGEON_FLOOR: 'studyquest:advance-dungeon-floor',
  FLEE_DUNGEON: 'studyquest:flee-dungeon',
  ABANDON_DUNGEON: 'studyquest:abandon-dungeon',
  COMPLETE_DUNGEON: 'studyquest:complete-dungeon',

  // Battles
  START_BATTLE: 'studyquest:start-battle',
  GET_CURRENT_BATTLE: 'studyquest:get-current-battle',
  GET_BATTLE: 'studyquest:get-battle',
  BATTLE_ACTION: 'studyquest:battle-action',
  GET_BATTLE_STATS: 'studyquest:get-battle-stats',

  // Quests
  GET_QUESTS: 'studyquest:get-quests',
  GET_ACTIVE_QUESTS: 'studyquest:get-active-quests',
  COMPLETE_QUEST: 'studyquest:complete-quest',
  RESET_DAILY_QUESTS: 'studyquest:reset-daily-quests',
  RESET_WEEKLY_QUESTS: 'studyquest:reset-weekly-quests',

  // Leaderboard
  GET_LEADERBOARD: 'studyquest:get-leaderboard',
  GET_RANK: 'studyquest:get-rank',
} as const;

// ============================================================================
// DEV TOOLS
// ============================================================================

export const DevChannels = {
  HOT_RELOAD_NOTIFICATION: 'dev:hot-reload-notification',
} as const;

// ============================================================================
// TYPE HELPERS
// ============================================================================

/** All IPC channel string values */
export type IpcChannel =
  | (typeof AppChannels)[keyof typeof AppChannels]
  | (typeof ShellChannels)[keyof typeof ShellChannels]
  | (typeof DialogChannels)[keyof typeof DialogChannels]
  | (typeof StoreChannels)[keyof typeof StoreChannels]
  | (typeof PowerChannels)[keyof typeof PowerChannels]
  | (typeof RecordingChannels)[keyof typeof RecordingChannels]
  | (typeof AudioChannels)[keyof typeof AudioChannels]
  | (typeof TranscriptionChannels)[keyof typeof TranscriptionChannels]
  | (typeof AIChannels)[keyof typeof AIChannels]
  | (typeof SessionChannels)[keyof typeof SessionChannels]
  | (typeof AuthChannels)[keyof typeof AuthChannels]
  | (typeof OAuthChannels)[keyof typeof OAuthChannels]
  | (typeof SyncChannels)[keyof typeof SyncChannels]
  | (typeof DriveChannels)[keyof typeof DriveChannels]
  | (typeof CanvasChannels)[keyof typeof CanvasChannels]
  | (typeof ShareChannels)[keyof typeof ShareChannels]
  | (typeof ExportChannels)[keyof typeof ExportChannels]
  | (typeof FriendsChannels)[keyof typeof FriendsChannels]
  | (typeof RoomsChannels)[keyof typeof RoomsChannels]
  | (typeof ChatChannels)[keyof typeof ChatChannels]
  | (typeof MessagesChannels)[keyof typeof MessagesChannels]
  | (typeof GamesChannels)[keyof typeof GamesChannels]
  | (typeof GamesJeopardyChannels)[keyof typeof GamesJeopardyChannels]
  | (typeof StudyQuestChannels)[keyof typeof StudyQuestChannels]
  | (typeof DevChannels)[keyof typeof DevChannels];
