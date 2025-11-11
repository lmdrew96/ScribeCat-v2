/**
 * HelpModal
 *
 * Modal for displaying Privacy Policy and Terms of Service
 */

import { marked } from 'marked';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('HelpModal');

export class HelpModal {
  private modal: HTMLElement;
  private aboutTab: HTMLElement;
  private helpTab: HTMLElement;
  private privacyTab: HTMLElement;
  private termsTab: HTMLElement;
  private aboutContent: HTMLElement;
  private helpContent: HTMLElement;
  private privacyContent: HTMLElement;
  private termsContent: HTMLElement;
  private aboutDocument: HTMLElement;
  private helpDocument: HTMLElement;
  private privacyDocument: HTMLElement;
  private termsDocument: HTMLElement;

  constructor() {
    // Get modal elements
    this.modal = document.getElementById('help-modal')!;
    this.aboutTab = document.getElementById('about-tab')!;
    this.helpTab = document.getElementById('help-tab')!;
    this.privacyTab = document.getElementById('privacy-tab')!;
    this.termsTab = document.getElementById('terms-tab')!;
    this.aboutContent = document.getElementById('about-content')!;
    this.helpContent = document.getElementById('help-content')!;
    this.privacyContent = document.getElementById('privacy-content')!;
    this.termsContent = document.getElementById('terms-content')!;
    this.aboutDocument = document.getElementById('about-document')!;
    this.helpDocument = document.getElementById('help-document')!;
    this.privacyDocument = document.getElementById('privacy-document')!;
    this.termsDocument = document.getElementById('terms-document')!;

    if (!this.modal) {
      logger.error('Help modal element not found');
      return;
    }

    this.initializeEventListeners();
    this.loadDocuments();
    this.populateAboutContent();
    this.populateHelpContent();
  }

  /**
   * Initialize event listeners for modal interactions
   */
  private initializeEventListeners(): void {
    // Open button
    const helpBtn = document.getElementById('help-btn');
    helpBtn?.addEventListener('click', () => this.show());

    // Close buttons
    const closeBtn = document.getElementById('close-help-btn');
    closeBtn?.addEventListener('click', () => this.hide());

    const closeModalBtn = document.getElementById('close-help-modal-btn');
    closeModalBtn?.addEventListener('click', () => this.hide());

    // Close on overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    overlay?.addEventListener('click', () => this.hide());

    // Prevent clicks inside modal content from closing
    const modalContent = this.modal.querySelector('.modal-content');
    modalContent?.addEventListener('click', (e) => e.stopPropagation());

    // Tab switching
    this.aboutTab?.addEventListener('click', () => this.switchTab('about'));
    this.helpTab?.addEventListener('click', () => this.switchTab('help'));
    this.privacyTab?.addEventListener('click', () => this.switchTab('privacy'));
    this.termsTab?.addEventListener('click', () => this.switchTab('terms'));
  }

  /**
   * Load Privacy Policy and Terms of Service documents
   */
  private async loadDocuments(): Promise<void> {
    try {
      // Load Privacy Policy
      const privacyResponse = await fetch('assets/PRIVACY.md');
      const privacyMarkdown = await privacyResponse.text();
      const privacyHtml = await marked.parse(privacyMarkdown);
      this.privacyDocument.innerHTML = privacyHtml;

      // Load Terms of Service
      const termsResponse = await fetch('assets/TERMS.md');
      const termsMarkdown = await termsResponse.text();
      const termsHtml = await marked.parse(termsMarkdown);
      this.termsDocument.innerHTML = termsHtml;

      logger.info('Legal documents loaded successfully');
    } catch (error) {
      logger.error('Failed to load legal documents:', error);
      this.privacyDocument.innerHTML = '<p class="error">Failed to load Privacy Policy. Please try again later.</p>';
      this.termsDocument.innerHTML = '<p class="error">Failed to load Terms of Service. Please try again later.</p>';
    }
  }

  /**
   * Switch between tabs
   */
  private switchTab(tab: 'about' | 'help' | 'privacy' | 'terms'): void {
    // Deactivate all tabs
    this.aboutTab.classList.remove('active');
    this.helpTab.classList.remove('active');
    this.privacyTab.classList.remove('active');
    this.termsTab.classList.remove('active');

    // Hide all content
    this.aboutContent.classList.remove('active');
    this.aboutContent.classList.add('hidden');
    this.helpContent.classList.remove('active');
    this.helpContent.classList.add('hidden');
    this.privacyContent.classList.remove('active');
    this.privacyContent.classList.add('hidden');
    this.termsContent.classList.remove('active');
    this.termsContent.classList.add('hidden');

    // Activate selected tab and show its content
    switch (tab) {
      case 'about':
        this.aboutTab.classList.add('active');
        this.aboutContent.classList.add('active');
        this.aboutContent.classList.remove('hidden');
        break;
      case 'help':
        this.helpTab.classList.add('active');
        this.helpContent.classList.add('active');
        this.helpContent.classList.remove('hidden');
        break;
      case 'privacy':
        this.privacyTab.classList.add('active');
        this.privacyContent.classList.add('active');
        this.privacyContent.classList.remove('hidden');
        break;
      case 'terms':
        this.termsTab.classList.add('active');
        this.termsContent.classList.add('active');
        this.termsContent.classList.remove('hidden');
        break;
    }
  }

  /**
   * Show the help modal
   */
  public show(): void {
    this.modal.classList.remove('hidden');
    // Always start with about tab
    this.switchTab('about');
  }

  /**
   * Hide the help modal
   */
  public hide(): void {
    this.modal.classList.add('hidden');
  }

  /**
   * Populate the About tab content
   */
  private async populateAboutContent(): Promise<void> {
    // Get version dynamically from package.json via IPC
    let version = '...';
    try {
      version = await window.scribeCat.app.getVersion();
    } catch (error) {
      logger.error('Failed to get app version:', error);
      version = 'Unknown';
    }

    this.aboutDocument.innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <img src="../../assets/nugget-logo.PNG" alt="ScribeCat Logo" style="width: 120px; height: 120px; border-radius: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 10px 0;">ScribeCat</h1>
        <p style="font-size: 1.2em; color: #888; margin: 0 0 10px 0;">Version ${version}</p>
        <p style="font-size: 1.1em; font-style: italic; margin: 0 0 30px 0;">ScribeCat scribes and is cat 🐱✨</p>
      </div>

      <h2>What is ScribeCat?</h2>
      <p>
        ScribeCat is a powerful desktop application for recording lectures, meetings, and conversations
        with real-time transcription, intelligent note-taking, and AI-powered study tools.
      </p>

      <h2>Key Features</h2>
      <ul>
        <li><strong>Real-Time Transcription:</strong> High-quality speech-to-text powered by AssemblyAI</li>
        <li><strong>Rich Text Editor:</strong> Professional note-taking with extensive formatting options</li>
        <li><strong>AI Study Tools:</strong> 9 powerful AI tools including flashcards, quizzes, summaries, and concept maps</li>
        <li><strong>Cloud Sync:</strong> Access your sessions across devices with secure cloud storage</li>
        <li><strong>Canvas LMS Integration:</strong> Organize sessions by course</li>
        <li><strong>40 Beautiful Themes:</strong> Customize your workspace with themes designed for focus, creativity, and productivity</li>
        <li><strong>Export Options:</strong> Export to PDF, DOCX, TXT, HTML, Markdown, and Google Drive</li>
      </ul>

      <h2>Brought to You by ADHD</h2>
      <p style="font-size: 1.1em; font-weight: bold; color: #3498db;">
        Agentic Development of Human Designs
      </p>
      <p>
        ScribeCat was built with accessibility and neurodiversity in mind, designed to help students
        of all learning styles succeed.
      </p>

      <h2>Credits & Acknowledgments</h2>
      <ul>
        <li><strong>Transcription:</strong> AssemblyAI</li>
        <li><strong>AI Assistant:</strong> Anthropic Claude</li>
        <li><strong>Rich Text Editor:</strong> Tiptap</li>
        <li><strong>Built with:</strong> Electron, TypeScript, Vite</li>
      </ul>

      <p style="margin-top: 30px; text-align: center; color: #888;">
        Made with ❤️ for students everywhere
      </p>
    `;
  }

  /**
   * Populate the Help tab content
   */
  private populateHelpContent(): void {
    this.helpDocument.innerHTML = `
      <h1>Help & Getting Started</h1>

      <h2>Quick Start</h2>
      <ol>
        <li><strong>Start Recording:</strong> Click the red record button to begin capturing audio</li>
        <li><strong>Take Notes:</strong> Use the rich text editor on the left to take notes while recording</li>
        <li><strong>View Transcription:</strong> Real-time transcription appears on the right panel</li>
        <li><strong>Pause/Resume:</strong> Use the pause button to temporarily stop recording</li>
        <li><strong>Stop & Save:</strong> Click the record button again to stop and save your session</li>
      </ol>

      <h2>Keyboard Shortcuts</h2>
      <h3>Text Formatting</h3>
      <ul>
        <li><strong>Ctrl/Cmd + B:</strong> Bold</li>
        <li><strong>Ctrl/Cmd + I:</strong> Italic</li>
        <li><strong>Ctrl/Cmd + U:</strong> Underline</li>
        <li><strong>Ctrl/Cmd + Shift + S:</strong> Strikethrough</li>
        <li><strong>Ctrl/Cmd + Shift + H:</strong> Heading 1</li>
        <li><strong>Ctrl/Cmd + Alt + H:</strong> Heading 2</li>
        <li><strong>Ctrl/Cmd + Shift + 8:</strong> Bullet List</li>
        <li><strong>Ctrl/Cmd + Shift + 7:</strong> Numbered List</li>
      </ul>

      <h3>Editing</h3>
      <ul>
        <li><strong>Ctrl/Cmd + Z:</strong> Undo</li>
        <li><strong>Ctrl/Cmd + Y:</strong> Redo</li>
      </ul>

      <h2>Study Mode</h2>
      <p>
        Access Study Mode by clicking the 📚 button in the top right. Here you can:
      </p>
      <ul>
        <li>View all your saved sessions</li>
        <li>Search and filter by course or date</li>
        <li>Play back recordings with synchronized transcription</li>
        <li>Use AI study tools (flashcards, quizzes, summaries, etc.)</li>
        <li>Export sessions in multiple formats</li>
        <li>Share sessions with classmates</li>
      </ul>

      <h2>Common Issues & Troubleshooting</h2>

      <h3>Microphone Not Working</h3>
      <ul>
        <li>Check that you've granted microphone permissions to ScribeCat</li>
        <li>Try selecting a different microphone from the dropdown</li>
        <li>Restart the application</li>
      </ul>

      <h3>Transcription Not Appearing</h3>
      <ul>
        <li>Verify your internet connection (transcription requires online access)</li>
        <li>Check that you're speaking clearly and close enough to the microphone</li>
        <li>Ensure the VU meter shows audio input levels</li>
      </ul>

      <h3>Cloud Sync Issues</h3>
      <ul>
        <li>Check your internet connection</li>
        <li>Sign out and sign back in</li>
        <li>Try the "Sync Now" button in Study Mode</li>
      </ul>

      <h2>Need More Help?</h2>
      <p>
        For additional support, bug reports, or feature requests, please visit our
        <a href="#" style="color: #3498db;">GitHub repository</a> or check the full documentation.
      </p>

      <h2>Tips for Best Results</h2>
      <ul>
        <li><strong>Use a quality microphone:</strong> Better audio = better transcription</li>
        <li><strong>Minimize background noise:</strong> Find a quiet space for recording</li>
        <li><strong>Speak clearly:</strong> Enunciate for improved accuracy</li>
        <li><strong>Review and edit:</strong> Always review transcriptions for accuracy</li>
        <li><strong>Organize with courses:</strong> Use the course selector to keep sessions organized</li>
        <li><strong>Use AI tools:</strong> Take advantage of the study tools to reinforce learning</li>
      </ul>
    `;
  }
}
