/**
 * WeakSpotsGenerator
 *
 * Identifies and explains concepts students are likely to struggle with
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';
import { getIconHTML } from '../../../utils/iconMap.js';

export class WeakSpotsGenerator extends BaseAIToolGenerator {
  /**
   * Generate weak spots analysis
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('weak_spots')) {
      const savedResult = session.getAIToolResult('weak_spots');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          getIconHTML('alertTriangle', { size: 24 }),
          'Weak Spots Available',
          'You have weak spots analysis generated on {date}.',
          () => this.renderWeakSpots(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Analyzing weak spots...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'weak_spots');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

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

      const result = await this.callAI(prompt);

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

        // Save the results to session
        await this.saveResults(session, 'weak_spots', weakSpots);

        // Render weak spots
        this.renderWeakSpots(weakSpots, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to analyze weak spots');
      }
    } catch (error) {
      console.error('Error analyzing weak spots:', error);
      this.showError(contentArea, 'weak_spots', error);
    }
  }

  /**
   * Render weak spots analysis
   */
  private static renderWeakSpots(weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}>, contentArea: HTMLElement, session?: Session): void {
    const severityIcons = {
      high: '<span class="severity-high" style="color: #ef4444;">●</span>',
      medium: '<span class="severity-medium" style="color: #f59e0b;">●</span>',
      low: '<span class="severity-low" style="color: #22c55e;">●</span>'
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
        const icon = severityIcons[severity as keyof typeof severityIcons] || severityIcons.medium;
        const label = severityLabels[severity as keyof typeof severityLabels] || 'Review';

        return `
          <div class="weak-spot-item" data-severity="${severity}">
            <div class="weak-spot-header">
              <div class="weak-spot-title">
                <span class="weak-spot-icon">${icon}</span>
                <span class="weak-spot-concept">${escapeHtml(spot.concept)}</span>
                <span class="weak-spot-severity-badge">${label}</span>
              </div>
              ${spot.session ? `<span class="weak-spot-session-badge">${escapeHtml(spot.session)}</span>` : ''}
            </div>
            <div class="weak-spot-reason">
              <strong>Why it's tricky:</strong> ${escapeHtml(spot.reason)}
            </div>
            <div class="weak-spot-mini-lesson">
              <strong>${getIconHTML('lightbulb', { size: 14 })} Quick tip:</strong> ${escapeHtml(spot.miniLesson)}
            </div>
          </div>
        `;
      }).join('');

    contentArea.innerHTML = `
      <div class="study-weak-spots">
        <div class="weak-spots-header">
          <h4>${getIconHTML('target', { size: 18 })} Potential Weak Spots</h4>
          <p>These concepts might be challenging. Focus on these for deeper understanding.</p>
        </div>
        <div class="weak-spots-list">
          ${weakSpotsHtml}
        </div>
      </div>
    `;
  }
}
