import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Session, ExportRecord } from './Session';
import { Transcription, TranscriptionSegment } from './Transcription';

describe('Session Entity', () => {
  let testDate: Date;
  let testTranscription: Transcription;

  beforeEach(() => {
    testDate = new Date('2025-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(testDate);

    const segments: TranscriptionSegment[] = [
      { text: 'Test transcription', startTime: 0, endTime: 5 },
    ];
    testTranscription = new Transcription(
      'Test transcription',
      segments,
      'en',
      'simulation',
      testDate
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create a valid session', () => {
      const session = new Session(
        'session-1',
        'Test Session',
        '/path/to/audio.webm',
        '<p>Notes</p>',
        testDate,
        testDate,
        300,
        testTranscription,
        ['tag1', 'tag2'],
        [],
        'course-1',
        'Computer Science',
        'CS101'
      );

      expect(session.id).toBe('session-1');
      expect(session.title).toBe('Test Session');
      expect(session.recordingPath).toBe('/path/to/audio.webm');
      expect(session.notes).toBe('<p>Notes</p>');
      expect(session.duration).toBe(300);
      expect(session.transcription).toBe(testTranscription);
      expect(session.tags).toEqual(['tag1', 'tag2']);
      expect(session.courseId).toBe('course-1');
    });

    it('should create session without optional fields', () => {
      const session = new Session(
        'session-1',
        'Test Session',
        '/path/to/audio.webm',
        '',
        testDate,
        testDate,
        300
      );

      expect(session.transcription).toBeUndefined();
      expect(session.tags).toEqual([]);
      expect(session.exportHistory).toEqual([]);
      expect(session.courseId).toBeUndefined();
    });
  });

  describe('updateNotes', () => {
    it('should update notes and updatedAt timestamp', () => {
      const session = new Session(
        'session-1',
        'Test',
        '/path',
        'Old notes',
        testDate,
        testDate,
        300
      );

      const futureDate = new Date('2025-01-02T00:00:00Z');
      vi.setSystemTime(futureDate);

      session.updateNotes('New notes');

      expect(session.notes).toBe('New notes');
      expect(session.updatedAt).toEqual(futureDate);
    });
  });

  describe('updateTitle', () => {
    it('should update title and updatedAt timestamp', () => {
      const session = new Session(
        'session-1',
        'Old Title',
        '/path',
        '',
        testDate,
        testDate,
        300
      );

      const futureDate = new Date('2025-01-02T00:00:00Z');
      vi.setSystemTime(futureDate);

      session.updateTitle('New Title');

      expect(session.title).toBe('New Title');
      expect(session.updatedAt).toEqual(futureDate);
    });
  });

  describe('addTranscription', () => {
    it('should add transcription and update timestamp', () => {
      const session = new Session(
        'session-1',
        'Test',
        '/path',
        '',
        testDate,
        testDate,
        300
      );

      const futureDate = new Date('2025-01-02T00:00:00Z');
      vi.setSystemTime(futureDate);

      session.addTranscription(testTranscription);

      expect(session.transcription).toBe(testTranscription);
      expect(session.updatedAt).toEqual(futureDate);
    });

    it('should replace existing transcription', () => {
      const session = new Session(
        'session-1',
        'Test',
        '/path',
        '',
        testDate,
        testDate,
        300,
        testTranscription
      );

      const newSegments: TranscriptionSegment[] = [
        { text: 'New transcription', startTime: 0, endTime: 5 },
      ];
      const newTranscription = new Transcription(
        'New transcription',
        newSegments,
        'en',
        'assemblyai',
        testDate
      );

      session.addTranscription(newTranscription);
      expect(session.transcription).toBe(newTranscription);
    });
  });

  describe('Tag Management', () => {
    describe('addTag', () => {
      it('should add tag and update timestamp', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        const futureDate = new Date('2025-01-02T00:00:00Z');
        vi.setSystemTime(futureDate);

        session.addTag('important');

        expect(session.tags).toContain('important');
        expect(session.updatedAt).toEqual(futureDate);
      });

      it('should normalize tags to lowercase', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        session.addTag('IMPORTANT');
        expect(session.tags).toContain('important');
        expect(session.tags).not.toContain('IMPORTANT');
      });

      it('should trim whitespace from tags', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        session.addTag('  important  ');
        expect(session.tags).toContain('important');
      });

      it('should not add duplicate tags', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        session.addTag('important');
        session.addTag('important');

        expect(session.tags.filter(t => t === 'important').length).toBe(1);
      });

      it('should not add empty tags', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        session.addTag('');
        session.addTag('   ');

        expect(session.tags).toEqual([]);
      });
    });

    describe('removeTag', () => {
      it('should remove tag and update timestamp', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300,
          undefined,
          ['important', 'test']
        );

        const futureDate = new Date('2025-01-02T00:00:00Z');
        vi.setSystemTime(futureDate);

        session.removeTag('important');

        expect(session.tags).not.toContain('important');
        expect(session.tags).toContain('test');
        expect(session.updatedAt).toEqual(futureDate);
      });

      it('should handle case-insensitive removal', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300,
          undefined,
          ['important']
        );

        session.removeTag('IMPORTANT');
        expect(session.tags).not.toContain('important');
      });

      it('should trim whitespace when removing', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300,
          undefined,
          ['important']
        );

        session.removeTag('  important  ');
        expect(session.tags).not.toContain('important');
      });

      it('should do nothing if tag does not exist', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300,
          undefined,
          ['test']
        );

        const originalUpdated = session.updatedAt;
        session.removeTag('nonexistent');

        expect(session.tags).toEqual(['test']);
        expect(session.updatedAt).toEqual(originalUpdated);
      });
    });

    describe('getTags', () => {
      it('should return copy of tags array', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300,
          undefined,
          ['tag1', 'tag2']
        );

        const tags = session.getTags();
        tags.push('tag3');

        expect(session.tags).toEqual(['tag1', 'tag2']);
        expect(session.tags).not.toContain('tag3');
      });
    });
  });

  describe('Export History', () => {
    describe('recordExport', () => {
      it('should record export and update timestamp', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        const futureDate = new Date('2025-01-02T00:00:00Z');
        vi.setSystemTime(futureDate);

        session.recordExport('pdf', '/exports/session.pdf');

        expect(session.exportHistory.length).toBe(1);
        expect(session.exportHistory[0].format).toBe('pdf');
        expect(session.exportHistory[0].path).toBe('/exports/session.pdf');
        expect(session.exportHistory[0].exportedAt).toEqual(futureDate);
        expect(session.updatedAt).toEqual(futureDate);
      });

      it('should record multiple exports', () => {
        const session = new Session(
          'session-1',
          'Test',
          '/path',
          '',
          testDate,
          testDate,
          300
        );

        session.recordExport('pdf', '/exports/session.pdf');
        session.recordExport('docx', '/exports/session.docx');
        session.recordExport('txt', '/exports/session.txt');

        expect(session.exportHistory.length).toBe(3);
        expect(session.exportHistory.map(e => e.format)).toEqual(['pdf', 'docx', 'txt']);
      });
    });
  });

  describe('hasTranscription', () => {
    it('should return true when transcription exists', () => {
      const session = new Session(
        'session-1',
        'Test',
        '/path',
        '',
        testDate,
        testDate,
        300,
        testTranscription
      );

      expect(session.hasTranscription()).toBe(true);
    });

    it('should return false when transcription is undefined', () => {
      const session = new Session(
        'session-1',
        'Test',
        '/path',
        '',
        testDate,
        testDate,
        300
      );

      expect(session.hasTranscription()).toBe(false);
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const session = new Session(
        'session-1',
        'Test Session',
        '/path/to/audio.webm',
        '<p>Notes</p>',
        testDate,
        testDate,
        300,
        testTranscription,
        ['tag1'],
        [{ format: 'pdf', path: '/export.pdf', exportedAt: testDate }],
        'course-1',
        'CS101',
        'Computer Science'
      );

      const json = session.toJSON();

      expect(json.id).toBe('session-1');
      expect(json.title).toBe('Test Session');
      expect(json.recordingPath).toBe('/path/to/audio.webm');
      expect(json.notes).toBe('<p>Notes</p>');
      expect(json.duration).toBe(300);
      expect(json.tags).toEqual(['tag1']);
      expect(json.exportHistory?.length).toBe(1);
      expect(json.courseId).toBe('course-1');
    });

    it('should deserialize from JSON correctly', () => {
      const segments: TranscriptionSegment[] = [
        { text: 'Test', startTime: 0, endTime: 5 },
      ];

      const json = {
        id: 'session-1',
        title: 'Test Session',
        recordingPath: '/path/to/audio.webm',
        notes: '<p>Notes</p>',
        createdAt: testDate,
        updatedAt: testDate,
        duration: 300,
        transcription: {
          fullText: 'Test',
          segments,
          language: 'en',
          provider: 'simulation' as const,
          createdAt: testDate,
        },
        tags: ['tag1'],
        exportHistory: [],
        courseId: 'course-1',
        courseTitle: 'CS101',
        courseNumber: 'Computer Science',
      };

      const session = Session.fromJSON(json);

      expect(session.id).toBe('session-1');
      expect(session.title).toBe('Test Session');
      expect(session.transcription?.fullText).toBe('Test');
      expect(session.tags).toEqual(['tag1']);
    });

    it('should round-trip correctly', () => {
      const original = new Session(
        'session-1',
        'Test',
        '/path',
        'notes',
        testDate,
        testDate,
        300,
        testTranscription,
        ['tag1']
      );

      const json = original.toJSON();
      const restored = Session.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.title).toBe(original.title);
      expect(restored.tags).toEqual(original.tags);
    });
  });
});
