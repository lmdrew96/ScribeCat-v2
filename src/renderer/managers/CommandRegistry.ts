/**
 * CommandRegistry
 *
 * Central registry for all app commands accessible via command palette.
 * Provides a unified interface for registering and managing commands.
 */

import { CommandPalette, Command } from '../components/CommandPalette.js';

export class CommandRegistry {
  private commandPalette: CommandPalette;

  constructor(commandPalette: CommandPalette) {
    this.commandPalette = commandPalette;
  }

  /**
   * Register all app commands
   */
  public registerAllCommands(context: {
    recordingManager: any;
    studyModeManager: any;
    viewManager: any;
    editorManager: any;
    transcriptionManager: any;
    settingsManager: any;
    aiManager: any;
    courseManager: any;
    authManager: any;
  }): void {
    this.registerRecordingCommands(context.recordingManager);
    this.registerStudyModeCommands(context.studyModeManager);
    this.registerViewCommands(context.viewManager);
    this.registerEditorCommands(context.editorManager);
    this.registerTranscriptionCommands(context.transcriptionManager);
    this.registerSettingsCommands(context.settingsManager);
    this.registerAICommands(context.aiManager);
    this.registerCourseCommands(context.courseManager);
    this.registerAuthCommands(context.authManager);
  }

  /**
   * Register recording-related commands
   */
  private registerRecordingCommands(recordingManager: any): void {
    const commands: Command[] = [
      {
        id: 'recording.start',
        title: 'Start Recording',
        description: 'Begin recording audio and transcription',
        category: 'Recording',
        icon: '🎙️',
        keywords: ['record', 'start', 'begin', 'audio'],
        action: () => {
          const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
          recordBtn?.click();
        }
      },
      {
        id: 'recording.pause',
        title: 'Pause Recording',
        description: 'Pause the current recording',
        category: 'Recording',
        icon: '⏸',
        keywords: ['pause', 'stop temporarily'],
        action: () => {
          const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
          pauseBtn?.click();
        }
      },
      {
        id: 'recording.stop',
        title: 'Stop Recording',
        description: 'Stop recording and save session',
        category: 'Recording',
        icon: '⏹',
        keywords: ['stop', 'end', 'finish', 'save'],
        action: () => {
          const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
          if (recordBtn?.classList.contains('recording')) {
            recordBtn.click();
          }
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register study mode commands
   */
  private registerStudyModeCommands(studyModeManager: any): void {
    const commands: Command[] = [
      {
        id: 'view.studyMode',
        title: 'Open Study Mode',
        description: 'View and review your saved sessions',
        category: 'Navigation',
        icon: '📚',
        keywords: ['study', 'sessions', 'review', 'library'],
        action: () => {
          const studyBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
          studyBtn?.click();
        }
      },
      {
        id: 'view.recording',
        title: 'Back to Recording',
        description: 'Return to recording view',
        category: 'Navigation',
        icon: '🔙',
        keywords: ['back', 'recording', 'main', 'return'],
        action: () => {
          const backBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
          backBtn?.click();
        }
      },
      {
        id: 'study.trash',
        title: 'Open Trash',
        description: 'View deleted sessions',
        category: 'Study Mode',
        icon: '🗑️',
        keywords: ['trash', 'deleted', 'removed'],
        action: () => {
          const trashBtn = document.getElementById('trash-btn') as HTMLButtonElement;
          trashBtn?.click();
        }
      },
      {
        id: 'study.sync',
        title: 'Sync Now',
        description: 'Sync sessions with cloud',
        category: 'Study Mode',
        icon: '☁️',
        keywords: ['sync', 'cloud', 'upload', 'backup'],
        action: () => {
          const syncBtn = document.getElementById('sync-now-btn') as HTMLButtonElement;
          syncBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register view commands
   */
  private registerViewCommands(viewManager: any): void {
    const commands: Command[] = [
      {
        id: 'view.settings',
        title: 'Open Settings',
        description: 'Configure app preferences',
        category: 'Navigation',
        icon: '⚙️',
        shortcut: 'Cmd+,',
        keywords: ['settings', 'preferences', 'config'],
        action: () => {
          const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
          settingsBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register editor commands
   */
  private registerEditorCommands(editorManager: any): void {
    const commands: Command[] = [
      {
        id: 'editor.bold',
        title: 'Bold Text',
        description: 'Make selected text bold',
        category: 'Editor',
        icon: '**B**',
        shortcut: 'Cmd+B',
        keywords: ['bold', 'format', 'strong'],
        action: () => {
          const boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
          boldBtn?.click();
        }
      },
      {
        id: 'editor.italic',
        title: 'Italic Text',
        description: 'Make selected text italic',
        category: 'Editor',
        icon: '*I*',
        shortcut: 'Cmd+I',
        keywords: ['italic', 'format', 'emphasis'],
        action: () => {
          const italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
          italicBtn?.click();
        }
      },
      {
        id: 'editor.underline',
        title: 'Underline Text',
        description: 'Underline selected text',
        category: 'Editor',
        icon: 'U',
        shortcut: 'Cmd+U',
        keywords: ['underline', 'format'],
        action: () => {
          const underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
          underlineBtn?.click();
        }
      },
      {
        id: 'editor.heading1',
        title: 'Heading 1',
        description: 'Format as large heading',
        category: 'Editor',
        icon: 'H1',
        shortcut: 'Cmd+Shift+H',
        keywords: ['heading', 'h1', 'title', 'format'],
        action: () => {
          const h1Btn = document.getElementById('heading1-btn') as HTMLButtonElement;
          h1Btn?.click();
        }
      },
      {
        id: 'editor.heading2',
        title: 'Heading 2',
        description: 'Format as medium heading',
        category: 'Editor',
        icon: 'H2',
        shortcut: 'Cmd+Alt+H',
        keywords: ['heading', 'h2', 'subtitle', 'format'],
        action: () => {
          const h2Btn = document.getElementById('heading2-btn') as HTMLButtonElement;
          h2Btn?.click();
        }
      },
      {
        id: 'editor.bulletList',
        title: 'Bullet List',
        description: 'Create bullet list',
        category: 'Editor',
        icon: '•',
        shortcut: 'Cmd+Shift+8',
        keywords: ['bullet', 'list', 'unordered'],
        action: () => {
          const bulletBtn = document.getElementById('bullet-list-btn') as HTMLButtonElement;
          bulletBtn?.click();
        }
      },
      {
        id: 'editor.numberedList',
        title: 'Numbered List',
        description: 'Create numbered list',
        category: 'Editor',
        icon: '1.',
        shortcut: 'Cmd+Shift+7',
        keywords: ['numbered', 'list', 'ordered'],
        action: () => {
          const numberedBtn = document.getElementById('numbered-list-btn') as HTMLButtonElement;
          numberedBtn?.click();
        }
      },
      {
        id: 'editor.link',
        title: 'Insert Link',
        description: 'Add hyperlink to text',
        category: 'Editor',
        icon: '🔗',
        keywords: ['link', 'url', 'hyperlink'],
        action: () => {
          const linkBtn = document.getElementById('link-btn') as HTMLButtonElement;
          linkBtn?.click();
        }
      },
      {
        id: 'editor.image',
        title: 'Insert Image',
        description: 'Add image to notes',
        category: 'Editor',
        icon: '🖼️',
        keywords: ['image', 'picture', 'photo'],
        action: () => {
          const imageBtn = document.getElementById('image-btn') as HTMLButtonElement;
          imageBtn?.click();
        }
      },
      {
        id: 'editor.table',
        title: 'Insert Table',
        description: 'Add table to notes',
        category: 'Editor',
        icon: '⊞',
        keywords: ['table', 'grid', 'columns'],
        action: () => {
          const tableBtn = document.getElementById('insert-table-btn') as HTMLButtonElement;
          tableBtn?.click();
        }
      },
      {
        id: 'editor.undo',
        title: 'Undo',
        description: 'Undo last action',
        category: 'Editor',
        icon: '↶',
        shortcut: 'Cmd+Z',
        keywords: ['undo', 'revert'],
        action: () => {
          const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
          undoBtn?.click();
        }
      },
      {
        id: 'editor.redo',
        title: 'Redo',
        description: 'Redo last undone action',
        category: 'Editor',
        icon: '↷',
        shortcut: 'Cmd+Y',
        keywords: ['redo', 'repeat'],
        action: () => {
          const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
          redoBtn?.click();
        }
      },
      {
        id: 'editor.clearFormat',
        title: 'Clear Formatting',
        description: 'Remove all formatting from selected text',
        category: 'Editor',
        icon: '✕',
        keywords: ['clear', 'format', 'plain', 'remove'],
        action: () => {
          const clearBtn = document.getElementById('clear-format-btn') as HTMLButtonElement;
          clearBtn?.click();
        }
      },
      {
        id: 'editor.clearNotes',
        title: 'Clear Notes',
        description: 'Delete all notes content',
        category: 'Editor',
        icon: '🗑️',
        keywords: ['clear', 'delete', 'notes', 'remove'],
        action: () => {
          const clearNotesBtn = document.getElementById('clear-notes-btn') as HTMLButtonElement;
          clearNotesBtn?.click();
        }
      },
      {
        id: 'editor.toggleToolbar',
        title: 'Toggle Advanced Toolbar',
        description: 'Show/hide the full formatting toolbar',
        category: 'Editor',
        icon: '🎨',
        keywords: ['toolbar', 'formatting', 'toggle', 'show', 'hide'],
        action: () => {
          const toggleBtn = document.getElementById('toggle-toolbar-btn') as HTMLButtonElement;
          toggleBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register transcription commands
   */
  private registerTranscriptionCommands(transcriptionManager: any): void {
    const commands: Command[] = [
      {
        id: 'transcription.clear',
        title: 'Clear Transcription',
        description: 'Delete all transcription text',
        category: 'Transcription',
        icon: '🗑️',
        keywords: ['clear', 'delete', 'transcription'],
        action: () => {
          const clearBtn = document.getElementById('clear-transcription-btn') as HTMLButtonElement;
          clearBtn?.click();
        }
      },
      {
        id: 'transcription.clearBoth',
        title: 'Clear Both Notes and Transcription',
        description: 'Delete all content from both panels',
        category: 'Transcription',
        icon: '⚠️',
        keywords: ['clear', 'delete', 'both', 'all'],
        action: () => {
          const clearBothBtn = document.getElementById('clear-both-btn') as HTMLButtonElement;
          clearBothBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register settings commands
   */
  private registerSettingsCommands(settingsManager: any): void {
    const commands: Command[] = [
      {
        id: 'settings.theme',
        title: 'Change Theme',
        description: 'Open theme settings',
        category: 'Settings',
        icon: '🎨',
        keywords: ['theme', 'appearance', 'color', 'dark', 'light'],
        action: () => {
          const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
          settingsBtn?.click();
          // Wait for modal to open, then scroll to appearance section
          setTimeout(() => {
            const appearanceGroup = document.querySelector('[data-group="appearance"]') as HTMLElement;
            appearanceGroup?.click();
          }, 200);
        }
      },
      {
        id: 'settings.transcription',
        title: 'Transcription Settings',
        description: 'Configure transcription preferences',
        category: 'Settings',
        icon: '🎙️',
        keywords: ['transcription', 'assemblyai', 'accuracy', 'settings'],
        action: () => {
          const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
          settingsBtn?.click();
          setTimeout(() => {
            const transcriptionGroup = document.querySelector('[data-group="transcription-ai"]') as HTMLElement;
            transcriptionGroup?.click();
          }, 200);
        }
      },
      {
        id: 'settings.integrations',
        title: 'Integrations',
        description: 'Connect Google Drive, Canvas, etc.',
        category: 'Settings',
        icon: '🔌',
        keywords: ['integrations', 'google', 'drive', 'canvas', 'connect'],
        action: () => {
          const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
          settingsBtn?.click();
          setTimeout(() => {
            const integrationsGroup = document.querySelector('[data-group="integrations"]') as HTMLElement;
            integrationsGroup?.click();
          }, 200);
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register AI commands
   */
  private registerAICommands(aiManager: any): void {
    const commands: Command[] = [
      {
        id: 'ai.chat',
        title: 'Open AI Chat',
        description: 'Ask AI about your content',
        category: 'AI Assistant',
        icon: '🤖',
        keywords: ['ai', 'chat', 'assistant', 'ask'],
        action: () => {
          const chatBtn = document.getElementById('floating-chat-btn') as HTMLButtonElement;
          chatBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register course commands
   */
  private registerCourseCommands(courseManager: any): void {
    const commands: Command[] = [
      {
        id: 'course.select',
        title: 'Select Course',
        description: 'Choose course for current session',
        category: 'Organization',
        icon: '📖',
        keywords: ['course', 'select', 'class', 'subject'],
        action: () => {
          const courseSelect = document.getElementById('course-select') as HTMLSelectElement;
          courseSelect?.focus();
          courseSelect?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }

  /**
   * Register auth commands
   */
  private registerAuthCommands(authManager: any): void {
    const commands: Command[] = [
      {
        id: 'auth.signIn',
        title: 'Sign In',
        description: 'Sign in to your account',
        category: 'Account',
        icon: '👤',
        keywords: ['sign', 'in', 'login', 'auth'],
        action: () => {
          const signInBtn = document.getElementById('signin-btn') as HTMLButtonElement;
          signInBtn?.click();
        }
      }
    ];

    this.commandPalette.registerCommands(commands);
  }
}
