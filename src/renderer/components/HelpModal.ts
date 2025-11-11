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
  private privacyTab: HTMLElement;
  private termsTab: HTMLElement;
  private privacyContent: HTMLElement;
  private termsContent: HTMLElement;
  private privacyDocument: HTMLElement;
  private termsDocument: HTMLElement;

  constructor() {
    // Get modal elements
    this.modal = document.getElementById('help-modal')!;
    this.privacyTab = document.getElementById('privacy-tab')!;
    this.termsTab = document.getElementById('terms-tab')!;
    this.privacyContent = document.getElementById('privacy-content')!;
    this.termsContent = document.getElementById('terms-content')!;
    this.privacyDocument = document.getElementById('privacy-document')!;
    this.termsDocument = document.getElementById('terms-document')!;

    if (!this.modal) {
      logger.error('Help modal element not found');
      return;
    }

    this.initializeEventListeners();
    this.loadDocuments();
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
   * Switch between Privacy and Terms tabs
   */
  private switchTab(tab: 'privacy' | 'terms'): void {
    if (tab === 'privacy') {
      // Activate privacy tab
      this.privacyTab.classList.add('active');
      this.termsTab.classList.remove('active');
      this.privacyContent.classList.add('active');
      this.privacyContent.classList.remove('hidden');
      this.termsContent.classList.remove('active');
      this.termsContent.classList.add('hidden');
    } else {
      // Activate terms tab
      this.termsTab.classList.add('active');
      this.privacyTab.classList.remove('active');
      this.termsContent.classList.add('active');
      this.termsContent.classList.remove('hidden');
      this.privacyContent.classList.remove('active');
      this.privacyContent.classList.add('hidden');
    }
  }

  /**
   * Show the help modal
   */
  public show(): void {
    this.modal.classList.remove('hidden');
    // Always start with privacy tab
    this.switchTab('privacy');
  }

  /**
   * Hide the help modal
   */
  public hide(): void {
    this.modal.classList.add('hidden');
  }
}
