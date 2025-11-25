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
    stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }, userId?: string | null, transcription?: string, title?: string) => ipcRenderer.invoke('recording:stop', audioData, duration, courseData, userId, transcription, title),
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
    subscribeToPresence: (userId: string) =>
      ipcRenderer.invoke('friends:subscribeToPresence', userId),
    unsubscribeFromPresence: (userId: string) =>
      ipcRenderer.invoke('friends:unsubscribeFromPresence', userId),
    setOffline: (userId: string) =>
      ipcRenderer.invoke('friends:setOffline', userId),
    onPresenceUpdate: (callback: (data: {
      friendId: string;
      presence: {
        status: 'online' | 'away' | 'offline';
        activity?: string;
        lastSeen: string;
      }
    }) => void) => {
      ipcRenderer.on('friends:presenceUpdate', (_event: any, data: any) => callback(data));
    },
    // Friend request realtime subscriptions
    subscribeToRequests: async (
      onRequest: (friendRequest: any, eventType: 'INSERT' | 'UPDATE') => void
    ) => {
      const requestHandler = (_event: any, data: { friendRequest: any; eventType: 'INSERT' | 'UPDATE' }) => {
        console.log('[Preload] Received friend request event:', data);
        onRequest(data.friendRequest, data.eventType);
      };

      ipcRenderer.on('friends:requestReceived', requestHandler);

      // Set up the subscription and wait for it to complete
      const result = await ipcRenderer.invoke('friends:subscribeToRequests');
      console.log('[Preload] Friend request subscription result:', result);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('friends:requestReceived', requestHandler);
      };
    },
    unsubscribeFromRequests: () =>
      ipcRenderer.invoke('friends:unsubscribeFromRequests')
  },
  studyRooms: {
    // Room operations
    createRoom: (params: { name: string; sessionId: string; maxParticipants: number }) =>
      ipcRenderer.invoke('rooms:createRoom', params),
    getUserRooms: () =>
      ipcRenderer.invoke('rooms:getUserRooms'),
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
    sendMessage: (params: { roomId: string; userId: string; message: string }) =>
      ipcRenderer.invoke('chat:sendMessage', params),
    getRoomMessages: (roomId: string, limit?: number) =>
      ipcRenderer.invoke('chat:getRoomMessages', roomId, limit),
    deleteMessage: (messageId: string, userId: string) =>
      ipcRenderer.invoke('chat:deleteMessage', messageId, userId),
    subscribeToRoom: (
      roomId: string,
      onMessage: (messageData: any) => void,
      onTyping?: (userId: string, userName: string, isTyping: boolean) => void
    ) => {
      const messageHandler = (_event: Electron.IpcRendererEvent, data: { roomId: string; message: any }) => {
        if (data.roomId === roomId) {
          onMessage(data.message);
        }
      };

      const typingHandler = (_event: Electron.IpcRendererEvent, data: {
        roomId: string;
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => {
        if (data.roomId === roomId && onTyping) {
          onTyping(data.userId, data.userName, data.isTyping);
        }
      };

      ipcRenderer.on('chat:newMessage', messageHandler);
      if (onTyping) {
        ipcRenderer.on('chat:typingStatus', typingHandler);
      }

      // Subscribe to room (fire-and-forget, but log errors)
      ipcRenderer.invoke('chat:subscribeToRoom', roomId)
        .then((result: any) => {
          if (!result?.success) {
            console.error('[Preload] Chat subscription failed:', result?.error);
          } else {
            console.log('[Preload] Chat subscription successful for room:', roomId);
          }
        })
        .catch((error: Error) => {
          console.error('[Preload] Chat subscription error:', error);
        });

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('chat:newMessage', messageHandler);
        ipcRenderer.removeListener('chat:typingStatus', typingHandler);
      };
    },
    broadcastTyping: (roomId: string, userId: string, userName: string, isTyping: boolean) =>
      ipcRenderer.invoke('chat:broadcastTyping', { roomId, userId, userName, isTyping }),
    unsubscribeAll: () =>
      ipcRenderer.invoke('chat:unsubscribeAll')
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
    subscribeToGameSession: (gameSessionId: string, onUpdate: (sessionData: any) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        onUpdate(data);
      };
      ipcRenderer.on(`games:session-update:${gameSessionId}`, handler);
      ipcRenderer.invoke('games:subscribe-session', gameSessionId);
      return () => {
        ipcRenderer.removeListener(`games:session-update:${gameSessionId}`, handler);
      };
    },
    subscribeToGameQuestions: (gameSessionId: string, onQuestion: (questionData: any) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        onQuestion(data);
      };
      ipcRenderer.on(`games:question-update:${gameSessionId}`, handler);
      ipcRenderer.invoke('games:subscribe-questions', gameSessionId);
      return () => {
        ipcRenderer.removeListener(`games:question-update:${gameSessionId}`, handler);
      };
    },
    subscribeToGameScores: (gameSessionId: string, onScore: (scoreData: any) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        onScore(data);
      };
      ipcRenderer.on(`games:score-update:${gameSessionId}`, handler);
      ipcRenderer.invoke('games:subscribe-scores', gameSessionId);
      return () => {
        ipcRenderer.removeListener(`games:score-update:${gameSessionId}`, handler);
      };
    },
    subscribeToRoomGames: (roomId: string, onGameSession: (sessionData: any) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        onGameSession(data);
      };
      ipcRenderer.on(`games:room-game-update:${roomId}`, handler);
      ipcRenderer.invoke('games:subscribe-room-games', roomId);
      return () => {
        ipcRenderer.removeListener(`games:room-game-update:${roomId}`, handler);
      };
    },
    unsubscribeAll: () =>
      ipcRenderer.invoke('games:unsubscribe-all'),

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
      subscribeToBuzzers: (questionId: string, onBuzzer: (buzzer: any) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: any) => {
          onBuzzer(data);
        };
        ipcRenderer.on(`games:buzzer-press:${questionId}`, handler);
        ipcRenderer.invoke('games:jeopardy:subscribe-buzzers', questionId);
        return () => {
          ipcRenderer.removeListener(`games:buzzer-press:${questionId}`, handler);
        };
      },
    }
  },
  power: {
    preventSleep: () => ipcRenderer.invoke('power:preventSleep'),
    allowSleep: () => ipcRenderer.invoke('power:allowSleep'),
    isPreventingSleep: () => ipcRenderer.invoke('power:isPreventingSleep')
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
