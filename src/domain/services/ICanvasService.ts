/**
 * Canvas LMS Service Interface
 * 
 * Defines the contract for Canvas LMS integration.
 * Handles course fetching and organization.
 */

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id?: number;
  workflow_state: string;
}

export interface CanvasConfig {
  baseUrl: string;
  apiToken: string;
}

export interface ICanvasService {
  /**
   * Configure Canvas connection
   */
  configure(config: CanvasConfig): Promise<void>;
  
  /**
   * Test Canvas connection
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Fetch user's enrolled courses
   */
  getCourses(): Promise<CanvasCourse[]>;
  
  /**
   * Get current configuration
   */
  getConfig(): CanvasConfig | null;
  
  /**
   * Check if Canvas is configured
   */
  isConfigured(): boolean;
  
  /**
   * Clear Canvas configuration
   */
  disconnect(): Promise<void>;
}
