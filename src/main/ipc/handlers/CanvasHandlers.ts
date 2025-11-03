/**
 * Canvas IPC Handlers
 * 
 * Handles IPC communication for Canvas LMS integration.
 */

import electron from 'electron';
import type { IpcMain } from 'electron';
import Store from 'electron-store';
import { BaseHandler } from '../BaseHandler.js';
import { CanvasService } from '../../../infrastructure/services/canvas/CanvasService.js';
import { CanvasConfig } from '../../../domain/services/ICanvasService.js';

const store = new Store({ projectName: 'scribecat-v2', name: 'canvas-store' });

export class CanvasHandlers extends BaseHandler {
  private canvasService: CanvasService;

  constructor() {
    super();
    this.canvasService = new CanvasService();
    this.loadStoredConfig();
  }

  /**
   * Load stored Canvas configuration on startup
   */
  private async loadStoredConfig(): Promise<void> {
    try {
      const config = (store as any).get('canvas-config') as CanvasConfig | undefined;
      if (config) {
        await this.canvasService.configure(config);
      }
    } catch (error) {
      console.error('Failed to load Canvas config:', error);
    }
  }

  register(ipcMain: IpcMain): void {
    /**
     * Configure Canvas connection
     */
    this.handle(ipcMain, 'canvas:configure', async (_event, config: CanvasConfig) => {
      await this.canvasService.configure(config);
      
      // Store config securely
      (store as any).set('canvas-config', config);
      
      return { success: true, data: { configured: true } };
    });

    /**
     * Test Canvas connection
     */
    this.handle(ipcMain, 'canvas:test-connection', async () => {
      const result = await this.canvasService.testConnection();
      return { success: true, data: { connected: result } };
    });

    /**
     * Get enrolled courses
     */
    this.handle(ipcMain, 'canvas:get-courses', async () => {
      const courses = await this.canvasService.getCourses();
      return { success: true, data: courses };
    });

    /**
     * Check if Canvas is configured
     */
    this.handle(ipcMain, 'canvas:is-configured', async () => {
      const configured = this.canvasService.isConfigured();
      return { success: true, data: { configured } };
    });

    /**
     * Get current Canvas configuration (without sensitive data)
     */
    this.handle(ipcMain, 'canvas:get-config', async () => {
      const config = this.canvasService.getConfig();
      if (config) {
        // Return config without the API token for security
        return {
          success: true,
          data: {
            baseUrl: config.baseUrl,
            hasToken: !!config.apiToken,
          },
        };
      }
      return { success: true, data: null };
    });

    /**
     * Disconnect from Canvas
     */
    this.handle(ipcMain, 'canvas:disconnect', async () => {
      await this.canvasService.disconnect();
      (store as any).delete('canvas-config');
      return { success: true, data: { disconnected: true } };
    });

    /**
     * Import courses from browser extension JSON
     */
    this.handle(ipcMain, 'canvas:import-courses', async (_event, jsonData: string) => {
      try {
        const data = JSON.parse(jsonData);
        
        // Validate JSON format
        if (data.source !== 'ScribeCat Canvas Browser Extension' || 
            data.format !== 'scribecat_course_import_v1' ||
            !Array.isArray(data.courses)) {
          throw new Error('Invalid JSON format. Please use the ScribeCat Canvas Browser Extension.');
        }
        
        // Store imported courses
        (store as any).set('canvas-imported-courses', data.courses);
        
        return { 
          success: true, 
          data: { 
            imported: true, 
            count: data.courses.length,
            courses: data.courses 
          } 
        };
      } catch (error) {
        throw new Error(`Failed to import courses: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    /**
     * Get imported courses
     */
    this.handle(ipcMain, 'canvas:get-imported-courses', async () => {
      const courses = (store as any).get('canvas-imported-courses') || [];
      return { success: true, data: courses };
    });

    /**
     * Delete an imported course
     */
    this.handle(ipcMain, 'canvas:delete-imported-course', async (_event, courseId: string) => {
      const courses = (store as any).get('canvas-imported-courses') || [];
      const filtered = courses.filter((c: any) => c.id !== courseId);
      (store as any).set('canvas-imported-courses', filtered);
      return { success: true, data: { deleted: true } };
    });
  }
}
