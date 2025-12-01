/**
 * TranscriptionRenderer
 *
 * Handles transcription rendering with search functionality
 */

import { formatTimestamp, escapeHtml } from '../../../utils/formatting.js';
import { getIconHTML } from '../../../utils/iconMap.js';

export class TranscriptionRenderer {
  /**
   * Render transcription for a session (used in multi-session tabs)
   */
  static renderTranscription(transcription: any): string {
    if (!transcription) {
      return '<p class="no-transcription">No transcription available for this session.</p>';
    }

    const segments = transcription.segments || [];
    if (segments.length === 0) {
      return `<p>${escapeHtml(transcription.fullText)}</p>`;
    }

    return segments.map((segment: any) => `
      <p class="transcription-segment" data-start="${segment.startTime}">
        <span class="timestamp clickable">[${formatTimestamp(segment.startTime)}]</span>
        ${escapeHtml(segment.text)}
      </p>
    `).join('');
  }

  /**
   * Render transcription with search bar
   */
  static renderTranscriptionWithSearch(
    transcription: any,
    currentSearchQuery: string,
    currentMatchIndex: number,
    totalMatches: number
  ): string {
    const searchBarHtml = `
      <div class="transcription-search-bar">
        <div class="search-input-container">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="transcription-search-input"
            placeholder="Search transcription..."
            value="${escapeHtml(currentSearchQuery)}"
          />
          <button class="search-clear-btn ${currentSearchQuery ? '' : 'hidden'}" title="Clear search">✕</button>
        </div>
        <div class="search-results-info ${currentSearchQuery ? '' : 'hidden'}">
          <span class="search-match-counter">
            ${totalMatches > 0
              ? `<span class="current-match">${currentMatchIndex + 1}</span> of <span class="total-matches">${totalMatches}</span>`
              : 'No matches'}
          </span>
          <div class="search-navigation">
            <button class="search-nav-btn search-prev-btn" title="Previous match" ${totalMatches <= 1 ? 'disabled' : ''}>${getIconHTML('chevronUp', { size: 14 })}</button>
            <button class="search-nav-btn search-next-btn" title="Next match" ${totalMatches <= 1 ? 'disabled' : ''}>${getIconHTML('chevronDown', { size: 14 })}</button>
          </div>
        </div>
      </div>
    `;

    const segmentsHtml = this.renderTranscriptionSegments(
      transcription,
      currentSearchQuery,
      currentMatchIndex
    );

    return searchBarHtml + segmentsHtml.html;
  }

  /**
   * Render transcription segments with clickable timestamps and search highlighting
   * Returns both HTML and the updated totalMatches count
   */
  static renderTranscriptionSegments(
    transcription: any,
    currentSearchQuery: string,
    currentMatchIndex: number
  ): { html: string; totalMatches: number } {
    // If no segments, fall back to full text
    if (!transcription.segments || transcription.segments.length === 0) {
      return {
        html: `<div class="transcription-text">${escapeHtml(transcription.fullText)}</div>`,
        totalMatches: 0
      };
    }

    // Filter segments based on search query
    let filteredSegments = transcription.segments;
    let matchIndexMap = new Map<number, number>(); // Maps segment index to match index
    let totalMatches = 0;

    if (currentSearchQuery) {
      const query = currentSearchQuery.toLowerCase();
      let matchCounter = 0;

      filteredSegments = transcription.segments.filter((segment: any, index: number) => {
        const matches = segment.text.toLowerCase().includes(query);
        if (matches) {
          matchIndexMap.set(index, matchCounter);
          matchCounter++;
        }
        return matches;
      });

      totalMatches = filteredSegments.length;

      // Ensure currentMatchIndex is valid
      if (currentMatchIndex >= totalMatches) {
        currentMatchIndex = Math.max(0, totalMatches - 1);
      }
    }

    // Render each segment with timestamp
    const segmentsHtml = filteredSegments.map((segment: any) => {
      const timestamp = formatTimestamp(segment.startTime);
      const originalIndex = transcription.segments.indexOf(segment);
      const matchIndex = matchIndexMap.get(originalIndex) ?? -1;
      const isCurrentMatch = matchIndex === currentMatchIndex;

      // Highlight search query in text
      let segmentText = escapeHtml(segment.text);
      if (currentSearchQuery) {
        const query = currentSearchQuery;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        segmentText = segmentText.replace(regex, '<mark class="search-highlight">$1</mark>');
      }

      return `
        <div class="transcription-segment ${isCurrentMatch ? 'current-match' : ''}" data-start-time="${segment.startTime}" data-end-time="${segment.endTime}" data-segment-index="${originalIndex}" data-match-index="${matchIndex}">
          <span class="segment-timestamp">[${timestamp}]</span>
          <span class="segment-text">${segmentText}</span>
        </div>
      `;
    }).join('');

    return {
      html: `<div class="transcription-segments">${segmentsHtml}</div>`,
      totalMatches
    };
  }
}
