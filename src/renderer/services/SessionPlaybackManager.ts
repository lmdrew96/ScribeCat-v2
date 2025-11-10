/**
 * SessionPlaybackManager
 *
 * Manages audio playback for study mode sessions.
 * Handles custom audio controls, progress bar, volume, keyboard shortcuts,
 * and transcription segment synchronization.
 */

import { formatDuration } from '../utils/formatting.js';

export class SessionPlaybackManager {
  private isDragging: boolean = false;
  private cleanupFunctions: (() => void)[] = [];

  /**
   * Initialize custom audio controls for a session
   */
  async initialize(
    audioElement: HTMLAudioElement,
    sessionDuration: number,
    isDetailViewVisible: () => boolean
  ): Promise<void> {
    // Get control elements
    const playPauseBtn = document.getElementById('play-pause-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const progressContainer = document.getElementById('audio-progress-container');
    const progressPlayed = document.getElementById('audio-progress-played');
    const progressHandle = document.getElementById('audio-progress-handle');
    const progressBuffered = document.getElementById('audio-progress-buffered');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalDurationDisplay = document.getElementById('total-duration');

    if (!playPauseBtn || !progressContainer || !progressPlayed || !progressHandle) {
      console.error('Custom audio control elements not found');
      return;
    }

    console.log('🎵 Initializing custom audio controls');
    console.log('Session duration:', sessionDuration);

    const actualDuration = sessionDuration;

    // Set the duration display immediately
    if (totalDurationDisplay && actualDuration) {
      totalDurationDisplay.textContent = formatDuration(actualDuration);
      console.log('✅ Set duration display:', formatDuration(actualDuration));
    }

    // Play/Pause button
    const playPauseHandler = () => {
      if (audioElement.paused) {
        audioElement.play().catch(err => console.error('Playback failed:', err));
      } else {
        audioElement.pause();
      }
    };
    playPauseBtn.addEventListener('click', playPauseHandler);
    this.cleanupFunctions.push(() => playPauseBtn.removeEventListener('click', playPauseHandler));

    // Update play/pause button icon
    const playHandler = () => {
      const icon = playPauseBtn.querySelector('.play-icon');
      if (icon) icon.textContent = '⏸';
      playPauseBtn.classList.add('playing');
    };
    audioElement.addEventListener('play', playHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('play', playHandler));

    const pauseHandler = () => {
      const icon = playPauseBtn.querySelector('.play-icon');
      if (icon) icon.textContent = '▶';
      playPauseBtn.classList.remove('playing');
    };
    audioElement.addEventListener('pause', pauseHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('pause', pauseHandler));

    // Volume button
    if (volumeBtn) {
      const volumeHandler = () => {
        audioElement.muted = !audioElement.muted;
        const icon = volumeBtn.querySelector('.volume-icon');
        if (icon) {
          icon.textContent = audioElement.muted ? '🔇' : '🔊';
        }
      };
      volumeBtn.addEventListener('click', volumeHandler);
      this.cleanupFunctions.push(() => volumeBtn.removeEventListener('click', volumeHandler));
    }

    // Update duration when metadata loads
    const metadataHandler = () => {
      console.log('✅ Audio metadata loaded');
      console.log('Duration from audio element:', audioElement.duration);
      if (totalDurationDisplay && !actualDuration && audioElement.duration && isFinite(audioElement.duration)) {
        totalDurationDisplay.textContent = formatDuration(audioElement.duration);
      }
    };
    audioElement.addEventListener('loadedmetadata', metadataHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('loadedmetadata', metadataHandler));

    // Error handling - suppress expected loading errors during fallback attempts
    const errorHandler = (e: Event) => {
      // Only log non-loading errors (errors after successful load)
      // Suppress MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) during initial load attempts
      const errorCode = audioElement.error?.code;
      const hasPlayed = audioElement.currentTime > 0 || !audioElement.paused;

      // Only log if audio has already played (not an initial load error)
      if (hasPlayed && errorCode !== 4) {
        console.error('❌ Audio error:', e);
        console.error('Error code:', errorCode);
        console.error('Error message:', audioElement.error?.message);
      }
    };
    audioElement.addEventListener('error', errorHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('error', errorHandler));

    const canplayHandler = () => {
      console.log('✅ Audio can play');
    };
    audioElement.addEventListener('canplay', canplayHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('canplay', canplayHandler));

    // Update progress bar and time display
    const timeupdateHandler = () => {
      if (!this.isDragging && actualDuration && isFinite(actualDuration)) {
        const progress = (audioElement.currentTime / actualDuration) * 100;

        if (progressPlayed) {
          progressPlayed.style.width = `${progress}%`;
        }
        if (progressHandle) {
          progressHandle.style.left = `${progress}%`;
        }

        // Update active segment
        this.updateActiveSegment(audioElement.currentTime);
      }

      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatDuration(audioElement.currentTime);
      }
    };
    audioElement.addEventListener('timeupdate', timeupdateHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('timeupdate', timeupdateHandler));

    // Force initial update if metadata already loaded
    if (audioElement.readyState >= 1) {
      console.log('Audio already has metadata, updating duration');
      if (totalDurationDisplay && audioElement.duration) {
        totalDurationDisplay.textContent = formatDuration(audioElement.duration);
      }
    }

    // Update buffered progress
    const progressHandler = () => {
      if (audioElement.buffered.length > 0 && progressBuffered) {
        const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1);
        const bufferedProgress = (bufferedEnd / audioElement.duration) * 100;
        progressBuffered.style.width = `${bufferedProgress}%`;
      }
    };
    audioElement.addEventListener('progress', progressHandler);
    this.cleanupFunctions.push(() => audioElement.removeEventListener('progress', progressHandler));

    // Progress bar seeking
    const seek = (e: MouseEvent) => {
      const rect = progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const seekTime = pos * actualDuration;

      if (!isNaN(seekTime) && isFinite(seekTime)) {
        audioElement.currentTime = seekTime;
      }
    };

    // Progress bar click to seek
    const clickHandler = (e: MouseEvent) => seek(e);
    progressContainer.addEventListener('click', clickHandler);
    this.cleanupFunctions.push(() => progressContainer.removeEventListener('click', clickHandler));

    // Progress bar drag to seek
    const startDrag = (e: MouseEvent) => {
      this.isDragging = true;
      seek(e);
    };

    const drag = (e: MouseEvent) => {
      if (this.isDragging) {
        seek(e);
      }
    };

    const endDrag = () => {
      this.isDragging = false;
    };

    progressContainer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    this.cleanupFunctions.push(() => {
      progressContainer.removeEventListener('mousedown', startDrag);
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', endDrag);
    });

    // Keyboard controls
    const keydownHandler = (e: KeyboardEvent) => {
      // Only handle if detail view is visible
      if (!isDetailViewVisible()) {
        return;
      }

      // Check if focus is on editor or input elements
      const target = e.target as HTMLElement;
      const isEditorFocused = target.closest('.tiptap-content') ||
                             target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (audioElement.paused) {
          audioElement.play().catch(err => console.error('Playback failed:', err));
        } else {
          audioElement.pause();
        }
      } else if (e.code === 'ArrowLeft' && !isEditorFocused) {
        e.preventDefault();
        audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
      } else if (e.code === 'ArrowRight' && !isEditorFocused) {
        e.preventDefault();
        audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 5);
      }
    };

    document.addEventListener('keydown', keydownHandler);
    this.cleanupFunctions.push(() => document.removeEventListener('keydown', keydownHandler));
  }

  /**
   * Update active segment based on current audio time
   */
  updateActiveSegment(currentTime: number): void {
    const segments = document.querySelectorAll('.transcription-segment');

    segments.forEach(segment => {
      const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
      const endTime = parseFloat((segment as HTMLElement).dataset.endTime || '0');

      // Check if current time is within this segment's range
      if (currentTime >= startTime && currentTime < endTime) {
        segment.classList.add('active');
      } else {
        segment.classList.remove('active');
      }
    });

    // No auto-scroll - let users manually scroll while listening
  }

  /**
   * Clean up event listeners and resources
   */
  cleanup(): void {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    this.isDragging = false;
  }
}
