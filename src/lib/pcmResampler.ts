/**
 * PCM16 Resampler - Converts 24kHz PCM16 to 16kHz PCM16
 * Used to fix pitch issues when sending OpenAI Realtime audio to Simli
 */

export class PCM16Resampler {
  private readonly inputRate: number;
  private readonly outputRate: number;
  private readonly ratio: number;
  private fractionalPosition: number = 0;
  private lastSample: number = 0;

  constructor(inputRate: number = 24000, outputRate: number = 16000) {
    this.inputRate = inputRate;
    this.outputRate = outputRate;
    this.ratio = outputRate / inputRate; // 16000/24000 = 0.6667
  }

  /**
   * Reset state (call on interruption/buffer clear)
   */
  reset(): void {
    this.fractionalPosition = 0;
    this.lastSample = 0;
  }

  /**
   * Convert PCM16 bytes from inputRate to outputRate using linear interpolation
   */
  process(inputBytes: Uint8Array): Uint8Array {
    // Convert bytes to Int16 samples (little-endian)
    const inputSamples = new Int16Array(inputBytes.buffer, inputBytes.byteOffset, inputBytes.length / 2);
    
    if (inputSamples.length === 0) {
      return new Uint8Array(0);
    }

    // Calculate output length
    const outputLength = Math.floor((inputSamples.length + this.fractionalPosition) * this.ratio);
    const outputSamples = new Int16Array(outputLength);
    
    let outputIndex = 0;
    let position = this.fractionalPosition;
    
    for (let i = 0; i < outputLength && outputIndex < outputLength; i++) {
      const inputIndex = Math.floor(position / this.ratio);
      const fraction = (position / this.ratio) - inputIndex;
      
      // Get current and next sample for interpolation
      let currentSample: number;
      let nextSample: number;
      
      if (inputIndex < 0) {
        currentSample = this.lastSample;
        nextSample = inputSamples[0] ?? this.lastSample;
      } else if (inputIndex >= inputSamples.length - 1) {
        currentSample = inputSamples[inputSamples.length - 1] ?? 0;
        nextSample = currentSample;
      } else {
        currentSample = inputSamples[inputIndex] ?? 0;
        nextSample = inputSamples[inputIndex + 1] ?? currentSample;
      }
      
      // Linear interpolation
      const interpolatedSample = currentSample + (nextSample - currentSample) * fraction;
      outputSamples[outputIndex++] = Math.round(interpolatedSample);
      
      position += 1;
    }
    
    // Update state for next chunk
    const consumedInputSamples = inputSamples.length;
    const expectedPosition = consumedInputSamples * this.ratio;
    this.fractionalPosition = (position - outputLength) * this.ratio;
    
    // Clamp fractional position
    if (this.fractionalPosition < 0) {
      this.fractionalPosition = 0;
    }
    
    // Store last sample for next chunk continuity
    this.lastSample = inputSamples[inputSamples.length - 1] ?? 0;
    
    // Convert back to bytes (little-endian)
    const outputBytes = new Uint8Array(outputSamples.buffer);
    return outputBytes;
  }
}
