/**
 * Game IPC Handlers
 * Handles IPC communication for multiplayer games
 */

import { ipcMain } from 'electron';
import { SupabaseGamesRepository } from '../../../infrastructure/services/supabase/SupabaseGamesRepository.js';

const gamesRepo = new SupabaseGamesRepository();

/**
 * Register all game-related IPC handlers
 *
 * NOTE: Realtime subscriptions for games are handled directly in the renderer process
 * via RendererSupabaseClient (WebSockets don't work in Electron's main process).
 * See MultiplayerGamesManager.subscribeToGameUpdates() and JeopardyGame.subscribeToBuzzers()
 */
export function registerGameHandlers(): void {
  // ============================================================================
  // Game Session Handlers
  // ============================================================================

  ipcMain.handle('games:create-session', async (event, params) => {
    try {
      const gameSession = await gamesRepo.createGameSession(params);
      return { success: true, gameSession: gameSession.toJSON() };
    } catch (error: any) {
      console.error('Failed to create game session:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-session', async (event, gameSessionId: string) => {
    try {
      const gameSession = await gamesRepo.getGameSession(gameSessionId);
      return { success: true, gameSession: gameSession?.toJSON() };
    } catch (error: any) {
      console.error('Failed to get game session:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-active-game', async (event, roomId: string) => {
    try {
      const gameSession = await gamesRepo.getActiveGameForRoom(roomId);
      return { success: true, gameSession: gameSession?.toJSON() };
    } catch (error: any) {
      console.error('Failed to get active game:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:start', async (event, gameSessionId: string) => {
    try {
      const gameSession = await gamesRepo.startGame(gameSessionId);
      return { success: true, gameSession: gameSession.toJSON() };
    } catch (error: any) {
      console.error('Failed to start game:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:complete', async (event, gameSessionId: string) => {
    try {
      const gameSession = await gamesRepo.completeGame(gameSessionId);
      return { success: true, gameSession: gameSession.toJSON() };
    } catch (error: any) {
      console.error('Failed to complete game:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:cancel', async (event, gameSessionId: string) => {
    try {
      const gameSession = await gamesRepo.cancelGame(gameSessionId);
      return { success: true, gameSession: gameSession.toJSON() };
    } catch (error: any) {
      console.error('Failed to cancel game:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:next-question', async (event, gameSessionId: string) => {
    try {
      const gameSession = await gamesRepo.nextQuestion(gameSessionId);
      return { success: true, gameSession: gameSession.toJSON() };
    } catch (error: any) {
      console.error('Failed to move to next question:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Question Handlers
  // ============================================================================

  ipcMain.handle('games:create-questions', async (event, questions: any[]) => {
    try {
      const createdQuestions = await gamesRepo.createGameQuestions(questions);
      return {
        success: true,
        questions: createdQuestions.map((q) => q.toJSON()),
      };
    } catch (error: any) {
      console.error('Failed to create questions:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-current-question', async (event, gameSessionId: string) => {
    try {
      const question = await gamesRepo.getCurrentQuestion(gameSessionId);
      return { success: true, question: question?.toClientJSON(false) };
    } catch (error: any) {
      console.error('Failed to get current question:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-questions', async (event, gameSessionId: string, includeAnswers: boolean) => {
    try {
      const questions = await gamesRepo.getGameQuestions(gameSessionId, includeAnswers);
      return {
        success: true,
        questions: questions.map((q) => q.toClientJSON(includeAnswers)),
      };
    } catch (error: any) {
      console.error('Failed to get questions:', error);
      return { success: false, error: error.message };
    }
  });

  // Get a specific game question by ID
  ipcMain.handle('games:get-question', async (event, gameSessionId: string, questionId: string) => {
    try {
      const question = await gamesRepo.getGameQuestion(questionId, true);
      return {
        success: true,
        question: question ? question.toClientJSON(true) : null,
      };
    } catch (error: any) {
      console.error('Failed to get game question:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-correct-answer', async (event, params: { gameSessionId: string; questionId: string; userId: string }) => {
    try {
      const result = await gamesRepo.getCorrectAnswer(params.gameSessionId, params.questionId, params.userId);
      return { success: true, result };
    } catch (error: any) {
      console.error('Failed to get correct answer:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Score Handlers
  // ============================================================================

  ipcMain.handle('games:submit-answer', async (event, params) => {
    try {
      const score = await gamesRepo.submitAnswer(params);
      return { success: true, score: score.toJSON() };
    } catch (error: any) {
      console.error('Failed to submit answer:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-leaderboard', async (event, gameSessionId: string) => {
    try {
      const leaderboard = await gamesRepo.getGameLeaderboard(gameSessionId);
      return { success: true, leaderboard };
    } catch (error: any) {
      console.error('Failed to get leaderboard:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:get-player-scores', async (event, gameSessionId: string, userId: string) => {
    try {
      const scores = await gamesRepo.getPlayerScores(gameSessionId, userId);
      return { success: true, scores: scores.map((s) => s.toJSON()) };
    } catch (error: any) {
      console.error('Failed to get player scores:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Jeopardy-Specific Handlers
  // ============================================================================

  ipcMain.handle('games:jeopardy:select-question', async (event, params: { gameSessionId: string; questionId: string; userId: string }) => {
    try {
      const success = await gamesRepo.selectJeopardyQuestion(params.gameSessionId, params.questionId, params.userId);
      return { success, gameSessionId: params.gameSessionId, questionId: params.questionId };
    } catch (error: any) {
      console.error('Failed to select Jeopardy question:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:buzz-in', async (event, params: { gameSessionId: string; questionId: string; userId: string }) => {
    try {
      const buzzerRank = await gamesRepo.recordBuzzerPress(params.gameSessionId, params.questionId, params.userId);
      return { success: true, buzzerRank };
    } catch (error: any) {
      console.error('Failed to record buzzer press:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-buzzers', async (event, questionId: string) => {
    try {
      const buzzers = await gamesRepo.getQuestionBuzzers(questionId);
      return { success: true, buzzers };
    } catch (error: any) {
      console.error('Failed to get question buzzers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-first-buzzer', async (event, questionId: string) => {
    try {
      const userId = await gamesRepo.getFirstBuzzer(questionId);
      return { success: true, userId };
    } catch (error: any) {
      console.error('Failed to get first buzzer:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-board', async (event, gameSessionId: string) => {
    try {
      const board = await gamesRepo.getJeopardyBoard(gameSessionId);
      return { success: true, board };
    } catch (error: any) {
      console.error('Failed to get Jeopardy board:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:set-current-player', async (event, params: { gameSessionId: string; userId: string }) => {
    try {
      await gamesRepo.setCurrentJeopardyPlayer(params.gameSessionId, params.userId);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to set current Jeopardy player:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-lowest-scoring-player', async (event, gameSessionId: string) => {
    try {
      const userId = await gamesRepo.getLowestScoringPlayer(gameSessionId);
      return { success: true, userId };
    } catch (error: any) {
      console.error('Failed to get lowest scoring player:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:advance-to-final', async (event, gameSessionId: string) => {
    try {
      await gamesRepo.advanceToFinalJeopardy(gameSessionId);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to advance to Final Jeopardy:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:is-board-complete', async (event, gameSessionId: string) => {
    try {
      const isComplete = await gamesRepo.isJeopardyBoardComplete(gameSessionId);
      return { success: true, isComplete };
    } catch (error: any) {
      console.error('Failed to check if board is complete:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:submit-answer', async (event, params) => {
    try {
      const pointsEarned = await gamesRepo.submitJeopardyAnswer(params);
      return { success: true, pointsEarned };
    } catch (error: any) {
      console.error('Failed to submit Jeopardy answer:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:skip-question', async (event, params) => {
    try {
      await gamesRepo.skipJeopardyQuestion(params);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to skip Jeopardy question:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:clear-buzzers', async (event, questionId: string) => {
    try {
      await gamesRepo.clearBuzzerPresses(questionId);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to clear buzzer presses:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Final Jeopardy Handlers
  // ============================================================================

  ipcMain.handle('games:jeopardy:submit-fj-wager', async (event, params: { gameSessionId: string; userId: string; wagerAmount: number }) => {
    try {
      const success = await gamesRepo.submitFinalJeopardyWager(params.gameSessionId, params.userId, params.wagerAmount);
      return { success };
    } catch (error: any) {
      console.error('Failed to submit FJ wager:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:all-fj-wagers-submitted', async (event, gameSessionId: string) => {
    try {
      const allSubmitted = await gamesRepo.allFinalJeopardyWagersSubmitted(gameSessionId);
      return { success: true, allSubmitted };
    } catch (error: any) {
      console.error('Failed to check FJ wagers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-fj-wagers', async (event, gameSessionId: string) => {
    try {
      const wagers = await gamesRepo.getFinalJeopardyWagers(gameSessionId);
      return { success: true, wagers };
    } catch (error: any) {
      console.error('Failed to get FJ wagers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:get-player-fj-wager', async (event, params: { gameSessionId: string; userId: string }) => {
    try {
      const wager = await gamesRepo.getPlayerFinalJeopardyWager(params.gameSessionId, params.userId);
      return { success: true, wager };
    } catch (error: any) {
      console.error('Failed to get player FJ wager:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:jeopardy:all-fj-answers-submitted', async (event, params: { gameSessionId: string; questionId: string }) => {
    try {
      const allSubmitted = await gamesRepo.allFinalJeopardyAnswersSubmitted(params.gameSessionId, params.questionId);
      return { success: true, allSubmitted };
    } catch (error: any) {
      console.error('Failed to check FJ answers:', error);
      return { success: false, error: error.message };
    }
  });
}
