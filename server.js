const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { createCanvas, registerFont } = require('canvas');


// Register fonts with their correct internal names
try {
  const fontFiles = [
    // Register with the actual internal font names you discovered
    { path: './fonts/UthmanicHafs1Ver18.ttf', family: 'KFGQPC HAFS Uthmanic Script' },
    { path: './fonts/AlMushafQuran.ttf', family: 'Al Majeed Quranic Font' },
    { path: './fonts/UtmanTahaNaskh.ttf', family: 'KFGQPC Uthman Taha Naskh' },
    { path: './fonts/UthmanicHafs1Ver09.ttf', family: 'KFGQPC Uthmanic Script HAFS' }
  ];
  
  fontFiles.forEach(font => {
    if (fs.existsSync(font.path)) {
      registerFont(font.path, { family: font.family });
      console.log(`✓ Registered font: ${font.family} from ${font.path}`);
    } else {
      console.log(`✗ Font file not found: ${font.path}`);
    }
  });
  
  console.log('Custom fonts registered. Testing availability...');
  
  // Test the registered fonts
  const canvas = createCanvas(100, 50);
  const ctx = canvas.getContext('2d');
  const testText = 'العربية';
  
  fontFiles.forEach(font => {
    try {
      ctx.font = `24px "${font.family}"`;
      const width = ctx.measureText(testText).width;
      console.log(`✓ ${font.family}: ${width}px`);
    } catch (error) {
      console.log(`✗ ${font.family}: Error`);
    }
  });
  
} catch (error) {
  console.error('Error registering custom fonts:', error);
  console.log('Falling back to system fonts...');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Configure CORS to allow your frontend domain
app.use(cors({
  origin: [
    'https://sakinahtime.com',
    'https://www.sakinahtime.com',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.get('origin') || 'unknown'}`);
  next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Ensure directories exist
const dirs = ['uploads', 'generated', 'temp'];
dirs.forEach(dir => {
  fs.ensureDirSync(path.join(__dirname, dir));
});

// Set FFmpeg path (you may need to adjust this based on your system)
// For Windows, you might need to install FFmpeg and set the path
// ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');

// API Routes

// Get available reciters
app.get('/api/reciters', (req, res) => {
  const reciters = [
    { id: 'abdul_basit', name: 'Abdul Basit Abdul Samad', language: 'Arabic' },
    { id: 'alafasy', name: 'Mishary Rashid Alafasy', language: 'Arabic' },
    { id: 'sudais', name: 'Abdur-Rahman As-Sudais', language: 'Arabic' },
    { id: 'abdullah_basfar', name: 'Abdullah Basfar', language: 'Arabic' },
    { id: 'abu_bakr_shatri', name: 'Abu Bakr Ash-Shaatree', language: 'Arabic' },
    { id: 'ahmed_neana', name: 'Ahmed Neana', language: 'Arabic' },
    { id: 'ahmed_ajamy', name: 'Ahmed ibn Ali al-Ajamy', language: 'Arabic' },
    { id: 'akram_alaqimy', name: 'Akram AlAlaqimy', language: 'Arabic' },
    { id: 'ali_hajjaj', name: 'Ali Hajjaj AlSuesy', language: 'Arabic' },
    { id: 'hani_rifai', name: 'Hani Rifai', language: 'Arabic' },
    { id: 'hudhaify', name: 'Ali Al-Hudhaify', language: 'Arabic' },
    { id: 'khalid_qahtani', name: 'Khaalid Abdullaah al-Qahtaanee', language: 'Arabic' },
    { id: 'minshawy', name: 'Muhammad Siddiq Al-Minshawi', language: 'Arabic' },
    { id: 'tablaway', name: 'Mohammad al-Tablaway', language: 'Arabic' },
    { id: 'muhsin_qasim', name: 'Muhsin Al Qasim', language: 'Arabic' },
    { id: 'abdullaah_juhaynee', name: 'Abdullaah 3awwaad Al-Juhaynee', language: 'Arabic' },
    { id: 'husary', name: 'Mahmoud Khalil Al-Husary', language: 'Arabic' },
    { id: 'ghamadi', name: 'Saad Al-Ghamdi', language: 'Arabic' },
    { id: 'shuraim', name: 'Saud Al-Shuraim', language: 'Arabic' }
  ];
  res.json(reciters);
});

// Get available fonts
app.get('/api/fonts', (req, res) => {
  try {
    const fonts = [
      { id: 'al_mushaf', name: 'Al Mushaf', family: 'Al Mushaf' },
      { id: 'uthmanic_hafs', name: 'Uthmanic Hafs (Old)', family: 'Uthmanic Hafs' }
    ];
    res.json(fonts);
  } catch (error) {
    console.error('Error getting fonts:', error);
    res.status(500).json({ error: 'Failed to get fonts' });
  }
});

// Generate live preview video (short version for real-time preview)
// FINAL PREVIEW CODE - Replace your entire /api/preview-video route with this

// FINAL PREVIEW CODE - Replace your entire /api/preview-video route with this

app.post('/api/preview-video', async (req, res) => {
  try {
      console.log('Generating live preview...');

      const {
          surah, ayah, ayahTo, textColor, fontSize, fontFamily, orientation, backgroundFilename
      } = req.body;

      // --- 1. Validation and Setup ---
      if (!surah || !ayah || !backgroundFilename) {
          return res.status(400).json({ error: 'Missing required parameters' });
      }
      const surahNum = parseInt(surah);
      const ayahNum = parseInt(ayah);
      if (isNaN(surahNum) || isNaN(ayahNum)) {
          return res.status(400).json({ error: 'Invalid surah or ayah numbers' });
      }

      const previewId = uuidv4();
      const previewDuration = 3;
      const videoWidth = orientation === 'portrait' ? 1080 : orientation === 'square' ? 1080 : 1920;
      const videoHeight = orientation === 'portrait' ? 1920 : orientation === 'square' ? 1080 : 1080;
      const maxTextWidth = Math.floor(videoWidth * 0.85);
      const textColorValue = textColor || '#ffffff';
      const baseFontSize = fontSize || Math.floor(videoHeight * 0.045);

      const fontMapping = {
          'Al Mushaf': 'Al Majeed Quranic Font',
          'Uthmanic Hafs': 'KFGQPC HAFS Uthmanic Script'
      };
      const selectedFont = fontMapping[fontFamily] || fontFamily;

      // --- 2. Fetch and Prepare Text ---
      const quranData = JSON.parse(fs.readFileSync('./quran-uthmani.json', 'utf8'));
      const translationData = JSON.parse(fs.readFileSync('./en.sahih.json', 'utf8'));

      const startVerse = parseInt(ayahNum);
      const endVerse = ayahTo ? parseInt(ayahTo) : startVerse;
      let arabicText = '';
      let translationText = '';

      for (let i = startVerse; i <= endVerse; i++) {
          const verse = quranData.data.surahs[surahNum - 1].ayahs[i - 1];
          const translation = translationData.data.surahs[surahNum - 1].ayahs[i - 1];
          if (arabicText) arabicText += ' ';
          if (translationText) translationText += ' ';
          arabicText += verse.text;
          translationText += translation.text;
      }
      arabicText = arabicText.normalize('NFC').replace(/ٱ/g, 'ا');

      // --- 3. Calculate Text Wrapping and Required Heights ---
      const arabicFontSize = baseFontSize;
      const translationFontSize = Math.floor(baseFontSize * 0.7);
      const tempCtx = createCanvas(1, 1).getContext('2d');
      
      tempCtx.font = `${arabicFontSize}px "${selectedFont}"`;
      const arabicWords = arabicText.split(' ');
      const arabicWrappedLines = [];
      let currentArabicLine = '';
      for (const word of arabicWords) {
          const testLine = currentArabicLine ? `${currentArabicLine} ${word}` : word;
          if (tempCtx.measureText(testLine).width > maxTextWidth && currentArabicLine) {
              arabicWrappedLines.push(currentArabicLine);
              currentArabicLine = word;
          } else {
              currentArabicLine = testLine;
          }
      }
      arabicWrappedLines.push(currentArabicLine);
      
      tempCtx.font = `${translationFontSize}px "Arial"`;
      const translationWords = translationText.split(' ');
      const translationWrappedLines = [];
      let currentTranslationLine = '';
      for (const word of translationWords) {
          const testLine = currentTranslationLine ? `${currentTranslationLine} ${word}` : word;
          if (tempCtx.measureText(testLine).width > maxTextWidth && currentTranslationLine) {
              translationWrappedLines.push(currentTranslationLine);
              currentTranslationLine = word;
          } else {
              currentTranslationLine = testLine;
          }
      }
      translationWrappedLines.push(currentTranslationLine);

      const arabicBlockHeight = arabicFontSize * 1.3 * arabicWrappedLines.length;
      const translationBlockHeight = translationFontSize * 1.3 * translationWrappedLines.length;

      // --- 4. Create Dynamically-Sized Text Canvases ---
      const tempArabicTextPath = path.join(__dirname, 'temp', `${previewId}_arabic.png`);
      const arabicCanvas = createCanvas(videoWidth, arabicBlockHeight);
      const arabicCtx = arabicCanvas.getContext('2d');
      arabicCtx.font = `${arabicFontSize}px "${selectedFont}"`;
      arabicCtx.fillStyle = textColorValue;
      arabicCtx.textAlign = 'center';
      arabicCtx.textBaseline = 'middle';
      arabicWrappedLines.forEach((line, index) => {
          const y = (index * arabicFontSize * 1.3) + (arabicFontSize * 1.3 / 2);
          arabicCtx.fillText(line, videoWidth / 2, y);
      });
      fs.writeFileSync(tempArabicTextPath, arabicCanvas.toBuffer('image/png'));

      const tempTranslationTextPath = path.join(__dirname, 'temp', `${previewId}_translation.png`);
      const translationCanvas = createCanvas(videoWidth, translationBlockHeight);
      const translationCtx = translationCanvas.getContext('2d');
      translationCtx.font = `${translationFontSize}px "Arial"`;
      translationCtx.fillStyle = textColorValue;
      translationCtx.textAlign = 'center';
      translationCtx.textBaseline = 'middle';
      translationWrappedLines.forEach((line, index) => {
          const y = (index * translationFontSize * 1.3) + (translationFontSize * 1.3 / 2);
          translationCtx.fillText(line, videoWidth / 2, y);
      });
      fs.writeFileSync(tempTranslationTextPath, translationCanvas.toBuffer('image/png'));
      
      // --- 5. Calculate Final Positions & Create Overlays ---
      const textGap = Math.floor(videoHeight * 0.03);
      const totalContentHeight = arabicBlockHeight + textGap + translationBlockHeight;
      
      const arabicTopPosition = (videoHeight - totalContentHeight) / 2;
      const translationTopPosition = arabicTopPosition + arabicBlockHeight + textGap;

      const overlayPadding = Math.floor(videoHeight * 0.05);
      const overlayX = (videoWidth * 0.05);
      const overlayY = arabicTopPosition - overlayPadding;
      const overlayWidth = videoWidth * 0.9;
      const overlayHeight = totalContentHeight + (overlayPadding * 2);
      
      const unifiedOverlayCanvas = createCanvas(videoWidth, videoHeight);
      const unifiedOverlayCtx = unifiedOverlayCanvas.getContext('2d');
      unifiedOverlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      unifiedOverlayCtx.beginPath();
      unifiedOverlayCtx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 25);
      unifiedOverlayCtx.fill();
      const tempUnifiedOverlayPath = path.join(__dirname, 'temp', `${previewId}_overlay.png`);
      fs.writeFileSync(tempUnifiedOverlayPath, unifiedOverlayCanvas.toBuffer('image/png'));
      
      // --- 5a. Create Modern Watermark (RESTORED) ---
      const watermarkCanvas = createCanvas(videoWidth, videoHeight);
      const watermarkCtx = watermarkCanvas.getContext('2d');
      const tempWatermarkPath = path.join(__dirname, 'temp', `${previewId}_watermark.png`);

      const brandText = 'Made on SakinahTime.com';
      const watermarkPadding = Math.floor(videoWidth * 0.03);
      const brandFontSize = Math.max(18, Math.floor(videoWidth * 0.015));
      const infoFontSize = Math.max(22, Math.floor(videoWidth * 0.02));

      const surahName = quranData.data.surahs[surahNum - 1].englishName;
      const surahWithVerse = endVerse > startVerse ?
          `${surahName}, Verses ${startVerse}-${endVerse}` :
          `${surahName}, Verse ${startVerse}`;

      watermarkCtx.font = `600 ${brandFontSize}px "Inter", "Lato", sans-serif`;
      watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      watermarkCtx.textAlign = 'right';
      watermarkCtx.textBaseline = 'bottom';
      watermarkCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      watermarkCtx.shadowBlur = 8;
      watermarkCtx.shadowOffsetY = 2;
      watermarkCtx.shadowOffsetX = 0;
      watermarkCtx.fillText(brandText, videoWidth - watermarkPadding, videoHeight - watermarkPadding);

      watermarkCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      watermarkCtx.shadowBlur = 6;
      watermarkCtx.font = `400 ${infoFontSize}px "Inter", "Lato", sans-serif`;
      watermarkCtx.textAlign = 'left';
      watermarkCtx.textBaseline = 'top';
      watermarkCtx.fillText(surahWithVerse, watermarkPadding, watermarkPadding);

      fs.writeFileSync(tempWatermarkPath, watermarkCanvas.toBuffer('image/png'));

      // --- 6. Generate Video with FFmpeg ---
      const command = ffmpeg()
          .input(path.join(__dirname, 'videos', backgroundFilename))
          .inputOptions(['-stream_loop', '-1', '-t', previewDuration.toString()])
          .input(tempUnifiedOverlayPath)
          .input(tempArabicTextPath)
          .input(tempTranslationTextPath)
          .input(tempWatermarkPath)
          .complexFilter([
              `[0:v]scale=${videoWidth}:${videoHeight}[bg]`,
              `[bg][1:v]overlay=0:0[bg_overlay]`,
              `[bg_overlay][2:v]overlay=(W-w)/2:${arabicTopPosition}[with_arabic]`,
              `[with_arabic][3:v]overlay=(W-w)/2:${translationTopPosition}[with_translation]`,
              `[with_translation][4:v]overlay=0:0[final]`
          ])
          .outputOptions(['-map', '[final]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-an'])
          .output(path.join(__dirname, 'previews', `${previewId}.mp4`));

      await new Promise((resolve, reject) => {
          command.on('end', resolve).on('error', reject).run();
      });

      // --- 7. Cleanup and Respond ---
      fs.unlinkSync(tempArabicTextPath);
      fs.unlinkSync(tempTranslationTextPath);
      fs.unlinkSync(tempUnifiedOverlayPath);
      fs.unlinkSync(tempWatermarkPath);

      res.json({
          success: true,
          previewUrl: `/api/previews/${previewId}.mp4` // Use a relative URL for flexibility
      });

  } catch (error) {
      console.error('Preview generation error:', error);
      res.status(500).json({ error: 'Failed to generate preview' });
  }
});
// Get available video backgrounds only
app.get('/api/backgrounds', (req, res) => {
  const videoDir = path.join(__dirname, 'videos');
  let backgrounds = [];

  // Only videos
  if (fs.existsSync(videoDir)) {
    const videoFiles = fs.readdirSync(videoDir).filter(f => f.match(/\.(mp4|webm|mov|avi)$/i));
    backgrounds = videoFiles.map(f => ({
      type: 'video',
      filename: f,
      displayName: f.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
      thumbnailUrl: `/api/thumbnail/${f}`
    }));
  }

  res.json(backgrounds);
});

// Generate and serve video thumbnails
app.get('/api/thumbnail/:filename', (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(__dirname, 'videos', filename);
  const thumbnailsDir = path.join(__dirname, 'thumbnails');
  const thumbnailPath = path.join(thumbnailsDir, `${filename}.jpg`);

  // Ensure thumbnails directory exists
  fs.ensureDirSync(thumbnailsDir);

  // Check if thumbnail already exists
  if (fs.existsSync(thumbnailPath)) {
    res.sendFile(thumbnailPath);
    return;
  }

  // Check if video exists
  if (!fs.existsSync(videoPath)) {
    res.status(404).send('Video not found');
    return;
  }

  // Generate thumbnail using FFmpeg
  ffmpeg(videoPath)
    .screenshots({
      timestamps: ['2'], // Take screenshot at 2 seconds
      filename: `${filename}.jpg`,
      folder: thumbnailsDir,
      size: '320x180' // 16:9 aspect ratio thumbnail
    })
    .on('end', () => {
      console.log('Thumbnail generated:', thumbnailPath);
      res.sendFile(thumbnailPath);
    })
    .on('error', (err) => {
      console.error('Error generating thumbnail:', err);
      res.status(500).send('Error generating thumbnail');
    });
});

// Get verse audio range
app.get('/api/verse-audio-range/:surah/:ayahFrom/:ayahTo/:reciter', async (req, res) => {
  try {
    const { surah, ayahFrom, ayahTo, reciter } = req.params;
    
    const reciterMap = {
      'alafasy': 'Alafasy',
      'abdulbasit': 'AbdulBasit_AbdulSamad',
      'saad': 'Saad_Al_Ghamidi',
      'maher': 'Maher_Al_Muaiqly',
      'hudhaify': 'Hudhaify',
      'minshawi': 'Minshawi',
      'sudais': 'Sudais'
    };

    const reciterName = reciterMap[reciter] || 'Alafasy';
    const audioFiles = [];
    
    // Collect audio files for the range
    for (let ayah = parseInt(ayahFrom); ayah <= parseInt(ayahTo); ayah++) {
      const paddedSurah = surah.toString().padStart(3, '0');
      const paddedAyah = ayah.toString().padStart(3, '0');
      const audioUrl = `https://everyayah.com/data/${reciterName}/${paddedSurah}${paddedAyah}.mp3`;
      audioFiles.push(audioUrl);
    }
    
    res.json({ 
      audioUrls: audioFiles,
      reciter: reciterName,
      verses: `${ayahFrom}-${ayahTo}`
    });
  } catch (error) {
    console.error('Error getting verse audio range:', error);
    res.status(500).json({ error: 'Failed to get verse audio range' });
  }
});

// Get verse audio
app.get('/api/verse-audio/:surah/:ayah/:reciter', async (req, res) => {
  try {
    const { surah, ayah, reciter } = req.params;
    
    // Construct audio URL based on reciter
    let audioUrl;
    const surahStr = surah.toString().padStart(3, '0');
    const ayahStr = ayah.toString().padStart(3, '0');
    
    switch (reciter) {
      case 'Abdul_Basit_Murattal_192kbps':
        audioUrl = `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Abdullaah_3awwaad_Al-Juhaynee_128kbps':
        audioUrl = `https://everyayah.com/data/Abdullaah_3awwaad_Al-Juhaynee_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Abdullah_Basfar_192kbps':
        audioUrl = `https://everyayah.com/data/Abdullah_Basfar_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Abdurrahmaan_As-Sudais_192kbps':
        audioUrl = `https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Abu_Bakr_Ash-Shaatree_128kbps':
        audioUrl = `https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Ahmed_Neana_128kbps':
        audioUrl = `https://everyayah.com/data/Ahmed_Neana_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net':
        audioUrl = `https://everyayah.com/data/Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Akram_AlAlaqimy_128kbps':
        audioUrl = `https://everyayah.com/data/Akram_AlAlaqimy_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Ali_Hajjaj_AlSuesy_128kbps':
        audioUrl = `https://everyayah.com/data/Ali_Hajjaj_AlSuesy_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Hani_Rifai_192kbps':
        audioUrl = `https://everyayah.com/data/Hani_Rifai_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Hudhaify_128kbps':
        audioUrl = `https://everyayah.com/data/Hudhaify_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Khaalid_Abdullaah_al-Qahtaanee_192kbps':
        audioUrl = `https://everyayah.com/data/Khaalid_Abdullaah_al-Qahtaanee_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Minshawy_Murattal_128kbps':
        audioUrl = `https://everyayah.com/data/Minshawy_Murattal_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Mohammad_al_Tablaway_128kbps':
        audioUrl = `https://everyayah.com/data/Mohammad_al_Tablaway_128kbps/${surahStr}${ayahStr}.mp3`;
        break;
      case 'Muhsin_Al_Qasim_192kbps':
        audioUrl = `https://everyayah.com/data/Muhsin_Al_Qasim_192kbps/${surahStr}${ayahStr}.mp3`;
        break;
      default:
        audioUrl = `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${surahStr}${ayahStr}.mp3`;
    }
    
    res.json({ audioUrl });
  } catch (error) {
    console.error('Error getting verse audio:', error);
    res.status(500).json({ error: 'Failed to get verse audio' });
  }
});

// Generate video
app.post('/api/generate-video', upload.single('background'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    const {
      surah,
      ayah,
      ayahTo,
      reciter,
      backgroundType,
      backgroundFilename,
      backgroundId, // fallback for old clients
      customBackground,
      textColor,
      fontSize,
      fontFamily,
      orientation,
      duration,
      quality
    } = req.body;
    
    console.log('Extracted values:');
    console.log('reciter:', reciter);
    console.log('backgroundType:', backgroundType);
    console.log('backgroundFilename:', backgroundFilename);
    console.log('backgroundId:', backgroundId);
    console.log('orientation:', orientation);
    console.log('fontFamily:', fontFamily);
    console.log('fontSize:', fontSize);
    console.log('textColor:', textColor);

    const videoId = uuidv4();
    const outputPath = path.join(__dirname, 'generated', `${videoId}.mp4`);
    // Audio path will be set after processing verse range
    const tempImagePath = path.join(__dirname, 'temp', `${videoId}_background.jpg`);

    // Get verse text and translation - handle verse ranges
    const quranData = JSON.parse(fs.readFileSync('quran-uthmani.json', 'utf8'));
    
    const startVerse = parseInt(ayah);
    const endVerse = ayahTo ? parseInt(ayahTo) : startVerse;
    
    // Store individual verses for sequential display
    const verses = [];
    
    for (let i = startVerse; i <= endVerse; i++) {
      const verse = quranData.data.surahs[surah - 1].ayahs[i - 1];
      if (!verse) {
        return res.status(404).json({ error: `Verse ${i} not found` });
      }
      verses.push({ number: i, text: verse.text });
    }
    
    console.log(`📖 Verse range ${startVerse}-${endVerse} loaded: ${verses.length} verses`);
    
    // For sequential display, we'll create individual text overlays for each verse
    // But first, let's process each verse's text individually
    for (let i = 0; i < verses.length; i++) {
      let verseText = verses[i].text;
      
      // Apply enhanced Unicode normalization to each verse
      verseText = verseText.normalize('NFC');
      
      // Enhanced character replacements for better rendering
      verseText = verseText
        .replace(/ٱلْءَاخِرَةِ/g, 'الْآخِرَةِ') // Fix for "الآخرة"
        .replace(/وَبِٱلْءَاخِرَةِ/g, 'وَبِالْآخِرَةِ') // Fix for "وبالآخرة"
        .replace(/بِٱلْءَاخِرَةِ/g, 'بِالْآخِرَةِ') // Fix for "بالآخرة"
        .replace(/ءَا/g, 'آ') // Hamza followed by Alif -> Alif Madda
        .replace(/ءُا/g, 'ؤا') // Hamza with damma followed by Alif
        .replace(/ءِا/g, 'ئا') // Hamza with kasra followed by Alif
        .replace(/\u0621\u0627/g, '\u0623') // Standalone Hamza + Alif -> Hamza on Alif
        .replace(/\u0621\u064E\u0627/g, '\u0623') // Hamza + Fatha + Alif -> Hamza on Alif
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0627/g, '\u0623') // Hamza + any diacritics + Alif -> Hamza on Alif
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0625/g, '\u0625') // Hamza + diacritics + Hamza-under-Alif
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0622/g, '\u0622') // Hamza + diacritics + Alif-Madda
        .replace(/ٱلْءَ/g, 'الْآ'); // General fix for hamza-alif in definite articles
      
      verses[i].processedText = verseText;
    }
    
    // Load translations for all verses
    const translationData = JSON.parse(fs.readFileSync('en.sahih.json', 'utf8'));
    
    for (let i = 0; i < verses.length; i++) {
      const verseNumber = verses[i].number;
      const translation = translationData.data.surahs[surah - 1].ayahs[verseNumber - 1];
      if (!translation) {
        return res.status(404).json({ error: `Translation for verse ${verseNumber} not found` });
      }
      verses[i].translation = translation.text;
    }
    
    console.log(`🎬 Creating sequential video for ${verses.length} verses with individual timing`);
    
    // Audio download will happen first, then we'll create verse timings and overlays
    
    // Download audio - handle verse ranges
    const audioFiles = [];
    for (let i = startVerse; i <= endVerse; i++) {
      const surahStr = surah.toString().padStart(3, '0');
      const ayahStr = i.toString().padStart(3, '0');
      audioFiles.push({ verse: i, surahStr, ayahStr });
    }
    
    console.log(`Downloading ${audioFiles.length} audio file(s) for verses ${startVerse}-${endVerse}`);
    
    // Map frontend reciter names to API directory names
    let reciterDirectory;
    switch (reciter) {
      case 'abdul_basit':
        reciterDirectory = 'Abdul_Basit_Murattal_192kbps';
        break;
      case 'alafasy':
        reciterDirectory = 'Alafasy_128kbps';
        break;
      case 'sudais':
        reciterDirectory = 'Abdurrahmaan_As-Sudais_192kbps';
        break;
      case 'abdullah_basfar':
        reciterDirectory = 'Abdullah_Basfar_192kbps';
        break;
      case 'abu_bakr_shatri':
        reciterDirectory = 'Abu_Bakr_Ash-Shaatree_128kbps';
        break;
      case 'ahmed_neana':
        reciterDirectory = 'Ahmed_Neana_128kbps';
        break;
      case 'ahmed_ajamy':
        reciterDirectory = 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net';
        break;
      case 'akram_alaqimy':
        reciterDirectory = 'Akram_AlAlaqimy_128kbps';
        break;
      case 'ali_hajjaj':
        reciterDirectory = 'Ali_Hajjaj_AlSuesy_128kbps';
        break;
      case 'hani_rifai':
        reciterDirectory = 'Hani_Rifai_192kbps';
        break;
      case 'hudhaify':
        reciterDirectory = 'Hudhaify_128kbps';
        break;
      case 'khalid_qahtani':
        reciterDirectory = 'Khaalid_Abdullaah_al-Qahtaanee_192kbps';
        break;
      case 'minshawy':
        reciterDirectory = 'Minshawy_Murattal_128kbps';
        break;
      case 'tablaway':
        reciterDirectory = 'Mohammad_al_Tablaway_128kbps';
        break;
      case 'muhsin_qasim':
        reciterDirectory = 'Muhsin_Al_Qasim_192kbps';
        break;
      case 'abdullaah_juhaynee':
        reciterDirectory = 'Abdullaah_3awwaad_Al-Juhaynee_128kbps';
        break;
      case 'husary':
        reciterDirectory = 'Husary_128kbps';
        break;
      case 'ghamadi':
        reciterDirectory = 'Ghamadi_40kbps';
        break;
      case 'shuraim':
        reciterDirectory = 'Saood_ash-Shuraym_128kbps';
        break;
      default:
        reciterDirectory = 'Abdul_Basit_Murattal_192kbps';
    }
    
    // Download audio for all verses in range and get their durations
    const audioSegments = [];
    const surahStr = surah.toString().padStart(3, '0');
    
    for (const verse of verses) {
      const verseAyahStr = verse.number.toString().padStart(3, '0');
      const verseAudioUrl = `https://everyayah.com/data/${reciterDirectory}/${surahStr}${verseAyahStr}.mp3`;
      const tempVerseAudioPath = path.join(__dirname, 'temp', `${videoId}_audio_${verse.number}.mp3`);
      
      console.log(`Downloading audio for verse ${verse.number} from:`, verseAudioUrl);
      
      try {
        const audioResponse = await axios({
          method: 'GET',
          url: verseAudioUrl,
          responseType: 'stream',
          timeout: 30000 // 30 second timeout
        });
        
        const audioWriter = fs.createWriteStream(tempVerseAudioPath);
        audioResponse.data.pipe(audioWriter);

        await new Promise((resolve, reject) => {
          audioWriter.on('finish', () => {
            console.log(`Audio downloaded successfully for verse ${verse.number}:`, tempVerseAudioPath);
            resolve();
          });
          audioWriter.on('error', (error) => {
            console.error('Error writing audio file:', error);
            reject(error);
          });
        });
        
        // Get audio duration for this verse
        const duration = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempVerseAudioPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration);
          });
        });
        
        audioSegments.push({
          verse: verse.number,
          path: tempVerseAudioPath,
          duration: duration,
          arabicText: verse.processedText,
          translation: verse.translation
        });
        
        console.log(`Verse ${verse.number} audio duration: ${duration} seconds`);
      } catch (error) {
        console.error(`Error downloading audio for verse ${verse.number}:`, error.message);
        return res.status(500).json({ error: `Failed to download audio for verse ${verse.number}` });
      }
    }
    
    // Concatenate all audio files
    const finalAudioPath = path.join(__dirname, 'temp', `${videoId}_audio.mp3`);
    
          if (audioSegments.length === 1) {
        // Single verse - just rename the file
        fs.renameSync(audioSegments[0].path, finalAudioPath);
    } else {
      // Multiple verses - concatenate them
      console.log('Concatenating audio files...');
      const audioConcat = ffmpeg();
      audioSegments.forEach(segment => {
        audioConcat.input(segment.path);
      });
      
      await new Promise((resolve, reject) => {
        audioConcat
          .on('end', () => {
            console.log('Audio concatenation completed');
            // Clean up individual audio files
            audioSegments.forEach(segment => {
              if (fs.existsSync(segment.path)) {
                fs.unlinkSync(segment.path);
              }
            });
            resolve();
          })
          .on('error', reject)
          .mergeToFile(finalAudioPath);
      });
    }

    // Now that we have all audio segments with durations, calculate verse timings
    console.log(`🎬 Creating sequential display for ${audioSegments.length} verses`);
    
    let cumulativeTime = 0;
    const verseTimings = [];
    
    // Calculate timing for each verse based on audio durations
    for (let i = 0; i < audioSegments.length; i++) {
      const segment = audioSegments[i];
      const startTime = cumulativeTime;
      const endTime = cumulativeTime + segment.duration;
      
      verseTimings.push({
        verse: segment.verse,
        startTime: startTime,
        endTime: endTime,
        duration: segment.duration,
        arabicText: segment.arabicText,
        translation: segment.translation
      });
      
      cumulativeTime = endTime;
      console.log(`📍 Verse ${segment.verse}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${segment.duration.toFixed(2)}s)`);
    }
    
    console.log(`🕐 Total video duration: ${cumulativeTime.toFixed(2)} seconds`);

    // Get video background path (videos only)
    let backgroundPath;
    let isVideoBackground = true; // Always video now
    
    if (backgroundType === 'video' && backgroundFilename) {
      backgroundPath = path.join(__dirname, 'videos', backgroundFilename);
    } else {
      // Fallback - use first available video
      const videoDir = path.join(__dirname, 'videos');
      if (fs.existsSync(videoDir)) {
        const videoFiles = fs.readdirSync(videoDir).filter(f => f.match(/\.(mp4|webm|mov|avi)$/i));
        if (videoFiles.length > 0) {
          backgroundPath = path.join(videoDir, videoFiles[0]);
        } else {
          return res.status(400).json({ error: 'No video backgrounds available' });
        }
      } else {
        return res.status(400).json({ error: 'Videos directory not found' });
      }
    }

    console.log('Background path:', backgroundPath);
    console.log('Starting video generation with FFmpeg...');
    console.log('Audio path:', finalAudioPath);
    const tempAudioPath = finalAudioPath; // For compatibility with existing code
    console.log('Output path:', outputPath);
    
    // Set environment variables to avoid fontconfig issues on Windows
    process.env.FONTCONFIG_PATH = '';
    process.env.FONTCONFIG_FILE = '';
    
    // Get audio duration first to ensure exact video length
    console.log('Getting audio duration...');
    const audioDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          console.error('Error getting audio duration:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration;
          console.log('Audio duration:', duration, 'seconds');
          resolve(duration);
        }
      });
    });

    // Create video with FFmpeg - with scale filter to ensure H.264 compatibility
    console.log('Creating FFmpeg command...');
    let command = ffmpeg();
    
    // Handle background input with proper looping
    if (!isVideoBackground) {
      // For images, loop and set duration to match audio
      command = command.input(backgroundPath).inputOptions(['-loop', '1', `-t`, `${audioDuration}`]);
    } else {
      // For videos, loop the video to match audio duration
      command = command.input(backgroundPath).inputOptions(['-stream_loop', '-1', `-t`, `${audioDuration}`]);
    }
    
    command = command.input(tempAudioPath)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 18',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-movflags +faststart'
      ])
      .output(outputPath);
    
    // Determine video dimensions based on orientation
    const selectedOrientation = orientation || 'landscape';
    let videoWidth, videoHeight;
    
    switch (selectedOrientation) {
      case 'portrait':
        videoWidth = 1080;
        videoHeight = 1920;
        break;
      case 'landscape':
      default:
        videoWidth = 1920;
        videoHeight = 1080;
        break;
    }
    
    console.log('Video orientation:', selectedOrientation);
    console.log('Video dimensions:', `${videoWidth}x${videoHeight}`);

      // Create text overlay images using Canvas with responsive sizing
  // Scale font size based on video height for better readability
  const baseFontSize = fontSize || Math.floor(videoHeight * 0.045); // 4.5% of video height
  const textColorValue = textColor || '#ffffff';
    
    // Calculate responsive dimensions for text areas
    const maxTextWidth = Math.floor(videoWidth * 0.85); // 85% of video width
    const arabicTextHeight = Math.floor(videoHeight * 0.2); // 20% for Arabic
    const translationTextHeight = Math.floor(videoHeight * 0.15); // 15% for translation
    
    console.log(`Text constraints - Width: ${maxTextWidth}, Arabic height: ${arabicTextHeight}, Translation height: ${translationTextHeight}`);
    
    // Function to calculate optimal font size and handle text wrapping
    function calculateOptimalTextSize(text, fontFamily, baseSize, maxWidth, maxHeight) {
      console.log('📏 calculateOptimalTextSize called with:');
      console.log(`Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      console.log(`Font: ${fontFamily}, Size: ${baseSize}, MaxWidth: ${maxWidth}, MaxHeight: ${maxHeight}`);
      
      const tempCanvas = createCanvas(100, 100);
      const tempCtx = tempCanvas.getContext('2d');
      
      let optimalSize = baseSize;
      let lines = [text]; // Start with single line
      
      // Test font sizes from base down to minimum
      for (let size = baseSize; size >= 16; size -= 2) {
        tempCtx.font = `${size}px "${fontFamily}"`;
        
        // Try single line first
        const singleLineWidth = tempCtx.measureText(text).width;
        const lineHeight = size * 1.3;
        
        if (singleLineWidth <= maxWidth && lineHeight <= maxHeight) {
          optimalSize = size;
          lines = [text];
          break;
        }
        
        // Try text wrapping for both Arabic and non-Arabic text
        // Check if text contains Arabic characters
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
        
        console.log(`📝 ${hasArabic ? 'Arabic' : 'Non-Arabic'} text detected, attempting wrapping at size ${size}px`);
        
        // For both Arabic and non-Arabic text, use word wrapping
        const words = text.split(' ');
        if (words.length > 1) {
          const wrappedLines = [];
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = tempCtx.measureText(testLine).width;
            
            if (testWidth <= maxWidth) {
              currentLine = testLine;
            } else {
              if (currentLine) wrappedLines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) wrappedLines.push(currentLine);
          
          const totalHeight = wrappedLines.length * lineHeight;
          if (totalHeight <= maxHeight) {
            optimalSize = size;
            lines = wrappedLines;
            break;
          }
        }
      }
      
      console.log(`Calculated optimal size for "${text.substring(0, 30)}...": ${optimalSize}px, lines: ${lines.length}`);
      if (lines.length > 1) {
        console.log('Text wrapped into lines:', lines.map(line => `"${line.substring(0, 20)}..."`));
      }
      return { fontSize: optimalSize, lines: lines };
    }
    
    // Map user-friendly font names to correct internal names (with system font fallbacks)
    const fontMapping = {
      'Al Mushaf': 'Al Majeed Quranic Font',
      'Uthmanic Hafs': 'KFGQPC HAFS Uthmanic Script'
    };
    
    // Fallback mapping to system fonts if custom fonts fail
    const systemFontFallback = {
      'KFGQPC HAFS Uthmanic Script': 'Traditional Arabic',
      'Al Majeed Quranic Font': 'Arabic Typesetting',
      'KFGQPC Uthman Taha Naskh': 'Tahoma',
      'KFGQPC Uthmanic Script HAFS': 'Segoe UI'
    };
    
    const requestedFont = fontFamily || 'Uthmanic Hafs';
    let selectedFont = fontMapping[requestedFont] || requestedFont;
    
    console.log('Raw fontFamily from request:', fontFamily);
    console.log('Requested font (user-friendly):', requestedFont);
    console.log('Selected font (internal name):', selectedFont, 'Base size:', baseFontSize);
    
    // List available fonts for debugging
    const availableFonts = Object.keys(fontMapping);
    console.log('Available user-friendly fonts:', availableFonts);
    console.log('Font mapping found:', !!fontMapping[requestedFont]);
    console.log('Will try custom font:', selectedFont);
    
    // Use the font mapping directly without testing - trust node-canvas registration
    console.log(`✅ Using mapped font: ${selectedFont} (from ${requestedFont})`)
    
    // Create individual text overlays for each verse
    const verseOverlays = [];
    
    // Use first verse to determine optimal font sizing for consistency
    const firstVerse = verseTimings[0];
    const arabicTextData = calculateOptimalTextSize(firstVerse.arabicText, selectedFont, baseFontSize, maxTextWidth, arabicTextHeight);
    const translationTextData = calculateOptimalTextSize(firstVerse.translation, 'Arial', Math.floor(baseFontSize * 0.7), maxTextWidth, translationTextHeight);
    
    console.log(`📏 Using consistent font sizes: Arabic ${arabicTextData.fontSize}px, Translation ${translationTextData.fontSize}px`);
    
    // Create text overlays for each verse
    for (let i = 0; i < verseTimings.length; i++) {
      const timing = verseTimings[i];
      const verseNum = timing.verse;
      
      const tempArabicTextPath = path.join(__dirname, 'temp', `${videoId}_arabic_v${verseNum}.png`);
      const tempTranslationTextPath = path.join(__dirname, 'temp', `${videoId}_translation_v${verseNum}.png`);
      const tempBlackOverlayPath = path.join(__dirname, 'temp', `${videoId}_black_overlay_v${verseNum}.png`);
      
      console.log(`🎨 Creating text overlays for verse ${verseNum}`);
      
      // Pre-calculate Arabic text wrapping FIRST (needed for both overlay sizing and text drawing)
      const arabicCtxTemp = createCanvas(100, 100).getContext('2d');
      arabicCtxTemp.font = `${arabicTextData.fontSize}px "${selectedFont}"`;
      
      const arabicWords = timing.arabicText.split(' ');
      const arabicWrappedLines = [];
      let currentArabicLine = '';
      
      for (const word of arabicWords) {
        const testLine = currentArabicLine ? `${currentArabicLine} ${word}` : word;
        const testWidth = arabicCtxTemp.measureText(testLine).width;
        
        if (testWidth <= maxTextWidth || !currentArabicLine) {
          currentArabicLine = testLine;
        } else {
          arabicWrappedLines.push(currentArabicLine);
          currentArabicLine = word;
        }
      }
      if (currentArabicLine) arabicWrappedLines.push(currentArabicLine);
      
      console.log(`📏 Arabic text will wrap to ${arabicWrappedLines.length} lines for verse ${verseNum}`);
      
      // Create Arabic text image for this verse
      const arabicCanvas = createCanvas(videoWidth, arabicTextHeight);
      const arabicCtx = arabicCanvas.getContext('2d');
      
      // Set font and style for Arabic text
      arabicCtx.font = `${arabicTextData.fontSize}px "${selectedFont}"`;
      arabicCtx.fillStyle = textColorValue;
      arabicCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      arabicCtx.lineWidth = 2;
      arabicCtx.textAlign = 'center';
      arabicCtx.textBaseline = 'middle';
      
      // Draw Arabic text using pre-calculated wrapped lines
      const lineHeight = arabicTextData.fontSize * 1.3;
      const totalHeight = arabicWrappedLines.length * lineHeight;
      const startY = (arabicTextHeight - totalHeight) / 2 + lineHeight / 2;
      
      console.log(`🎨 Drawing ${arabicWrappedLines.length} lines of Arabic text, total height: ${totalHeight}px`);
      
      arabicWrappedLines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        arabicCtx.strokeText(line, videoWidth / 2, y);
        arabicCtx.fillText(line, videoWidth / 2, y);
      });
      
      // Save Arabic text image
      const arabicBuffer = arabicCanvas.toBuffer('image/png');
      fs.writeFileSync(tempArabicTextPath, arabicBuffer);
      
      // Create translation text image for this verse
      const translationCanvas = createCanvas(videoWidth, translationTextHeight);
      const translationCtx = translationCanvas.getContext('2d');
      
      // Calculate translation text with proper wrapping
      const translationData = calculateOptimalTextSize(timing.translation, 'Arial', translationTextData.fontSize, maxTextWidth, translationTextHeight);
      
      translationCtx.font = `${translationData.fontSize}px "Arial"`;
      translationCtx.fillStyle = textColorValue;
      translationCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      translationCtx.lineWidth = 2;
      translationCtx.textAlign = 'center';
      translationCtx.textBaseline = 'middle';
      
      // Draw translation text (multi-line)
      const translationLineHeight = translationData.fontSize * 1.3;
      const totalTranslationHeight = translationData.lines.length * translationLineHeight;
      const translationStartY = (translationTextHeight - totalTranslationHeight) / 2 + translationLineHeight / 2;
      
      translationData.lines.forEach((line, index) => {
        const y = translationStartY + (index * translationLineHeight);
        translationCtx.strokeText(line, videoWidth / 2, y);
        translationCtx.fillText(line, videoWidth / 2, y);
      });
      
      // Save translation text image
      const translationBuffer = translationCanvas.toBuffer('image/png');
      fs.writeFileSync(tempTranslationTextPath, translationBuffer);
      
      // Create rounded black overlay for this verse
      const blackOverlayCanvas = createCanvas(videoWidth, videoHeight);
      const blackOverlayCtx = blackOverlayCanvas.getContext('2d');
      
      // Calculate overlay dimensions based on pre-calculated text wrapping
      // Use the arabicWrappedLines calculated at the beginning of the loop
      const arabicHeight = arabicTextData.fontSize * 1.3 * arabicWrappedLines.length;
      const translationHeight = translationTextData.fontSize * 1.3 * translationData.lines.length;
      const textGap = 20; // Small gap between texts
      const totalContentHeight = arabicHeight + translationHeight + textGap;
      
      // Background overlay dimensions - calculate to match actual text positioning
      const overlayPadding = 60; // Increased padding for better coverage
      const overlayWidth = videoWidth * 0.9; // Slightly wider for better coverage
      
      // Calculate overlay position to match where text will actually be drawn
      const extraGap = Math.floor(videoHeight * 0.05); // Same gap used in positioning
      const arabicOffset = Math.floor(arabicHeight / 2) + extraGap;
      const translationOffset = Math.floor(translationHeight / 2) + extraGap;
      
      // Overlay should cover from top of Arabic text to bottom of translation text
      const overlayTopY = (videoHeight / 2) - arabicOffset - (arabicHeight / 2) - overlayPadding;
      const overlayBottomY = (videoHeight / 2) + translationOffset + (translationHeight / 2) + overlayPadding;
      const overlayHeight = overlayBottomY - overlayTopY;
      
      const overlayX = (videoWidth - overlayWidth) / 2;
      const overlayY = overlayTopY;
      
      // Clear background (transparent)
      blackOverlayCtx.clearRect(0, 0, videoWidth, videoHeight);
      
      // Draw rounded black overlay
      blackOverlayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      blackOverlayCtx.beginPath();
      blackOverlayCtx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 25);
      blackOverlayCtx.fill();
      
      // Save black overlay image
      const blackOverlayBuffer = blackOverlayCanvas.toBuffer('image/png');
      fs.writeFileSync(tempBlackOverlayPath, blackOverlayBuffer);
      
      console.log(`🎯 Verse ${verseNum} overlay: ${overlayWidth}x${overlayHeight} at (${overlayX}, ${overlayY})`);
      
      // Store overlay info for FFmpeg processing (including actual line count for positioning)
      verseOverlays.push({
        verse: verseNum,
        startTime: timing.startTime,
        endTime: timing.endTime,
        arabicPath: tempArabicTextPath,
        translationPath: tempTranslationTextPath,
        blackOverlayPath: tempBlackOverlayPath,
        arabicLineCount: arabicWrappedLines.length // Store actual line count
      });
      
      console.log(`✅ Created text overlays for verse ${verseNum}: ${timing.startTime.toFixed(2)}s - ${timing.endTime.toFixed(2)}s`);
    }
    
    console.log(`🎬 Created ${verseOverlays.length} verse overlays for sequential display`);
    
    // --- ✨ Modern & Professional Watermark ---

console.log('🏷️ Creating modern watermark overlay');
const watermarkCanvas = createCanvas(videoWidth, videoHeight);
const watermarkCtx = watermarkCanvas.getContext('2d');

// 1. Define styling constants for easy adjustments
const brandText = 'Made on SakinahTime.com';
const padding = Math.floor(videoWidth * 0.03); // 3% padding from the edge
const brandFontSize = Math.max(18, Math.floor(videoWidth * 0.015)); // Smaller, subtle size for the brand
const infoFontSize = Math.max(22, Math.floor(videoWidth * 0.02)); // A clear, readable size for the verse info

// 2. Get the verse information text
const watermarkQuranData = JSON.parse(fs.readFileSync('quran-uthmani.json', 'utf8'));
const surahName = watermarkQuranData.data.surahs[surah - 1].englishName;
const watermarkStartVerse = parseInt(ayah);
const watermarkEndVerse = ayahTo ? parseInt(ayahTo) : watermarkStartVerse;
const surahWithVerse = watermarkEndVerse > watermarkStartVerse ?
  `${surahName}, Verses ${watermarkStartVerse}-${watermarkEndVerse}` : // For a range, e.g., "Al-Baqarah, Verses 2-5"
  `${surahName}, Verse ${watermarkStartVerse}`;                  // For a single verse, e.g., "Al-Fatihah, Verse 1"

// 3. Draw the main brand watermark in the bottom-right
watermarkCtx.font = `600 ${brandFontSize}px "Inter", "Lato", sans-serif`; // Use a clean, semi-bold font
watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // Slightly transparent white
watermarkCtx.textAlign = 'right';
watermarkCtx.textBaseline = 'bottom';

// Add a soft drop shadow for legibility
watermarkCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
watermarkCtx.shadowBlur = 8;
watermarkCtx.shadowOffsetY = 2;
watermarkCtx.shadowOffsetX = 0;

watermarkCtx.fillText(brandText, videoWidth - padding, videoHeight - padding);

// 4. Draw the informational Surah/Verse name in the top-left
// Reset shadow for a different, more subtle style for this text
watermarkCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
watermarkCtx.shadowBlur = 6;

watermarkCtx.font = `400 ${infoFontSize}px "Inter", "Lato", sans-serif`; // Use a regular weight
watermarkCtx.textAlign = 'left';
watermarkCtx.textBaseline = 'top';

watermarkCtx.fillText(surahWithVerse, padding, padding);

// 5. Save the generated watermark image
const tempWatermarkPath = path.join(__dirname, 'temp', `${videoId}_watermark.png`);
const watermarkBuffer = watermarkCanvas.toBuffer('image/png');
fs.writeFileSync(tempWatermarkPath, watermarkBuffer);

console.log('✅ Modern watermark overlay created');
    
    // All text overlays are now created individually for each verse
    // Skip to video generation with sequential overlays
    
    console.log('Video dimensions for overlay positioning:', `${videoWidth}x${videoHeight}`);
    
    // Create sequential verse display using FFmpeg time-based filters
    console.log('🎬 Building sequential verse display with time-based overlays');
    
    // Start with the background video - loop it for the full audio duration
    let videoCommand = ffmpeg(backgroundPath)
      .inputOptions(['-stream_loop', '-1', '-t', cumulativeTime.toString()])
      .input(finalAudioPath)
      .input(tempWatermarkPath); // Add watermark as input
    
    // Add all verse text overlays as inputs
    verseOverlays.forEach(overlay => {
      videoCommand.input(overlay.blackOverlayPath);
      videoCommand.input(overlay.arabicPath);
      videoCommand.input(overlay.translationPath);
    });
    
    // Build complex filter chain for sequential display
    let filterChain = [
      `[0:v]scale=${videoWidth}:${videoHeight}[bg]`,
      `[bg][2:v]overlay=0:0[watermarked]` // Add permanent watermark (input 2 is watermark)
    ];
    let currentOutput = 'watermarked';
    
    // Add each verse overlay with timing
    for (let i = 0; i < verseOverlays.length; i++) {
      const overlay = verseOverlays[i];
      const blackOverlayInputIndex = 3 + (i * 3); // Black overlay input index (offset by watermark)
      const arabicInputIndex = 4 + (i * 3); // Arabic text input index (offset by watermark)
      const translationInputIndex = 5 + (i * 3); // Translation text input index (offset by watermark)
      
      const blackBgOutput = `blackbg_${i}`;
      const arabicOutput = `arabic_${i}`;
      const translationOutput = `verse_${i}`;
      
      // Add rounded black overlay with timing
      filterChain.push(
        `[${currentOutput}][${blackOverlayInputIndex}:v]overlay=0:0:enable='between(t,${overlay.startTime},${overlay.endTime})'[${blackBgOutput}]`
      );
      
      // Calculate dynamic positioning based on actual text sizes
      const arabicLineHeight = arabicTextData.fontSize * 1.3;
      const actualArabicLines = overlay.arabicLineCount; // Use stored actual line count
      const arabicTotalHeight = arabicLineHeight * actualArabicLines;
      
      const translationLineHeight = translationTextData.fontSize * 1.3;
      // Translation lines are calculated properly in the verse creation
      const translationTotalHeight = translationLineHeight * 3; // Conservative estimate
      
      const textGap = Math.floor(videoHeight * 0.02); // 2% of video height as gap
      const totalContentHeight = arabicTotalHeight + textGap + translationTotalHeight;
      
      // Position Arabic text above center, translation below with clear gap
      const extraGap = Math.floor(videoHeight * 0.05); // Additional 5% gap between texts
      const arabicOffset = Math.floor(arabicTotalHeight / 2) + extraGap; // Arabic above center
      const translationOffset = Math.floor(translationTotalHeight / 2) + extraGap; // Translation below center with gap
      
      console.log(`📍 Verse ${overlay.verse} positioning: Arabic offset=${arabicOffset}, Translation offset=${translationOffset}`);
      
      // Add Arabic text overlay with dynamic positioning
      filterChain.push(
        `[${blackBgOutput}][${arabicInputIndex}:v]overlay=(W-w)/2:(H-h)/2-${arabicOffset}:enable='between(t,${overlay.startTime},${overlay.endTime})'[${arabicOutput}]`
      );
      
      // Add translation text overlay with dynamic positioning
      filterChain.push(
        `[${arabicOutput}][${translationInputIndex}:v]overlay=(W-w)/2:(H-h)/2+${translationOffset}:enable='between(t,${overlay.startTime},${overlay.endTime})'[${translationOutput}]`
      );
      
      currentOutput = translationOutput;
    }
    
    // Final output
    filterChain.push(`[${currentOutput}]null[final]`);
    
    console.log('📋 FFmpeg filter chain:');
    filterChain.forEach((filter, index) => {
      console.log(`  ${index + 1}. ${filter}`);
    });
    
    videoCommand
      .complexFilter(filterChain)
      .outputOptions([
        '-map', '[final]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p'
      ])
      .output(outputPath);
    
    await new Promise((resolve, reject) => {
      videoCommand
        .on('end', () => {
          console.log('Video generated successfully:', outputPath);
          
          // Clean up temporary files
          verseOverlays.forEach(overlay => {
            if (fs.existsSync(overlay.arabicPath)) {
              fs.unlinkSync(overlay.arabicPath);
            }
            if (fs.existsSync(overlay.translationPath)) {
              fs.unlinkSync(overlay.translationPath);
            }
          });
          
          resolve();
        })
        .on('error', (error, stdout, stderr) => {
          console.error('FFmpeg error:', error);
          console.error('FFmpeg stdout:', stdout);
          console.error('FFmpeg stderr:', stderr);
          reject(error);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress);
        })
        .run();
    });

    // Clean up temp files
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }
    
    // Clean up individual verse overlay files
    verseOverlays.forEach(overlay => {
      if (fs.existsSync(overlay.blackOverlayPath)) {
        fs.unlinkSync(overlay.blackOverlayPath);
      }
      if (fs.existsSync(overlay.arabicPath)) {
        fs.unlinkSync(overlay.arabicPath);
      }
      if (fs.existsSync(overlay.translationPath)) {
        fs.unlinkSync(overlay.translationPath);
      }
    });
    
    // Clean up watermark
    if (fs.existsSync(tempWatermarkPath)) {
      fs.unlinkSync(tempWatermarkPath);
    }
    
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      videoId,
      downloadUrl: `/api/download/${videoId}`,
      shareUrl: `/api/share/${videoId}`
    });

  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

// Download video
app.get('/api/download/:videoId', (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(__dirname, 'generated', `${videoId}.mp4`);
  
  console.log('Download request for videoId:', videoId);
  console.log('Video path:', videoPath);
  console.log('File exists:', fs.existsSync(videoPath));
  
  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    console.log('File size:', stats.size, 'bytes');
    
    // Set proper headers for video download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="quran-verse-${videoId}.mp4"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(videoPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming video file:', error);
      res.status(500).json({ error: 'Error streaming video file' });
    });
  } else {
    console.error('Video file not found:', videoPath);
    res.status(404).json({ error: 'Video not found' });
  }
});

// Share video (returns video info)
app.get('/api/share/:videoId', (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(__dirname, 'generated', `${videoId}.mp4`);
  
  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    res.json({
      videoId,
      size: stats.size,
      created: stats.birthtime,
      downloadUrl: `/api/download/${videoId}`
    });
  } else {
    res.status(404).json({ error: 'Video not found' });
  }
});

// Clean up old videos (run periodically)
app.post('/api/cleanup', (req, res) => {
  const generatedDir = path.join(__dirname, 'generated');
  const files = fs.readdirSync(generatedDir);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  let cleanedCount = 0;
  files.forEach(file => {
    const filePath = path.join(generatedDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.birthtime.getTime() > maxAge) {
      fs.removeSync(filePath);
      cleanedCount++;
    }
  });

  res.json({ cleanedCount });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Video generation API available at http://localhost:${PORT}`);
}); 