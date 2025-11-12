/**
 * StudyPlanGenerator
 *
 * Creates personalized study plans based on exam timeline and available time
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';

export class StudyPlanGenerator extends BaseAIToolGenerator {
  /**
   * Generate study plan
   */
  static async generate(session: Session, contentArea: HTMLElement, daysUntilExam?: number, hoursPerDay?: number, forceRegenerate: boolean = false): Promise<void> {
    // If no parameters provided, show the form
    if (daysUntilExam === undefined || hoursPerDay === undefined) {
      this.showStudyPlanForm(session, contentArea);
      return;
    }

    // Check if we have saved results with the same parameters
    if (!forceRegenerate && session.hasAIToolResult('study_plan')) {
      const savedResult = session.getAIToolResult('study_plan');
      // Check if saved result has the same parameters (new format) or matches days (old format)
      const savedDays = savedResult?.data?.daysUntilExam || savedResult?.data?.length;
      const savedHours = savedResult?.data?.hoursPerDay;
      const savedPlan = savedResult?.data?.plan || savedResult?.data;

      if (savedResult && savedPlan && savedDays === daysUntilExam &&
          (savedHours === hoursPerDay || savedHours === undefined)) {
        const totalHours = daysUntilExam * hoursPerDay;
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '📅',
          'Study Plan Available',
          `You have a ${daysUntilExam}-day study plan (${totalHours}h total) generated on {date}.`,
          () => this.renderStudyPlan(savedPlan, daysUntilExam, hoursPerDay, contentArea, session),
          () => this.generate(session, contentArea, daysUntilExam, hoursPerDay, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Creating your study plan...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'study_plan');
        return;
      }

      const { text: transcriptionText, isMultiSession, childSessionTitles } = transcription;
      const sessionTitles = childSessionTitles || [session.title];

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

      const result = await this.callAI(prompt);

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

        // Save the results to session with parameters for proper caching
        const planData = {
          daysUntilExam,
          hoursPerDay,
          plan: studyPlan
        };
        await this.saveResults(session, 'study_plan', planData);

        // Render study plan
        this.renderStudyPlan(studyPlan, daysUntilExam, hoursPerDay, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate study plan');
      }
    } catch (error) {
      console.error('Error generating study plan:', error);
      this.showError(contentArea, 'study_plan', error);
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
  private static renderStudyPlan(plan: Array<{day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string}>, daysUntilExam: number, hoursPerDay: number, contentArea: HTMLElement, session?: Session): void {
    const totalHours = daysUntilExam * hoursPerDay;

    const daysHtml = plan.map(dayPlan => {
      const activitiesHtml = dayPlan.activities.map(activity => `
        <div class="plan-activity">
          <span class="plan-activity-name">${escapeHtml(activity.activity)}</span>
          <span class="plan-activity-duration">${escapeHtml(activity.duration)}</span>
        </div>
      `).join('');

      const toolsHtml = dayPlan.tools.map(tool => `
        <span class="plan-tool-badge">${escapeHtml(tool)}</span>
      `).join('');

      return `
        <div class="plan-day-card">
          <div class="plan-day-header">
            <span class="plan-day-number">Day ${dayPlan.day}</span>
            <span class="plan-day-topics">${escapeHtml(dayPlan.topics)}</span>
          </div>
          <div class="plan-day-goal">
            <strong>Goal:</strong> ${escapeHtml(dayPlan.goal)}
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
