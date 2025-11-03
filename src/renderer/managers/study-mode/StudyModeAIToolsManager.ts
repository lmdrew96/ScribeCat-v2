/**
 * StudyModeAIToolsManager
 *
 * Handles AI study tools integration (summary, concepts, flashcards, quiz).
 */

import type { Session } from '../../../domain/entities/Session.js';
import { AISummaryManager } from '../../services/AISummaryManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeAIToolsManager');

export class StudyModeAIToolsManager {
  private aiSummaryManager: AISummaryManager;
  private studyContentArea: HTMLElement | null = null;

  constructor(aiSummaryManager: AISummaryManager) {
    this.aiSummaryManager = aiSummaryManager;
  }

  /**
   * Initialize AI tools for a session
   */
  initialize(session: Session): void {
    this.studyContentArea = document.getElementById('study-content-area');
    if (!this.studyContentArea) {
      logger.warn('Study content area not found');
      return;
    }

    this.attachStudyToolHandlers(session);
    logger.info(`Initialized AI tools for session: ${session.id}`);
  }

  /**
   * Attach event handlers for AI study tools
   */
  private attachStudyToolHandlers(session: Session): void {
    if (!this.studyContentArea) return;

    // Generate Summary button
    const summaryBtn = document.getElementById('generate-summary-btn');
    summaryBtn?.addEventListener('click', () => {
      this.generateSummary(session);
    });

    // Extract Key Concepts button
    const conceptsBtn = document.getElementById('extract-concepts-btn');
    conceptsBtn?.addEventListener('click', () => {
      this.extractKeyConcepts(session);
    });

    // Generate Flashcards button
    const flashcardsBtn = document.getElementById('generate-flashcards-btn');
    flashcardsBtn?.addEventListener('click', () => {
      this.generateFlashcards(session);
    });

    // Generate Quiz button
    const quizBtn = document.getElementById('generate-quiz-btn');
    quizBtn?.addEventListener('click', () => {
      this.generateQuiz(session);
    });
  }

  /**
   * Generate summary
   */
  private generateSummary(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateSummary(session, this.studyContentArea);
    logger.info('Generating summary for session');
  }

  /**
   * Extract key concepts
   */
  private extractKeyConcepts(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.extractKeyConcepts(session, this.studyContentArea);
    logger.info('Extracting key concepts for session');
  }

  /**
   * Generate flashcards
   */
  private generateFlashcards(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateFlashcards(session, this.studyContentArea);
    logger.info('Generating flashcards for session');
  }

  /**
   * Generate quiz
   */
  private generateQuiz(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateQuiz(session, this.studyContentArea);
    logger.info('Generating quiz for session');
  }
}
