/**
 * Peak Detection Service for PPG Signal Analysis
 * 
 * Implements robust peak detection for photoplethysmography (PPG) signals
 * and calculates heart rate from detected peaks.
 */

/**
 * Class to manage peak detection and heart rate calculation
 */
export class PeakDetector {
  constructor(samplingRate = 50) {
    this.samplingRate = samplingRate // Hz
    this.peakTimestamps = [] // Stores timestamps of detected peaks in ms
    this.maxPeakHistory = 10 // Keep last 10 peaks for HR calculation
    this.minPeakDistance = 0.4 // Minimum 0.4 seconds between peaks (150 BPM max)
    this.lastPeakIndex = -1
    this.currentHeartRate = 0
  }

  /**
   * Detects if the current value represents a peak in the signal
   * Uses adaptive thresholding and local maxima detection
   * 
   * @param {Array} dataArray - The signal data array (with ring buffer support)
   * @param {number} currentIndex - Current write index in the array
   * @param {string} signalType - Type of signal (TIA, HPF, LPF, AMP, IR, RED, GREEN, etc.)
   * @returns {boolean} - True if a peak is detected
   */
  detectPeak(dataArray, currentIndex, signalType) {
    // Only detect peaks for PPG waveform signals (S1 and S2)
    const ppgSignals = ['TIA', 'HPF', 'LPF', 'AMP', 'IR', 'RED', 'GREEN']
    if (!ppgSignals.includes(signalType)) {
      return false
    }

    const arrayLength = dataArray.length
    
    // Need minimum samples for reliable detection
    if (arrayLength < 50) {
      return false
    }

    // Get current and previous samples (handle ring buffer)
    const getCurrentValue = (offset) => {
      const idx = (currentIndex - offset + arrayLength) % arrayLength
      return dataArray[idx]
    }

    const current = getCurrentValue(0)
    const prev1 = getCurrentValue(1)
    const prev2 = getCurrentValue(2)
    const prev3 = getCurrentValue(3)
    const next1 = arrayLength > currentIndex + 1 ? getCurrentValue(-1) : prev1

    // Validate data quality
    if (!Number.isFinite(current) || !Number.isFinite(prev1) || !Number.isFinite(prev2)) {
      return false
    }

    // Enforce minimum distance between peaks (prevent double detection)
    const minSampleDistance = Math.floor(this.minPeakDistance * this.samplingRate)
    if (this.lastPeakIndex >= 0) {
      let samplesSinceLastPeak
      if (dataArray._rbFull) {
        // Ring buffer mode
        samplesSinceLastPeak = (currentIndex - this.lastPeakIndex + arrayLength) % arrayLength
      } else {
        // Growing array mode
        samplesSinceLastPeak = currentIndex - this.lastPeakIndex
      }
      
      if (samplesSinceLastPeak < minSampleDistance) {
        return false
      }
    }

    // Calculate adaptive threshold from recent history
    const windowSize = Math.min(100, arrayLength) // Use last 100 samples or less
    const recentSamples = []
    for (let i = 0; i < windowSize; i++) {
      const val = getCurrentValue(i)
      if (Number.isFinite(val)) {
        recentSamples.push(val)
      }
    }

    if (recentSamples.length < 30) {
      return false
    }

    // Calculate statistics
    const mean = recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length
    const variance = recentSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSamples.length
    const std = Math.sqrt(variance)

    // Adaptive threshold: mean + factor * std
    // Factor of 0.6 works well for PPG signals
    const threshold = mean + 0.6 * std

    // Check for local maximum conditions:
    // 1. Current value above threshold
    // 2. Current value is greater than neighbors (local maximum)
    // 3. Signal is descending after the peak
    const isAboveThreshold = current > threshold
    const isLocalMaximum = current > prev1 && current > prev2 && current >= next1
    const isDescending = prev1 > prev2 // Signal was ascending before current
    
    if (isAboveThreshold && isLocalMaximum && isDescending) {
      // Peak detected!
      this.lastPeakIndex = currentIndex
      this.recordPeak()
      return true
    }

    return false
  }

  /**
   * Records a detected peak timestamp and updates heart rate calculation
   */
  recordPeak() {
    const now = Date.now()
    this.peakTimestamps.push(now)

    // Keep only recent peaks
    if (this.peakTimestamps.length > this.maxPeakHistory) {
      this.peakTimestamps.shift()
    }

    // Calculate heart rate from peak intervals
    this.updateHeartRate()
  }

  /**
   * Calculates heart rate from stored peak intervals
   * Uses median interval to reduce noise impact
   */
  updateHeartRate() {
    if (this.peakTimestamps.length < 2) {
      this.currentHeartRate = 0
      return
    }

    // Calculate intervals between consecutive peaks
    const intervals = []
    for (let i = 1; i < this.peakTimestamps.length; i++) {
      const interval = this.peakTimestamps[i] - this.peakTimestamps[i - 1]
      intervals.push(interval)
    }

    // Use median interval for robustness against outliers
    intervals.sort((a, b) => a - b)
    const medianInterval = intervals[Math.floor(intervals.length / 2)]

    // Convert interval (ms) to heart rate (BPM)
    // BPM = 60000 ms/min / interval_ms
    const bpm = 60000 / medianInterval

    // Validate BPM is in reasonable range (40-180 BPM)
    if (bpm >= 40 && bpm <= 180) {
      this.currentHeartRate = Math.round(bpm)
    }
  }

  /**
   * Gets the current calculated heart rate
   * @returns {number} Heart rate in BPM
   */
  getHeartRate() {
    return this.currentHeartRate
  }

  /**
   * Resets the detector state
   */
  reset() {
    this.peakTimestamps = []
    this.lastPeakIndex = -1
    this.currentHeartRate = 0
  }

  /**
   * Updates the sampling rate (call this if sampling rate changes)
   * @param {number} newRate - New sampling rate in Hz
   */
  setSamplingRate(newRate) {
    this.samplingRate = newRate
    this.reset() // Reset on rate change to avoid inconsistencies
  }
}

/**
 * Factory function to create a new peak detector instance
 * @param {number} samplingRate - Sampling rate in Hz (default: 50)
 * @returns {PeakDetector}
 */
export function createPeakDetector(samplingRate = 50) {
  return new PeakDetector(samplingRate)
}

