// src/preload/preload.ts
// Type declarations are in preload.d.ts

const { contextBridge, ipcRenderer } = require('electron');

// Type definitions (inline to avoid ES module import in CommonJS context)
interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

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

interface ExportOptions {
  includeAudio?: boolean;
  includeTranscription?: boolean;
  includeNotes?: boolean;
  includeSummary?: boolean;
  format?: string;
}

interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface GoogleDriveUploadOptions {
  folderId?: string;
  mimeType?: string;
  description?: string;
}

interface CanvasConfig {
  baseUrl: string;
  apiToken: string;
}

interface TranscriptionResult {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface SignInWithEmailParams {
  email: string;
  password: string;
}

interface SignUpWithEmailParams {
  email: string;
  password: string;
  fullName?: string;
}

// Expose the API to the renderer process
const electronAPI = {
  // Generic invoke for any IPC channel (allows flexible IPC calls)
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  dialog: {
    showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    getTempPath: () => ipcRenderer.invoke('dialog:getTempPath'),
    deleteFile: (filePath: string) => ipcRenderer.invoke('dialog:deleteFile', filePath),
    fileExists: (filePath: string) => ipcRenderer.invoke('dialog:fileExists', filePath)
  },
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }, userId?: string | null, transcription?: string, title?: string, bookmarks?: Array<{ timestamp: number; label?: string; createdAt: Date }>) => ipcRenderer.invoke('recording:stop', audioData, duration, courseData, userId, transcription, title, bookmarks),
    pause: () => ipcRenderer.invoke('recording:pause'),
    resume: () => ipcRenderer.invoke('recording:resume'),
    getStatus: () => ipcRenderer.invoke('recording:getStatus')
  },
  audio: {
    saveFile: (audioData: number[], fileName: string, folderPath: string) => 
      ipcRenderer.invoke('audio:save-file', audioData, fileName, folderPath),
    getMetadata: (filePath: string) => 
      ipcRenderer.invoke('audio:get-metadata', filePath)
  },
  transcription: {
    assemblyai: {
      getToken: (apiKey: string) => ipcRenderer.invoke('transcription:assemblyai:getToken', apiKey),
      batchTranscribe: (apiKey: string, audioFilePath: string) =>
        ipcRenderer.invoke('transcription:assemblyai:batch', apiKey, audioFilePath)
    }
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value)
  },
  ai: {
    chat: (message: string, history: ChatMessage[], options?: ChatOptions) =>
      ipcRenderer.invoke('ai:chat', message, history, options),
    chatStream: async (message: string, history: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void) => {
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
    polishTranscription: (text: string, options?: Partial<{ grammar: boolean; punctuation: boolean; clarity: boolean; preserveMeaning: boolean }>) =>
      ipcRenderer.invoke('ai:polishTranscription', text, options),
    generateSummary: (transcription: string, notes?: string, options?: Partial<{ style: string; maxLength: number }>) =>
      ipcRenderer.invoke('ai:generateSummary', transcription, notes, options),
    generateTitle: (transcription: string, notes?: string, options?: Partial<{ maxLength: number; format: string }>) =>
      ipcRenderer.invoke('ai:generateTitle', transcription, notes, options),
    isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    setApiKey: (apiKey: string) => ipcRenderer.invoke('ai:setApiKey', apiKey)
  },
    session: {
      list: (sortOrder?: 'asc' | 'desc') =>
        ipcRenderer.invoke('sessions:list', sortOrder),
      listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') =>
        ipcRenderer.invoke('sessions:listWithTags', tags, sortOrder),
      delete: (sessionId: string) =>
        ipcRenderer.invoke('sessions:delete', sessionId),
      deleteMultiple: (sessionIds: string[]) =>
        ipcRenderer.invoke('sessions:deleteMultiple', sessionIds),
      update: (sessionId: string, updates: {
        title?: string;
        notes?: string;
        tags?: string[];
        courseId?: string;
        courseTitle?: string;
        courseNumber?: string;
      }) =>
        ipcRenderer.invoke('sessions:update', sessionId, updates),
      export: (sessionId: string, format: string, outputPath: string, options?: ExportOptions) =>
        ipcRenderer.invoke('session:export', sessionId, format, outputPath, options),
      exportWithDefaults: (sessionId: string, format: string, outputPath: string) =>
        ipcRenderer.invoke('session:exportWithDefaults', sessionId, format, outputPath),
      updateTranscription: (sessionId: string, transcriptionText: string, provider?: string, timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>) =>
        ipcRenderer.invoke('session:updateTranscription', sessionId, transcriptionText, provider, timestampedEntries),
      updateNotes: (sessionId: string, notes: string) =>
        ipcRenderer.invoke('session:updateNotes', sessionId, notes),
      updateSummary: (sessionId: string, summary: string) =>
        ipcRenderer.invoke('session:updateSummary', sessionId, summary),
      createDraft: () =>
        ipcRenderer.invoke('session:createDraft'),
      addStudyModeTime: (sessionId: string, seconds: number) =>
        ipcRenderer.invoke('session:addStudyModeTime', sessionId, seconds),
      incrementAIToolUsage: (sessionId: string) =>
        ipcRenderer.invoke('session:incrementAIToolUsage', sessionId),
      incrementAIChatMessages: (sessionId: string, count: number) =>
        ipcRenderer.invoke('session:incrementAIChatMessages', sessionId, count),
      getAvailableFormats: () =>
        ipcRenderer.invoke('export:getAvailableFormats'),
      // Trash-related methods
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
      createMultiSessionStudySet: (sessionIds: string[], title: string) =>
        ipcRenderer.invoke('sessions:createMultiSessionStudySet', sessionIds, title)
    },
  drive: {
    configure: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:configure', config),
    isAuthenticated: () => ipcRenderer.invoke('drive:isAuthenticated'),
    getAuthUrl: () => ipcRenderer.invoke('drive:getAuthUrl'),
    exchangeCodeForTokens: (code: string) => ipcRenderer.invoke('drive:exchangeCodeForTokens', code),
    setCredentials: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:setCredentials', config),
    getUserEmail: () => ipcRenderer.invoke('drive:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    disconnectLocal: () => ipcRenderer.invoke('drive:disconnectLocal'),
    uploadFile: (filePath: string, options: GoogleDriveUploadOptions) =>
      ipcRenderer.invoke('drive:uploadFile', filePath, options),
    listFiles: (folderId?: string) =>
      ipcRenderer.invoke('drive:listFiles', folderId),
    createFolder: (name: string, parentId?: string) =>
      ipcRenderer.invoke('drive:createFolder', name, parentId),
    restoreFromCloud: () => ipcRenderer.invoke('drive:restoreFromCloud'),
    onAutoReconnected: (callback: () => void) => {
      ipcRenderer.on('drive:auto-reconnected', () => callback());
    },
    removeAutoReconnectedListener: () => {
      ipcRenderer.removeAllListeners('drive:auto-reconnected');
    }
  },
  canvas: {
    configure: (config: { baseUrl: string; apiToken: string }) =>
      ipcRenderer.invoke('canvas:configure', config),
    testConnection: () => ipcRenderer.invoke('canvas:test-connection'),
    getCourses: () => ipcRenderer.invoke('canvas:get-courses'),
    isConfigured: () => ipcRenderer.invoke('canvas:is-configured'),
    getConfig: () => ipcRenderer.invoke('canvas:get-config'),
    disconnect: () => ipcRenderer.invoke('canvas:disconnect'),
    importCourses: (jsonData: string) => ipcRenderer.invoke('canvas:import-courses', jsonData),
    getImportedCourses: () => ipcRenderer.invoke('canvas:get-imported-courses'),
    deleteImportedCourse: (courseId: string) => ipcRenderer.invoke('canvas:delete-imported-course', courseId)
  },
  auth: {
    signInWithEmail: (params: SignInWithEmailParams) => ipcRenderer.invoke('auth:signInWithEmail', params),
    signUpWithEmail: (params: SignUpWithEmailParams) => ipcRenderer.invoke('auth:signUpWithEmail', params),
    signInWithGoogle: (codeChallenge: string) => ipcRenderer.invoke('auth:signInWithGoogle', codeChallenge),
    // Open OAuth in Electron window with WebAuthn/passkey support
    openOAuthWindow: (authUrl: string) => ipcRenderer.invoke('auth:openOAuthWindow', authUrl),
    // NOTE: OAuth callback is now handled in renderer process using RendererSupabaseClient
    // No IPC method needed - renderer exchanges code directly where localStorage works
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
    checkUsernameAvailability: (username: string) => ipcRenderer.invoke('auth:checkUsernameAvailability', username),
    setUsername: (username: string) => ipcRenderer.invoke('auth:setUsername', username),
    // Note: updateProfile, resetPassword, and deleteAccount are handled directly in renderer
    // via RendererSupabaseClient where the auth session is properly maintained.
    // Send auth state changes to main process for cloud sync
    sessionChanged: (data: { userId: string | null; accessToken?: string; refreshToken?: string }) =>
      ipcRenderer.invoke('auth:sessionChanged', data),
    // OAuth waiting window
    showOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:showWaitingWindow'),
    closeOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:closeWaitingWindow'),
    onOAuthCodeReceived: (callback: (code: string) => void) => {
      ipcRenderer.on('oauth:code-received', (_event: Electron.IpcRendererEvent, code: string) => callback(code));
    },
    onOAuthCancelled: (callback: () => void) => {
      ipcRenderer.on('oauth:cancelled', () => callback());
    },
    removeOAuthListeners: () => {
      ipcRenderer.removeAllListeners('oauth:code-received');
      ipcRenderer.removeAllListeners('oauth:cancelled');
    }
  },
  sync: {
    uploadSession: (sessionId: string) => ipcRenderer.invoke('sync:uploadSession', sessionId),
    getStatus: (sessionId: string) => ipcRenderer.invoke('sync:getStatus', sessionId),
    retrySync: (sessionId: string) => ipcRenderer.invoke('sync:retrySync', sessionId),
    syncAllFromCloud: () => ipcRenderer.invoke('sync:syncAllFromCloud')
  },
  share: {
    checkAccess: (sessionId: string) =>
      ipcRenderer.invoke('share:checkAccess', sessionId),
    create: (params: { sessionId: string; email: string; permissionLevel: 'viewer' | 'editor' }) =>
      ipcRenderer.invoke('share:create', params),
    remove: (params: { shareId?: string; invitationId?: string }) =>
      ipcRenderer.invoke('share:remove', params),
    updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) =>
      ipcRenderer.invoke('share:updatePermission', params),
    getSessionShares: (sessionId: string) =>
      ipcRenderer.invoke('share:getSessionShares', sessionId),
    getSharedWithMe: () =>
      ipcRenderer.invoke('share:getSharedWithMe'),
    acceptInvitation: (token: string) =>
      ipcRenderer.invoke('share:acceptInvitation', token)
  },
  friends: {
    // NOTE: Realtime subscriptions for presence and friend requests are handled
    // directly in FriendsManager via RendererSupabaseClient (WebSockets don't work
    // in Electron's main process)
    getFriends: () =>
      ipcRenderer.invoke('friends:getFriends'),
    getFriendsCount: () =>
      ipcRenderer.invoke('friends:getFriendsCount'),
    removeFriend: (friendId: string) =>
      ipcRenderer.invoke('friends:removeFriend', friendId),
    areFriends: (userId: string) =>
      ipcRenderer.invoke('friends:areFriends', userId),
    getMutualFriendsCount: (userId: string) =>
      ipcRenderer.invoke('friends:getMutualFriendsCount', userId),
    getFriendRequests: () =>
      ipcRenderer.invoke('friends:getFriendRequests'),
    getIncomingRequests: () =>
      ipcRenderer.invoke('friends:getIncomingRequests'),
    getOutgoingRequests: () =>
      ipcRenderer.invoke('friends:getOutgoingRequests'),
    getIncomingRequestsCount: () =>
      ipcRenderer.invoke('friends:getIncomingRequestsCount'),
    sendRequest: (recipientId: string) =>
      ipcRenderer.invoke('friends:sendRequest', recipientId),
    acceptRequest: (requestId: string) =>
      ipcRenderer.invoke('friends:acceptRequest', requestId),
    rejectRequest: (requestId: string) =>
      ipcRenderer.invoke('friends:rejectRequest', requestId),
    cancelRequest: (requestId: string) =>
      ipcRenderer.invoke('friends:cancelRequest', requestId),
    searchUsers: (searchEmail: string, limit?: number) =>
      ipcRenderer.invoke('friends:searchUsers', searchEmail, limit),
    getUserProfile: (userId: string) =>
      ipcRenderer.invoke('friends:getUserProfile', userId),
    // Presence operations
    updatePresence: (params: { userId: string; status: 'online' | 'away' | 'offline'; activity?: string }) =>
      ipcRenderer.invoke('friends:updatePresence', params),
    getUserPresence: (userId: string) =>
      ipcRenderer.invoke('friends:getUserPresence', userId),
    getFriendsPresence: (userId: string) =>
      ipcRenderer.invoke('friends:getFriendsPresence', userId),
    setOffline: (userId: string) =>
      ipcRenderer.invoke('friends:setOffline', userId)
  },
  studyRooms: {
    // Room operations
    createRoom: (params: { name: string; sessionId: string; maxParticipants: number }) =>
      ipcRenderer.invoke('rooms:createRoom', params),
    getUserRooms: () =>
      ipcRenderer.invoke('rooms:getUserRooms'),
    getRejoinableRooms: () =>
      ipcRenderer.invoke('rooms:getRejoinableRooms'),
    getRoomById: (roomId: string) =>
      ipcRenderer.invoke('rooms:getRoomById', roomId),
    closeRoom: (roomId: string) =>
      ipcRenderer.invoke('rooms:closeRoom', roomId),
    updateRoom: (params: { roomId: string; name?: string; maxParticipants?: number }) =>
      ipcRenderer.invoke('rooms:updateRoom', params),
    // Participant operations
    getRoomParticipants: (roomId: string) =>
      ipcRenderer.invoke('rooms:getRoomParticipants', roomId),
    getParticipantCount: (roomId: string) =>
      ipcRenderer.invoke('rooms:getParticipantCount', roomId),
    joinRoom: (roomId: string) =>
      ipcRenderer.invoke('rooms:joinRoom', roomId),
    leaveRoom: (roomId: string) =>
      ipcRenderer.invoke('rooms:leaveRoom', roomId),
    removeParticipant: (params: { roomId: string; participantId: string }) =>
      ipcRenderer.invoke('rooms:removeParticipant', params),
    isUserInRoom: (roomId: string) =>
      ipcRenderer.invoke('rooms:isUserInRoom', roomId),
    // Invitation operations
    sendInvitation: (params: { roomId: string; inviteeId: string }) =>
      ipcRenderer.invoke('rooms:sendInvitation', params),
    getUserInvitations: () =>
      ipcRenderer.invoke('rooms:getUserInvitations'),
    getPendingInvitations: () =>
      ipcRenderer.invoke('rooms:getPendingInvitations'),
    acceptInvitation: (invitationId: string) =>
      ipcRenderer.invoke('rooms:acceptInvitation', invitationId),
    declineInvitation: (invitationId: string) =>
      ipcRenderer.invoke('rooms:declineInvitation', invitationId),
    cancelInvitation: (invitationId: string) =>
      ipcRenderer.invoke('rooms:cancelInvitation', invitationId),
    // Realtime subscriptions
    subscribeToInvitations: async (
      onInvitation: (invitation: any, eventType: 'INSERT' | 'UPDATE') => void
    ) => {
      const invitationHandler = (_event: any, data: { invitation: any; eventType: 'INSERT' | 'UPDATE' }) => {
        console.log('[Preload] Received invitation event:', data);
        onInvitation(data.invitation, data.eventType);
      };

      ipcRenderer.on('rooms:invitationReceived', invitationHandler);

      // Set up the subscription and wait for it to complete
      const result = await ipcRenderer.invoke('rooms:subscribeToInvitations');
      console.log('[Preload] Subscription result:', result);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('rooms:invitationReceived', invitationHandler);
      };
    },
    unsubscribeFromInvitations: () =>
      ipcRenderer.invoke('rooms:unsubscribeFromInvitations')
  },
  chat: {
    // NOTE: Realtime subscriptions are handled directly in ChatManager
    // via RendererSupabaseClient (WebSockets don't work in Electron's main process)
    sendMessage: (params: { roomId: string; userId: string; message: string }) =>
      ipcRenderer.invoke('chat:sendMessage', params),
    getRoomMessages: (roomId: string, limit?: number) =>
      ipcRenderer.invoke('chat:getRoomMessages', roomId, limit),
    deleteMessage: (messageId: string, userId: string) =>
      ipcRenderer.invoke('chat:deleteMessage', messageId, userId)
  },
  messages: {
    // NOTE: Realtime subscriptions are handled directly in MessagesManager
    // via RendererSupabaseClient (WebSockets don't work in Electron's main process)
    send: (params: { recipientId: string; subject?: string; content: string; attachments?: any[] }) =>
      ipcRenderer.invoke('messages:send', params),
    getInbox: (limit?: number) =>
      ipcRenderer.invoke('messages:getInbox', limit),
    getSent: (limit?: number) =>
      ipcRenderer.invoke('messages:getSent', limit),
    getConversation: (params: { otherUserId: string; limit?: number }) =>
      ipcRenderer.invoke('messages:getConversation', params),
    getMessage: (messageId: string) =>
      ipcRenderer.invoke('messages:getMessage', messageId),
    markAsRead: (messageId: string) =>
      ipcRenderer.invoke('messages:markAsRead', messageId),
    markConversationAsRead: (senderId: string) =>
      ipcRenderer.invoke('messages:markConversationAsRead', senderId),
    getUnreadCount: () =>
      ipcRenderer.invoke('messages:getUnreadCount'),
    delete: (messageId: string) =>
      ipcRenderer.invoke('messages:delete', messageId),
    uploadAttachment: (params: { data: ArrayBuffer; name: string; type: string }) =>
      ipcRenderer.invoke('messages:uploadAttachment', params)
  },
  games: {
    createGameSession: (params: { roomId: string; gameType: string; config: any }) =>
      ipcRenderer.invoke('games:create-session', params),
    getGameSession: (gameSessionId: string) =>
      ipcRenderer.invoke('games:get-session', gameSessionId),
    getActiveGameForRoom: (roomId: string) =>
      ipcRenderer.invoke('games:get-active-game', roomId),
    startGame: (gameSessionId: string) =>
      ipcRenderer.invoke('games:start', gameSessionId),
    completeGame: (gameSessionId: string) =>
      ipcRenderer.invoke('games:complete', gameSessionId),
    cancelGame: (gameSessionId: string) =>
      ipcRenderer.invoke('games:cancel', gameSessionId),
    nextQuestion: (gameSessionId: string) =>
      ipcRenderer.invoke('games:next-question', gameSessionId),
    createGameQuestions: (questions: any[]) =>
      ipcRenderer.invoke('games:create-questions', questions),
    getCurrentQuestion: (gameSessionId: string) =>
      ipcRenderer.invoke('games:get-current-question', gameSessionId),
    getGameQuestions: (gameSessionId: string, includeAnswers: boolean) =>
      ipcRenderer.invoke('games:get-questions', gameSessionId, includeAnswers),
    getGameQuestion: (gameSessionId: string, questionId: string) =>
      ipcRenderer.invoke('games:get-question', gameSessionId, questionId),
    getCorrectAnswer: (params: { gameSessionId: string; questionId: string; userId: string }) =>
      ipcRenderer.invoke('games:get-correct-answer', params),
    submitAnswer: (params: { gameSessionId: string; userId: string; questionId: string; answer: string; timeTakenMs: number }) =>
      ipcRenderer.invoke('games:submit-answer', params),
    getGameLeaderboard: (gameSessionId: string) =>
      ipcRenderer.invoke('games:get-leaderboard', gameSessionId),
    getPlayerScores: (gameSessionId: string, userId: string) =>
      ipcRenderer.invoke('games:get-player-scores', gameSessionId, userId),

    // NOTE: Realtime subscriptions are handled directly in the renderer process
    // via RendererSupabaseClient (WebSockets don't work in Electron's main process).
    // See MultiplayerGamesManager.subscribeToGameUpdates() and JeopardyGame.subscribeToBuzzers()

    // Jeopardy-specific methods
    jeopardy: {
      selectQuestion: (params: { gameSessionId: string; questionId: string; userId: string }) =>
        ipcRenderer.invoke('games:jeopardy:select-question', params),
      buzzIn: (params: { gameSessionId: string; questionId: string; userId: string }) =>
        ipcRenderer.invoke('games:jeopardy:buzz-in', params),
      getBuzzers: (questionId: string) =>
        ipcRenderer.invoke('games:jeopardy:get-buzzers', questionId),
      getFirstBuzzer: (questionId: string) =>
        ipcRenderer.invoke('games:jeopardy:get-first-buzzer', questionId),
      getBoard: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:get-board', gameSessionId),
      setCurrentPlayer: (params: { gameSessionId: string; userId: string }) =>
        ipcRenderer.invoke('games:jeopardy:set-current-player', params),
      getLowestScoringPlayer: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:get-lowest-scoring-player', gameSessionId),
      advanceToFinal: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:advance-to-final', gameSessionId),
      isBoardComplete: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:is-board-complete', gameSessionId),
      submitAnswer: (params: {
        gameSessionId: string;
        questionId: string;
        userId: string;
        answer: string;
        isCorrect: boolean;
        buzzerRank: number;
        wagerAmount?: number;
        timeTakenMs?: number;
      }) =>
        ipcRenderer.invoke('games:jeopardy:submit-answer', params),
      skipQuestion: (params: { gameSessionId: string; questionId: string }) =>
        ipcRenderer.invoke('games:jeopardy:skip-question', params),
      clearBuzzers: (questionId: string) =>
        ipcRenderer.invoke('games:jeopardy:clear-buzzers', questionId),
      // Final Jeopardy methods
      submitFJWager: (params: { gameSessionId: string; userId: string; wagerAmount: number }) =>
        ipcRenderer.invoke('games:jeopardy:submit-fj-wager', params),
      allFJWagersSubmitted: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:all-fj-wagers-submitted', gameSessionId),
      getFJWagers: (gameSessionId: string) =>
        ipcRenderer.invoke('games:jeopardy:get-fj-wagers', gameSessionId),
      getPlayerFJWager: (params: { gameSessionId: string; userId: string }) =>
        ipcRenderer.invoke('games:jeopardy:get-player-fj-wager', params),
      allFJAnswersSubmitted: (params: { gameSessionId: string; questionId: string }) =>
        ipcRenderer.invoke('games:jeopardy:all-fj-answers-submitted', params),
      // NOTE: Buzzer and FJ wager subscriptions are handled directly in JeopardyGame
      // via RendererSupabaseClient (WebSockets don't work in Electron's main process)
    }
  },
  power: {
    preventSleep: () => ipcRenderer.invoke('power:preventSleep'),
    allowSleep: () => ipcRenderer.invoke('power:allowSleep'),
    isPreventingSleep: () => ipcRenderer.invoke('power:isPreventingSleep')
  },
  studyQuest: {
    // Character operations
    getClasses: () => ipcRenderer.invoke('studyquest:get-classes'),
    getCharacter: (userId: string) => ipcRenderer.invoke('studyquest:get-character', userId),
    createCharacter: (params: { userId: string; name: string; classId: string }) =>
      ipcRenderer.invoke('studyquest:create-character', params),
    addXp: (params: { userId: string; xp: number }) =>
      ipcRenderer.invoke('studyquest:add-xp', params),
    addGold: (params: { userId: string; gold: number }) =>
      ipcRenderer.invoke('studyquest:add-gold', params),
    healCharacter: (userId: string) => ipcRenderer.invoke('studyquest:heal-character', userId),
    // Inventory operations
    getInventory: (userId: string) => ipcRenderer.invoke('studyquest:get-inventory', userId),
    getEquippedItems: (userId: string) => ipcRenderer.invoke('studyquest:get-equipped-items', userId),
    equipItem: (params: { userId: string; itemId: string }) =>
      ipcRenderer.invoke('studyquest:equip-item', params),
    unequipItem: (params: { userId: string; itemId: string }) =>
      ipcRenderer.invoke('studyquest:unequip-item', params),
    useItem: (params: { userId: string; itemId: string }) =>
      ipcRenderer.invoke('studyquest:use-item', params),
    dropItem: (params: { characterId: string; itemId: string }) =>
      ipcRenderer.invoke('studyquest:drop-item', params),
    // Shop operations
    getShopItems: () => ipcRenderer.invoke('studyquest:get-shop-items'),
    buyItem: (params: { userId: string; itemId: string }) =>
      ipcRenderer.invoke('studyquest:buy-item', params),
    // Dungeon operations
    getDungeons: () => ipcRenderer.invoke('studyquest:get-dungeons'),
    startDungeon: (params: { userId: string; dungeonId: string }) =>
      ipcRenderer.invoke('studyquest:start-dungeon', params),
    getCurrentDungeonRun: (userId: string) => ipcRenderer.invoke('studyquest:get-current-dungeon-run', userId),
    advanceDungeonFloor: (userId: string) => ipcRenderer.invoke('studyquest:advance-dungeon-floor', userId),
    completeDungeon: (userId: string) => ipcRenderer.invoke('studyquest:complete-dungeon', userId),
    fleeDungeon: (userId: string) => ipcRenderer.invoke('studyquest:flee-dungeon', userId),
    // Battle operations
    startBattle: (params: { userId: string; enemy: any }) =>
      ipcRenderer.invoke('studyquest:start-battle', params),
    getCurrentBattle: (userId: string) => ipcRenderer.invoke('studyquest:get-current-battle', userId),
    battleAction: (params: { userId: string; action: string; itemId?: string }) =>
      ipcRenderer.invoke('studyquest:battle-action', params),
    // Quest operations
    getActiveQuests: (userId: string) => ipcRenderer.invoke('studyquest:get-active-quests', userId),
    completeQuest: (params: { userId: string; questId: string }) =>
      ipcRenderer.invoke('studyquest:complete-quest', params),
    // Leaderboard
    getLeaderboard: (limit?: number) => ipcRenderer.invoke('studyquest:get-leaderboard', limit),
    // Study rewards
    awardStudyRewards: (params: { userId: string; studyTimeMinutes: number; aiToolsUsed: number; aiChatsUsed: number; sessionCompleted: boolean }) =>
      ipcRenderer.invoke('studyquest:award-study-rewards', params)
  },
  dev: {
    onHotReloadNotification: (callback: (message: string) => void) => {
      ipcRenderer.on('dev:hot-reload-notification', (_event: Electron.IpcRendererEvent, message: string) => callback(message));
    },
    removeHotReloadListener: () => {
      ipcRenderer.removeAllListeners('dev:hot-reload-notification');
    }
  },
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
