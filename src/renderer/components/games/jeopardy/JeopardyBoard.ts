/**
 * JeopardyBoard
 *
 * Handles Jeopardy board rendering and question selection.
 */

import type { JeopardyGameState, JeopardyBoardCell } from './JeopardyTypes.js';

export class JeopardyBoard {
  /**
   * Load the Jeopardy board from the backend
   */
  static async loadBoard(gameSessionId: string): Promise<JeopardyBoardCell[] | null> {
    console.log('[JeopardyBoard] loadBoard() - Fetching board for game:', gameSessionId);
    const result = await (window as any).scribeCat.games.jeopardy.getBoard(gameSessionId);
    console.log('[JeopardyBoard] loadBoard() - Result:', result);

    if (result.success && result.board) {
      console.log('[JeopardyBoard] loadBoard() - Loaded', result.board.length, 'questions');
      return result.board;
    }

    console.error('[JeopardyBoard] loadBoard() - Failed to load board or board is empty');
    return null;
  }

  /**
   * Handle question selection from board
   */
  static async selectQuestion(
    gameSessionId: string,
    questionId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log('[JeopardyBoard] selectQuestion() called with questionId:', questionId);

    const result = await (window as any).scribeCat.games.jeopardy.selectQuestion({
      gameSessionId,
      questionId,
      userId,
    });

    console.log('[JeopardyBoard] selectQuestion API result:', result);

    if (result.success) {
      console.log('[JeopardyBoard] Question selected successfully:', questionId);
    } else {
      console.error('[JeopardyBoard] Failed to select question:', result.error);
    }

    return result;
  }

  /**
   * Render the Jeopardy board view
   */
  static renderBoardView(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { board, currentPlayerId, participants } = state;

    if (!board || board.length === 0) {
      return '<div class="game-loading">Loading Jeopardy board...</div>';
    }

    // Group questions by category
    const categories: Record<string, JeopardyBoardCell[]> = {};
    for (const question of board) {
      if (!categories[question.category]) {
        categories[question.category] = [];
      }
      categories[question.category].push(question);
    }

    // Sort questions within each category by points
    for (const category in categories) {
      categories[category].sort((a, b) => a.points - b.points);
    }

    // Ensure exactly 6 categories for standard Jeopardy board
    const REQUIRED_CATEGORIES = 6;
    let categoryNames = Object.keys(categories);

    // If fewer than 6 categories, pad with empty placeholders
    while (categoryNames.length < REQUIRED_CATEGORIES) {
      const emptyCategory = `Category ${categoryNames.length + 1}`;
      categories[emptyCategory] = [];
      categoryNames.push(emptyCategory);
    }

    // If more than 6, take only first 6
    categoryNames = categoryNames.slice(0, REQUIRED_CATEGORIES);
    const currentPlayer = participants.find(p => p.userId === currentPlayerId);
    const isMyTurn = currentPlayer?.isCurrentUser ?? false;

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="jeopardy-board-container">
          <div class="jeopardy-turn-indicator">
            ${isMyTurn
              ? '<span class="your-turn">Your turn! Select a question.</span>'
              : `<span class="waiting-turn">Waiting for ${escapeHtml(currentPlayer?.userFullName || currentPlayer?.userEmail || 'player')} to select...</span>`
            }
          </div>

          <div class="jeopardy-board">
            <!-- Category headers -->
            <div class="jeopardy-categories">
              ${categoryNames.map(cat => `
                <div class="jeopardy-category-header">
                  ${escapeHtml(cat)}
                </div>
              `).join('')}
            </div>

            <!-- Question grid -->
            <div class="jeopardy-grid">
              ${JeopardyBoard.renderQuestionGrid(categories, categoryNames, isMyTurn)}
            </div>
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render question grid
   */
  static renderQuestionGrid(
    categories: Record<string, JeopardyBoardCell[]>,
    categoryNames: string[],
    isMyTurn: boolean
  ): string {
    const QUESTIONS_PER_CATEGORY = 5; // Standard Jeopardy has 5 rows

    let gridHtml = '';

    for (let row = 0; row < QUESTIONS_PER_CATEGORY; row++) {
      for (const category of categoryNames) {
        const question = categories[category][row];

        if (question) {
          const isAnswered = question.isSelected;
          const canSelect = isMyTurn && !isAnswered;

          gridHtml += `
            <button
              class="jeopardy-question-cell ${isAnswered ? 'answered' : ''} ${canSelect ? 'selectable' : ''}"
              data-question-id="${question.questionId}"
              ${canSelect ? '' : 'disabled'}
            >
              ${isAnswered ? '' : `$${question.points}`}
            </button>
          `;
        } else {
          gridHtml += '<div class="jeopardy-question-cell empty"></div>';
        }
      }
    }

    return gridHtml;
  }

  /**
   * Attach event listeners for board selection
   */
  static attachBoardListeners(
    container: HTMLElement,
    onQuestionSelect: (questionId: string) => void,
    attachExitListeners: () => void
  ): void {
    const questionCells = container.querySelectorAll('.jeopardy-question-cell.selectable');
    questionCells.forEach(cell => {
      cell.addEventListener('click', () => {
        const questionId = cell.getAttribute('data-question-id');
        if (questionId) {
          onQuestionSelect(questionId);
        }
      });
    });

    attachExitListeners();
  }
}
