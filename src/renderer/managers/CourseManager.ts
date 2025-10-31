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
    this.courseSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedCourseId = target.value || null;
      console.log('Course selected:', this.selectedCourseId);
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
      option.title = course.source === 'api' 
        ? 'From Canvas API' 
        : 'Imported from browser extension';
      
      this.courseSelect.appendChild(option);
    });

    // Show/hide dropdown based on course availability
    if (this.courses.length === 0) {
      this.courseSelect.style.display = 'none';
    } else {
      this.courseSelect.style.display = 'inline-block';
    }
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
