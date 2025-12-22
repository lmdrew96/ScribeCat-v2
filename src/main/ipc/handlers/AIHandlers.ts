import electron from 'electron';
import type { IpcMain, BrowserWindow } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { ClaudeAIService } from '../../../infrastructure/services/ai/ClaudeAIService.js';
import type { ChatMessage, ChatOptions, PolishOptions, SummaryOptions, TitleOptions } from '../../../shared/types.js';

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
    this.handle(ipcMain, 'ai:chat', async (_event, message: unknown, history: unknown, options?: unknown) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const response = await aiService.chat(
        message as string,
        history as ChatMessage[],
        options as ChatOptions | undefined
      );
      return { success: true, data: response };
    });

    // AI: Chat stream
    this.handle(ipcMain, 'ai:chatStream', async (_event, message: unknown, history: unknown, options: unknown) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const mainWindow = this.getMainWindow();
      await aiService.chatStream(
        message as string,
        history as ChatMessage[],
        options as ChatOptions,
        (chunk: string) => {
          // Send chunk to renderer via IPC
          mainWindow?.webContents.send('ai:chatChunk', chunk);
        }
      );
      
      return { success: true };
    });

    // AI: Polish transcription
    this.handle(ipcMain, 'ai:polishTranscription', async (_event, text: unknown, options?: unknown) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.polishTranscription(text as string, options as PolishOptions | undefined);
      return { success: true, data: result };
    });

    // AI: Generate summary
    this.handle(ipcMain, 'ai:generateSummary', async (_event, transcription: unknown, notes?: unknown, options?: unknown) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.generateSummary(
        transcription as string,
        notes as string | undefined,
        options as SummaryOptions | undefined
      );
      return { success: true, data: result };
    });

    // AI: Generate title
    this.handle(ipcMain, 'ai:generateTitle', async (_event, transcription: unknown, notes?: unknown, options?: unknown) => {
      const aiService = this.getAIService();
      if (!aiService) {
        return { success: false, error: 'AI service not configured. Please set an API key.' };
      }
      
      const result = await aiService.generateTitle(
        transcription as string,
        notes as string | undefined,
        options as TitleOptions | undefined
      );
      return { success: true, data: result };
    });
  }
}
