/**
 * StudyModeRetranscriber
 *
 * Handles re-transcription of sessions using AssemblyAI.
 * Extracts audio handling, API calls, and session updates into a focused module.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SupabaseStorageService } from '../../../infrastructure/services/supabase/SupabaseStorageService.js';
import { config } from '../../../config.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeRetranscriber');

export class StudyModeRetranscriber {
  /**
   * Re-transcribe a session with AssemblyAI
   */
  async retranscribe(
    session: Session,
    onComplete: () => Promise<void>,
    onDetailViewRender?: (session: Session) => Promise<void>
  ): Promise<void> {
    if (!session.recordingPath) {
      alert('No recording file found for this session. Cannot re-transcribe.');
      return;
    }

    // Confirm with user
    const confirmed = confirm(
      'Re-transcribe this session?\n\n' +
      'This will send the audio file to AssemblyAI for transcription and replace the existing transcription. ' +
      'This may take a few minutes depending on the length of the recording.'
    );

    if (!confirmed) return;

    // Get AssemblyAI API key from config (.env file)
    const assemblyaiKey = config.assemblyai.apiKey;
    if (!assemblyaiKey) {
      alert('AssemblyAI API key not configured. Please add ASSEMBLYAI_API_KEY to your .env file.');
      return;
    }

    const retranscribeBtn = document.querySelector('.retranscribe-session-btn') as HTMLButtonElement;

    try {
      // Show loading indicator
      if (retranscribeBtn) {
        retranscribeBtn.disabled = true;
        retranscribeBtn.innerHTML = '<span class="action-icon">⏳</span><span class="action-label">Transcribing...</span>';
      }

      logger.info(`Starting re-transcription for session: ${session.id}`);

      // Get the audio file path
      const audioFilePath = await this.resolveAudioPath(session);

      // Call the batch transcription API
      const result = await window.scribeCat.transcription.assemblyai.batchTranscribe(
        assemblyaiKey,
        audioFilePath
      );

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed');
      }

      logger.info('Transcription completed successfully');

      // Process and save the transcription
      await this.processTranscriptionResult(session.id, result.transcription);

      // Wait for file system writes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload sessions
      await onComplete();

      // Render detail view if callback provided
      if (onDetailViewRender) {
        await onDetailViewRender(session);
      }

      // Restore button
      this.restoreButton(retranscribeBtn);

      alert('Transcription completed successfully!');

    } catch (error) {
      logger.error('Failed to re-transcribe session', error);
      alert(`Failed to re-transcribe session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.restoreButton(retranscribeBtn);
    }
  }

  /**
   * Resolve the audio file path (cloud or local)
   */
  private async resolveAudioPath(session: Session): Promise<string> {
    let audioFilePath = session.recordingPath!;

    // If it's a cloud path, try to get a signed URL from Supabase
    if (audioFilePath.startsWith('cloud://')) {
      const storagePath = audioFilePath.replace('cloud://', '');
      logger.info(`Getting signed URL for cloud recording: ${storagePath}`);

      const storageService = new SupabaseStorageService();
      const result = await storageService.getSignedUrl(storagePath, 7200); // 2 hours

      if (result.success && result.url) {
        logger.info(`Successfully obtained signed URL`);
        return result.url;
      }

      // Cloud file not found, try local fallback
      logger.warn(`Cloud file not found: ${result.error || 'Unknown error'}. Trying local fallbacks...`);
      return await this.findLocalFallback(session);
    }

    // Remove file:// prefix if present (for local files)
    if (audioFilePath.startsWith('file://')) {
      return audioFilePath.substring(7);
    }

    return audioFilePath;
  }

  /**
   * Find local fallback recording file
   */
  private async findLocalFallback(session: Session): Promise<string> {
    const fallbackPaths = this.generateFallbackPaths(session);

    for (const localPath of fallbackPaths) {
      const fileCheck = await window.scribeCat.dialog.fileExists(localPath);
      if (fileCheck.success && fileCheck.exists) {
        logger.info(`Found local recording at: ${localPath}`);
        return localPath;
      }
    }

    throw new Error('Recording file not found in cloud or local storage. Cannot re-transcribe.');
  }

  /**
   * Generate possible local file paths for fallback
   */
  private generateFallbackPaths(session: Session): string[] {
    const constructLocalPath = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      const timestampStr = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
      return `/Users/nae/Library/Application Support/scribecat-v2/recordings/recording-${timestampStr}.webm`;
    };

    const fallbackPaths: string[] = [];

    // Try paths based on session creation time FIRST (most reliable)
    const sessionTime = new Date(session.createdAt);
    sessionTime.setUTCSeconds(0, 0);
    fallbackPaths.push(constructLocalPath(sessionTime));
    fallbackPaths.push(constructLocalPath(session.createdAt));

    // Try +/- 5 seconds from session creation time
    for (let offset = -5; offset <= 5; offset++) {
      if (offset === 0) continue;
      const offsetTime = new Date(session.createdAt);
      offsetTime.setUTCSeconds(offsetTime.getUTCSeconds() + offset);
      fallbackPaths.push(constructLocalPath(offsetTime));
    }

    // Try paths based on transcription creation time (less reliable)
    if (session.transcription?.createdAt) {
      const transcriptionTime = new Date(session.transcription.createdAt);
      fallbackPaths.push(constructLocalPath(transcriptionTime));

      const transcriptionMinus1 = new Date(transcriptionTime);
      transcriptionMinus1.setUTCSeconds(transcriptionMinus1.getUTCSeconds() - 1);
      fallbackPaths.push(constructLocalPath(transcriptionMinus1));

      const transcriptionPlus1 = new Date(transcriptionTime);
      transcriptionPlus1.setUTCSeconds(transcriptionPlus1.getUTCSeconds() + 1);
      fallbackPaths.push(constructLocalPath(transcriptionPlus1));
    }

    return fallbackPaths;
  }

  /**
   * Process transcription result and save to session
   */
  private async processTranscriptionResult(sessionId: string, transcriptionData: any): Promise<void> {
    // Diagnostic logging
    console.log('📊 Re-transcription data received:', {
      hasSentences: !!transcriptionData.sentences,
      sentenceCount: transcriptionData.sentences?.length || 0,
      hasWords: !!transcriptionData.words,
      wordCount: transcriptionData.words?.length || 0
    });

    // Format timestamped entries from AssemblyAI sentences
    let timestampedEntries = transcriptionData.sentences?.map((sentence: any) => ({
      startTime: sentence.start / 1000, // Convert ms to seconds
      endTime: sentence.end / 1000,
      text: sentence.text
    })) || [];

    // Fallback: If sentences are not available, use words to create segments
    if (timestampedEntries.length === 0 && transcriptionData.words?.length > 0) {
      console.warn('⚠️ Sentences not available, falling back to word-level timestamps');
      timestampedEntries = this.createSegmentsFromWords(transcriptionData.words);
      console.log(`✅ Created ${timestampedEntries.length} segments from word-level data`);
    }

    // Update session transcription
    const updateResult = await window.scribeCat.session.updateTranscription(
      sessionId,
      transcriptionData.text,
      'assemblyai',
      timestampedEntries
    );

    if (!updateResult?.success) {
      throw new Error(updateResult?.error || 'Failed to save transcription to session');
    }

    console.log('✅ Re-transcription update complete');
  }

  /**
   * Create sentence-like segments from word-level data
   */
  private createSegmentsFromWords(words: any[]): any[] {
    const segments: any[] = [];
    const wordsPerSegment = 10;

    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      const startTime = segmentWords[0].start / 1000;
      const endTime = segmentWords[segmentWords.length - 1].end / 1000;
      const text = segmentWords.map((w: any) => w.text).join(' ');

      segments.push({ startTime, endTime, text });
    }

    return segments;
  }

  /**
   * Restore retranscribe button to default state
   */
  private restoreButton(btn: HTMLButtonElement | null): void {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="action-icon">🔄</span><span class="action-label">Re-transcribe</span>';
    }
  }
}
