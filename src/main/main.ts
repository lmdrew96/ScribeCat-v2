import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { RecordingManager } from './recording-manager';
import { FileManager } from './file-manager';
import { TranscriptionManager } from './transcription-manager';

class ScribeCatApp {
  private mainWindow: BrowserWindow | null = null;
  private recordingManager: RecordingManager | null = null;
  private fileManager: FileManager | null = null;
  private transcriptionManager: TranscriptionManager | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupSecurity();
      this.setupManagers();
      this.setupIPC();
      this.setupMenu();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private setupManagers(): void {
    this.recordingManager = new RecordingManager(this.mainWindow);
    this.fileManager = new FileManager();
    this.transcriptionManager = new TranscriptionManager();
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      titleBarStyle: 'hiddenInset',
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });
  }

  private setupSecurity(): void {
    // Disable web security in development only
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow?.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data:'
          }
        });
      });
    }
  }

  private setupIPC(): void {
    // IPC handlers are now set up in the respective managers
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Session',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu:new-session');
            }
          },
          {
            label: 'Save Session',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu:save-session');
            }
          },
          { type: 'separator' },
          {
            label: 'Export',
            submenu: [
              {
                label: 'Export as Text',
                click: () => {
                  this.mainWindow?.webContents.send('menu:export-txt');
                }
              },
              {
                label: 'Export as PDF',
                click: () => {
                  this.mainWindow?.webContents.send('menu:export-pdf');
                }
              }
            ]
          }
        ]
      },
      {
        label: 'Recording',
        submenu: [
          {
            label: 'Start Recording',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              this.mainWindow?.webContents.send('menu:start-recording');
            }
          },
          {
            label: 'Stop Recording',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => {
              this.mainWindow?.webContents.send('menu:stop-recording');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

new ScribeCatApp();
