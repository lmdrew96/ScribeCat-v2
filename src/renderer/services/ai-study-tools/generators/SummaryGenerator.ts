/**
 * SummaryGenerator
 *
 * Generates AI summaries for sessions and study sets
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { renderMarkdown } from '../../../utils/markdown-renderer.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';

export class SummaryGenerator extends BaseAIToolGenerator {
  /**
   * Generate and save a short summary (150 chars) for card display
   * This is automatically called after transcription completes
   */
  static async generateAndSaveShortSummary(sessionId: string): Promise<void> {
    try {
      // Get session via IPC
      const sessionResult = await (window as any).scribeCat.session.list();
      if (!sessionResult.success || !sessionResult.sessions) {
        console.error('Failed to load sessions for short summary generation');
        return;
      }

      const sessionData = sessionResult.sessions.find((s: any) => s.id === sessionId);
      if (!sessionData) {
        console.error(`Session ${sessionId} not found`);
        return;
      }

      // Import Session class for reconstruction
      const { Session: SessionClass } = await import('../../../../domain/entities/Session.js');
      const session = SessionClass.fromJSON(sessionData);

      // Check if session has transcription
      if (!session.transcription || !session.transcription.fullText) {
        console.log('No transcription available for short summary generation');
        return;
      }

      // Generate a very short summary using AI (max 150 chars)
      const prompt = `Provide a 1-2 sentence summary (maximum 150 characters) of this lecture transcription. Be concise and focus on the main topic only.

Transcription:
${session.transcription.fullText}`;

      const result = await (window as any).scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // Extract message from AI response
        let summary: string;
        if (typeof result.data === 'string') {
          summary = result.data;
        } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
          summary = (result.data as { message: string }).message;
        } else {
          summary = JSON.stringify(result.data);
        }

        // Ensure summary is no longer than 150 characters
        if (summary.length > 150) {
          summary = summary.substring(0, 147) + '...';
        }

        // Save summary to session via IPC
        await (window as any).scribeCat.session.updateSummary(sessionId, summary);
        console.log(`✅ Short summary saved for session ${sessionId}: ${summary}`);

        // Refresh study mode to show the new summary
        if (window.studyModeManager) {
          await window.studyModeManager.refresh();
          console.log('📚 Study mode refreshed to display new summary');
        }
      }
    } catch (error) {
      console.error('Error generating short summary:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Generate AI summary of the session
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('summary')) {
      const savedResult = session.getAIToolResult('summary');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '📄',
          'Summary Available',
          'You have a summary generated on {date}.',
          () => this.renderSummary(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Generating summary...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'summary');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;
      const notesText: string = session.notes || '';

      console.log(`🎯 SummaryGenerator.generate - Session type: ${session.type}, isMultiSession: ${isMultiSession}, childSessionIds:`, session.childSessionIds);

      // Generate summary using AI
      let summaryResult;
      if (isMultiSession) {
        // For multi-session study sets, use chat with custom prompt
        const prompt = `You are analyzing a multi-session study set that combines content from multiple lecture/recording sessions. The transcription below contains clear session markers (e.g., "━━━ SESSION 1: Title ━━━").

Please generate a comprehensive summary that:
1. Summarizes the key points from ALL sessions
2. Tags each major point with its source session (e.g., "Session 1:", "Session 2:")
3. Shows how concepts build across sessions if applicable
4. Maintains clear separation between different sessions' content

Transcription:
${transcriptionText}

${notesText ? `Notes:\n${notesText}` : ''}

Format your response as a clear, organized summary with session attribution.`;

        summaryResult = await window.scribeCat.ai.chat(prompt, [], {
          includeTranscription: false,
          includeNotes: false
        });
      } else {
        // For single sessions, use the standard summary API
        summaryResult = await window.scribeCat.ai.generateSummary(
          transcriptionText,
          notesText || undefined
        );
      }

      const result = summaryResult;

      if (result.success && result.data) {
        // Extract summary from SummaryResult object
        let summary: string;
        if (typeof result.data === 'string') {
          summary = result.data;
        } else if (result.data && typeof result.data === 'object' && 'summary' in result.data) {
          summary = (result.data as { summary: string }).summary;
        } else {
          summary = JSON.stringify(result.data);
        }

        // Save the results to session
        await this.saveResults(session, 'summary', summary);

        // Render summary
        this.renderSummary(summary, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      this.showError(contentArea, 'summary', error);
    }
  }

  /**
   * Render summary
   */
  private static renderSummary(summary: string, contentArea: HTMLElement, session?: Session): void {
    contentArea.innerHTML = `
      <div class="study-summary">
        <div class="summary-section">
          <h5>📋 Summary</h5>
          <div>${renderMarkdown(summary)}</div>
        </div>
      </div>
    `;
  }
}
