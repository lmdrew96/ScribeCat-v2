/**
 * ModalDialog - Shared modal dialog component
 *
 * Provides reusable modal dialogs for confirmations, prompts, and custom content.
 * Handles overlay, keyboard events (ESC/Enter), and focus management.
 */

export interface ModalConfig {
  title: string;
  content?: string | HTMLElement;
  buttons?: ModalButton[];
  onClose?: () => void;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
}

export interface ModalButton {
  text: string;
  type?: 'primary' | 'secondary' | 'danger';
  onClick: () => void | Promise<void>;
}

export class ModalDialog {
  private overlay: HTMLElement | null = null;
  private config: ModalConfig;

  private static readonly BUTTON_STYLES = {
    primary: 'background: #27ae60; color: #fff;',
    secondary: 'background: #555; color: #fff;',
    danger: 'background: #e74c3c; color: #fff;'
  };

  constructor(config: ModalConfig) {
    this.config = {
      closeOnOverlay: true,
      closeOnEscape: true,
      ...config
    };
  }

  /**
   * Show the modal
   */
  public show(): void {
    this.create();
    this.attachEventListeners();
  }

  /**
   * Close and remove the modal
   */
  public close(): void {
    if (this.overlay && this.overlay.parentNode) {
      document.body.removeChild(this.overlay);
      this.overlay = null;

      if (this.config.onClose) {
        this.config.onClose();
      }
    }
  }

  /**
   * Create the modal structure
   */
  private create(): void {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog-content';
    dialog.style.cssText = `
      background: #2c2c2c;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0 0 16px 0; color: #fff; font-size: 18px;';
    title.textContent = this.config.title;
    dialog.appendChild(title);

    // Content
    if (this.config.content) {
      const contentContainer = document.createElement('div');
      contentContainer.style.cssText = 'margin: 0 0 16px 0; color: #ccc; font-size: 14px; line-height: 1.5;';

      if (typeof this.config.content === 'string') {
        contentContainer.innerHTML = this.config.content;
      } else {
        contentContainer.appendChild(this.config.content);
      }

      dialog.appendChild(contentContainer);
    }

    // Buttons
    if (this.config.buttons && this.config.buttons.length > 0) {
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

      this.config.buttons.forEach(buttonConfig => {
        const button = document.createElement('button');
        button.textContent = buttonConfig.text;
        button.style.cssText = `
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          ${ModalDialog.BUTTON_STYLES[buttonConfig.type || 'secondary']}
        `;

        button.addEventListener('click', async () => {
          await buttonConfig.onClick();
          this.close();
        });

        buttonContainer.appendChild(button);
      });

      dialog.appendChild(buttonContainer);
    }

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.overlay) return;

    // Close on overlay click
    if (this.config.closeOnOverlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    // Close on escape
    if (this.config.closeOnEscape) {
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.close();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }
  }

  /**
   * Static convenience method: Show a confirmation dialog
   */
  public static confirm(
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>
  ): ModalDialog {
    const modal = new ModalDialog({
      title,
      content: message,
      buttons: [
        {
          text: 'Cancel',
          type: 'secondary',
          onClick: () => {}
        },
        {
          text: 'Confirm',
          type: 'primary',
          onClick: onConfirm
        }
      ]
    });
    modal.show();
    return modal;
  }

  /**
   * Static convenience method: Show an alert dialog
   */
  public static alert(title: string, message: string): ModalDialog {
    const modal = new ModalDialog({
      title,
      content: message,
      buttons: [
        {
          text: 'OK',
          type: 'primary',
          onClick: () => {}
        }
      ]
    });
    modal.show();
    return modal;
  }

  /**
   * Static convenience method: Show a prompt dialog
   */
  public static prompt(
    title: string,
    message: string,
    placeholder: string = ''
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #555;
        border-radius: 4px;
        background: #1e1e1e;
        color: #fff;
        font-size: 14px;
        box-sizing: border-box;
        margin-top: 8px;
      `;

      const contentContainer = document.createElement('div');
      const messageP = document.createElement('p');
      messageP.textContent = message;
      messageP.style.marginBottom = '8px';
      contentContainer.appendChild(messageP);
      contentContainer.appendChild(input);

      const modal = new ModalDialog({
        title,
        content: contentContainer,
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            onClick: () => resolve(null)
          },
          {
            text: 'OK',
            type: 'primary',
            onClick: () => {
              const value = input.value.trim();
              resolve(value || null);
            }
          }
        ],
        onClose: () => resolve(null)
      });

      modal.show();

      // Focus input after modal is shown
      setTimeout(() => input.focus(), 100);

      // Handle Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          modal.close();
          resolve(value || null);
        }
      });
    });
  }
}
