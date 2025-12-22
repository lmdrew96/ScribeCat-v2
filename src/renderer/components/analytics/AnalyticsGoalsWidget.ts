/**
 * AnalyticsGoalsWidget
 *
 * Handles goal rendering, modals, and operations for the analytics dashboard.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { GoalsManager, type GoalProgress } from '../../managers/GoalsManager.js';
import { createLogger } from '../../../shared/logger.js';
import { getIconHTML } from '../../utils/iconMap.js';

const logger = createLogger('AnalyticsGoalsWidget');

export interface GoalsWidgetCallbacks {
  getSessions: () => Session[];
  rerenderDashboard: () => void;
}

export class AnalyticsGoalsWidget {
  private goalsManager: GoalsManager;
  private callbacks: GoalsWidgetCallbacks;

  constructor(goalsManager: GoalsManager, callbacks: GoalsWidgetCallbacks) {
    this.goalsManager = goalsManager;
    this.callbacks = callbacks;
  }

  /**
   * Render goals widget
   */
  render(): string {
    const sessions = this.callbacks.getSessions();
    const activeGoals = this.goalsManager.getActiveGoals();
    const dailyGoal = this.goalsManager.getActiveGoal('daily');
    const weeklyGoal = this.goalsManager.getActiveGoal('weekly');

    const dailyProgress = dailyGoal ? this.goalsManager.calculateProgress(dailyGoal, sessions) : null;
    const weeklyProgress = weeklyGoal ? this.goalsManager.calculateProgress(weeklyGoal, sessions) : null;

    // If no goals set, show setup prompt
    if (activeGoals.length === 0) {
      return `
        <div class="analytics-section">
          <h3 class="analytics-section-title">Study Goals</h3>
          <div class="goals-empty">
            <div class="goals-empty-icon">${getIconHTML('target', { size: 32 })}</div>
            <div class="goals-empty-text">Set a study time goal to track your progress!</div>
            <div class="goals-actions">
              <button class="goal-setup-btn" onclick="window.analyticsDashboard?.showGoalModal('daily')">
                Set Daily Goal
              </button>
              <button class="goal-setup-btn" onclick="window.analyticsDashboard?.showGoalModal('weekly')">
                Set Weekly Goal
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Show active goals with progress
    return `
      <div class="analytics-section">
        <h3 class="analytics-section-title">Study Goals</h3>
        <div class="goals-container">
          ${dailyProgress ? this.renderGoalCard(dailyProgress, 'daily') : `
            <div class="goal-card goal-placeholder">
              <div class="goal-placeholder-content">
                <span class="goal-placeholder-icon">${getIconHTML('calendar', { size: 20 })}</span>
                <span class="goal-placeholder-text">No daily goal set</span>
              </div>
              <button class="goal-setup-btn-small" onclick="window.analyticsDashboard?.showGoalModal('daily')">
                Set Goal
              </button>
            </div>
          `}

          ${weeklyProgress ? this.renderGoalCard(weeklyProgress, 'weekly') : `
            <div class="goal-card goal-placeholder">
              <div class="goal-placeholder-content">
                <span class="goal-placeholder-icon">${getIconHTML('chart', { size: 20 })}</span>
                <span class="goal-placeholder-text">No weekly goal set</span>
              </div>
              <button class="goal-setup-btn-small" onclick="window.analyticsDashboard?.showGoalModal('weekly')">
                Set Goal
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render individual goal card
   */
  private renderGoalCard(progress: GoalProgress, type: 'daily' | 'weekly'): string {
    const icon = type === 'daily' ? getIconHTML('calendar', { size: 18 }) : getIconHTML('chart', { size: 18 });
    const title = type === 'daily' ? 'Daily Goal' : 'Weekly Goal';
    const motivationalMsg = this.goalsManager.getMotivationalMessage(progress);
    const timeRemaining = this.goalsManager.getTimeRemaining(progress);
    const onTrack = type === 'weekly' ? this.goalsManager.isOnTrackForWeeklyGoal(progress) : true;

    return `
      <div class="goal-card ${progress.isComplete ? 'goal-complete' : ''}">
        <div class="goal-header">
          <div class="goal-title">
            <span class="goal-icon">${icon}</span>
            <span>${title}</span>
          </div>
          <button class="goal-edit-btn" onclick="window.analyticsDashboard?.showGoalModal('${type}')" title="Edit goal">
            ${getIconHTML('pencil', { size: 14 })}
          </button>
        </div>

        <div class="goal-progress">
          <div class="goal-progress-text">
            <span class="goal-current">${this.goalsManager.formatMinutes(progress.currentMinutes)}</span>
            <span class="goal-separator">/</span>
            <span class="goal-target">${this.goalsManager.formatMinutes(progress.targetMinutes)}</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width: ${progress.percentComplete}%"></div>
          </div>
          <div class="goal-progress-percent">${Math.round(progress.percentComplete)}%</div>
        </div>

        <div class="goal-status">
          ${progress.isComplete
            ? `<span class="goal-status-complete">${getIconHTML('check', { size: 14 })} Complete</span>`
            : `<span class="goal-status-remaining">${timeRemaining}</span>`
          }
          ${type === 'weekly' && !progress.isComplete && progress.daysRemaining
            ? `<span class="goal-days-remaining">${progress.daysRemaining} day${progress.daysRemaining !== 1 ? 's' : ''} left</span>`
            : ''
          }
        </div>

        <div class="goal-motivation ${progress.isComplete ? 'goal-motivation-complete' : ''}">
          ${motivationalMsg}
        </div>

        ${type === 'weekly' && !progress.isComplete
          ? `<div class="goal-on-track ${onTrack ? 'on-track' : 'behind-track'}">
              ${onTrack ? getIconHTML('check', { size: 14 }) + ' On track for weekly goal' : getIconHTML('alertTriangle', { size: 14 }) + ' Behind schedule for weekly goal'}
            </div>`
          : ''
        }
      </div>
    `;
  }

  /**
   * Show goal setting modal
   */
  showGoalModal(type: 'daily' | 'weekly'): void {
    const existingGoal = this.goalsManager.getActiveGoal(type);
    const title = type === 'daily' ? 'Daily Goal' : 'Weekly Goal';
    const subtitle = type === 'daily'
      ? 'How many minutes do you want to study each day?'
      : 'How many minutes do you want to study each week?';

    const presets = type === 'daily'
      ? [15, 30, 45, 60, 90, 120]
      : [120, 180, 300, 420, 600, 900];

    const currentValue = existingGoal?.targetMinutes || presets[2];

    // Create modal overlay
    const modalHtml = `
      <div class="goal-modal" id="goal-modal">
        <div class="goal-modal-overlay" onclick="document.getElementById('goal-modal').remove()"></div>
        <div class="goal-modal-content">
          <div class="goal-modal-header">
            <h3>Set ${title}</h3>
            <button class="close-modal-btn" onclick="document.getElementById('goal-modal').remove()">×</button>
          </div>
          <div class="goal-modal-body">
            <p class="goal-modal-subtitle">${subtitle}</p>

            <div class="goal-presets">
              ${presets.map(minutes => `
                <button
                  class="goal-preset-btn ${currentValue === minutes ? 'active' : ''}"
                  onclick="window.analyticsDashboard?.selectGoalPreset('${type}', ${minutes})"
                  data-minutes="${minutes}"
                >
                  ${this.goalsManager.formatMinutes(minutes)}
                </button>
              `).join('')}
            </div>

            <div class="goal-custom-input">
              <label for="goal-custom-minutes">Or enter custom minutes:</label>
              <input
                type="number"
                id="goal-custom-minutes"
                min="1"
                max="${type === 'daily' ? '1440' : '10080'}"
                value="${currentValue}"
                placeholder="Enter minutes"
              />
            </div>

            <div class="goal-modal-actions">
              <button class="goal-modal-btn goal-modal-cancel" onclick="document.getElementById('goal-modal').remove()">
                Cancel
              </button>
              ${existingGoal ? `
                <button class="goal-modal-btn goal-modal-delete" onclick="window.analyticsDashboard?.deleteGoal('${type}')">
                  Delete Goal
                </button>
              ` : ''}
              <button class="goal-modal-btn goal-modal-save" onclick="window.analyticsDashboard?.saveGoal('${type}')">
                ${existingGoal ? 'Update Goal' : 'Set Goal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild!);
  }

  /**
   * Select a goal preset
   */
  selectGoalPreset(_type: 'daily' | 'weekly', minutes: number): void {
    // Update active state on buttons
    document.querySelectorAll('.goal-preset-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`.goal-preset-btn[data-minutes="${minutes}"]`)?.classList.add('active');

    // Update custom input
    const input = document.getElementById('goal-custom-minutes') as HTMLInputElement;
    if (input) {
      input.value = minutes.toString();
    }
  }

  /**
   * Save goal
   */
  saveGoal(type: 'daily' | 'weekly'): void {
    const input = document.getElementById('goal-custom-minutes') as HTMLInputElement;
    if (!input) return;

    const minutes = parseInt(input.value);
    if (isNaN(minutes) || minutes < 1) {
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.error('Please enter a valid number of minutes');
      }
      return;
    }

    const existingGoal = this.goalsManager.getActiveGoal(type);
    if (existingGoal) {
      this.goalsManager.updateGoal(existingGoal.id, minutes);
    } else {
      this.goalsManager.createGoal(type, minutes);
    }

    // Close modal
    document.getElementById('goal-modal')?.remove();

    // Re-render dashboard
    this.callbacks.rerenderDashboard();

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const goalType = type === 'daily' ? 'Daily' : 'Weekly';
      notificationTicker.success(`${goalType} goal ${existingGoal ? 'updated' : 'set'}! Target: ${this.goalsManager.formatMinutes(minutes)}`, 3000);
    }

    logger.info(`Goal ${existingGoal ? 'updated' : 'created'}: ${type} - ${minutes} minutes`);
  }

  /**
   * Delete goal
   */
  deleteGoal(type: 'daily' | 'weekly'): void {
    const goal = this.goalsManager.getActiveGoal(type);
    if (!goal) return;

    this.goalsManager.deleteGoal(goal.id);

    // Close modal
    document.getElementById('goal-modal')?.remove();

    // Re-render dashboard
    this.callbacks.rerenderDashboard();

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const goalType = type === 'daily' ? 'Daily' : 'Weekly';
      notificationTicker.success(`${goalType} goal deleted`, 3000);
    }

    logger.info(`Goal deleted: ${type}`);
  }
}
