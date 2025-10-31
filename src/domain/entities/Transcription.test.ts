import { describe, it, expect } from 'vitest';
import { Transcription, TranscriptionSegment } from './Transcription';

describe('Transcription Entity', () => {
  const createValidSegments = (): TranscriptionSegment[] => [
    { text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.95 },
    { text: 'This is a test', startTime: 2, endTime: 5, confidence: 0.92 },
    { text: 'of transcription', startTime: 5, endTime: 8, confidence: 0.98 },
  ];

  describe('Constructor and Validation', () => {
    it('should create a valid transcription', () => {
      const segments = createValidSegments();
      const transcription = new Transcription(
        'Hello world This is a test of transcription',
        segments,
        'en',
        'simulation',
        new Date(),
        0.95
      );

      expect(transcription.fullText).toBe('Hello world This is a test of transcription');
      expect(transcription.segments).toEqual(segments);
      expect(transcription.language).toBe('en');
      expect(transcription.provider).toBe('simulation');
      expect(transcription.averageConfidence).toBe(0.95);
    });

    it('should reject empty fullText', () => {
      expect(() => {
        new Transcription(
          '',
          createValidSegments(),
          'en',
          'simulation',
          new Date()
        );
      }).toThrow('Transcription text cannot be empty');
    });

    it('should reject whitespace-only fullText', () => {
      expect(() => {
        new Transcription(
          '   ',
          createValidSegments(),
          'en',
          'simulation',
          new Date()
        );
      }).toThrow('Transcription text cannot be empty');
    });

    it('should reject empty segments array', () => {
      expect(() => {
        new Transcription(
          'Hello world',
          [],
          'en',
          'simulation',
          new Date()
        );
      }).toThrow('Transcription must have at least one segment');
    });

    it('should reject segments not in chronological order', () => {
      const invalidSegments: TranscriptionSegment[] = [
        { text: 'First', startTime: 0, endTime: 2 },
        { text: 'Second', startTime: 1, endTime: 3 }, // Starts before previous ends
      ];

      expect(() => {
        new Transcription(
          'First Second',
          invalidSegments,
          'en',
          'simulation',
          new Date()
        );
      }).toThrow('Transcription segments must be in chronological order');
    });

    it('should reject confidence < 0', () => {
      expect(() => {
        new Transcription(
          'Hello world',
          createValidSegments(),
          'en',
          'simulation',
          new Date(),
          -0.5
        );
      }).toThrow('Average confidence must be between 0 and 1');
    });

    it('should reject confidence > 1', () => {
      expect(() => {
        new Transcription(
          'Hello world',
          createValidSegments(),
          'en',
          'simulation',
          new Date(),
          1.5
        );
      }).toThrow('Average confidence must be between 0 and 1');
    });

    it('should allow undefined confidence', () => {
      const transcription = new Transcription(
        'Hello world',
        createValidSegments(),
        'en',
        'simulation',
        new Date(),
        undefined
      );

      expect(transcription.averageConfidence).toBeUndefined();
    });
  });

  describe('getTextForTimeRange', () => {
    it('should return text for segments within time range', () => {
      const transcription = new Transcription(
        'Hello world This is a test of transcription',
        createValidSegments(),
        'en',
        'simulation',
        new Date()
      );

      const result = transcription.getTextForTimeRange(2, 8);
      expect(result).toBe('This is a test of transcription');
    });

    it('should return empty string when no segments in range', () => {
      const transcription = new Transcription(
        'Hello world This is a test',
        createValidSegments(),
        'en',
        'simulation',
        new Date()
      );

      const result = transcription.getTextForTimeRange(10, 15);
      expect(result).toBe('');
    });

    it('should return only exact matches', () => {
      const transcription = new Transcription(
        'Hello world This is a test of transcription',
        createValidSegments(),
        'en',
        'simulation',
        new Date()
      );

      const result = transcription.getTextForTimeRange(0, 2);
      expect(result).toBe('Hello world');
    });
  });

  describe('getDuration', () => {
    it('should return duration from last segment', () => {
      const transcription = new Transcription(
        'Hello world This is a test of transcription',
        createValidSegments(),
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.getDuration()).toBe(8);
    });

    it('should return 0 for empty segments', () => {
      // This test will throw during construction due to validation
      // but tests the getDuration logic
      const segments: TranscriptionSegment[] = [
        { text: 'Test', startTime: 0, endTime: 0 },
      ];
      const transcription = new Transcription(
        'Test',
        segments,
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.getDuration()).toBe(0);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize to JSON correctly', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const segments = createValidSegments();
      const transcription = new Transcription(
        'Hello world This is a test of transcription',
        segments,
        'en',
        'assemblyai',
        createdAt,
        0.95
      );

      const json = transcription.toJSON();

      expect(json).toEqual({
        fullText: 'Hello world This is a test of transcription',
        segments,
        language: 'en',
        provider: 'assemblyai',
        createdAt,
        averageConfidence: 0.95,
      });
    });

    it('should deserialize from JSON correctly', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const segments = createValidSegments();
      const json = {
        fullText: 'Hello world This is a test',
        segments,
        language: 'en',
        provider: 'simulation' as const,
        createdAt,
        averageConfidence: 0.92,
      };

      const transcription = Transcription.fromJSON(json);

      expect(transcription.fullText).toBe(json.fullText);
      expect(transcription.segments).toEqual(json.segments);
      expect(transcription.language).toBe(json.language);
      expect(transcription.provider).toBe(json.provider);
      expect(transcription.createdAt).toEqual(createdAt);
      expect(transcription.averageConfidence).toBe(json.averageConfidence);
    });

    it('should round-trip correctly (serialize then deserialize)', () => {
      const original = new Transcription(
        'Hello world',
        createValidSegments(),
        'en',
        'simulation',
        new Date('2025-01-01'),
        0.95
      );

      const json = original.toJSON();
      const restored = Transcription.fromJSON(json);

      expect(restored.fullText).toBe(original.fullText);
      expect(restored.segments).toEqual(original.segments);
      expect(restored.language).toBe(original.language);
      expect(restored.provider).toBe(original.provider);
      expect(restored.averageConfidence).toBe(original.averageConfidence);
    });

    it('should handle missing averageConfidence in JSON', () => {
      const json = {
        fullText: 'Hello world',
        segments: createValidSegments(),
        language: 'en',
        provider: 'simulation' as const,
        createdAt: new Date(),
      };

      const transcription = Transcription.fromJSON(json);
      expect(transcription.averageConfidence).toBeUndefined();
    });
  });

  describe('Provider Types', () => {
    it('should accept "assemblyai" provider', () => {
      const transcription = new Transcription(
        'Hello world',
        createValidSegments(),
        'en',
        'assemblyai',
        new Date()
      );

      expect(transcription.provider).toBe('assemblyai');
    });

    it('should accept "simulation" provider', () => {
      const transcription = new Transcription(
        'Hello world',
        createValidSegments(),
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.provider).toBe('simulation');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single segment', () => {
      const segments: TranscriptionSegment[] = [
        { text: 'Only segment', startTime: 0, endTime: 5 },
      ];

      const transcription = new Transcription(
        'Only segment',
        segments,
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.segments.length).toBe(1);
      expect(transcription.getDuration()).toBe(5);
    });

    it('should handle segments with no confidence', () => {
      const segments: TranscriptionSegment[] = [
        { text: 'No confidence', startTime: 0, endTime: 2 },
        { text: 'segment', startTime: 2, endTime: 4 },
      ];

      const transcription = new Transcription(
        'No confidence segment',
        segments,
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.segments[0].confidence).toBeUndefined();
    });

    it('should handle very long transcription', () => {
      const longText = 'word '.repeat(1000).trim();
      const segments: TranscriptionSegment[] = [];
      for (let i = 0; i < 100; i++) {
        segments.push({
          text: `Segment ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
        });
      }

      const transcription = new Transcription(
        longText,
        segments,
        'en',
        'simulation',
        new Date()
      );

      expect(transcription.segments.length).toBe(100);
      expect(transcription.getDuration()).toBe(1000);
    });
  });
});
