/**
 * WeakSpotsGenerator
 *
 * Identifies and explains concepts students are likely to struggle with
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';
import { createLoadingHTML } from '../../../utils/loading-helpers.js';

export class WeakSpotsGenerator {
  /**
   * Generate weak spots analysis
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('weak_spots')) {
      const savedResult = session.getAIToolResult('weak_spots');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(session, contentArea, savedResult);
        return;
      }
    }

    // Show loading state
    contentArea.innerHTML = createLoadingHTML('Analyzing weak spots...');

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

        // Save the results to session
        session.saveAIToolResult('weak_spots', weakSpots);
        await window.scribeCat.sessions.update(session.id, session.toJSON());

        // Render weak spots
        this.renderWeakSpots(weakSpots, contentArea, session);
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
   * Show prompt to load previous or regenerate
   */
  private static showLoadOrRegeneratePrompt(session: Session, contentArea: HTMLElement, savedResult: any): void {
    const generatedDate = new Date(savedResult.generatedAt).toLocaleDateString();
    const regenerationCount = savedResult.regenerationCount || 0;

    contentArea.innerHTML = `
      <div class="ai-result-prompt">
        <div class="prompt-header">
          <div class="prompt-icon">🎯</div>
          <h4>Weak Spots Analysis Available</h4>
        </div>
        <div class="prompt-body">
          <p>You have a weak spots analysis generated on <strong>${generatedDate}</strong>.</p>
          ${regenerationCount > 0 ? `<p class="regeneration-count">Regenerated ${regenerationCount} time${regenerationCount > 1 ? 's' : ''}</p>` : ''}
        </div>
        <div class="prompt-actions">
          <button class="btn-primary" id="load-previous-btn">Load Previous</button>
          <button class="btn-secondary" id="regenerate-btn">Regenerate</button>
        </div>
      </div>
    `;

    const loadBtn = document.getElementById('load-previous-btn');
    loadBtn?.addEventListener('click', () => {
      this.renderWeakSpots(savedResult.data, contentArea, session);
    });

    const regenerateBtn = document.getElementById('regenerate-btn');
    regenerateBtn?.addEventListener('click', () => {
      this.generate(session, contentArea, true);
    });
  }

  /**
   * Render weak spots analysis
   */
  private static renderWeakSpots(weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}>, contentArea: HTMLElement, session?: Session): void {
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
                <span class="weak-spot-concept">${escapeHtml(spot.concept)}</span>
                <span class="weak-spot-severity-badge">${label}</span>
              </div>
              ${spot.session ? `<span class="weak-spot-session-badge">${escapeHtml(spot.session)}</span>` : ''}
            </div>
            <div class="weak-spot-reason">
              <strong>Why it's tricky:</strong> ${escapeHtml(spot.reason)}
            </div>
            <div class="weak-spot-mini-lesson">
              <strong>💡 Quick tip:</strong> ${escapeHtml(spot.miniLesson)}
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
