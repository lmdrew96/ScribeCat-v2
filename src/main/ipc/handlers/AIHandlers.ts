import electron from 'electron';
import type { IpcMain, BrowserWindow } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { ClaudeAIService } from '../../../infrastructure/services/ai/ClaudeAIService.js';
import type { ChatMessage } from '../../../shared/types.js';

/**
 * Handles AI-related IPC channels
 * 
 * Manages Claude AI service configuration, chat, and content generation.
 */
export class AIHandlers extends BaseHandler {
  constructor(
    private getAIService: () => ClaudeAIService | null,
    private getMainWindow: () => BrowserWindow | null
  ) {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Note: ai:setApiKey is handled in main.ts because it needs to modify this.aiService
    
    // AI: Check if configured
    this.handle(ipcMain, 'ai:isConfigured', async () => {
      const aiService = this.getAIService();
      const isConfigured = aiService ? await aiService.isConfigured() : false;
      return { success: true, data: isConfigured };
    });

    // AI: Test connection
    this.handle(ipcMain, 'ai:testConnection', async () => {
      console.log('🔍 AI test connection handler called');
      
      const aiService = this.getAIService();
      if (!aiService) {
        console.log('❌ AI service not configured');
        return { success: false, error: 'AI service not configured' };
      }
      
      console.log('✅ AI service exists, calling testConnection...');
      const connected = await aiService.testConnection();
      console.log('📊 Test connection result:', connected);
      
      return { success: true, data: connected };
    });

    // AI: Chat
    this.handle(ipcMain, 'ai:chat', async (event, message: string, history: ChatMessage[], options?: any) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const response = await aiService.chat(message, history, options);
      return { success: true, data: response };
    });

    // AI: Chat stream
    this.handle(ipcMain, 'ai:chatStream', async (event, message: string, history: ChatMessage[], options: any) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const mainWindow = this.getMainWindow();
      await aiService.chatStream(message, history, options, (chunk: string) => {
        // Send chunk to renderer via IPC
        mainWindow?.webContents.send('ai:chatChunk', chunk);
      });
      
      return { success: true };
    });

    // AI: Polish transcription
    this.handle(ipcMain, 'ai:polishTranscription', async (event, text: string, options?: any) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.polishTranscription(text, options);
      return { success: true, data: result };
    });

    // AI: Generate summary
    this.handle(ipcMain, 'ai:generateSummary', async (event, transcription: string, notes?: string, options?: any) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.generateSummary(transcription, notes, options);
      return { success: true, data: result };
    });

    // AI: Generate title
    this.handle(ipcMain, 'ai:generateTitle', async (event, transcription: string, notes?: string, options?: any) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.generateTitle(transcription, notes, options);
      return { success: true, data: result };
    });
  }
}
