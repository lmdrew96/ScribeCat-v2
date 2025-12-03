/**
 * Types for the Analytics Dashboard module
 */

export interface StudyStats {
  totalStudyTime: number; // Total minutes
  totalSessions: number;
  averageDuration: number; // Minutes
  coursesBreakdown: Map<string, { count: number; totalTime: number }>;
  currentStreak: number; // Days
  longestStreak: number; // Days
  studyDates: Date[]; // All unique study dates
}
