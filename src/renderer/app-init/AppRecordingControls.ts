/**
 * AppRecordingControls
 *
 * Recording control functions: start, stop, pause, resume.
 */

import type { RecordingManager } from '../managers/RecordingManager.js';
import type { DeviceManager } from '../managers/DeviceManager.js';
import type { SessionResetManager } from '../managers/SessionResetManager.js';
import { notificationTicker } from '../managers/NotificationTicker.js';

export interface RecordingControlDependencies {
  recordingManager: RecordingManager;
  deviceManager: DeviceManager;
  sessionResetManager: SessionResetManager;
  audioManager: { cleanup: () => void };
}

export class AppRecordingControls {
  private deps: RecordingControlDependencies;

  constructor(deps: RecordingControlDependencies) {
    this.deps = deps;
  }

  /**
   * Handle record button toggle
   */
  async handleRecordToggle(): Promise<void> {
    if (!this.deps.recordingManager.getIsRecording()) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  /**
   * Handle pause button toggle
   */
  async handlePauseToggle(): Promise<void> {
    if (!this.deps.recordingManager.getIsPaused()) {
      await this.pauseRecording();
    } else {
      await this.resumeRecording();
    }
  }

  /**
   * Handle bookmark button click
   */
  handleAddBookmark(): void {
    if (this.deps.recordingManager.getIsRecording()) {
      this.deps.recordingManager.addBookmark();
    }
  }

  /**
   * Start recording
   */
  async startRecording(): Promise<void> {
    try {
      const selectedDeviceId = this.deps.deviceManager.getSelectedDeviceId();

      if (!selectedDeviceId) {
        alert('Please select a microphone device');
        return;
      }

      await this.deps.recordingManager.start(selectedDeviceId);
    } catch (error) {
      console.error('Failed to start recording:', error);
      await this.deps.recordingManager.cleanup();
      alert(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    try {
      await this.deps.recordingManager.stop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    try {
      await this.deps.recordingManager.pause();
    } catch (error) {
      console.error('Failed to pause recording:', error);
      alert(`Failed to pause recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    try {
      await this.deps.recordingManager.resume();
    } catch (error) {
      console.error('Failed to resume recording:', error);
      alert(`Failed to resume recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle new session button
   */
  async handleNewSession(): Promise<void> {
    if (!this.deps.sessionResetManager.canReset()) {
      const reason = this.deps.sessionResetManager.getDisabledReason();
      notificationTicker.warning(`Cannot start new session: ${reason}`, 3000);
      return;
    }

    const confirmed = confirm('Start a new session? Your current work will be saved automatically.');

    if (!confirmed) {
      return;
    }

    try {
      const result = await this.deps.sessionResetManager.resetSession();

      if (result.success) {
        notificationTicker.success('✓ New session ready!', 2000);
      } else {
        notificationTicker.error(result.error || 'Failed to reset session', 3000);
      }
    } catch (error) {
      console.error('Error during new session reset:', error);
      notificationTicker.error('Failed to start new session', 3000);
    }
  }

  /**
   * Update new session button enabled/disabled state
   */
  updateNewSessionButtonState(): void {
    const newSessionBtn = document.getElementById('new-session-btn') as HTMLButtonElement;

    if (!newSessionBtn) {
      return;
    }

    const canReset = this.deps.sessionResetManager.canReset();
    newSessionBtn.disabled = !canReset;

    if (!canReset) {
      const reason = this.deps.sessionResetManager.getDisabledReason();
      newSessionBtn.title = `New Session (${reason})`;
    } else {
      newSessionBtn.title = 'Start a new session (saves current work)';
    }
  }
}
