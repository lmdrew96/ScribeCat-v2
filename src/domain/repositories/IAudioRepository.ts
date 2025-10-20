/**
 * IAudioRepository
 * 
 * Interface for audio file storage operations.
 * Implementation details are in the infrastructure layer.
 */

export interface IAudioRepository {
  /**
   * Save audio data to storage
   * @param audioData - The audio data buffer to save
   * @param filename - The filename to use (without path)
   * @returns The full path where the file was saved
   */
  saveAudio(audioData: ArrayBuffer, filename: string): Promise<string>;

  /**
   * Load audio data from storage
   * @param filePath - The full path to the audio file
   * @returns The audio data as a buffer
   */
  loadAudio(filePath: string): Promise<Buffer>;

  /**
   * Delete audio file from storage
   * @param filePath - The full path to the audio file
   */
  deleteAudio(filePath: string): Promise<void>;

  /**
   * Check if audio file exists
   * @param filePath - The full path to the audio file
   */
  audioExists(filePath: string): Promise<boolean>;

  /**
   * Get the recordings directory path
   */
  getRecordingsDirectory(): string;
}
