/**
 * WeakSpotsGenerator
 *
 * Identifies and explains concepts students are likely to struggle with
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { HtmlHelper } from '../utils/HtmlHelper.js';

export class WeakSpotsGenerator {
  /**
   * Generate weak spots analysis
   */
  static async generate(session: Session, contentArea: HTMLElement): Promise<void> {
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Analyzing weak spots...</div>
      </div>
    `;

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await MultiSessionHelper.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
        if (!session.transcription || !session.transcription.fullText) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available for this session.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to identify weak spots
      const prompt = isMultiSession
        ? `Analyze this MULTI-SESSION study set transcription and identify 5-7 concepts that a student is MOST LIKELY TO STRUGGLE WITH. The transcription contains content from multiple sessions marked with headers.

For each weak spot, identify:
1. The concept/topic name
2. Why it's a weak spot (e.g., "explained briefly", "complex terminology", "assumed prior knowledge", "mentioned once", "high information density")
3. A brief mini-lesson or tip to help understand it better
4. Severity level: "high" (critical to understand), "medium" (important), or "low" (good to review)
5. Which session(s) it appears in

Format as a JSON array with objects containing "concept", "reason", "miniLesson", "severity", and "session" fields.

Transcription:
${transcriptionText}`
        : `Analyze this transcription and identify 5-7 concepts that a student is MOST LIKELY TO STRUGGLE WITH.

For each weak spot, identify:
1. The concept/topic name
2. Why it's a weak spot (e.g., "explained briefly", "complex terminology", "assumed prior knowledge", "mentioned once", "high information density")
3. A brief mini-lesson or tip to help understand it better
4. Severity level: "high" (critical to understand), "medium" (important), or "low" (good to review)

Format as a JSON array with objects containing "concept", "reason", "miniLesson", and "severity" fields.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}> = [];

        try {
          weakSpots = AIResponseParser.parseJsonArray(
            result.data,
            'Weak Spots',
            (data): data is Array<{ concept: string; reason: string; miniLesson: string; severity: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'concept' in data[0] &&
                     'reason' in data[0] && 'miniLesson' in data[0] &&
                     'severity' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse weak spots:', e);
          throw new Error('Failed to parse weak spots from AI response. The AI may not have returned the expected format.');
        }

        if (weakSpots.length === 0) {
          throw new Error('No weak spots identified');
        }

        // Render weak spots
        this.renderWeakSpots(weakSpots, contentArea);
      } else {
        throw new Error(result.error || 'Failed to analyze weak spots');
      }
    } catch (error) {
      console.error('Error analyzing weak spots:', error);
      contentArea.innerHTML = `
        <div class="study-weak-spots">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to analyze weak spots: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }

  /**
   * Render weak spots analysis
   */
  private static renderWeakSpots(weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}>, contentArea: HTMLElement): void {
    const severityIcons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const severityLabels = {
      high: 'Priority',
      medium: 'Review',
      low: 'Optional'
    };

    const weakSpotsHtml = weakSpots
      .sort((a, b) => {
        // Sort by severity: high > medium > low
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return (severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] || 1) -
               (severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] || 1);
      })
      .map(spot => {
        const severity = spot.severity.toLowerCase();
        const icon = severityIcons[severity as keyof typeof severityIcons] || '🟡';
        const label = severityLabels[severity as keyof typeof severityLabels] || 'Review';

        return `
          <div class="weak-spot-item" data-severity="${severity}">
            <div class="weak-spot-header">
              <div class="weak-spot-title">
                <span class="weak-spot-icon">${icon}</span>
                <span class="weak-spot-concept">${HtmlHelper.escapeHtml(spot.concept)}</span>
                <span class="weak-spot-severity-badge">${label}</span>
              </div>
              ${spot.session ? `<span class="weak-spot-session-badge">${HtmlHelper.escapeHtml(spot.session)}</span>` : ''}
            </div>
            <div class="weak-spot-reason">
              <strong>Why it's tricky:</strong> ${HtmlHelper.escapeHtml(spot.reason)}
            </div>
            <div class="weak-spot-mini-lesson">
              <strong>💡 Quick tip:</strong> ${HtmlHelper.escapeHtml(spot.miniLesson)}
            </div>
          </div>
        `;
      }).join('');

    contentArea.innerHTML = `
      <div class="study-weak-spots">
        <div class="weak-spots-header">
          <h4>🎯 Potential Weak Spots</h4>
          <p>These concepts might be challenging. Focus on these for deeper understanding.</p>
        </div>
        <div class="weak-spots-list">
          ${weakSpotsHtml}
        </div>
      </div>
    `;
  }
}
