/**
 * Games IPC Bridge
 *
 * IPC bindings for multiplayer games (Quiz Battle, Jeopardy, etc.)
 *
 * NOTE: Realtime game state subscriptions are handled directly in renderer
 * via RendererSupabaseClient since WebSockets don't work in Electron's main process.
 */

const { ipcRenderer } = require('electron');
import { GamesChannels, GamesJeopardyChannels } from '../../shared/IpcChannels.js';
import type { GameConfig } from '../../domain/entities/GameSession.js';
import type { CreateGameQuestionParams } from '../../domain/repositories/IGameRepository.js';

export const gamesBridge = {
  // Game session management
  createGameSession: (params: { roomId: string; gameType: string; config: GameConfig }) =>
    ipcRenderer.invoke(GamesChannels.CREATE_SESSION, params),
  getGameSession: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_SESSION, gameSessionId),
  getActiveGameForRoom: (roomId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_ACTIVE_GAME, roomId),
  startGame: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.START, gameSessionId),
  completeGame: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.COMPLETE, gameSessionId),
  cancelGame: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.CANCEL, gameSessionId),

  // Questions
  nextQuestion: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.NEXT_QUESTION, gameSessionId),
  createGameQuestions: (questions: CreateGameQuestionParams[]) =>
    ipcRenderer.invoke(GamesChannels.CREATE_QUESTIONS, questions),
  getCurrentQuestion: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_CURRENT_QUESTION, gameSessionId),
  getGameQuestions: (gameSessionId: string, includeAnswers: boolean) =>
    ipcRenderer.invoke(GamesChannels.GET_QUESTIONS, gameSessionId, includeAnswers),
  getGameQuestion: (gameSessionId: string, questionId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_QUESTION, gameSessionId, questionId),
  getCorrectAnswer: (params: { gameSessionId: string; questionId: string; userId: string }) =>
    ipcRenderer.invoke(GamesChannels.GET_CORRECT_ANSWER, params),

  // Answers & scoring
  submitAnswer: (params: {
    gameSessionId: string;
    userId: string;
    questionId: string;
    answer: string;
    timeTakenMs: number;
  }) => ipcRenderer.invoke(GamesChannels.SUBMIT_ANSWER, params),
  getGameLeaderboard: (gameSessionId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_LEADERBOARD, gameSessionId),
  getPlayerScores: (gameSessionId: string, userId: string) =>
    ipcRenderer.invoke(GamesChannels.GET_PLAYER_SCORES, gameSessionId, userId),

  // Jeopardy-specific methods
  jeopardy: {
    selectQuestion: (params: { gameSessionId: string; questionId: string; userId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.SELECT_QUESTION, params),
    buzzIn: (params: { gameSessionId: string; questionId: string; userId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.BUZZ_IN, params),
    getBuzzers: (questionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_BUZZERS, questionId),
    getFirstBuzzer: (questionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_FIRST_BUZZER, questionId),
    getBoard: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_BOARD, gameSessionId),
    setCurrentPlayer: (params: { gameSessionId: string; userId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.SET_CURRENT_PLAYER, params),
    getLowestScoringPlayer: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_LOWEST_SCORING_PLAYER, gameSessionId),
    advanceToFinal: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.ADVANCE_TO_FINAL, gameSessionId),
    isBoardComplete: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.IS_BOARD_COMPLETE, gameSessionId),
    submitAnswer: (params: {
      gameSessionId: string;
      questionId: string;
      userId: string;
      answer: string;
      isCorrect: boolean;
      buzzerRank: number;
      wagerAmount?: number;
      timeTakenMs?: number;
    }) => ipcRenderer.invoke(GamesJeopardyChannels.SUBMIT_ANSWER, params),
    skipQuestion: (params: { gameSessionId: string; questionId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.SKIP_QUESTION, params),
    clearBuzzers: (questionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.CLEAR_BUZZERS, questionId),
    // Final Jeopardy
    submitFJWager: (params: { gameSessionId: string; userId: string; wagerAmount: number }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.SUBMIT_FJ_WAGER, params),
    allFJWagersSubmitted: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.ALL_FJ_WAGERS_SUBMITTED, gameSessionId),
    getFJWagers: (gameSessionId: string) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_FJ_WAGERS, gameSessionId),
    getPlayerFJWager: (params: { gameSessionId: string; userId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.GET_PLAYER_FJ_WAGER, params),
    allFJAnswersSubmitted: (params: { gameSessionId: string; questionId: string }) =>
      ipcRenderer.invoke(GamesJeopardyChannels.ALL_FJ_ANSWERS_SUBMITTED, params),
  },
};
