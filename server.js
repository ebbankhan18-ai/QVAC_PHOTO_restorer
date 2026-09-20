import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { restorePhoto, initializeModel, cleanup, isDemoModeActive } from './photo-restorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3006;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

let initializationProgress = { percentage: 0, downloaded: 0, total: 0 };

app.get('/api/status', (req, res) => {
  res.json({ 
    demoMode: isDemoModeActive(),
    message: isDemoModeActive() 
      ? 'Running in demo mode (Windows). Full AI processing requires Linux/macOS/WSL2.'
      : 'Running with QVAC SDK'
  });
});

app.post('/api/init', async (req, res) => {
  try {
    initializationProgress = { percentage: 0, downloaded: 0, total: 0 };
    await initializeModel((p) => {
      initializationProgress = p;
    });
    res.json({ 
      success: true, 
      message: isDemoModeActive() 
        ? 'Demo model loaded (simulated)' 
        : 'Model loaded successfully',
      demoMode: isDemoModeActive()
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/init/progress', (req, res) => {
  res.json(initializationProgress);
});

app.post('/api/restore', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }
    
    console.log('Received file:', req.file.originalname, req.file.size, 'bytes');
    
    const options = {
      prompt: 'restore old photo, enhance details, remove scratches, improve clarity, high quality, sharp',
      negative_prompt: 'blurry, low quality, distorted, artifacts, watermark, text, noise',
      strength: 0.3,
      steps: 20,
      cfg_scale: 7,
      seed: -1
    };
    
    console.log('Restoring photo with options:', options);
    const result = await restorePhoto(req.file.buffer, options);
    
    const outputDir = path.join(__dirname, 'public', 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const savedImages = [];
    for (let i = 0; i < result.images.length; i++) {
      const filename = `restored_${Date.now()}_${i}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, result.images[i]);
      savedImages.push(`/outputs/${filename}`);
    }
    
    res.json({ 
      success: true, 
      images: savedImages,
      stats: result.stats,
      demoMode: isDemoModeActive()
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cleanup', async (req, res) => {
  try {
    await cleanup();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`QVAC Photo Restorer ready!`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', async () => {
  await cleanup();
  server.close();
  process.exit(0);
});