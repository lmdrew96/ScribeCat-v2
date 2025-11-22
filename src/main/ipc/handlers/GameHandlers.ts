/**
 * Game IPC Handlers
 * Handles IPC communication for multiplayer games
 */

import { ipcMain } from 'electron';
import { SupabaseGamesRepository } from '../../../infrastructure/services/supabase/SupabaseGamesRepository.js';

const gamesRepo = new SupabaseGamesRepository();

// Store unsubscribe functions for cleanup
const subscriptions = new Map<string, () => Promise<void>>();

/**
 * Register all game-related IPC handlers
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
    console.log('[DEBUG GameHandlers] submitAnswer params:', params);
    console.log('[DEBUG GameHandlers] timeTakenMs:', params.timeTakenMs);
    try {
      const score = await gamesRepo.submitAnswer(params);
      console.log('[DEBUG GameHandlers] Score created:', score.toJSON());
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
  // Real-time Subscription Handlers
  // ============================================================================

  ipcMain.handle('games:subscribe-session', (event, gameSessionId: string) => {
    try {
      const subscriptionKey = `session:${gameSessionId}`;

      // Clean up existing subscription if any
      const existing = subscriptions.get(subscriptionKey);
      if (existing) {
        existing().catch(console.error);
      }

      const unsubscribe = gamesRepo.subscribeToGameSession(gameSessionId, (gameSession) => {
        event.sender.send(`games:session-update:${gameSessionId}`, gameSession.toJSON());
      });

      subscriptions.set(subscriptionKey, unsubscribe);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to subscribe to game session:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:subscribe-questions', (event, gameSessionId: string) => {
    try {
      const subscriptionKey = `questions:${gameSessionId}`;

      // Clean up existing subscription if any
      const existing = subscriptions.get(subscriptionKey);
      if (existing) {
        existing().catch(console.error);
      }

      const unsubscribe = gamesRepo.subscribeToGameQuestions(gameSessionId, (question) => {
        event.sender.send(`games:question-update:${gameSessionId}`, question.toClientJSON(false));
      });

      subscriptions.set(subscriptionKey, unsubscribe);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to subscribe to game questions:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:subscribe-scores', (event, gameSessionId: string) => {
    try {
      const subscriptionKey = `scores:${gameSessionId}`;

      // Clean up existing subscription if any
      const existing = subscriptions.get(subscriptionKey);
      if (existing) {
        existing().catch(console.error);
      }

      const unsubscribe = gamesRepo.subscribeToGameScores(gameSessionId, (score) => {
        event.sender.send(`games:score-update:${gameSessionId}`, score.toJSON());
      });

      subscriptions.set(subscriptionKey, unsubscribe);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to subscribe to game scores:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:subscribe-room-games', (event, roomId: string) => {
    try {
      const subscriptionKey = `room-games:${roomId}`;

      // Clean up existing subscription if any
      const existing = subscriptions.get(subscriptionKey);
      if (existing) {
        existing().catch(console.error);
      }

      const unsubscribe = gamesRepo.subscribeToRoomGames(roomId, (gameSession) => {
        event.sender.send(`games:room-game-update:${roomId}`, gameSession?.toJSON());
      });

      subscriptions.set(subscriptionKey, unsubscribe);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to subscribe to room games:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('games:unsubscribe-all', async () => {
    try {
      // Unsubscribe all stored subscriptions
      for (const [key, unsubscribe] of subscriptions.entries()) {
        await unsubscribe().catch(console.error);
      }
      subscriptions.clear();

      // Also unsubscribe at repository level
      await gamesRepo.unsubscribeAll();
      return { success: true };
    } catch (error: any) {
      console.error('Failed to unsubscribe from games:', error);
      return { success: false, error: error.message };
    }
  });
}
