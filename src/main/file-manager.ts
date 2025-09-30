import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SessionData } from '../shared/types';

export class FileManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(process.cwd(), 'sessions');
    this.ensureSessionsDir();
    this.setupIPC();
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private setupIPC(): void {
    ipcMain.handle('files:save', async (event, sessionData: SessionData) => {
      return this.saveSession(sessionData);
    });

    ipcMain.handle('files:load', async (event, sessionId: string) => {
      return this.loadSession(sessionId);
    });

    ipcMain.handle('files:list', async () => {
      return this.listSessions();
    });

    ipcMain.handle('files:delete', async (event, sessionId: string) => {
      return this.deleteSession(sessionId);
    });

    ipcMain.handle('files:export', async (event, sessionId: string, format: string) => {
      return this.exportSession(sessionId, format);
    });
  }

  private async saveSession(sessionData: SessionData): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionData.id}.json`);
      sessionData.updatedAt = new Date();
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  private async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  }

  private async listSessions(): Promise<SessionData[]> {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessions: SessionData[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.sessionsDir, file);
          const data = fs.readFileSync(filePath, 'utf8');
          const session = JSON.parse(data);
          sessions.push(session);
        }
      }

      return sessions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Failed to list sessions:', error);
      throw error;
    }
  }

  private async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  private async exportSession(sessionId: string, format: string): Promise<string> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const exportDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      let content = '';
      let extension = '';

      switch (format) {
        case 'txt':
          content = this.exportAsText(session);
          extension = 'txt';
          break;
        case 'pdf':
          content = this.exportAsPDF(session);
          extension = 'pdf';
          break;
        case 'docx':
          content = this.exportAsDocx(session);
          extension = 'docx';
          break;
        default:
          throw new Error('Unsupported export format');
      }

      const filename = `${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      const filePath = path.join(exportDir, filename);
      fs.writeFileSync(filePath, content);

      return filePath;
    } catch (error) {
      console.error('Failed to export session:', error);
      throw error;
    }
  }

  private exportAsText(session: SessionData): string {
    let content = `# ${session.title}\n\n`;
    
    if (session.courseTitle) {
      content += `**Course:** ${session.courseTitle}\n`;
    }
    
    if (session.assignmentId) {
      content += `**Assignment:** ${session.assignmentId}\n`;
    }
    
    content += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    content += `**Duration:** ${Math.round((session.duration || 0) / 1000)}s\n\n`;
    
    if (session.transcription) {
      content += `## Transcription\n\n${session.transcription}\n\n`;
    }
    
    if (session.notes) {
      content += `## Notes\n\n${session.notes}\n`;
    }
    
    return content;
  }

  private exportAsPDF(session: SessionData): string {
    // This would use a PDF generation library like puppeteer or pdfkit
    // For now, return the text content
    return this.exportAsText(session);
  }

  private exportAsDocx(session: SessionData): string {
    // This would use a DOCX generation library
    // For now, return the text content
    return this.exportAsText(session);
  }
}
