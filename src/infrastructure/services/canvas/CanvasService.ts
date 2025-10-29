/**
 * Canvas LMS Service Implementation
 * 
 * Handles communication with Canvas LMS API.
 * Stores credentials securely and fetches course data.
 */

import { ICanvasService, CanvasCourse, CanvasConfig } from '../../../domain/services/ICanvasService';

export class CanvasService implements ICanvasService {
  private config: CanvasConfig | null = null;

  /**
   * Configure Canvas connection
   */
  async configure(config: CanvasConfig): Promise<void> {
    // Validate config
    if (!config.baseUrl || !config.apiToken) {
      throw new Error('Canvas URL and API token are required');
    }

    // Normalize base URL (remove trailing slash)
    config.baseUrl = config.baseUrl.replace(/\/$/, '');

    // Test connection before saving
    const testConfig = { ...config };
    this.config = testConfig;
    
    try {
      await this.testConnection();
      // Connection successful, keep config
    } catch (error) {
      this.config = null;
      throw error;
    }
  }

  /**
   * Test Canvas connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Canvas not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/users/self`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token');
        } else if (response.status === 404) {
          throw new Error('Invalid Canvas URL');
        } else {
          throw new Error(`Connection failed: ${response.statusText}`);
        }
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to Canvas');
    }
  }

  /**
   * Fetch user's enrolled courses
   */
  async getCourses(): Promise<CanvasCourse[]> {
    if (!this.config) {
      throw new Error('Canvas not configured');
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.statusText}`);
      }

      const courses: CanvasCourse[] = await response.json();
      
      // Filter out concluded courses and sort by name
      return courses
        .filter(course => course.workflow_state === 'available')
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch courses');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CanvasConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Check if Canvas is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Clear Canvas configuration
   */
  async disconnect(): Promise<void> {
    this.config = null;
  }
}
