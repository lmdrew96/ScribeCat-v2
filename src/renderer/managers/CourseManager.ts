/**
 * Course Manager
 * 
 * Manages course selection and integration with Canvas LMS.
 */

export class CourseManager {
  private courseSelect: HTMLSelectElement;
  private selectedCourseId: string | null = null;
  private courses: any[] = [];

  constructor() {
    this.courseSelect = document.getElementById('course-select') as HTMLSelectElement;
    this.initializeEventListeners();
    this.loadCourses();
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    this.courseSelect?.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const value = target.value;

      // Check if "Other..." was selected
      if (value === 'custom-other') {
        const customValue = await this.showCustomCoursePrompt();

        if (customValue !== null) {
          // Create a temporary custom course object
          this.selectedCourseId = 'custom-' + Date.now();
          const customCourse = {
            id: this.selectedCourseId,
            title: customValue || 'Other',
            code: customValue || '',
            source: 'custom'
          };

          // Add to courses array
          this.courses.push(customCourse);

          // Refresh dropdown to show the custom course
          this.updateCourseDropdown();

          // Select the custom course
          this.courseSelect.value = this.selectedCourseId;

          console.log('Custom course created:', customCourse);
        } else {
          // User cancelled, reset to previous selection or empty
          target.value = this.selectedCourseId || '';
        }
      } else {
        this.selectedCourseId = value || null;
        console.log('Course selected:', this.selectedCourseId);
      }
    });
  }

  /**
   * Show custom course input prompt
   */
  private showCustomCoursePrompt(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById('input-prompt-modal') as HTMLElement;
      const title = document.getElementById('input-prompt-title') as HTMLElement;
      const label = document.getElementById('input-prompt-label') as HTMLElement;
      const field = document.getElementById('input-prompt-field') as HTMLInputElement;
      const okBtn = document.getElementById('ok-input-prompt-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement;
      const closeBtn = document.getElementById('close-input-prompt-btn') as HTMLButtonElement;

      // Set modal content
      title.textContent = 'Custom Course';
      label.textContent = 'Course title or category (optional):';
      field.value = '';
      field.placeholder = 'e.g., Study Session, Personal Notes, Research...';

      // Show modal
      modal.classList.remove('hidden');
      field.focus();

      // Handle OK button
      const handleOk = () => {
        const value = field.value.trim();
        cleanup();
        resolve(value); // Empty string is OK, null means cancelled
      };

      // Handle cancel
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      // Handle Enter key
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      // Cleanup function
      const cleanup = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        field.removeEventListener('keydown', handleKeydown);
      };

      // Add event listeners
      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
      field.addEventListener('keydown', handleKeydown);
    });
  }

  /**
   * Load courses from both Canvas API and imported courses
   */
  public async loadCourses(): Promise<void> {
    try {
      const allCourses: any[] = [];

      // Try to get courses from Canvas API
      try {
        const apiConfigured = await window.scribeCat.canvas.isConfigured();
        if (apiConfigured.data?.configured) {
          const apiResult = await window.scribeCat.canvas.getCourses();
          if (apiResult.success && apiResult.data) {
            allCourses.push(...apiResult.data.map((course: any) => ({
              ...course,
              source: 'api'
            })));
          }
        }
      } catch (error) {
        console.log('Canvas API not available:', error);
      }

      // Get imported courses from browser extension
      try {
        const importedResult = await window.scribeCat.canvas.getImportedCourses();
        if (importedResult.success && importedResult.data) {
          allCourses.push(...importedResult.data.map((course: any) => ({
            ...course,
            source: 'imported'
          })));
        }
      } catch (error) {
        console.log('No imported courses:', error);
      }

      this.courses = allCourses;
      this.updateCourseDropdown();

    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  }

  /**
   * Update the course dropdown with available courses
   */
  private updateCourseDropdown(): void {
    if (!this.courseSelect) return;

    // Clear existing options except the first one
    while (this.courseSelect.options.length > 1) {
      this.courseSelect.remove(1);
    }

    // Add courses to dropdown
    this.courses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.id;

      // Handle both API format (code/title) and extension format (courseNumber/courseTitle)
      const code = course.code || course.courseNumber;
      const title = course.title || course.courseTitle;

      // Format: "CISC108 - Introduction to Computer Science I"
      const displayText = code
        ? `${code} - ${title || 'Untitled'}`
        : title || 'Untitled Course';

      option.textContent = displayText;

      // Add source indicator
      if (course.source === 'custom') {
        option.title = 'Custom course entry';
      } else {
        option.title = course.source === 'api'
          ? 'From Canvas API'
          : 'Imported from browser extension';
      }

      this.courseSelect.appendChild(option);
    });

    // Add "Other..." option at the end
    const otherOption = document.createElement('option');
    otherOption.value = 'custom-other';
    otherOption.textContent = 'Other...';
    otherOption.title = 'Enter a custom course title or category';
    this.courseSelect.appendChild(otherOption);

    // Always show the dropdown, even when no courses are available
    // Users can still select "No Course Selected" option
    this.courseSelect.style.display = 'inline-block';
  }

  /**
   * Get the currently selected course
   */
  public getSelectedCourse(): any | null {
    if (!this.selectedCourseId) return null;
    return this.courses.find(c => c.id === this.selectedCourseId) || null;
  }

  /**
   * Get the selected course ID
   */
  public getSelectedCourseId(): string | null {
    return this.selectedCourseId;
  }

  /**
   * Set the selected course by ID
   */
  public setSelectedCourse(courseId: string | null): void {
    this.selectedCourseId = courseId;
    if (this.courseSelect) {
      this.courseSelect.value = courseId || '';
    }
  }

  /**
   * Clear course selection
   */
  public clearSelection(): void {
    this.selectedCourseId = null;
    if (this.courseSelect) {
      this.courseSelect.value = '';
    }
  }

  /**
   * Get all available courses
   */
  public getCourses(): any[] {
    return this.courses;
  }

  /**
   * Refresh courses (call after importing new courses)
   */
  public async refresh(): Promise<void> {
    await this.loadCourses();
  }
}
