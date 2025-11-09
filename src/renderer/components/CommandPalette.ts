/**
 * CommandPalette
 *
 * Cmd+K command palette for quick access to all app actions.
 * Implements fuzzy search and keyboard navigation.
 */

export interface Command {
  id: string;
  title: string;
  description?: string;
  category?: string;
  keywords?: string[];
  shortcut?: string;
  icon?: string;
  action: () => void | Promise<void>;
}

export class CommandPalette {
  private modal: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private resultsList: HTMLElement | null = null;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex: number = 0;
  private isOpen: boolean = false;

  constructor() {
    // Modal will be created in initialize()
  }

  /**
   * Initialize the command palette
   */
  public initialize(): void {
    this.createModal();
    this.setupKeyboardListener();
  }

  /**
   * Register a command
   */
  public registerCommand(command: Command): void {
    this.commands.push(command);
  }

  /**
   * Register multiple commands
   */
  public registerCommands(commands: Command[]): void {
    this.commands.push(...commands);
  }

  /**
   * Unregister a command by ID
   */
  public unregisterCommand(id: string): void {
    this.commands = this.commands.filter(cmd => cmd.id !== id);
  }

  /**
   * Clear all commands
   */
  public clearCommands(): void {
    this.commands = [];
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="command-palette-modal" class="command-palette" style="display: none;">
        <div class="command-palette-overlay" data-close-palette></div>
        <div class="command-palette-content">
          <div class="command-palette-search">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              id="command-palette-input"
              class="command-palette-input"
              placeholder="Type a command or search..."
              autocomplete="off"
              spellcheck="false"
            />
            <kbd class="command-palette-hint">Esc</kbd>
          </div>
          <div class="command-palette-results" id="command-palette-results">
            <div class="command-palette-empty">
              Type to search for commands
            </div>
          </div>
          <div class="command-palette-footer">
            <div class="command-palette-hint-group">
              <kbd>↑↓</kbd> Navigate
              <kbd>↵</kbd> Execute
              <kbd>Esc</kbd> Close
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('command-palette-modal');
    this.searchInput = document.getElementById('command-palette-input') as HTMLInputElement;
    this.resultsList = document.getElementById('command-palette-results');

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.modal || !this.searchInput) return;

    // Close on overlay click
    this.modal.querySelector('[data-close-palette]')?.addEventListener('click', () => {
      this.close();
    });

    // Search input
    this.searchInput.addEventListener('input', () => {
      this.handleSearch();
    });

    // Keyboard navigation
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Prevent form submission
    this.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }

  /**
   * Setup global keyboard listener for Cmd+K
   */
  private setupKeyboardListener(): void {
    document.addEventListener('keydown', (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }

      // Escape to close
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });
  }

  /**
   * Handle search input
   */
  private handleSearch(): void {
    if (!this.searchInput) return;

    const query = this.searchInput.value.toLowerCase().trim();

    if (!query) {
      this.filteredCommands = this.commands;
      this.renderResults();
      return;
    }

    // Fuzzy search
    this.filteredCommands = this.commands.filter(cmd => {
      const searchText = [
        cmd.title,
        cmd.description || '',
        cmd.category || '',
        ...(cmd.keywords || [])
      ].join(' ').toLowerCase();

      return this.fuzzyMatch(query, searchText);
    });

    // Sort by relevance
    this.filteredCommands.sort((a, b) => {
      const aScore = this.getRelevanceScore(query, a);
      const bScore = this.getRelevanceScore(query, b);
      return bScore - aScore;
    });

    this.selectedIndex = 0;
    this.renderResults();
  }

  /**
   * Fuzzy match algorithm
   */
  private fuzzyMatch(query: string, text: string): boolean {
    let queryIndex = 0;
    let textIndex = 0;

    while (queryIndex < query.length && textIndex < text.length) {
      if (query[queryIndex] === text[textIndex]) {
        queryIndex++;
      }
      textIndex++;
    }

    return queryIndex === query.length;
  }

  /**
   * Get relevance score for sorting
   */
  private getRelevanceScore(query: string, command: Command): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const titleLower = command.title.toLowerCase();

    // Exact match in title
    if (titleLower === queryLower) {
      score += 1000;
    }

    // Starts with query
    if (titleLower.startsWith(queryLower)) {
      score += 500;
    }

    // Contains query
    if (titleLower.includes(queryLower)) {
      score += 250;
    }

    // Match in description
    if (command.description?.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Match in keywords
    if (command.keywords?.some(kw => kw.toLowerCase().includes(queryLower))) {
      score += 150;
    }

    return score;
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.filteredCommands.length - 1
        );
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        e.preventDefault();
        this.executeSelected();
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * Update visual selection
   */
  private updateSelection(): void {
    const items = this.resultsList?.querySelectorAll('.command-item');
    items?.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Execute selected command
   */
  private async executeSelected(): Promise<void> {
    const selectedCommand = this.filteredCommands[this.selectedIndex];
    if (!selectedCommand) return;

    try {
      await selectedCommand.action();
      this.close();
    } catch (error) {
      console.error('Error executing command:', error);
    }
  }

  /**
   * Render search results
   */
  private renderResults(): void {
    if (!this.resultsList) return;

    if (this.filteredCommands.length === 0) {
      this.resultsList.innerHTML = `
        <div class="command-palette-empty">
          No commands found
        </div>
      `;
      return;
    }

    // Group by category
    const grouped = this.groupByCategory(this.filteredCommands);

    let html = '';
    for (const [category, commands] of Object.entries(grouped)) {
      if (category !== 'undefined') {
        html += `<div class="command-category">${category}</div>`;
      }

      commands.forEach((cmd, index) => {
        const globalIndex = this.filteredCommands.indexOf(cmd);
        const isSelected = globalIndex === this.selectedIndex;

        html += `
          <div class="command-item ${isSelected ? 'selected' : ''}" data-index="${globalIndex}">
            <div class="command-main">
              ${cmd.icon ? `<span class="command-icon">${cmd.icon}</span>` : ''}
              <div class="command-text">
                <div class="command-title">${this.highlightMatch(cmd.title)}</div>
                ${cmd.description ? `<div class="command-description">${cmd.description}</div>` : ''}
              </div>
            </div>
            ${cmd.shortcut ? `<kbd class="command-shortcut">${cmd.shortcut}</kbd>` : ''}
          </div>
        `;
      });
    }

    this.resultsList.innerHTML = html;

    // Add click listeners
    this.resultsList.querySelectorAll('.command-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0');
        this.selectedIndex = index;
        this.executeSelected();
      });
    });
  }

  /**
   * Group commands by category
   */
  private groupByCategory(commands: Command[]): Record<string, Command[]> {
    const grouped: Record<string, Command[]> = {};

    commands.forEach(cmd => {
      const category = cmd.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(cmd);
    });

    return grouped;
  }

  /**
   * Highlight matching text
   */
  private highlightMatch(text: string): string {
    if (!this.searchInput) return text;

    const query = this.searchInput.value.toLowerCase().trim();
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);

    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);

    return `${before}<mark>${match}</mark>${after}`;
  }

  /**
   * Open the command palette
   */
  public open(): void {
    if (!this.modal || !this.searchInput) return;

    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.searchInput.value = '';
    this.filteredCommands = this.commands;
    this.selectedIndex = 0;
    this.renderResults();

    // Focus input after a short delay
    setTimeout(() => {
      this.searchInput?.focus();
    }, 50);
  }

  /**
   * Close the command palette
   */
  public close(): void {
    if (!this.modal) return;

    this.isOpen = false;
    this.modal.style.display = 'none';
    this.searchInput!.value = '';
  }

  /**
   * Toggle the command palette
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Get whether palette is open
   */
  public getIsOpen(): boolean {
    return this.isOpen;
  }
}
