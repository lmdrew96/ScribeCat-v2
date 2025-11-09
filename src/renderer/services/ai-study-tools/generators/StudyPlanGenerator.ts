/**
 * StudyPlanGenerator
 *
 * Creates personalized study plans based on exam timeline and available time
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { HtmlHelper } from '../utils/HtmlHelper.js';
import { createLoadingHTML } from '../../../utils/loading-helpers.js';

export class StudyPlanGenerator {
  /**
   * Generate study plan
   */
  static async generate(session: Session, contentArea: HTMLElement, daysUntilExam?: number, hoursPerDay?: number): Promise<void> {
    // If no parameters provided, show the form
    if (daysUntilExam === undefined || hoursPerDay === undefined) {
      this.showStudyPlanForm(session, contentArea);
      return;
    }

    // Show loading state
    contentArea.innerHTML = createLoadingHTML('Creating your study plan...');

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;
      let sessionTitles: string[] = [];

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await MultiSessionHelper.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-plan">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);
        sessionTitles = childSessions.map(s => s.title);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-plan">
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
            <div class="study-plan">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available for this session.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = session.transcription.fullText;
        sessionTitles = [session.title];
      }

      const totalHours = daysUntilExam * hoursPerDay;

      // Use AI to generate study plan
      const prompt = isMultiSession
        ? `Create a personalized ${daysUntilExam}-day study plan for this MULTI-SESSION study set. The student has ${hoursPerDay} hours available per day (total: ${totalHours} hours).

Sessions to cover:
${sessionTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

For each day, create:
1. Day number (1-${daysUntilExam})
2. Focus topics for that day
3. Recommended study tools to use (e.g., "Key Concepts", "Quiz", "Weak Spots", "Flashcards")
4. Time allocation for each activity
5. Brief description of what to accomplish

Format as a JSON array with objects containing "day", "topics", "tools" (array), "activities" (array of {activity, duration}), and "goal" fields. Ensure the plan progressively builds knowledge and includes review sessions.

Transcription summary (analyze to understand content):
${transcriptionText.substring(0, 3000)}...`
        : `Create a personalized ${daysUntilExam}-day study plan for this session. The student has ${hoursPerDay} hours available per day (total: ${totalHours} hours).

Topic: ${session.title}

For each day, create:
1. Day number (1-${daysUntilExam})
2. Focus topics for that day
3. Recommended study tools to use (e.g., "Key Concepts", "Quiz", "Weak Spots", "Flashcards")
4. Time allocation for each activity
5. Brief description of what to accomplish

Format as a JSON array with objects containing "day", "topics", "tools" (array of strings), "activities" (array of {activity, duration}), and "goal" fields. Ensure the plan progressively builds knowledge and includes review sessions.

Transcription summary (analyze to understand content):
${transcriptionText.substring(0, 3000)}...`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let studyPlan: Array<{day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string}> = [];

        try {
          studyPlan = AIResponseParser.parseJsonArray(
            result.data,
            'Study Plan',
            (data): data is Array<{ day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'day' in data[0] &&
                     'topics' in data[0] && 'tools' in data[0] &&
                     'activities' in data[0] && 'goal' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse study plan:', e);
          throw new Error('Failed to parse study plan from AI response. The AI may not have returned the expected format.');
        }

        if (studyPlan.length === 0) {
          throw new Error('No study plan generated');
        }

        // Render study plan
        this.renderStudyPlan(studyPlan, daysUntilExam, hoursPerDay, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate study plan');
      }
    } catch (error) {
      console.error('Error generating study plan:', error);
      contentArea.innerHTML = `
        <div class="study-plan">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to generate study plan: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }

  /**
   * Show study plan form
   */
  private static showStudyPlanForm(session: Session, contentArea: HTMLElement): void {
    contentArea.innerHTML = `
      <div class="study-plan-form">
        <div class="plan-form-header">
          <h4>📅 Create Your Study Plan</h4>
          <p>Tell us about your exam, and we'll create a personalized study schedule</p>
        </div>

        <div class="plan-form-inputs">
          <div class="plan-form-group">
            <label for="days-until-exam">Days until exam:</label>
            <select id="days-until-exam" class="plan-form-select">
              <option value="1">1 day (cram session)</option>
              <option value="2">2 days</option>
              <option value="3" selected>3 days</option>
              <option value="5">5 days</option>
              <option value="7">1 week</option>
              <option value="14">2 weeks</option>
            </select>
          </div>

          <div class="plan-form-group">
            <label for="hours-per-day">Hours available per day:</label>
            <select id="hours-per-day" class="plan-form-select">
              <option value="1">1 hour</option>
              <option value="2" selected>2 hours</option>
              <option value="3">3 hours</option>
              <option value="4">4 hours</option>
              <option value="6">6 hours</option>
              <option value="8">8 hours (full day)</option>
            </select>
          </div>
        </div>

        <button class="plan-form-submit" id="generate-plan-btn">Generate Study Plan</button>
      </div>
    `;

    // Attach event listener
    const generateBtn = document.getElementById('generate-plan-btn');
    generateBtn?.addEventListener('click', () => {
      const daysSelect = document.getElementById('days-until-exam') as HTMLSelectElement;
      const hoursSelect = document.getElementById('hours-per-day') as HTMLSelectElement;

      const days = parseInt(daysSelect.value);
      const hours = parseInt(hoursSelect.value);

      this.generate(session, contentArea, days, hours);
    });
  }

  /**
   * Render study plan
   */
  private static renderStudyPlan(plan: Array<{day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string}>, daysUntilExam: number, hoursPerDay: number, contentArea: HTMLElement): void {
    const totalHours = daysUntilExam * hoursPerDay;

    const daysHtml = plan.map(dayPlan => {
      const activitiesHtml = dayPlan.activities.map(activity => `
        <div class="plan-activity">
          <span class="plan-activity-name">${HtmlHelper.escapeHtml(activity.activity)}</span>
          <span class="plan-activity-duration">${HtmlHelper.escapeHtml(activity.duration)}</span>
        </div>
      `).join('');

      const toolsHtml = dayPlan.tools.map(tool => `
        <span class="plan-tool-badge">${HtmlHelper.escapeHtml(tool)}</span>
      `).join('');

      return `
        <div class="plan-day-card">
          <div class="plan-day-header">
            <span class="plan-day-number">Day ${dayPlan.day}</span>
            <span class="plan-day-topics">${HtmlHelper.escapeHtml(dayPlan.topics)}</span>
          </div>
          <div class="plan-day-goal">
            <strong>Goal:</strong> ${HtmlHelper.escapeHtml(dayPlan.goal)}
          </div>
          <div class="plan-day-tools">
            <strong>Use these tools:</strong>
            <div class="plan-tools-list">${toolsHtml}</div>
          </div>
          <div class="plan-day-activities">
            <strong>Schedule:</strong>
            ${activitiesHtml}
          </div>
        </div>
      `;
    }).join('');

    contentArea.innerHTML = `
      <div class="study-plan">
        <div class="plan-header">
          <h4>📅 Your ${daysUntilExam}-Day Study Plan</h4>
          <p>Total study time: ${totalHours} hours (${hoursPerDay}h/day)</p>
        </div>
        <div class="plan-days-grid">
          ${daysHtml}
        </div>
        <div class="plan-footer">
          <p>💡 Tip: Check off each activity as you complete it to track your progress!</p>
        </div>
      </div>
    `;
  }
}
