/**
 * AISummaryManager
 *
 * Coordinates AI-powered study tools for sessions.
 * Delegates to specialized generators for each study tool.
 */

import type { Session } from '../../domain/entities/Session.js';
import { SummaryGenerator } from './ai-study-tools/generators/SummaryGenerator.js';
import { ConceptGenerator } from './ai-study-tools/generators/ConceptGenerator.js';
import { FlashcardGenerator } from './ai-study-tools/generators/FlashcardGenerator.js';
import { QuizGenerator } from './ai-study-tools/generators/QuizGenerator.js';
import { WeakSpotsGenerator } from './ai-study-tools/generators/WeakSpotsGenerator.js';
import { StudyPlanGenerator } from './ai-study-tools/generators/StudyPlanGenerator.js';
import { ELI5Generator } from './ai-study-tools/generators/ELI5Generator.js';

export class AISummaryManager {
  /**
   * Generate and save a short summary (150 chars) for card display
   * This is automatically called after transcription completes
   */
  async generateAndSaveShortSummary(sessionId: string): Promise<void> {
    return SummaryGenerator.generateAndSaveShortSummary(sessionId);
  }

  /**
   * Generate AI summary of the session
   */
  async generateSummary(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('generate-summary-btn');
    return SummaryGenerator.generate(session, contentArea);
  }

  /**
   * Extract key concepts from the session
   */
  async extractKeyConcepts(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('extract-concepts-btn');
    return ConceptGenerator.extractKeyConcepts(session, contentArea);
  }

  /**
   * Generate flashcards from the session
   */
  async generateFlashcards(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('generate-flashcards-btn');
    return FlashcardGenerator.generate(session, contentArea);
  }

  /**
   * Generate a quiz from the session
   */
  async generateQuiz(session: Session, contentArea: HTMLElement, questionCount?: number): Promise<void> {
    this.setActiveStudyTool('generate-quiz-btn');
    return QuizGenerator.generate(session, contentArea, questionCount);
  }

  /**
   * Generate weak spots analysis
   */
  async generateWeakSpots(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('weak-spots-btn');
    return WeakSpotsGenerator.generate(session, contentArea);
  }

  /**
   * Generate ELI5 (Explain Like I'm 5) explanations for complex concepts
   */
  async generateELI5Explainer(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('eli5-explainer-btn');
    return ELI5Generator.generate(session, contentArea);
  }

  /**
   * Generate concept map
   */
  async generateConceptMap(session: Session, contentArea: HTMLElement): Promise<void> {
    this.setActiveStudyTool('concept-map-btn');
    return ConceptGenerator.generateConceptMap(session, contentArea);
  }

  /**
   * Generate study plan
   */
  async generateStudyPlan(session: Session, contentArea: HTMLElement, daysUntilExam?: number, hoursPerDay?: number): Promise<void> {
    this.setActiveStudyTool('study-plan-btn');
    return StudyPlanGenerator.generate(session, contentArea, daysUntilExam, hoursPerDay);
  }

  /**
   * Set active state for study tool buttons
   */
  private setActiveStudyTool(activeButtonId: string): void {
    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.study-tool-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked button
    const activeButton = document.getElementById(activeButtonId);
    activeButton?.classList.add('active');
  }
}
