import { loadModel, unloadModel, diffusion, SD_V2_1_1B_Q8_0 } from '@qvac/sdk';
import os from 'os';

let modelId = null;
let isLoading = false;
let isDemoMode = os.platform() === 'win32'; // Force demo mode on Windows

console.log(`Platform: ${os.platform()}, Demo mode: ${isDemoMode}`);

export async function initializeModel(onProgress) {
  if (modelId) return modelId;
  if (isLoading) {
    while (isLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return modelId;
  }
  
  if (isDemoMode) {
    return simulateModelLoad(onProgress);
  }
  
  isLoading = true;
  try {
    console.log('Loading model:', SD_V2_1_1B_Q8_0);
    modelId = await loadModel({
      modelSrc: SD_V2_1_1B_Q8_0,
      modelType: 'sdcpp-generation',
      modelConfig: { prediction: 'v' },
      onProgress
    });
    console.log('Model loaded:', modelId);
    return modelId;
  } catch (error) {
    console.error('Model load error:', error);
    // Fall back to demo mode
    isDemoMode = true;
    return simulateModelLoad(onProgress);
  } finally {
    isLoading = false;
  }
}

async function simulateModelLoad(onProgress) {
  console.log('Demo mode: Simulating model load...');
  modelId = 'demo-model-id';
  
  // Simulate download progress
  const totalSteps = 20;
  for (let i = 0; i <= totalSteps; i++) {
    const percentage = Math.round((i / totalSteps) * 100);
    const downloaded = Math.round((percentage / 100) * 2322705024);
    const progress = { percentage, downloaded, total: 2322705024 };
    if (onProgress) onProgress(progress);
    await new Promise(r => setTimeout(r, 150));
  }
  
  console.log('Demo mode: Model loaded');
  return modelId;
}

export async function restorePhoto(imageBuffer, options = {}) {
  if (!modelId) {
    await initializeModel();
  }
  
  if (isDemoMode) {
    return simulatePhotoRestore(imageBuffer, options);
  }
  
  const {
    prompt = 'restore old photo, enhance details, remove scratches, improve clarity, high quality, sharp',
    negative_prompt = 'blurry, low quality, distorted, artifacts, watermark, text, noise',
    strength = 0.3,
    steps = 20,
    cfg_scale = 7,
    seed = -1
  } = options;
  
  console.log('Starting diffusion with options:', { prompt, negative_prompt, strength, steps, cfg_scale, seed });
  
  const { progressStream, outputs, stats } = diffusion({
    modelId,
    prompt,
    negative_prompt,
    init_image: new Uint8Array(imageBuffer),
    strength,
    steps,
    cfg_scale,
    seed
  });
  
  const progress = [];
  for await (const p of progressStream) {
    console.log('Progress:', p);
    progress.push(p);
  }
  
  const buffers = await outputs;
  const statistics = await stats;
  
  console.log('Diffusion complete, stats:', statistics);
  
  return {
    images: buffers.map(b => Buffer.from(b)),
    progress,
    stats: statistics
  };
}

async function simulatePhotoRestore(imageBuffer, options) {
  console.log('Demo mode: Simulating photo restoration...');
  
  const steps = options.steps || 20;
  
  // Simulate progress
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, 100));
    console.log(`Demo progress: step ${i}/${steps}`);
  }
  
  const originalBuffer = Buffer.from(imageBuffer);
  
  return {
    images: [originalBuffer],
    progress: [],
    stats: { 
      steps, 
      demoMode: true,
      message: 'Demo mode - UI working, actual AI processing requires Linux/macOS/WSL2'
    }
  };
}

export async function cleanup() {
  if (modelId && !isDemoMode) {
    await unloadModel({ modelId, clearStorage: false });
  }
  modelId = null;
  isDemoMode = os.platform() === 'win32';
}

export function getModelId() {
  return modelId;
}

export function isDemoModeActive() {
  return isDemoMode;
}