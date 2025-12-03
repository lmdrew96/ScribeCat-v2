/**
 * JeopardyTypes
 *
 * Shared types and interfaces for the Jeopardy game component.
 */

import { GameState } from '../MultiplayerGame.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';

export interface JeopardyBoardCell {
  questionId: string;
  category: string;
  points: number;
  columnPosition: number;
  isSelected: boolean;
  isDailyDouble: boolean;
}

export interface BuzzerPress {
  userId: string;
  buzzerRank: number;
  pressedAt: Date;
}

export interface FJAnswer {
  answer: string;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface JeopardyGameState extends GameState {
  // Board state
  board: JeopardyBoardCell[] | null;

  // Turn state
  currentPlayerId: string | null;
  selectedQuestionId: string | null;

  // Buzzer state
  buzzerEnabled: boolean;
  buzzers: BuzzerPress[];
  firstBuzzerId: string | null;
  myBuzzerRank: number | null;

  // Answer feedback state
  showingAnswerFeedback: boolean;
  lastAnswerCorrect: boolean | null;
  lastAnswerUserId: string | null;
  feedbackQuestion: GameQuestion | null;
  playersWhoAnsweredWrong: Set<string>;

  // Round state
  round: 'regular' | 'final_jeopardy';
  wagerAmount: number | null;
  showingDailyDoubleWager: boolean;
  showingFinalJeopardyWager: boolean;

  // Final Jeopardy state
  fjPhase: 'wager' | 'question' | 'results' | null;
  fjWagers: Map<string, number>;
  fjMyWagerSubmitted: boolean;
  fjTimer: number | null;
  fjAnswers: Map<string, FJAnswer>;
  fjMyAnswerSubmitted: boolean;
}

/**
 * Create initial Jeopardy-specific state from base game state
 */
export function createInitialJeopardyState(baseState: GameState): Partial<JeopardyGameState> {
  return {
    board: null,
    currentPlayerId: baseState.session.currentPlayerId || null,
    selectedQuestionId: baseState.session.selectedQuestionId || null,
    buzzerEnabled: false,
    buzzers: [],
    firstBuzzerId: null,
    myBuzzerRank: null,
    showingAnswerFeedback: false,
    lastAnswerCorrect: null,
    lastAnswerUserId: null,
    feedbackQuestion: null,
    playersWhoAnsweredWrong: new Set<string>(),
    round: baseState.session.round || 'regular',
    wagerAmount: null,
    showingDailyDoubleWager: false,
    showingFinalJeopardyWager: false,
    fjPhase: null,
    fjWagers: new Map<string, number>(),
    fjMyWagerSubmitted: false,
    fjTimer: null,
    fjAnswers: new Map<string, FJAnswer>(),
    fjMyAnswerSubmitted: false,
  };
}
