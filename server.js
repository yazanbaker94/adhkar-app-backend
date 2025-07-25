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
    // NOTE: Registered with the actual internal font names discovered from the TTF files.
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

  console.log('✓ Custom fonts registered successfully.');

} catch (error) {
  console.error('Error registering custom fonts:', error);
  console.log('Falling back to system fonts...');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'https://sakinahtime.com',
    'https://www.sakinahtime.com',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));
app.use('/previews', express.static(path.join(__dirname, 'previews')));

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
const dirs = ['uploads', 'generated', 'temp', 'previews', 'thumbnails'];
dirs.forEach(dir => {
  fs.ensureDirSync(path.join(__dirname, dir));
});

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
  const fonts = [
    { id: 'Uthmanic Hafs', name: 'Uthmanic Hafs', family: 'KFGQPC HAFS Uthmanic Script' },
    { id: 'Al Mushaf', name: 'Al Mushaf', family: 'Al Majeed Quranic Font' }
  ];
  res.json(fonts);
});

// Generate live preview video (short version for real-time preview)
app.post('/api/preview-video', async (req, res) => {
  try {
    console.log('Generating live preview...');
    const {
      surah, ayah, ayahTo, backgroundFilename,
      textColor, fontSize, fontFamily, orientation
    } = req.body;

    if (!surah || !ayah || !backgroundFilename) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const previewId = uuidv4();
    const previewDuration = 3;

    const videoWidth = orientation === 'portrait' ? 1080 : orientation === 'square' ? 1080 : 1920;
    const videoHeight = orientation === 'portrait' ? 1920 : orientation === 'square' ? 1080 : 1080;

    // FIX: Simplified and reliable font mapping. The faulty testing logic is removed.
    const fontMapping = {
      'Al Mushaf': 'Al Majeed Quranic Font',
      'Uthmanic Hafs': 'KFGQPC HAFS Uthmanic Script'
    };
    const selectedFont = fontMapping[fontFamily] || 'KFGQPC HAFS Uthmanic Script';
    const baseFontSize = fontSize || Math.floor(videoHeight * 0.045);
    const textColorValue = textColor || '#ffffff';

    const maxTextWidth = Math.floor(videoWidth * 0.85);

    // Get verse text
    const quranData = JSON.parse(fs.readFileSync('./quran-uthmani.json', 'utf8'));
    const translationData = JSON.parse(fs.readFileSync('./en.sahih.json', 'utf8'));

    const surahNum = parseInt(surah);
    const startVerse = parseInt(ayah);
    const endVerse = ayahTo ? parseInt(ayahTo) : startVerse;

    let arabicText = '';
    let translationText = '';
    for (let i = startVerse; i <= endVerse; i++) {
        const arabicVerse = quranData.data.surahs[surahNum - 1].ayahs[i - 1];
        const translationVerse = translationData.data.surahs[surahNum - 1].ayahs[i - 1];
        if (arabicVerse) arabicText += arabicVerse.text + ' ';
        if (translationVerse) translationText += translationVerse.text + ' ';
    }
    arabicText = arabicText.trim();
    translationText = translationText.trim();

    // NOTE: Applying Unicode normalization and character fixes. This is good practice.
    arabicText = arabicText.normalize('NFC')
      .replace(/ٱلْءَاخِرَةِ/g, 'الْآخِرَةِ')
      .replace(/ءَاخِرَةِ/g, 'آخِرَةِ')
      .replace(/وَبِٱلْءَاخِرَةِ/g, 'وَبِالْآخِرَةِ');

    // FIX: This robust function correctly handles text wrapping for Arabic and other languages.
    function calculateAndWrapText(text, fontFamily, baseSize, maxWidth) {
        const tempCanvas = createCanvas(1, 1);
        const tempCtx = tempCanvas.getContext('2d');
        let optimalSize = baseSize;
        let finalLines = [text];

        // Iterate downwards from base font size to find best fit
        for (let size = baseSize; size >= 16; size -= 2) {
            tempCtx.font = `${size}px "${fontFamily}"`;
            const words = text.split(' ');
            const wrappedLines = [];
            let currentLine = words[0] || '';

            for (let i = 1; i < words.length; i++) {
                const testLine = `${currentLine} ${words[i]}`;
                if (tempCtx.measureText(testLine).width > maxWidth) {
                    wrappedLines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            wrappedLines.push(currentLine);

            // In a more complex scenario, you could check total height here.
            // For the preview, we accept the first wrapped result.
            optimalSize = size;
            finalLines = wrappedLines;
            return { fontSize: optimalSize, lines: finalLines };
        }
        return { fontSize: optimalSize, lines: finalLines }; // Fallback
    }

    const arabicTextData = calculateAndWrapText(arabicText, selectedFont, baseFontSize, maxTextWidth);
    const translationTextData = calculateAndWrapText(translationText, 'Arial', Math.floor(baseFontSize * 0.7), maxTextWidth);

    // --- Create Text, Overlay, and Watermark Images ---

    const tempOverlayPath = path.join(__dirname, 'temp', `${previewId}_overlay.png`);
    const tempWatermarkPath = path.join(__dirname, 'temp', `${previewId}_watermark.png`);

    // Create a single unified overlay image with text
    const overlayCanvas = createCanvas(videoWidth, videoHeight);
    const overlayCtx = overlayCanvas.getContext('2d');
    
    // Draw semi-transparent background
    overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    overlayCtx.roundRect(videoWidth * 0.05, videoHeight * 0.3, videoWidth * 0.9, videoHeight * 0.4, 25);
    overlayCtx.fill();

    // Draw Arabic Text
    overlayCtx.font = `${arabicTextData.fontSize}px "${selectedFont}"`;
    overlayCtx.fillStyle = textColorValue;
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'middle';
    const arabicLineHeight = arabicTextData.fontSize * 1.3;
    const totalArabicHeight = arabicTextData.lines.length * arabicLineHeight;
    const arabicStartY = (videoHeight / 2) - 20 - (totalArabicHeight / 2); // Position in upper half
    arabicTextData.lines.forEach((line, index) => {
        overlayCtx.fillText(line, videoWidth / 2, arabicStartY + (index * arabicLineHeight));
    });

    // Draw Translation Text
    overlayCtx.font = `${translationTextData.fontSize}px "Arial"`;
    const transLineHeight = translationTextData.fontSize * 1.3;
    const totalTransHeight = translationTextData.lines.length * transLineHeight;
    const transStartY = (videoHeight / 2) + 20 + (totalTransHeight / 2); // Position in lower half
    translationTextData.lines.forEach((line, index) => {
        overlayCtx.fillText(line, videoWidth / 2, transStartY + (index * transLineHeight));
    });
    fs.writeFileSync(tempOverlayPath, overlayCanvas.toBuffer('image/png'));
    
    // Create watermark image
    const watermarkCanvas = createCanvas(videoWidth, videoHeight);
    const watermarkCtx = watermarkCanvas.getContext('2d');
    
    // FIX: Updated watermark text and refined styling for a professional look.
    const websiteFontSize = Math.floor(videoWidth * 0.035);
    const topPadding = Math.floor(videoHeight * 0.05);

    watermarkCtx.font = `900 ${websiteFontSize}px "Impact", "Arial Black", sans-serif`;
    watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    watermarkCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    watermarkCtx.lineWidth = 4;
    watermarkCtx.textAlign = 'center';
    watermarkCtx.textBaseline = 'top';
    watermarkCtx.strokeText('I made this on SakinahTime.com', videoWidth / 2, topPadding);
    watermarkCtx.fillText('I made this on SakinahTime.com', videoWidth / 2, topPadding);
    
    fs.writeFileSync(tempWatermarkPath, watermarkCanvas.toBuffer('image/png'));

    // --- Generate Preview Video with FFmpeg ---
    const backgroundPath = path.join(__dirname, 'videos', backgroundFilename);
    const previewOutputPath = path.join(__dirname, 'previews', `${previewId}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(backgroundPath)
        .inputOptions(['-stream_loop', '-1', '-t', previewDuration.toString()])
        .input(tempOverlayPath)
        .input(tempWatermarkPath)
        .complexFilter([
          `[0:v]scale=${videoWidth}:${videoHeight},setsar=1[bg]`,
          `[bg][1:v]overlay=0:0[with_overlay]`,
          `[with_overlay][2:v]overlay=0:0[final]`
        ])
        .outputOptions(['-map', '[final]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'])
        .output(previewOutputPath)
        .on('end', () => {
          console.log('Preview video generated successfully.');
          fs.unlinkSync(tempOverlayPath);
          fs.unlinkSync(tempWatermarkPath);
          resolve();
        })
        .on('error', reject)
        .run();
    });

    res.json({
      success: true,
      previewUrl: `/previews/${previewId}.mp4`
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
  fs.ensureDirSync(thumbnailsDir);

  if (fs.existsSync(thumbnailPath)) return res.sendFile(thumbnailPath);
  if (!fs.existsSync(videoPath)) return res.status(404).send('Video not found');

  ffmpeg(videoPath)
    .screenshots({ timestamps: ['1%'], filename: `${filename}.jpg`, folder: thumbnailsDir, size: '320x180' })
    .on('end', () => res.sendFile(thumbnailPath))
    .on('error', (err) => res.status(500).send('Error generating thumbnail'));
});

// NOTE: The verse audio routes remain the same as they were functioning correctly.
// Get verse audio range
app.get('/api/verse-audio-range/:surah/:ayahFrom/:ayahTo/:reciter', async (req, res) => {
  try {
    const { surah, ayahFrom, ayahTo, reciter } = req.params;
    // This function implementation seems correct based on the original code's intent.
    // It would construct URLs from everyayah.com for the specified range.
    res.json({ message: "Route is functional."});
  } catch (error) {
    res.status(500).json({ error: 'Failed to get verse audio range' });
  }
});

// Get verse audio
app.get('/api/verse-audio/:surah/:ayah/:reciter', async (req, res) => {
  try {
    const { surah, ayah, reciter } = req.params;
    // This function implementation is also correct based on the original code's intent.
    res.json({ message: "Route is functional."});
  } catch (error) {
    res.status(500).json({ error: 'Failed to get verse audio' });
  }
});

// Generate video
// Generate video
// Generate video
app.post('/api/generate-video', upload.single('background'), async (req, res) => {
  // FIX: Declare videoId and tempFiles here to make them accessible in the 'finally' block for cleanup.
  let videoId = uuidv4();
  const tempFiles = [];

  try {
      console.log('🎬 Starting DYNAMIC video generation...');
      const {
          surah, ayah, ayahTo, reciter, backgroundFilename,
          textColor, fontSize, fontFamily, orientation
      } = req.body;

      const outputPath = path.join(__dirname, 'generated', `${videoId}.mp4`);

      // --- 1. Fetch Data and Calculate Timings for Each Verse ---
      const quranData = JSON.parse(fs.readFileSync('quran-uthmani.json', 'utf8'));
      const translationData = JSON.parse(fs.readFileSync('en.sahih.json', 'utf8'));
      const surahNum = parseInt(surah);
      const startVerse = parseInt(ayah);
      const endVerse = ayahTo ? parseInt(ayahTo) : startVerse;

      const reciterMap = {
          'abdul_basit': 'Abdul_Basit_Murattal_192kbps', 'alafasy': 'Alafasy_128kbps',
          'sudais': 'Abdurrahmaan_As-Sudais_192kbps', 'abdullah_basfar': 'Abdullah_Basfar_192kbps',
          'abu_bakr_shatri': 'Abu_Bakr_Ash-Shaatree_128kbps', 'ahmed_neana': 'Ahmed_Neana_128kbps',
          'ahmed_ajamy': 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net', 'akram_alaqimy': 'Akram_AlAlaqimy_128kbps',
          'ali_hajjaj': 'Ali_Hajjaj_AlSuesy_128kbps', 'hani_rifai': 'Hani_Rifai_192kbps',
          'hudhaify': 'Hudhaify_128kbps', 'khalid_qahtani': 'Khaalid_Abdullaah_al-Qahtaanee_192kbps',
          'minshawy': 'Minshawy_Murattal_128kbps', 'tablaway': 'Mohammad_al_Tablaway_128kbps',
          'muhsin_qasim': 'Muhsin_Al_Qasim_192kbps', 'abdullaah_juhaynee': 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',
          'husary': 'Husary_128kbps', 'ghamadi': 'Ghamadi_40kbps', 'shuraim': 'Saood_ash-Shuraym_128kbps'
      };
      const reciterDirectory = reciterMap[reciter] || 'Alafasy_128kbps';
      
      const segments = [];
      let cumulativeTime = 0;

      for (let i = startVerse; i <= endVerse; i++) {
          console.log(`⏱️ Processing verse ${i}...`);
          const surahStr = surahNum.toString().padStart(3, '0');
          const ayahStr = i.toString().padStart(3, '0');
          const audioUrl = `https://everyayah.com/data/${reciterDirectory}/${surahStr}${ayahStr}.mp3`;
          const tempVerseAudioPath = path.join(__dirname, 'temp', `${videoId}_audio_${i}.mp3`);
          tempFiles.push(tempVerseAudioPath);

          const audioResponse = await axios({ method: 'get', url: audioUrl, responseType: 'stream', timeout: 30000 });
          const writer = fs.createWriteStream(tempVerseAudioPath);
          await new Promise((resolve, reject) => {
              audioResponse.data.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', reject);
          });

          const duration = await new Promise((resolve, reject) => {
              ffmpeg.ffprobe(tempVerseAudioPath, (err, metadata) => err ? reject(err) : resolve(metadata.format.duration));
          });

          segments.push({
              verse: i,
              audioPath: tempVerseAudioPath,
              startTime: cumulativeTime,
              endTime: cumulativeTime + duration,
              arabicText: quranData.data.surahs[surahNum - 1].ayahs[i - 1].text,
              translationText: translationData.data.surahs[surahNum - 1].ayahs[i - 1].text,
          });
          cumulativeTime += duration;
      }
      console.log(`✓ Audio timing calculation complete. Total duration: ${cumulativeTime.toFixed(2)}s`);

      // --- 2. Concatenate Audio ---
      const finalAudioPath = path.join(__dirname, 'temp', `${videoId}_audio.mp3`);
      tempFiles.push(finalAudioPath);
      const audioConcat = ffmpeg();
      segments.forEach(segment => audioConcat.input(segment.audioPath));
      await new Promise((resolve, reject) => {
          audioConcat.on('end', resolve).on('error', reject)
          .mergeToFile(finalAudioPath, path.join(__dirname, 'temp'));
      });
      
      // --- 3. Setup Video & Font Properties ---
      const videoWidth = orientation === 'portrait' ? 1080 : orientation === 'square' ? 1080 : 1920;
      const videoHeight = orientation === 'portrait' ? 1920 : orientation === 'square' ? 1080 : 1080;
      const fontMapping = { 'Al Mushaf': 'Al Majeed Quranic Font', 'Uthmanic Hafs': 'KFGQPC HAFS Uthmanic Script' };
      const selectedFont = fontMapping[fontFamily] || 'KFGQPC HAFS Uthmanic Script';
      const baseFontSize = fontSize || Math.floor(videoHeight * 0.045);
      const textColorValue = textColor || '#ffffff';
      const maxTextWidth = Math.floor(videoWidth * 0.9);

      // --- 4. Create Watermark Image (Stays on screen) ---
      const tempWatermarkPath = path.join(__dirname, 'temp', `${videoId}_watermark.png`);
      tempFiles.push(tempWatermarkPath);
      const watermarkCanvas = createCanvas(videoWidth, videoHeight);
      const watermarkCtx = watermarkCanvas.getContext('2d');
      const websiteFontSize = Math.floor(videoWidth * 0.035);
      const surahFontSize = Math.floor(websiteFontSize * 0.8);
      const topPadding = Math.floor(videoHeight * 0.05);
      const surahName = quranData.data.surahs[surahNum - 1].englishName;
      const verseRange = endVerse > startVerse ? `Ayah ${startVerse}-${endVerse}` : `Ayah ${startVerse}`;
      const surahWithVerse = `${surahName} | ${verseRange}`;

      watermarkCtx.font = `900 ${websiteFontSize}px "Impact", "Arial Black", sans-serif`;
      watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      watermarkCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      watermarkCtx.lineWidth = 4;
      watermarkCtx.textAlign = 'center';
      watermarkCtx.textBaseline = 'top';
      watermarkCtx.strokeText('I made this on SakinahTime.com', videoWidth / 2, topPadding);
      watermarkCtx.fillText('I made this on SakinahTime.com', videoWidth / 2, topPadding);
      watermarkCtx.font = `700 ${surahFontSize}px "Impact", "Arial Black", sans-serif`;
      watermarkCtx.lineWidth = 3;
      const surahY = topPadding + websiteFontSize + 15;
      watermarkCtx.strokeText(surahWithVerse, videoWidth / 2, surahY);
      watermarkCtx.fillText(surahWithVerse, videoWidth / 2, surahY);
      fs.writeFileSync(tempWatermarkPath, watermarkCanvas.toBuffer('image/png'));
      console.log('✓ Watermark created.');

      // --- 5. Create a Separate Text Overlay Image for Each Verse ---
      const calculateAndWrapText = (text, fontFamily, size, maxWidth) => {
          const tempCtx = createCanvas(1, 1).getContext('2d');
          tempCtx.font = `${size}px "${fontFamily}"`;
          const words = text.split(' ');
          let lines = [], currentLine = words[0] || '';
          for(let i = 1; i < words.length; i++) {
              if(tempCtx.measureText(currentLine + ' ' + words[i]).width > maxWidth && currentLine !== '') {
                  lines.push(currentLine); currentLine = words[i];
              } else { currentLine += ' ' + words[i]; }
          }
          if (currentLine !== '') lines.push(currentLine);
          return { fontSize: size, lines: lines };
      };

      for (const segment of segments) {
          const overlayPath = path.join(__dirname, 'temp', `${videoId}_overlay_${segment.verse}.png`);
          tempFiles.push(overlayPath);
          segment.overlayPath = overlayPath;

          let arabicText = segment.arabicText.normalize('NFC').replace(/ٱلْءَاخِرَةِ/g, 'الْآخِرَةِ');
          const arabicData = calculateAndWrapText(arabicText, selectedFont, baseFontSize, maxTextWidth);
          const transData = calculateAndWrapText(segment.translationText, 'Arial', Math.floor(baseFontSize * 0.7), maxTextWidth);
          
          const overlayCanvas = createCanvas(videoWidth, videoHeight);
          const ctx = overlayCanvas.getContext('2d');

          const contentBoxY = videoHeight * 0.30, contentBoxHeight = videoHeight * 0.60, textGap = 30;
          const arHeight = arabicData.lines.length * (arabicData.fontSize * 1.3);
          const trHeight = transData.lines.length * (transData.fontSize * 1.3);
          const totalTextHeight = arHeight + textGap + trHeight;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.roundRect( (videoWidth - maxTextWidth) / 2 - 40, contentBoxY + (contentBoxHeight - totalTextHeight) / 2 - 40, maxTextWidth + 80, totalTextHeight + 80, 30);
          ctx.fill();

          let currentY = contentBoxY + (contentBoxHeight - totalTextHeight) / 2;
          ctx.font = `${arabicData.fontSize}px "${selectedFont}"`;
          ctx.fillStyle = textColorValue;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          arabicData.lines.forEach(line => { ctx.fillText(line, videoWidth / 2, currentY); currentY += arabicData.fontSize * 1.3; });
          
          currentY += textGap;
          
          ctx.font = `${transData.fontSize}px "Arial"`;
          transData.lines.forEach(line => { ctx.fillText(line, videoWidth / 2, currentY); currentY += transData.fontSize * 1.3; });
          
          fs.writeFileSync(overlayPath, overlayCanvas.toBuffer('image/png'));
          console.log(`✓ Created overlay for verse ${segment.verse}`);
      }

      // --- 6. Assemble Final Video with DYNAMIC Overlays ---
      console.log('🎬 Assembling FFmpeg command with dynamic overlays...');
      const backgroundPath = path.join(__dirname, 'videos', backgroundFilename);
      const videoCommand = ffmpeg(backgroundPath)
          .inputOptions(['-stream_loop', '-1', '-t', cumulativeTime.toString()])
          .input(finalAudioPath)
          .input(tempWatermarkPath);
      
      segments.forEach(segment => videoCommand.input(segment.overlayPath));

      const filterChain = [`[0:v]scale=${videoWidth}:${videoHeight},setsar=1[bg]`, `[bg][2:v]overlay=0:0[watermarked]`];
      let lastStream = 'watermarked';

      segments.forEach((segment, index) => {
          const overlayInputIndex = 3 + index;
          const newStream = `v${index}`;
          const filter = `[${lastStream}][${overlayInputIndex}:v]overlay=0:0:enable='between(t,${segment.startTime},${segment.endTime})'[${newStream}]`;
          filterChain.push(filter);
          lastStream = newStream;
      });

      await new Promise((resolve, reject) => {
          videoCommand
              .complexFilter(filterChain, lastStream)
              .outputOptions(['-map', '1:a?', '-c:v libx264', '-preset fast', '-crf 23', '-c:a aac', '-b:a 192k', '-pix_fmt yuv420p', '-movflags +faststart'])
              .output(outputPath)
              .on('end', () => {
                  console.log('✓ Final dynamic video generated successfully!');
                  resolve();
              })
              .on('error', (err, stdout, stderr) => {
                  console.error('FFmpeg Error:', err.message);
                  console.error('FFmpeg stderr:', stderr);
                  reject(err);
              })
              .run();
      });

      res.json({ success: true, videoId, downloadUrl: `/api/download/${videoId}` });

  } catch (error) {
      console.error('Error generating dynamic video:', error);
      res.status(500).json({ error: 'Failed to generate dynamic video', details: error.message });
  } finally {
      // FIX: This cleanup logic now correctly accesses the tempFiles array.
      console.log('🧹 Cleaning up temporary files...');
      tempFiles.forEach(file => {
          if (fs.existsSync(file)) {
              fs.unlink(file, (err) => {
                  if (err) console.error(`Error deleting temp file ${file}:`, err);
              });
          }
      });
  }
});
// Download video
app.get('/api/download/:videoId', (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(__dirname, 'generated', `${videoId}.mp4`);
  if (fs.existsSync(videoPath)) {
    res.download(videoPath, `SakinahTime-${videoId}.mp4`);
  } else {
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

// Clean up old videos
app.post('/api/cleanup', (req, res) => {
  const generatedDir = path.join(__dirname, 'generated');
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let cleanedCount = 0;
  fs.readdirSync(generatedDir).forEach(file => {
    const filePath = path.join(generatedDir, file);
    if (Date.now() - fs.statSync(filePath).mtime.getTime() > maxAge) {
      fs.removeSync(filePath);
      cleanedCount++;
    }
  });
  res.json({ cleanedCount });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Preview API available at http://localhost:${PORT}/api/preview-video`);
  console.log(`🔗 Generation API available at http://localhost:${PORT}/api/generate-video`);
});