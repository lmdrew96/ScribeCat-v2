/**
 * SmartSuggestionEngine
 *
 * Generates intelligent, context-aware suggestions for AI study tools.
 * Uses ContentAnalyzer insights to provide proactive recommendations.
 * Supports both recording mode (passive) and study mode (active) contexts.
 */

import { ContentAnalyzer, SuggestionTrigger, ContextMode } from './ContentAnalyzer.js';

export type SuggestionAction =
  // Study mode actions (active AI tools)
  | 'flashcards' | 'quiz' | 'summary' | 'eli5' | 'concept' | 'weak_spots' | 'study_plan' | 'concept_map'
  // Recording mode actions (passive helpers)
  | 'bookmark' | 'highlight' | 'note_prompt';

export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  action: SuggestionAction;
  confidence: number; // 0-1
  priority: 'low' | 'medium' | 'high';
  icon: string;
  command?: string; // Natural language command to trigger this
  dismissible: boolean;
  timestamp: Date;
  mode?: ContextMode; // Which mode this suggestion is for
}

export interface SuggestionState {
  shown: Set<string>; // suggestion IDs that have been shown
  dismissed: Set<string>; // suggestion IDs that user dismissed
  accepted: Set<string>; // suggestion IDs that user acted on
  lastSuggestionTime: Date | null;
}

export class SmartSuggestionEngine {
  private contentAnalyzer: ContentAnalyzer;
  private state: SuggestionState;
  private readonly MIN_SUGGESTION_INTERVAL_MS = 120000; // 2 minutes between suggestions

  constructor(contentAnalyzer: ContentAnalyzer) {
    this.contentAnalyzer = contentAnalyzer;
    this.state = {
      shown: new Set(),
      dismissed: new Set(),
      accepted: new Set(),
      lastSuggestionTime: null
    };
  }

  /**
   * Get current smart suggestions based on content analysis
   */
  public getSuggestions(mode: ContextMode = 'study'): SmartSuggestion[] {
    const triggers = this.contentAnalyzer.getSuggestionTriggers(mode);
    const suggestions: SmartSuggestion[] = [];

    for (const trigger of triggers) {
      // Skip if confidence is too low
      // Lower threshold for recording mode (passive suggestions)
      const minConfidence = mode === 'recording' ? 0.65 : 0.6;
      if (trigger.confidence < minConfidence) continue;

      const suggestion = this.triggerToSuggestion(trigger);

      // Skip if already dismissed or shown recently
      if (this.state.dismissed.has(suggestion.id)) continue;
      if (this.state.shown.has(suggestion.id) && !this.shouldResuggest(suggestion)) continue;

      // Check suggestion cooldown
      if (!this.canShowSuggestion()) continue;

      suggestions.push(suggestion);
    }

    // Sort by priority and confidence
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Get the top suggestion to show
   */
  public getTopSuggestion(mode: ContextMode = 'study'): SmartSuggestion | null {
    const suggestions = this.getSuggestions(mode);
    return suggestions[0] || null;
  }

  /**
   * Convert a trigger to a suggestion
   */
  private triggerToSuggestion(trigger: SuggestionTrigger): SmartSuggestion {
    const baseId = `${trigger.type}_${trigger.suggestedAction}`;
    const id = `${baseId}_${Date.now()}`;

    let title: string;
    let description: string;
    let icon: string;
    let command: string;
    let action = trigger.suggestedAction;

    // ===== RECORDING MODE SUGGESTIONS (passive helpers) =====
    switch (trigger.suggestedAction) {
      case 'bookmark':
        title = 'Bookmark This?';
        description = trigger.reason + '. Mark this moment for later review?';
        icon = '🔖';
        command = 'bookmark this moment';
        break;

      case 'highlight':
        title = 'Important Moment';
        description = trigger.reason + '. Consider highlighting this in your notes.';
        icon = '⭐';
        command = 'highlight important';
        break;

      case 'note_prompt':
        title = 'Quick Note?';
        description = trigger.reason + '. Jot down a quick note to help you remember.';
        icon = '📝';
        command = 'add note';
        break;

      // ===== STUDY MODE SUGGESTIONS (active AI tools) =====
      case 'flashcards':
        title = 'Create Flashcards?';
        description = trigger.reason + '. Want to create flashcards to study these?';
        icon = '🃏';
        command = 'create flashcards';
        break;

      case 'quiz':
        title = 'Generate Practice Quiz?';
        description = trigger.reason + '. I can create a quiz to test your understanding!';
        icon = '📝';
        command = 'make quiz';
        break;

      case 'summary':
        title = 'Summarize Your Session?';
        description = trigger.reason + '. Want a concise summary of what you\'ve covered?';
        icon = '📄';
        command = 'summarize session';
        break;

      case 'eli5':
        title = 'Need Clarification?';
        description = trigger.reason + '. I can explain these concepts in simpler terms!';
        icon = '🤔';
        command = 'explain this simply';
        break;

      case 'break':
        title = 'Take a Break?';
        description = trigger.reason + '. Research shows breaks improve retention!';
        icon = '☕';
        command = 'remind me to take a break';
        action = 'summary'; // Fallback to summary if they want to review first
        break;

      case 'notes':
        title = 'Extract Key Concepts?';
        description = trigger.reason + '. I can help you extract the key points!';
        icon = '💡';
        command = 'help me take notes';
        action = 'concept'; // Suggest extracting key concepts
        break;

      default:
        title = 'Try AI Study Tools?';
        description = 'I have some suggestions to help you study better!';
        icon = '🤖';
        command = 'show study tools';
        action = 'summary';
    }

    const priority = this.calculatePriority(trigger.confidence, trigger.type, trigger.mode);

    return {
      id,
      title,
      description,
      action,
      confidence: trigger.confidence,
      priority,
      icon,
      command,
      dismissible: true,
      timestamp: new Date(),
      mode: trigger.mode
    };
  }

  /**
   * Calculate priority based on confidence and trigger type
   */
  private calculatePriority(confidence: number, triggerType: string, mode?: ContextMode): 'low' | 'medium' | 'high' {
    // Recording mode: Keep all suggestions low-medium priority (passive, non-intrusive)
    if (mode === 'recording') {
      // Only confusion gets medium priority in recording
      if (triggerType === 'confusion' && confidence > 0.8) return 'medium';

      // Topic emphasis gets medium priority if highly confident
      if (triggerType === 'topic_emphasis' && confidence > 0.8) return 'medium';

      // Everything else is low priority in recording mode
      return 'low';
    }

    // Study mode: Use full priority range (active suggestions)
    // Confusion is high priority
    if (triggerType === 'confusion' && confidence > 0.8) return 'high';

    // Duration warnings are medium-high priority (for "take a break")
    if (triggerType === 'duration' && confidence > 0.7) return 'high';

    // High confidence = higher priority
    if (confidence > 0.85) return 'high';
    if (confidence > 0.7) return 'medium';
    return 'low';
  }

  /**
   * Check if enough time has passed to show a new suggestion
   */
  private canShowSuggestion(): boolean {
    if (!this.state.lastSuggestionTime) return true;

    const now = new Date();
    const timeSinceLastMs = now.getTime() - this.state.lastSuggestionTime.getTime();

    return timeSinceLastMs >= this.MIN_SUGGESTION_INTERVAL_MS;
  }

  /**
   * Check if a suggestion should be shown again
   */
  private shouldResuggest(suggestion: SmartSuggestion): boolean {
    // Don't re-suggest high confidence items within a session
    if (suggestion.confidence > 0.85) return false;

    // Allow re-suggesting lower confidence items after 10 minutes
    const suggestedTime = suggestion.timestamp.getTime();
    const now = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;

    return (now - suggestedTime) > tenMinutesMs;
  }

  /**
   * Mark a suggestion as shown
   */
  public markShown(suggestionId: string): void {
    this.state.shown.add(suggestionId);
    this.state.lastSuggestionTime = new Date();
  }

  /**
   * Mark a suggestion as dismissed
   */
  public markDismissed(suggestionId: string): void {
    this.state.dismissed.add(suggestionId);
  }

  /**
   * Mark a suggestion as accepted (user acted on it)
   */
  public markAccepted(suggestionId: string): void {
    this.state.accepted.add(suggestionId);
    this.state.dismissed.add(suggestionId); // Don't show again
  }

  /**
   * Parse natural language command and return corresponding action
   */
  public parseNaturalLanguageCommand(command: string): SmartSuggestion | null {
    const commandLower = command.toLowerCase().trim();

    // Flashcards
    if (commandLower.includes('flashcard') || commandLower.includes('flash card')) {
      return this.createManualSuggestion('flashcards', 'Creating flashcards from your session');
    }

    // Quiz
    if (commandLower.includes('quiz') || commandLower.includes('test') || commandLower.includes('practice')) {
      return this.createManualSuggestion('quiz', 'Generating a practice quiz');
    }

    // Summary
    if (commandLower.includes('summary') || commandLower.includes('summarize')) {
      return this.createManualSuggestion('summary', 'Creating a summary of your session');
    }

    // ELI5
    if (commandLower.includes('eli5') || commandLower.includes('explain') || commandLower.includes('simple')) {
      return this.createManualSuggestion('eli5', 'Explaining in simple terms');
    }

    // Concepts
    if (commandLower.includes('concept') || commandLower.includes('key point') || commandLower.includes('main idea')) {
      return this.createManualSuggestion('concept', 'Extracting key concepts');
    }

    // Weak spots
    if (commandLower.includes('weak spot') || commandLower.includes('gap') || commandLower.includes('missing')) {
      return this.createManualSuggestion('weak_spots', 'Identifying knowledge gaps');
    }

    // Learn mode (now integrated into flashcards)
    if (commandLower.includes('learn') || commandLower.includes('study guide')) {
      return this.createManualSuggestion('flashcards', 'Creating interactive flashcards with learn mode');
    }

    // Study plan
    if (commandLower.includes('study plan') || commandLower.includes('schedule')) {
      return this.createManualSuggestion('study_plan', 'Building a personalized study plan');
    }

    // Concept map
    if (commandLower.includes('concept map') || commandLower.includes('mind map') || commandLower.includes('map out')) {
      return this.createManualSuggestion('concept_map', 'Creating a visual concept map');
    }

    return null;
  }

  /**
   * Create a manual suggestion from user command
   */
  private createManualSuggestion(
    action: SmartSuggestion['action'],
    description: string
  ): SmartSuggestion {
    return {
      id: `manual_${action}_${Date.now()}`,
      title: `${action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}`,
      description,
      action,
      confidence: 1.0, // User explicitly requested
      priority: 'high',
      icon: this.getIconForAction(action),
      dismissible: false,
      timestamp: new Date()
    };
  }

  /**
   * Get icon for action
   */
  private getIconForAction(action: SuggestionAction): string {
    const icons: Record<SuggestionAction, string> = {
      // Study mode icons
      flashcards: '🃏',
      quiz: '📝',
      summary: '📄',
      eli5: '🤔',
      concept: '💡',
      weak_spots: '🎯',
      study_plan: '📅',
      concept_map: '🗺️',
      // Recording mode icons
      bookmark: '🔖',
      highlight: '⭐',
      note_prompt: '📝'
    };
    return icons[action] || '🤖';
  }

  /**
   * Reset state (e.g., when starting a new session)
   */
  public reset(): void {
    this.state = {
      shown: new Set(),
      dismissed: new Set(),
      accepted: new Set(),
      lastSuggestionTime: null
    };
  }

  /**
   * Get suggestion statistics
   */
  public getStats() {
    return {
      totalShown: this.state.shown.size,
      totalDismissed: this.state.dismissed.size,
      totalAccepted: this.state.accepted.size,
      acceptanceRate: this.state.shown.size > 0
        ? this.state.accepted.size / this.state.shown.size
        : 0
    };
  }
}
