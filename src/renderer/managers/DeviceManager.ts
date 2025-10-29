/**
 * DeviceManager
 * Handles microphone device enumeration and selection
 */

export class DeviceManager {
  private microphoneSelect: HTMLSelectElement;

  constructor() {
    this.microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
  }

  /**
   * Load and populate microphone devices
   */
  async loadDevices(): Promise<void> {
    try {
      console.log('Loading microphone devices...');

      // Request permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      console.log('Found devices:', audioInputs);

      // Clear loading option
      this.microphoneSelect.innerHTML = '';

      if (audioInputs.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No microphones found';
        this.microphoneSelect.appendChild(option);
        this.microphoneSelect.disabled = true;
        return;
      }

      // Add devices to dropdown
      audioInputs.forEach((device, i) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${i + 1}`;
        this.microphoneSelect.appendChild(option);
      });

      console.log(`Loaded ${audioInputs.length} microphone device(s)`);
    } catch (error) {
      console.error('Failed to load microphone devices:', error);
      this.microphoneSelect.innerHTML = '<option value="">Error loading devices</option>';
      this.microphoneSelect.disabled = true;

      alert('Failed to access microphone devices. Please check permissions and grant access in system settings.');
    }
  }

  /**
   * Get selected device ID
   */
  getSelectedDeviceId(): string {
    return this.microphoneSelect.value;
  }

  /**
   * Enable/disable device selection
   */
  setEnabled(enabled: boolean): void {
    this.microphoneSelect.disabled = !enabled;
  }
}
