/**
 * Export Types
 *
 * Shared types for export operations.
 */

export type ExportFormat = 'txt' | 'pdf' | 'docx' | 'html';
export type ExportDestination = 'local' | 'drive' | 'both';

export interface ExportOptions {
  format: ExportFormat;
  destination: ExportDestination;
}

export interface ExportCallbacks {
  onBulkExportComplete?: () => void;
}
