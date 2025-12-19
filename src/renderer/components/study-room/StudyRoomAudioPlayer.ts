/**
 * StudyRoomAudioPlayer
 *
 * Handles audio player setup and playback controls.
 */

import { SessionPlaybackManager } from '../../services/SessionPlaybackManager.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';

export class StudyRoomAudioPlayer {
  private sessionPlaybackManager: SessionPlaybackManager;
  private speedButtonAbortController: AbortController | null = null;

  constructor() {
    this.sessionPlaybackManager = new SessionPlaybackManager();
  }

  /**
   * Cleanup audio player resources
   */
  cleanup(): void {
    this.speedButtonAbortController?.abort();
    this.speedButtonAbortController = null;
  }

  /**
   * Setup audio player with recording
   */
  async setup(sessionData: any, recordingPath: string): Promise<boolean> {
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;

    if (!audioPlayerContainer || !audioElement || !recordingPath) {
      return false;
    }

    try {
      audioPlayerContainer.style.display = 'block';

      if (recordingPath.startsWith('cloud://')) {
        const storagePath = recordingPath.replace('cloud://', '');
        // Use RendererSupabaseClient which has proper auth context
        const client = RendererSupabaseClient.getInstance().getClient();
        const { data, error } = await client.storage
          .from('audio-files')
          .createSignedUrl(storagePath, 7200);

        if (error || !data?.signedUrl) {
          console.error('Failed to get signed URL for audio:', error?.message || 'No URL returned');
          audioPlayerContainer.style.display = 'none';
          return false;
        }

        audioElement.src = data.signedUrl;
      } else {
        audioElement.src = `file://${recordingPath}`;
      }

      this.sessionPlaybackManager.initialize(
        audioElement,
        sessionData.duration || 0,
        () => audioPlayerContainer.style.display !== 'none',
        sessionData.id
      );

      this.setupSpeedControls(audioElement);

      return true;
    } catch (error) {
      console.error('Failed to setup audio player:', error);
      audioPlayerContainer.style.display = 'none';
      return false;
    }
  }

  /**
   * Setup speed control buttons
   */
  private setupSpeedControls(audioElement: HTMLAudioElement): void {
    // Cleanup previous listeners
    this.speedButtonAbortController?.abort();
    this.speedButtonAbortController = new AbortController();

    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
        audioElement.playbackRate = speed;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }, { signal: this.speedButtonAbortController!.signal });
    });
  }
}
