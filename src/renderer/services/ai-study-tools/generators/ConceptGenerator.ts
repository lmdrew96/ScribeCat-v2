/**
 * ConceptGenerator
 *
 * Generates key concepts and concept maps from sessions
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { renderMarkdown } from '../../../markdown-renderer.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';

export class ConceptGenerator extends BaseAIToolGenerator {
  /**
   * Extract key concepts from the session
   */
  static async extractKeyConcepts(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('concept')) {
      const savedResult = session.getAIToolResult('concept');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '💡',
          'Key Concepts Available',
          'You have key concepts generated on {date}.',
          () => this.renderConcepts(savedResult.data, contentArea, session),
          () => this.extractKeyConcepts(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Extracting key concepts...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'concepts');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

      // Use AI to extract key concepts
      const prompt = isMultiSession
        ? `Extract the key concepts from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each concept, provide:
1. The term/concept name
2. A brief definition
3. Which session(s) it appears in (e.g., "Session 1" or "Sessions 1-3")

Format as a JSON array with objects containing "term", "definition", and "sessions" fields. Limit to 7-10 most important concepts across all sessions.

Transcription:
${transcriptionText}`
        : `Extract the key concepts from this transcription. For each concept, provide the term and a brief definition. Format as a JSON array with objects containing "term" and "definition" fields. Limit to 5-7 most important concepts.

Transcription:
${transcriptionText}`;

      const result = await this.callAI(prompt);

      if (result.success && result.data) {
        // result.data is a string response from AI
        let concepts: Array<{term: string; definition: string; sessions?: string}> = [];

        try {
          concepts = AIResponseParser.parseJsonArray(
            result.data,
            'Key Concepts',
            (data): data is Array<{ term: string; definition: string; sessions?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
        } catch (e) {
          console.warn('Failed to parse concepts as JSON, using plain text:', e);
          // If JSON parsing fails, create a single concept from the response
          const responseText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
          concepts = [{
            term: 'Key Concepts',
            definition: responseText
          }];
        }

        // Save the results to session
        await this.saveResults(session, 'concept', concepts);

        // Render concepts
        this.renderConcepts(concepts, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to extract concepts');
      }
    } catch (error) {
      console.error('Error extracting concepts:', error);
      this.showError(contentArea, 'concepts', error);
    }
  }

  /**
   * Generate concept map
   */
  static async generateConceptMap(session: Session, contentArea: HTMLElement): Promise<void> {
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Generating concept map...</div>
      </div>
    `;

    try {
      const isMultiSession = session.type === 'multi-session-study-set';
      let transcriptionText: string;

      if (isMultiSession) {
        const childSessions = await MultiSessionHelper.loadChildSessions(session);
        if (childSessions.length === 0) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No child sessions found.</div>`;
          return;
        }
        transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);
        if (!transcriptionText || !transcriptionText.trim()) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
      } else {
        if (!session.transcription?.fullText) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
        transcriptionText = session.transcription.fullText;
      }

      // Generate hierarchical concept structure
      const prompt = `Create a hierarchical concept map from this transcription. Identify:
1. Main topic (1 central concept)
2. Major subtopics (3-5 concepts)
3. Supporting concepts for each subtopic (2-3 each)

Format as a JSON object with:
- "mainTopic": string
- "subtopics": array of {"name": string, "supporting": array of strings}

Transcription:
${transcriptionText}`;

      const result = await this.callAI(prompt);

      if (result.success && result.data) {
        let conceptMap: {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}>};

        try {
          conceptMap = AIResponseParser.parseJsonObject(
            result.data,
            'Concept Map',
            (data): data is {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}> } => {
              return typeof data === 'object' && data !== null && 'mainTopic' in data && 'subtopics' in data;
            }
          );
        } catch (e) {
          console.error('Failed to parse concept map:', e);
          throw new Error('Failed to parse concept map from AI response.');
        }

        // Render concept map
        this.renderConceptMap(conceptMap, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate concept map');
      }
    } catch (error) {
      console.error('Error generating concept map:', error);
      contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--record-color);">Failed to generate concept map: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }

  /**
   * Render concept map
   */
  private static renderConceptMap(conceptMap: {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}>}, contentArea: HTMLElement): void {
    const subtopicsHtml = conceptMap.subtopics.map(subtopic => {
      const supportingHtml = subtopic.supporting.map(concept => `
        <div class="map-supporting-concept">${escapeHtml(concept)}</div>
      `).join('');

      return `
        <div class="map-subtopic-branch">
          <div class="map-subtopic">${escapeHtml(subtopic.name)}</div>
          <div class="map-supporting-concepts">${supportingHtml}</div>
        </div>
      `;
    }).join('');

    contentArea.innerHTML = `
      <div class="concept-map">
        <div class="map-header">
          <h4>🗺️ Concept Map</h4>
          <p>Visual representation of how concepts relate</p>
        </div>
        <div class="map-diagram">
          <div class="map-main-topic">${escapeHtml(conceptMap.mainTopic)}</div>
          <div class="map-subtopics">${subtopicsHtml}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render concepts
   */
  private static renderConcepts(concepts: Array<{term: string; definition: string; sessions?: string}>, contentArea: HTMLElement, session?: Session): void {
    const conceptsHtml = concepts.map(concept => `
      <div class="concept-item">
        <div class="concept-term">
          ${escapeHtml(concept.term)}
          ${concept.sessions ? `<span class="concept-sessions"> (${escapeHtml(concept.sessions)})</span>` : ''}
        </div>
        <div class="concept-definition">${renderMarkdown(concept.definition)}</div>
      </div>
    `).join('');

    contentArea.innerHTML = `
      <div class="study-concepts">
        ${conceptsHtml}
      </div>
    `;
  }
}
