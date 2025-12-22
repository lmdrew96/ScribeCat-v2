/**
 * Games IPC Bridge
 *
 * IPC bindings for multiplayer games (Quiz Battle, Jeopardy, etc.)
 *
 * NOTE: Realtime game state subscriptions are handled directly in renderer
 * via RendererSupabaseClient since WebSockets don't work in Electron's main process.
 */

const { ipcRenderer } = require('electron');

export const gamesBridge = {
  // Game session management
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

  // Questions
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

  // Answers & scoring
  submitAnswer: (params: {
    gameSessionId: string;
    userId: string;
    questionId: string;
    answer: string;
    timeTakenMs: number;
  }) => ipcRenderer.invoke('games:submit-answer', params),
  getGameLeaderboard: (gameSessionId: string) =>
    ipcRenderer.invoke('games:get-leaderboard', gameSessionId),
  getPlayerScores: (gameSessionId: string, userId: string) =>
    ipcRenderer.invoke('games:get-player-scores', gameSessionId, userId),

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
    }) => ipcRenderer.invoke('games:jeopardy:submit-answer', params),
    skipQuestion: (params: { gameSessionId: string; questionId: string }) =>
      ipcRenderer.invoke('games:jeopardy:skip-question', params),
    clearBuzzers: (questionId: string) =>
      ipcRenderer.invoke('games:jeopardy:clear-buzzers', questionId),
    // Final Jeopardy
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
  },
};
