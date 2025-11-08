import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportSessionUseCase } from './ExportSessionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IExportService, ExportOptions, ExportResult } from '../../domain/services/IExportService';

describe('ExportSessionUseCase', () => {
  let useCase: ExportSessionUseCase;
  let mockSessionRepository: ISessionRepository;
  let mockTxtExportService: IExportService;
  let mockPdfExportService: IExportService;
  let mockDocxExportService: IExportService;
  let mockHtmlExportService: IExportService;
  let exportServices: Map<string, IExportService>;

  const createMockExportService = (format: 'txt' | 'pdf' | 'docx' | 'html'): IExportService => ({
    export: vi.fn().mockResolvedValue({
      success: true,
      filePath: `/exports/session.${format}`,
      format,
    } as ExportResult),
    getFormat: vi.fn().mockReturnValue(format),
    isAvailable: vi.fn().mockResolvedValue(true),
  });

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository();
    mockTxtExportService = createMockExportService('txt');
    mockPdfExportService = createMockExportService('pdf');
    mockDocxExportService = createMockExportService('docx');
    mockHtmlExportService = createMockExportService('html');

    exportServices = new Map();
    exportServices.set('txt', mockTxtExportService);
    exportServices.set('pdf', mockPdfExportService);
    exportServices.set('docx', mockDocxExportService);
    exportServices.set('html', mockHtmlExportService);

    useCase = new ExportSessionUseCase(mockSessionRepository, exportServices);
  });

  describe('execute - basic export', () => {
    it('should export session to txt format successfully', async () => {
      const session = createSampleSession({ id: 'session-123', title: 'Test Session' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(true);
      expect(result.format).toBe('txt');
      expect(result.filePath).toBe('/exports/session.txt');
      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        '/exports/output.txt',
        undefined
      );
    });

    it('should export session to pdf format successfully', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123', 'pdf', '/exports/output.pdf');

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');
      expect(mockPdfExportService.export).toHaveBeenCalled();
    });

    it('should export session to docx format successfully', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123', 'docx', '/exports/output.docx');

      expect(result.success).toBe(true);
      expect(result.format).toBe('docx');
      expect(mockDocxExportService.export).toHaveBeenCalled();
    });

    it('should export session to html format successfully', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123', 'html', '/exports/output.html');

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(mockHtmlExportService.export).toHaveBeenCalled();
    });

    it('should pass export options to export service', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const options: ExportOptions = {
        includeMetadata: true,
        includeTranscription: true,
        includeNotes: true,
        includeTimestamps: false,
      };

      await useCase.execute('session-123', 'txt', '/exports/output.txt', options);

      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        '/exports/output.txt',
        options
      );
    });

    it('should record export in session history when successful', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      await useCase.execute('session-123', 'pdf', '/exports/output.pdf');

      expect(mockSessionRepository.save).toHaveBeenCalled();
      const savedSession = vi.mocked(mockSessionRepository.save).mock.calls[0][0];
      expect(savedSession.exportHistory).toHaveLength(1);
      expect(savedSession.exportHistory[0].format).toBe('pdf');
      expect(savedSession.exportHistory[0].path).toBe('/exports/session.pdf');
    });

    it('should not record export when export fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockTxtExportService.export).mockResolvedValue({
        success: false,
        filePath: '/exports/output.txt',
        format: 'txt',
        error: 'Export failed',
      });

      await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(mockSessionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('execute - error handling', () => {
    it('should return error when session not found', async () => {
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(null);

      const result = await useCase.execute('non-existent', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(mockTxtExportService.export).not.toHaveBeenCalled();
    });

    it('should return error when export service not available for format', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      // Create use case with no services
      const emptyUseCase = new ExportSessionUseCase(mockSessionRepository, new Map());

      const result = await emptyUseCase.execute('session-123', 'pdf', '/exports/output.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No export service available');
    });

    it('should return error when export service is not available', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockPdfExportService.isAvailable).mockResolvedValue(false);

      const result = await useCase.execute('session-123', 'pdf', '/exports/output.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('is not available');
      expect(mockPdfExportService.export).not.toHaveBeenCalled();
    });

    it('should handle export service throwing error', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockTxtExportService.export).mockRejectedValue(
        new Error('File system error')
      );

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error');
    });

    it('should handle repository findById throwing error', async () => {
      vi.mocked(mockSessionRepository.findById).mockRejectedValue(
        new Error('Database error')
      );

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockSessionRepository.findById).mockRejectedValue('String error');

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('executeWithDefaults', () => {
    it('should export with default options', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      await useCase.executeWithDefaults('session-123', 'pdf', '/exports/output.pdf');

      expect(mockPdfExportService.export).toHaveBeenCalledWith(
        session,
        '/exports/output.pdf',
        expect.objectContaining({
          includeMetadata: true,
          includeTranscription: false,
          includeNotes: true,
          includeTimestamps: true,
        })
      );
    });

    it('should work for all formats', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const formats: Array<'txt' | 'pdf' | 'docx' | 'html'> = ['txt', 'pdf', 'docx', 'html'];

      for (const format of formats) {
        const result = await useCase.executeWithDefaults(
          'session-123',
          format,
          `/exports/output.${format}`
        );

        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
      }
    });

    it('should handle errors same as execute', async () => {
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(null);

      const result = await useCase.executeWithDefaults('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getAvailableFormats', () => {
    it('should return all available formats', async () => {
      const formats = await useCase.getAvailableFormats();

      expect(formats).toContain('txt');
      expect(formats).toContain('pdf');
      expect(formats).toContain('docx');
      expect(formats).toContain('html');
      expect(formats).toHaveLength(4);
    });

    it('should exclude unavailable formats', async () => {
      vi.mocked(mockPdfExportService.isAvailable).mockResolvedValue(false);
      vi.mocked(mockDocxExportService.isAvailable).mockResolvedValue(false);

      const formats = await useCase.getAvailableFormats();

      expect(formats).toContain('txt');
      expect(formats).toContain('html');
      expect(formats).not.toContain('pdf');
      expect(formats).not.toContain('docx');
      expect(formats).toHaveLength(2);
    });

    it('should return empty array when no services available', async () => {
      vi.mocked(mockTxtExportService.isAvailable).mockResolvedValue(false);
      vi.mocked(mockPdfExportService.isAvailable).mockResolvedValue(false);
      vi.mocked(mockDocxExportService.isAvailable).mockResolvedValue(false);
      vi.mocked(mockHtmlExportService.isAvailable).mockResolvedValue(false);

      const formats = await useCase.getAvailableFormats();

      expect(formats).toEqual([]);
    });

    it('should return empty array when no services registered', async () => {
      const emptyUseCase = new ExportSessionUseCase(mockSessionRepository, new Map());

      const formats = await emptyUseCase.getAvailableFormats();

      expect(formats).toEqual([]);
    });
  });

  describe('exportMultiple - batch export', () => {
    it('should export multiple sessions successfully', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'First Session' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Second Session' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Third Session' });

      mockSessionRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        if (id === 'session-3') return session3;
        return null;
      });

      // Recreate use case with updated mocks
      useCase = new ExportSessionUseCase(mockSessionRepository, exportServices);

      const results = await useCase.exportMultiple(
        ['session-1', 'session-2', 'session-3'],
        'pdf',
        '/exports'
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(mockPdfExportService.export).toHaveBeenCalledTimes(3);
    });

    it('should sanitize session titles in output paths', async () => {
      const session = createSampleSession({
        id: 'session-1',
        title: 'Session with spaces & special chars!'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      await useCase.exportMultiple(['session-1'], 'txt', '/exports');

      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        '/exports/Session_with_spaces___special_chars_.txt',
        undefined
      );
    });

    it('should handle partial failures in batch export', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'Session 1' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Session 3' });

      mockSessionRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return null; // not found
        if (id === 'session-3') return session3;
        return null;
      });

      // Recreate use case with updated mocks
      useCase = new ExportSessionUseCase(mockSessionRepository, exportServices);

      const results = await useCase.exportMultiple(
        ['session-1', 'session-2', 'session-3'],
        'pdf',
        '/exports'
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('not found');
      expect(results[2].success).toBe(true);
    });

    it('should continue batch export even if one export fails', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'Session 1' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Session 2' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Session 3' });

      mockSessionRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        if (id === 'session-3') return session3;
        return null;
      });

      let exportCallCount = 0;
      mockPdfExportService.export = vi.fn().mockImplementation(async () => {
        const results: ExportResult[] = [
          { success: true, filePath: '/exports/s1.pdf', format: 'pdf' },
          { success: false, filePath: '/exports/s2.pdf', format: 'pdf', error: 'Export failed' },
          { success: true, filePath: '/exports/s3.pdf', format: 'pdf' }
        ];
        return results[exportCallCount++];
      });

      // Recreate use case with updated mocks
      useCase = new ExportSessionUseCase(mockSessionRepository, exportServices);

      const results = await useCase.exportMultiple(
        ['session-1', 'session-2', 'session-3'],
        'pdf',
        '/exports'
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should handle empty session IDs array', async () => {
      const results = await useCase.exportMultiple([], 'txt', '/exports');

      expect(results).toEqual([]);
      expect(mockTxtExportService.export).not.toHaveBeenCalled();
    });

    it('should pass options to each export', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'Session 1' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Session 2' });

      mockSessionRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      // Recreate use case with updated mocks
      useCase = new ExportSessionUseCase(mockSessionRepository, exportServices);

      const options: ExportOptions = {
        includeMetadata: false,
        includeTranscription: true,
        includeNotes: false,
        includeTimestamps: true,
      };

      await useCase.exportMultiple(['session-1', 'session-2'], 'html', '/exports', options);

      expect(mockHtmlExportService.export).toHaveBeenCalledTimes(2);
      expect(mockHtmlExportService.export).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        options
      );
    });

    it('should handle exceptions in batch export', async () => {
      vi.mocked(mockSessionRepository.findById).mockRejectedValue(
        new Error('Database error')
      );

      const results = await useCase.exportMultiple(['session-1'], 'txt', '/exports');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle very long output paths', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const longPath = '/exports/' + 'a'.repeat(500) + '.txt';
      const result = await useCase.execute('session-123', 'txt', longPath);

      expect(result.success).toBe(true);
      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        longPath,
        undefined
      );
    });

    it('should handle special characters in output paths', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const specialPath = '/exports/session-特殊-字符-🎉.txt';
      await useCase.execute('session-123', 'txt', specialPath);

      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        specialPath,
        undefined
      );
    });

    it('should handle session with missing optional fields', async () => {
      const session = createSampleSession({
        id: 'session-123',
        notes: '',
        tags: [],
        transcription: undefined,
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(true);
      expect(mockTxtExportService.export).toHaveBeenCalledWith(
        session,
        '/exports/output.txt',
        undefined
      );
    });

    it('should handle export service returning different path', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockTxtExportService.export).mockResolvedValue({
        success: true,
        filePath: '/different/path/output.txt',
        format: 'txt',
      });

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/different/path/output.txt');
    });
  });

  describe('integration scenarios', () => {
    it('should export session with full metadata', async () => {
      const session = createSampleSession({
        id: 'session-123',
        title: 'Integration Test Session',
        notes: '<p>Complete session notes</p>',
        tags: ['integration', 'test'],
        duration: 3600,
        courseId: 'course-123',
        cloudId: 'cloud-456',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      const options: ExportOptions = {
        includeMetadata: true,
        includeTranscription: true,
        includeNotes: true,
        includeTimestamps: true,
      };

      const result = await useCase.execute('session-123', 'pdf', '/exports/complete.pdf', options);

      expect(result.success).toBe(true);
      expect(mockPdfExportService.export).toHaveBeenCalledWith(session, '/exports/complete.pdf', options);
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    it('should export multiple sessions in different formats', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'Session 1' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Session 2' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2);

      const pdfResult = await useCase.execute('session-1', 'pdf', '/exports/s1.pdf');
      const txtResult = await useCase.execute('session-2', 'txt', '/exports/s2.txt');

      expect(pdfResult.success).toBe(true);
      expect(txtResult.success).toBe(true);
      expect(mockPdfExportService.export).toHaveBeenCalledTimes(1);
      expect(mockTxtExportService.export).toHaveBeenCalledTimes(1);
    });

    it('should handle export with all services unavailable', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockTxtExportService.isAvailable).mockResolvedValue(false);

      const result = await useCase.execute('session-123', 'txt', '/exports/output.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('is not available');
      expect(mockTxtExportService.export).not.toHaveBeenCalled();
    });
  });
});
