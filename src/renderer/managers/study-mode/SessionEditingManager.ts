/**
 * SessionEditingManager
 *
 * Handles all session metadata editing operations:
 * - Title editing (list view and detail view)
 * - Course assignment via modal
 *
 * Consolidates previously duplicated code from StudyModeManager.
 */

import { Session } from '../../../domain/entities/Session.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SessionEditingManager');

interface TitleEditConfig {
  fontSize: string;
  padding: string;
  selector: string;
}

export class SessionEditingManager {
  /**
   * Start editing a session title
   *
   * @param session - Session to edit
   * @param context - 'list' for session list view, 'detail' for detail view
   * @param onComplete - Callback after save/cancel
   */
  public startTitleEdit(
    session: Session,
    context: 'list' | 'detail',
    onComplete: () => void
  ): void {
    const config: TitleEditConfig =
      context === 'list'
        ? {
            fontSize: '18px',
            padding: '4px 8px',
            selector: `.session-title[data-session-id="${session.id}"]`
          }
        : {
            fontSize: '28px',
            padding: '8px 12px',
            selector: '.session-detail-title'
          };

    const titleElement = document.querySelector(config.selector) as HTMLElement;
    if (!titleElement) {
      logger.warn('Title element not found', { context, selector: config.selector });
      return;
    }

    const currentTitle = session.title;

    // Create input element
    const input = this.createTitleInput(currentTitle, config);

    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // Save handler
    const saveTitle = async () => {
      const newTitle = input.value.trim();

      if (newTitle && newTitle !== currentTitle) {
        try {
          const result = await window.scribeCat.session.update(session.id, { title: newTitle });

          if (result.success) {
            session.title = newTitle;
            logger.info('Title updated successfully');
          } else {
            logger.error('Failed to update title', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error updating title', error);
          alert('An error occurred while updating the title.');
        }
      }

      onComplete();
    };

    // Add event listeners
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onComplete();
      }
    });
  }

  /**
   * Create title edit input element
   */
  private createTitleInput(currentValue: string, config: TitleEditConfig): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'title-edit-input';
    input.style.cssText = `
      width: 100%;
      padding: ${config.padding};
      font-size: ${config.fontSize};
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;
    return input;
  }

  /**
   * Start course editing via modal dialog
   *
   * @param session - Session to edit
   * @param onComplete - Callback after course assignment (success or cancel)
   */
  public async startCourseEdit(session: Session, onComplete: () => void): Promise<void> {
    // Access global course manager
    const courseManager = (window as any).courseManager;
    if (!courseManager) {
      logger.error('CourseManager not available');
      return;
    }

    // Get modal elements
    const modal = document.getElementById('course-select-modal') as HTMLElement;
    const dropdown = document.getElementById('course-select-dropdown') as HTMLSelectElement;
    const okBtn = document.getElementById('ok-course-select-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-course-select-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('close-course-select-btn') as HTMLButtonElement;

    if (!modal || !dropdown || !okBtn || !cancelBtn || !closeBtn) {
      logger.error('Course selection modal elements not found');
      return;
    }

    // Populate dropdown with courses
    await this.populateCourseDropdown(courseManager, dropdown, session);

    // Show modal
    modal.classList.remove('hidden');
    dropdown.focus();

    // Handle custom course selection
    const handleDropdownChange = async () => {
      if (dropdown.value === 'custom-other') {
        const customValue = await this.showCustomCoursePrompt();

        if (customValue !== null) {
          // Create temporary custom course option
          const customId = `custom-${Date.now()}`;
          const customOption = document.createElement('option');
          customOption.value = customId;
          customOption.textContent = customValue || 'Other';
          customOption.dataset.courseTitle = customValue || 'Other';
          customOption.dataset.courseNumber = '';
          customOption.dataset.custom = 'true';

          // Insert before "Other..." option
          const otherOption = dropdown.querySelector('option[value="custom-other"]');
          if (otherOption) {
            dropdown.insertBefore(customOption, otherOption);
          }
          dropdown.value = customId;
        } else {
          // User cancelled, reset to previous value
          dropdown.value = session.courseId || '';
        }
      }
    };

    // Handle OK button
    const handleOk = async () => {
      await this.saveCourseSelection(session, dropdown);
      cleanup();
      onComplete();
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
    };

    // Cleanup function
    const cleanup = () => {
      modal.classList.add('hidden');
      dropdown.removeEventListener('change', handleDropdownChange);
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      closeBtn.removeEventListener('click', handleCancel);
    };

    // Add event listeners
    dropdown.addEventListener('change', handleDropdownChange);
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
  }

  /**
   * Populate course dropdown with available courses
   */
  private async populateCourseDropdown(
    courseManager: any,
    dropdown: HTMLSelectElement,
    session: Session
  ): Promise<void> {
    await courseManager.loadCourses();
    const courses = courseManager.getCourses();

    // Clear existing options
    dropdown.innerHTML = '';

    // Add "No Course Selected" option
    const noCourseOption = document.createElement('option');
    noCourseOption.value = '';
    noCourseOption.textContent = 'No Course Selected';
    dropdown.appendChild(noCourseOption);

    // Add available courses
    courses.forEach((course: any) => {
      const option = document.createElement('option');
      option.value = course.id;

      // Handle both API format and extension format
      const code = course.code || course.courseNumber;
      const title = course.title || course.courseTitle;
      const displayText = code ? `${code} - ${title || 'Untitled'}` : title || 'Untitled Course';

      option.textContent = displayText;
      option.dataset.courseTitle = title;
      option.dataset.courseNumber = code;
      dropdown.appendChild(option);
    });

    // Add "Other..." option
    const otherOption = document.createElement('option');
    otherOption.value = 'custom-other';
    otherOption.textContent = 'Other...';
    dropdown.appendChild(otherOption);

    // Set current selection
    dropdown.value = session.courseId || '';
  }

  /**
   * Show custom course prompt modal
   */
  private showCustomCoursePrompt(): Promise<string | null> {
    return new Promise((resolve) => {
      const inputModal = document.getElementById('input-prompt-modal') as HTMLElement;
      const inputTitle = document.getElementById('input-prompt-title') as HTMLElement;
      const inputLabel = document.getElementById('input-prompt-label') as HTMLElement;
      const inputField = document.getElementById('input-prompt-field') as HTMLInputElement;
      const inputOkBtn = document.getElementById('ok-input-prompt-btn') as HTMLButtonElement;
      const inputCancelBtn = document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement;
      const inputCloseBtn = document.getElementById('close-input-prompt-btn') as HTMLButtonElement;

      if (!inputModal || !inputTitle || !inputLabel || !inputField) {
        logger.error('Custom course prompt elements not found');
        resolve(null);
        return;
      }

      inputTitle.textContent = 'Custom Course';
      inputLabel.textContent = 'Course title or category (optional):';
      inputField.value = '';
      inputField.placeholder = 'e.g., Study Session, Personal Notes, Research...';

      inputModal.classList.remove('hidden');
      inputField.focus();

      const handleInputOk = () => {
        const value = inputField.value.trim();
        inputCleanup();
        resolve(value);
      };

      const handleInputCancel = () => {
        inputCleanup();
        resolve(null);
      };

      const handleInputKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleInputOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleInputCancel();
        }
      };

      const inputCleanup = () => {
        inputModal.classList.add('hidden');
        inputOkBtn.removeEventListener('click', handleInputOk);
        inputCancelBtn.removeEventListener('click', handleInputCancel);
        inputCloseBtn.removeEventListener('click', handleInputCancel);
        inputField.removeEventListener('keydown', handleInputKeydown);
      };

      inputOkBtn.addEventListener('click', handleInputOk);
      inputCancelBtn.addEventListener('click', handleInputCancel);
      inputCloseBtn.addEventListener('click', handleInputCancel);
      inputField.addEventListener('keydown', handleInputKeydown);
    });
  }

  /**
   * Save course selection to session
   */
  private async saveCourseSelection(session: Session, dropdown: HTMLSelectElement): Promise<void> {
    const selectedValue = dropdown.value;
    const selectedOption = dropdown.options[dropdown.selectedIndex];

    let courseId: string | undefined;
    let courseTitle: string | undefined;
    let courseNumber: string | undefined;

    if (selectedValue && selectedValue !== '') {
      courseId = selectedValue;
      courseTitle = selectedOption.dataset.courseTitle || selectedOption.textContent || undefined;
      courseNumber = selectedOption.dataset.courseNumber || undefined;
    }

    try {
      const result = await window.scribeCat.session.update(session.id, {
        courseId,
        courseTitle,
        courseNumber
      });

      if (result.success) {
        // Update local session
        session.courseId = courseId;
        session.courseTitle = courseTitle;
        session.courseNumber = courseNumber;
        logger.info('Course updated successfully');
      } else {
        logger.error('Failed to update course', result.error);
        alert(`Failed to update course: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error updating course', error);
      alert('An error occurred while updating the course.');
    }
  }
}
