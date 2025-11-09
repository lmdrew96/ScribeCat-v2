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
    logger.info(`Initialized AI tools for session: ${session.id}, type: ${session.type}, isMultiSession: ${session.isMultiSessionStudySet ? session.isMultiSessionStudySet() : 'N/A'}`);
  }

  /**
   * Attach event handlers for AI study tools
   */
  private attachStudyToolHandlers(session: Session): void {
    if (!this.studyContentArea) return;

    // Row 1: Content Analysis Tools
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

    // Weak Spots Detector button
    const weakSpotsBtn = document.getElementById('weak-spots-btn');
    weakSpotsBtn?.addEventListener('click', () => {
      this.generateWeakSpots(session);
    });

    // Row 2: Active Learning Tools
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

    // Learn Mode button
    const learnModeBtn = document.getElementById('learn-mode-btn');
    learnModeBtn?.addEventListener('click', () => {
      this.generateLearnMode(session);
    });

    // Row 3: Advanced Tools
    // ELI5 Explainer button
    const eli5Btn = document.getElementById('eli5-explainer-btn');
    eli5Btn?.addEventListener('click', () => {
      this.generateELI5Explainer(session);
    });

    // Concept Map button
    const conceptMapBtn = document.getElementById('concept-map-btn');
    conceptMapBtn?.addEventListener('click', () => {
      this.generateConceptMap(session);
    });

    // Study Plan button
    const studyPlanBtn = document.getElementById('study-plan-btn');
    studyPlanBtn?.addEventListener('click', () => {
      this.generateStudyPlan(session);
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

  /**
   * Generate weak spots analysis
   */
  private generateWeakSpots(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateWeakSpots(session, this.studyContentArea);
    logger.info('Generating weak spots analysis for session');
  }

  /**
   * Generate learn mode
   */
  private generateLearnMode(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateLearnMode(session, this.studyContentArea);
    logger.info('Generating learn mode for session');
  }

  /**
   * Generate ELI5 explainer
   */
  private generateELI5Explainer(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateELI5Explainer(session, this.studyContentArea);
    logger.info('Generating ELI5 explainer for session');
  }

  /**
   * Generate concept map
   */
  private generateConceptMap(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateConceptMap(session, this.studyContentArea);
    logger.info('Generating concept map for session');
  }

  /**
   * Generate study plan
   */
  private generateStudyPlan(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateStudyPlan(session, this.studyContentArea);
    logger.info('Generating study plan for session');
  }
}
