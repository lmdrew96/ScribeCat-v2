/**
 * Test fixtures for course-related data
 */

/**
 * Sample course data
 */
export interface SampleCourse {
  id: string;
  code: string;
  name: string;
  term: string;
  instructor?: string;
  enrollmentStatus?: string;
}

/**
 * Create a sample course
 */
export const createSampleCourse = (overrides: Partial<SampleCourse> = {}): SampleCourse => ({
  id: 'course-123',
  code: 'CS 101',
  name: 'Introduction to Computer Science',
  term: 'Fall 2025',
  instructor: 'Dr. Smith',
  enrollmentStatus: 'active',
  ...overrides,
});

/**
 * Create multiple sample courses
 */
export const createSampleCourseList = (count: number = 5): SampleCourse[] => {
  const subjects = ['CS', 'MATH', 'PHYS', 'CHEM', 'BIO'];
  const levels = [101, 201, 301, 401];
  const names = [
    'Introduction to',
    'Advanced',
    'Fundamentals of',
    'Applied',
    'Theoretical',
  ];

  return Array.from({ length: count }, (_, i) => {
    const subject = subjects[i % subjects.length];
    const level = levels[Math.floor(i / subjects.length) % levels.length];
    const prefix = names[i % names.length];

    return createSampleCourse({
      id: `course-${i + 1}`,
      code: `${subject} ${level}`,
      name: `${prefix} ${subject}`,
      term: i % 2 === 0 ? 'Fall 2025' : 'Spring 2025',
    });
  });
};

/**
 * Canvas course data structure
 */
export interface CanvasCourse extends SampleCourse {
  canvasId: number;
  courseCode: string;
  workflowState: string;
}

/**
 * Create a sample Canvas course
 */
export const createSampleCanvasCourse = (
  overrides: Partial<CanvasCourse> = {}
): CanvasCourse => ({
  id: 'canvas-course-123',
  canvasId: 12345,
  code: 'CS 101',
  courseCode: 'CS-101-001',
  name: 'Introduction to Computer Science',
  term: 'Fall 2025',
  workflowState: 'available',
  instructor: 'Dr. Smith',
  ...overrides,
});

/**
 * Sample study set data
 */
export interface SampleStudySet {
  id: string;
  title: string;
  sessions: string[]; // Array of session IDs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a sample study set
 */
export const createSampleStudySet = (overrides: Partial<SampleStudySet> = {}): SampleStudySet => ({
  id: 'study-set-123',
  title: 'Midterm Review',
  sessions: ['session-1', 'session-2', 'session-3'],
  createdAt: new Date('2025-01-15T12:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});
