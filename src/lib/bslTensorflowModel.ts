/**
 * BSL TensorFlow Model Loader
 * 
 * Provides infrastructure for loading and using trained BSL recognition models.
 * Currently supports:
 * 1. Rule-based detection (using MediaPipe landmarks)
 * 2. Future: TensorFlow.js models for classification
 * 
 * Model sources:
 * - SlingoModels (University of Bath): Object detection models
 * - BSL-Fingerspelling-Recognizer: MobileNetV2 for alphabet
 */

import * as tf from '@tensorflow/tfjs';
import type { HandLandmark } from './bslGestures';

// Model categories and their sign labels
export const MODEL_CATEGORIES = {
  greetings: ['HELLO', 'GOODBYE', 'THANK_YOU', 'PLEASE', 'SORRY', 'YES', 'NO'],
  family: ['MOTHER', 'FATHER', 'BROTHER', 'SISTER', 'BABY', 'FAMILY'],
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
} as const;

// Model URLs (for future integration with trained models)
const MODEL_URLS = {
  greetings_v1: 'https://raw.githubusercontent.com/dp846/SlingoModels/main/greetings_v1/model.json',
  greetings_v2: 'https://raw.githubusercontent.com/dp846/SlingoModels/main/greetings_v2/model.json',
  family_v1: 'https://raw.githubusercontent.com/dp846/SlingoModels/main/family_v1/model.json',
} as const;

export interface BSLPrediction {
  sign: string;
  confidence: number;
  category: string;
}

export interface ModelState {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  availableModels: string[];
}

// Cached models
const modelCache: Map<string, tf.GraphModel> = new Map();
let modelState: ModelState = {
  isLoaded: false,
  isLoading: false,
  error: null,
  availableModels: Object.keys(MODEL_URLS),
};

/**
 * Load a TensorFlow.js model from URL
 * Note: SlingoModels are object detection models (SSD MobileNet),
 * not landmark classification. For now, we use enhanced heuristics.
 */
export const loadModel = async (modelName: keyof typeof MODEL_URLS): Promise<tf.GraphModel | null> => {
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName)!;
  }

  modelState.isLoading = true;
  modelState.error = null;

  try {
    const url = MODEL_URLS[modelName];
    console.log(`Loading BSL model: ${modelName} from ${url}`);
    
    const model = await tf.loadGraphModel(url);
    modelCache.set(modelName, model);
    modelState.isLoaded = true;
    modelState.isLoading = false;
    
    console.log(`BSL model ${modelName} loaded successfully`);
    return model;
  } catch (error) {
    console.error(`Failed to load BSL model ${modelName}:`, error);
    modelState.error = `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`;
    modelState.isLoading = false;
    return null;
  }
};

/**
 * Normalize hand landmarks for model input
 * Converts MediaPipe landmarks to a normalized format
 */
export const normalizeLandmarks = (landmarks: HandLandmark[]): number[] => {
  if (!landmarks || landmarks.length !== 21) {
    return [];
  }

  // Center around wrist
  const wrist = landmarks[0];
  const normalized: number[] = [];

  // Calculate bounding box for scale normalization
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x);
    maxX = Math.max(maxX, lm.x);
    minY = Math.min(minY, lm.y);
    maxY = Math.max(maxY, lm.y);
  }

  const scaleX = maxX - minX || 1;
  const scaleY = maxY - minY || 1;
  const scale = Math.max(scaleX, scaleY);

  // Normalize each landmark relative to wrist and scale
  for (const lm of landmarks) {
    normalized.push(
      (lm.x - wrist.x) / scale,
      (lm.y - wrist.y) / scale,
      lm.z / scale
    );
  }

  return normalized;
};

/**
 * Extract features from landmarks for classification
 * Returns a feature vector that captures hand pose characteristics
 */
export const extractFeatures = (landmarks: HandLandmark[]): number[] => {
  if (!landmarks || landmarks.length !== 21) {
    return [];
  }

  const features: number[] = [];
  const wrist = landmarks[0];

  // Finger tip indices
  const tips = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky
  const mcps = [1, 5, 9, 13, 17];  // MCP joints

  // Feature 1: Finger extension ratios
  for (let i = 0; i < tips.length; i++) {
    const tip = landmarks[tips[i]];
    const mcp = landmarks[mcps[i]];
    const tipDist = Math.sqrt(
      Math.pow(tip.x - wrist.x, 2) + 
      Math.pow(tip.y - wrist.y, 2)
    );
    const mcpDist = Math.sqrt(
      Math.pow(mcp.x - wrist.x, 2) + 
      Math.pow(mcp.y - wrist.y, 2)
    );
    features.push(tipDist / (mcpDist || 1));
  }

  // Feature 2: Finger spread (angles between adjacent fingers)
  for (let i = 0; i < tips.length - 1; i++) {
    const tip1 = landmarks[tips[i]];
    const tip2 = landmarks[tips[i + 1]];
    const dx = tip2.x - tip1.x;
    const dy = tip2.y - tip1.y;
    features.push(Math.atan2(dy, dx) / Math.PI); // Normalized angle
  }

  // Feature 3: Hand orientation (wrist to middle finger MCP)
  const middleMcp = landmarks[9];
  const handAngle = Math.atan2(
    middleMcp.y - wrist.y,
    middleMcp.x - wrist.x
  );
  features.push(handAngle / Math.PI);

  // Feature 4: Thumb position relative to palm
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  features.push(thumbTip.x - indexMcp.x);
  features.push(thumbTip.y - indexMcp.y);

  // Feature 5: Finger curl (distance from tip to PIP)
  const pips = [3, 6, 10, 14, 18];
  for (let i = 0; i < tips.length; i++) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    const dist = Math.sqrt(
      Math.pow(tip.x - pip.x, 2) + 
      Math.pow(tip.y - pip.y, 2)
    );
    features.push(dist);
  }

  return features;
};

/**
 * Create a tensor from normalized landmarks
 */
export const landmarksToTensor = (landmarks: HandLandmark[]): tf.Tensor | null => {
  const normalized = normalizeLandmarks(landmarks);
  if (normalized.length === 0) return null;
  
  return tf.tensor2d([normalized], [1, normalized.length]);
};

/**
 * Get model state
 */
export const getModelState = (): ModelState => ({ ...modelState });

/**
 * Clear all cached models
 */
export const clearModelCache = (): void => {
  for (const model of modelCache.values()) {
    model.dispose();
  }
  modelCache.clear();
  modelState.isLoaded = false;
};

/**
 * Check if TensorFlow.js is ready
 */
export const isTFReady = async (): Promise<boolean> => {
  try {
    await tf.ready();
    return true;
  } catch {
    return false;
  }
};

export default {
  loadModel,
  normalizeLandmarks,
  extractFeatures,
  landmarksToTensor,
  getModelState,
  clearModelCache,
  isTFReady,
  MODEL_CATEGORIES,
};
