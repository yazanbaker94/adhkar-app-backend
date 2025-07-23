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
    'http://localhost:8080',
    'http://127.0.0.1:3000'
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
app.post('/api/preview-video', async (req, res) => {
  try {
    console.log('Generating live preview...');
    
    const {
      surah, ayah, ayahTo, reciter, backgroundType, backgroundFilename,
      textColor, fontSize, fontFamily, orientation
    } = req.body;

    console.log('Preview request body:', req.body);

    // Validate required parameters
    if (!surah || !ayah || !backgroundFilename) {
      console.error('Missing required parameters:', { surah, ayah, backgroundFilename });
      return res.status(400).json({ 
        error: 'Missing required parameters: surah, ayah, and backgroundFilename are required' 
      });
    }

    const surahNum = parseInt(surah);
    const ayahNum = parseInt(ayah);

    if (isNaN(surahNum) || isNaN(ayahNum) || surahNum < 1 || ayahNum < 1) {
      console.error('Invalid surah or ayah numbers:', { surah: surahNum, ayah: ayahNum });
      return res.status(400).json({ 
        error: 'Invalid surah or ayah numbers' 
      });
    }

    // Create a short preview video (3-5 seconds max)
    const previewId = uuidv4();
    const previewDuration = 3; // 3 seconds for quick preview
    
    // Use same logic as main video generation but shorter
    const videoWidth = orientation === 'portrait' ? 1080 : orientation === 'square' ? 1080 : 1920;
    const videoHeight = orientation === 'portrait' ? 1920 : orientation === 'square' ? 1080 : 1080;
    
    const fontMapping = {
      'Al Mushaf': 'Al Majeed Quranic Font',
      'Uthmanic Hafs': 'KFGQPC HAFS Uthmanic Script'
    };
    
      let selectedFont = fontMapping[fontFamily] || fontFamily;
  // Scale font size based on video height for better readability
  const baseFontSize = fontSize || Math.floor(videoHeight * 0.045); // 4.5% of video height
  const textColorValue = textColor || '#ffffff';
    
    // Test and detect working font for Hafs in preview at actual font size
    if (fontFamily === 'Uthmanic Hafs') {
      console.log('🔍 Preview: Testing Hafs font variations at actual size...');
      const testCanvas = createCanvas(100, 50);
      const testCtx = testCanvas.getContext('2d');
      const testText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
      
      // Test at actual font size, not 24px
      testCtx.font = `${baseFontSize}px "Arial"`;
      const arialBaseline = testCtx.measureText(testText).width;
      console.log(`Preview Arial baseline at ${baseFontSize}px: ${arialBaseline}px`);
      
      const possibleNames = [
        'KFGQPC HAFS Uthmanic Script',
        'UthmanicHafs1Ver18',
        'KFGQPC Hafs Uthmanic Script', 
        'Traditional Arabic',
        // Try the actual Windows font names
        'KFGQPC Uthmanic Script HAFS',
        'UthmanicHafs1 Ver18',
        'Uthmanic Hafs Ver18'
      ];
      
      let detectedWorkingFont = null;
      possibleNames.forEach(name => {
        try {
          testCtx.font = `${baseFontSize}px "${name}"`;
          const width = testCtx.measureText(testText).width;
          const diff = Math.abs(width - arialBaseline);
          console.log(`Preview font "${name}" at ${baseFontSize}px: width=${width}px, diff=${diff}px`);
          
          if (diff > 10 && !detectedWorkingFont) { // Use higher threshold for larger fonts
            detectedWorkingFont = name;
            console.log(`✓ Preview detected working Hafs font: ${name}`);
          }
        } catch (e) {
          console.log(`Preview font "${name}": failed - ${e.message}`);
        }
      });
      
      if (detectedWorkingFont) {
        selectedFont = detectedWorkingFont;
        console.log(`🔄 Preview using detected font: ${detectedWorkingFont}`);
      } else {
        // If no font detected, try system Arabic fonts directly
        console.log('🔄 No Hafs font detected, trying system Arabic fonts...');
        const systemArabicFonts = ['Traditional Arabic', 'Arabic Typesetting', 'Tahoma'];
        for (const sysFont of systemArabicFonts) {
          testCtx.font = `${baseFontSize}px "${sysFont}"`;
          const sysWidth = testCtx.measureText(testText).width;
          const sysDiff = Math.abs(sysWidth - arialBaseline);
          console.log(`System font "${sysFont}" at ${baseFontSize}px: width=${sysWidth}px, diff=${sysDiff}px`);
          if (sysDiff > 5) {
            selectedFont = sysFont;
            console.log(`✓ Using system Arabic font: ${sysFont}`);
            break;
          }
        }
      }
    }
    
    // Calculate responsive dimensions for preview (same as main generation)
    const maxTextWidth = Math.floor(videoWidth * 0.85);
    const arabicTextHeight = Math.floor(videoHeight * 0.2);
    const translationTextHeight = Math.floor(videoHeight * 0.15);
    
    // Get verse text (same structure as main generation)
    const quranData = JSON.parse(fs.readFileSync('./quran-uthmani.json', 'utf8'));
    const translationData = JSON.parse(fs.readFileSync('./en.sahih.json', 'utf8'));
    
    console.log('Loading verse data for surah:', surahNum, 'ayah:', ayahNum);
    
    // Access data correctly - check if it's wrapped in .data or direct
    const quranSurahs = quranData.data ? quranData.data.surahs : quranData.surahs;
    const translationSurahs = translationData.data ? translationData.data.surahs : translationData.surahs;
    
    if (!quranSurahs || !translationSurahs) {
      throw new Error('Could not access Quran data structure');
    }
    
    if (surahNum > quranSurahs.length || ayahNum > quranSurahs[surahNum - 1].ayahs.length) {
      throw new Error(`Invalid verse reference: surah ${surahNum}, ayah ${ayahNum}`);
    }
    
    const selectedSurah = quranSurahs[surahNum - 1];
    // Handle verse ranges for preview
    const startVerse = parseInt(ayahNum);
    const endVerse = ayahTo ? parseInt(ayahTo) : startVerse;
    
    let arabicText = '';
    let translationText = '';
    
    for (let i = startVerse; i <= endVerse; i++) {
      const selectedAyah = selectedSurah.ayahs[i - 1];
      const selectedTranslation = translationSurahs[surahNum - 1].ayahs[i - 1];
      
      if (!selectedAyah || !selectedTranslation) {
        throw new Error(`Could not find verse data for surah ${surahNum}, ayah ${i}`);
      }
      
      if (arabicText) arabicText += ' ';
      if (translationText) translationText += ' ';
      
      arabicText += selectedAyah.text;
      translationText += selectedTranslation.text;
    }
    
    console.log('🔍 Original Arabic text from Quran data:');
    console.log(`"${arabicText}"`);
    console.log('Text length:', arabicText.length);
    console.log('First 10 characters:', arabicText.substring(0, 10).split('').map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));
    
    // Fix Unicode normalization issues for Arabic text
    console.log('🔧 Applying Unicode normalization...');
    
    // Normalize Unicode composition (NFC)
    arabicText = arabicText.normalize('NFC');
    
    // Fix specific Arabic character issues - enhanced for diacritics
    arabicText = arabicText
      // Fix the exact pattern we see in logs: ء + FATHA + ا → أ
      .replace(/\u0621\u064E\u0627/g, '\u0623') // ء َ ا → أ (exact pattern from debugging)
      // Fix other hamza + diacritics + alif patterns
      .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0627/g, '\u0623') // hamza + any diacritics + alif → hamza on alif
      .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0625/g, '\u0625') // hamza + any diacritics + hamza-under-alif
      .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0622/g, '\u0622') // hamza + any diacritics + alif-madda
      // Fix simple cases without diacritics
      .replace(/ءا/g, 'أ')
      .replace(/\u0621\u0627/g, '\u0623') // hamza + alif → hamza on alif
      .replace(/\u0621\u0623/g, '\u0623') // hamza + hamza-on-alif → hamza on alif
      .replace(/\u0621\u0625/g, '\u0625') // hamza + hamza-under-alif → hamza under alif
      .replace(/\u0621\u0622/g, '\u0622') // hamza + alif-madda → alif madda
      .replace(/ٱلْءَاخِرَةِ/g, 'الْآخِرَةِ') // Fix "الآخرة" rendering issue
      .replace(/ءَاخِرَةِ/g, 'آخِرَةِ') // Alternative pattern for "الآخرة"
      .replace(/وَبِٱلْءَاخِرَةِ/g, 'وَبِالْآخِرَةِ') // Fix "وبالآخرة" specific issue
      .replace(/بِٱلْءَاخِرَةِ/g, 'بِالْآخِرَةِ') // Fix "بالآخرة" pattern
      .replace(/ٱلْءَ/g, 'الْآ'); // General fix for hamza-alif in definite articles
    
    console.log('🔧 After normalization:');
    console.log(`"${arabicText}"`);
    console.log('New length:', arabicText.length);
    
    // Check for problematic characters
    const problematicChars = arabicText.match(/[\uFFFD\u0621]/g);
    if (problematicChars) {
      console.log('⚠️ Found problematic characters:', problematicChars.map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));
    } else {
      console.log('✅ No problematic characters found');
    }
    
    // Function to calculate optimal font size and handle text wrapping (same as main generation)
    function calculateOptimalTextSize(text, fontFamily, baseSize, maxWidth, maxHeight) {
      const tempCanvas = createCanvas(100, 100);
      const tempCtx = tempCanvas.getContext('2d');
      
      let optimalSize = baseSize;
      let lines = [text];
      
      for (let size = baseSize; size >= 16; size -= 2) {
        tempCtx.font = `${size}px "${fontFamily}"`;
        
        const singleLineWidth = tempCtx.measureText(text).width;
        const lineHeight = size * 1.3;
        
        if (singleLineWidth <= maxWidth && lineHeight <= maxHeight) {
          optimalSize = size;
          lines = [text];
          break;
        }
        
        // Check if text contains Arabic characters
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
        
        if (hasArabic) {
          // For Arabic text, AVOID text wrapping to prevent corruption
          // Just continue to smaller font sizes
          console.log(`🚫 Arabic text detected, skipping wrapping at size ${size}px`);
          continue;
        } else {
          // For non-Arabic text, use normal wrapping
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
      }
      
      return { fontSize: optimalSize, lines: lines };
    }
    
    // Use consistent font sizing (same as final video) instead of calculateOptimalTextSize
    const arabicTextData = {
      fontSize: baseFontSize, // Use full base font size like final video
      lines: [arabicText] // Placeholder, will be replaced with proper wrapping
    };
    const translationTextData = calculateOptimalTextSize(translationText, 'Arial', Math.floor(baseFontSize * 0.7), maxTextWidth, translationTextHeight);
    
    // Create text images with responsive sizing
    const tempArabicTextPath = path.join(__dirname, 'temp', `${previewId}_preview_arabic.png`);
    const tempTranslationTextPath = path.join(__dirname, 'temp', `${previewId}_preview_translation.png`);
    
    // Generate Arabic text image with unified background
    const arabicCanvas = createCanvas(videoWidth, arabicTextHeight);
    const arabicCtx = arabicCanvas.getContext('2d');
    
    // Set initial font and test if it works (same logic as main generation)
    let finalFont = selectedFont;
    arabicCtx.font = `${arabicTextData.fontSize}px "${selectedFont}"`;
    
    // Test if font is working
    const testCtx = createCanvas(200, 100).getContext('2d');
    const testText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    
    testCtx.font = `${arabicTextData.fontSize}px "Arial"`;
    const arialWidth = testCtx.measureText(testText).width;
    
    testCtx.font = `${arabicTextData.fontSize}px "${selectedFont}"`;
    const customFontWidth = testCtx.measureText(testText).width;
    const customFontDifference = Math.abs(customFontWidth - arialWidth);
    
    console.log(`Preview font test - Original: "${selectedFont}", width=${customFontWidth}px, diff=${customFontDifference}px`);
    
    if (customFontDifference > 10) {
      console.log(`✓ Preview: Original font "${selectedFont}" is working fine (diff=${customFontDifference}px)`);
      finalFont = selectedFont;
    } else if (fontFamily === 'Uthmanic Hafs') {
      console.log('🔍 Preview: Original Hafs font not working, trying alternatives...');
      // Try alternative font names for Hafs
      const alternativeNames = [
        'UthmanicHafs1Ver18', 
        'KFGQPC Hafs Uthmanic Script', 
        'Traditional Arabic',
        'KFGQPC Uthmanic Script HAFS',
        'UthmanicHafs1 Ver18',
        'Uthmanic Hafs Ver18'
      ];
      
      for (const altName of alternativeNames) {
        testCtx.font = `${arabicTextData.fontSize}px "${altName}"`;
        const altWidth = testCtx.measureText(testText).width;
        const altDifference = Math.abs(altWidth - arialWidth);
        
        console.log(`Preview testing "${altName}": width=${altWidth}px, diff=${altDifference}px`);
        
        if (altDifference > 10) {
          finalFont = altName;
          console.log(`✓ Preview using working font: ${altName}`);
          break;
        }
      }
    } else {
      console.log(`⚠ Preview: Font "${selectedFont}" not working well (diff=${customFontDifference}px), keeping it anyway`);
    }
    
    arabicCtx.font = `${arabicTextData.fontSize}px "${finalFont}"`;
    console.log(`🎨 Preview: Final Canvas font set to: ${arabicCtx.font}`);
    
    // Double-check the font is actually working by measuring text again
    const finalTestWidth = arabicCtx.measureText('بِسْمِ اللَّهِ').width;
    console.log(`🎨 Preview: Final text width with "${finalFont}": ${finalTestWidth}px`);
    
    // Test specific problematic text
    const problemText = 'وَبِٱلْءَاخِرَةِ';
    const problemWidth = arabicCtx.measureText(problemText).width;
    console.log(`🔍 Preview: Problem text "${problemText}" width: ${problemWidth}px`);
    
    // Try with Arial to compare
    const currentFont = arabicCtx.font;
    arabicCtx.font = `${arabicTextData.fontSize}px "Arial"`;
    const arialProblemWidth = arabicCtx.measureText(problemText).width;
    console.log(`🔍 Preview: Same text with Arial width: ${arialProblemWidth}px`);
    
    // Reset to final font
    arabicCtx.font = currentFont;
    
    // Pre-calculate Arabic text wrapping for preview (same as final video) - MOVED HERE
    const previewArabicCtxTemp = createCanvas(100, 100).getContext('2d');
    previewArabicCtxTemp.font = `${arabicTextData.fontSize}px "${finalFont}"`;
    
    console.log(`🔧 Preview: Wrapping calculation using font: ${arabicTextData.fontSize}px "${finalFont}"`);
    console.log(`🔧 Preview: Max text width: ${maxTextWidth}px`);
    console.log(`🔧 Preview: Full Arabic text: "${arabicText.substring(0, 100)}..."`);
    
    const previewArabicWords = arabicText.split(' ');
    const previewArabicWrappedLines = [];
    let previewCurrentArabicLine = '';
    
    for (const word of previewArabicWords) {
      const testLine = previewCurrentArabicLine ? `${previewCurrentArabicLine} ${word}` : word;
      const testWidth = previewArabicCtxTemp.measureText(testLine).width;
      
      if (testWidth <= maxTextWidth || !previewCurrentArabicLine) {
        previewCurrentArabicLine = testLine;
      } else {
        console.log(`🔧 Preview: Line break - "${previewCurrentArabicLine}" (width: ${previewArabicCtxTemp.measureText(previewCurrentArabicLine).width}px)`);
        previewArabicWrappedLines.push(previewCurrentArabicLine);
        previewCurrentArabicLine = word;
      }
    }
    if (previewCurrentArabicLine) {
      console.log(`🔧 Preview: Final line - "${previewCurrentArabicLine}" (width: ${previewArabicCtxTemp.measureText(previewCurrentArabicLine).width}px)`);
      previewArabicWrappedLines.push(previewCurrentArabicLine);
    }
    
    console.log(`📏 Preview: Arabic text will wrap to ${previewArabicWrappedLines.length} lines`);
    console.log(`📏 Preview: Using font size ${arabicTextData.fontSize}px for Arabic text`);
    console.log(`📏 Preview: arabicTextData.lines has ${arabicTextData.lines?.length || 0} lines`);
    console.log(`📏 Preview: previewArabicWrappedLines has ${previewArabicWrappedLines.length} lines`);
    
    // Calculate text positioning using pre-calculated wrapped lines (match final video)
    const lineHeight = arabicTextData.fontSize * 1.3;
    const totalTextHeight = previewArabicWrappedLines.length * lineHeight;
    const startY = (arabicTextHeight - totalTextHeight) / 2 + lineHeight / 2;
    
    // Set text styles
    arabicCtx.fillStyle = textColorValue;
    arabicCtx.strokeStyle = '#000000';
    arabicCtx.lineWidth = 3;
    arabicCtx.textAlign = 'center';
    arabicCtx.textBaseline = 'middle';
    
    console.log('🎨 Preview - Drawing Arabic text lines (using wrapped lines):');
    console.log(`🎨 Preview - Total lines to draw: ${previewArabicWrappedLines.length}`);
    console.log(`🎨 Preview - Line height: ${lineHeight}px, Start Y: ${startY}px`);
    
    previewArabicWrappedLines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      console.log(`Preview Line ${index + 1}: "${line.substring(0, 50)}..." at Y=${y}`);
      
      arabicCtx.strokeText(line, videoWidth / 2, y);
      arabicCtx.fillText(line, videoWidth / 2, y);
    });
    
    const arabicBuffer = arabicCanvas.toBuffer('image/png');
    fs.writeFileSync(tempArabicTextPath, arabicBuffer);
    
    // Generate translation text image with multiple lines
    const translationCanvas = createCanvas(videoWidth, translationTextHeight);
    const translationCtx = translationCanvas.getContext('2d');
    translationCtx.font = `${translationTextData.fontSize}px "Arial"`;
    
    // Calculate translation text positioning (no background - will be unified)
    const translationLineHeight = translationTextData.fontSize * 1.3;
    const totalTranslationHeight = translationTextData.lines.length * translationLineHeight;
    const translationStartY = (translationTextHeight - totalTranslationHeight) / 2 + translationLineHeight / 2;
    
    // Set text styles
    translationCtx.fillStyle = textColorValue;
    translationCtx.strokeStyle = '#000000';
    translationCtx.lineWidth = 2;
    translationCtx.textAlign = 'center';
    translationCtx.textBaseline = 'middle';
    
    translationTextData.lines.forEach((line, index) => {
      const y = translationStartY + (index * translationLineHeight);
      translationCtx.strokeText(line, videoWidth / 2, y);
      translationCtx.fillText(line, videoWidth / 2, y);
    });
    
    const translationBuffer = translationCanvas.toBuffer('image/png');
    fs.writeFileSync(tempTranslationTextPath, translationBuffer);
    
    // Create unified background overlay for both texts
    const unifiedOverlayCanvas = createCanvas(videoWidth, videoHeight);
    const unifiedOverlayCtx = unifiedOverlayCanvas.getContext('2d');
    
    // Arabic text wrapping already calculated above - use those results
    
    // Text dimensions will be calculated below using final video logic
    
    // Background overlay dimensions - match final video exactly
    const overlayPadding = 60; // Increased padding for better coverage
    const overlayWidth = videoWidth * 0.9; // Slightly wider for better coverage
    
    // MATCH FINAL VIDEO EXACTLY - Use the same precise positioning as final video
    // Calculate actual text dimensions based on wrapped lines (same as final video)
    const arabicHeight = arabicTextData.fontSize * 1.3 * previewArabicWrappedLines.length;
    const translationHeight = translationTextData.fontSize * 1.3 * translationTextData.lines.length;
    const textGap = Math.floor(videoHeight * 0.02); // 2% of video height as gap
    
    // Use the EXACT same positioning calculation as final video
    const extraGap = Math.floor(videoHeight * 0.05); // Additional 5% gap between texts
    const arabicOffset = Math.floor(arabicHeight / 2) + extraGap; // Arabic above center
    const translationOffset = Math.floor(translationHeight / 2) + extraGap; // Translation below center with gap
    
    // Calculate overlay position to match where text will actually be drawn (SAME AS FINAL VIDEO)
    // The overlay should cover from top of Arabic to bottom of translation with proper padding
    const arabicTopPosition = (videoHeight / 2) - arabicOffset - (arabicHeight / 2);
    const translationBottomPosition = (videoHeight / 2) + translationOffset + (translationHeight / 2);
    
    const overlayTopY = arabicTopPosition - overlayPadding;
    const overlayBottomY = translationBottomPosition + overlayPadding;
    const overlayHeight = overlayBottomY - overlayTopY;
    
    console.log(`🔧 Preview: Using EXACT FINAL VIDEO positioning logic`);
    console.log(`🔧 Preview: Arabic area: ${arabicTopPosition}px to ${arabicTopPosition + arabicHeight}px`);
    console.log(`🔧 Preview: Translation area: ${translationBottomPosition - translationHeight}px to ${translationBottomPosition}px`);
    console.log(`🔧 Preview: Arabic offset: ${arabicOffset}px, Translation offset: ${translationOffset}px`);
    
    const overlayX = (videoWidth - overlayWidth) / 2;
    const overlayY = overlayTopY;
    
    console.log(`📏 Preview overlay positioning:`);
    console.log(`📏 Video center: ${videoHeight / 2}px`);
    console.log(`📏 Arabic positioning: top=${arabicTopPosition}px, height=${arabicHeight}px, offset=${arabicOffset}px`);
    console.log(`📏 Translation positioning: bottom=${translationBottomPosition}px, height=${translationHeight}px, offset=${translationOffset}px`);
    console.log(`📏 Overlay: ${overlayWidth}x${overlayHeight} at (${overlayX}, ${overlayY})`);
    console.log(`📏 Overlay covers Y: ${overlayTopY} to ${overlayBottomY}`);
    
    // Draw smooth rounded background
    unifiedOverlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    unifiedOverlayCtx.beginPath();
    unifiedOverlayCtx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 25);
    unifiedOverlayCtx.fill();
    
    const tempUnifiedOverlayPath = path.join(__dirname, 'temp', `${previewId}_unified_overlay.png`);
    const unifiedOverlayBuffer = unifiedOverlayCanvas.toBuffer('image/png');
    fs.writeFileSync(tempUnifiedOverlayPath, unifiedOverlayBuffer);
    
    // Create watermark image for preview
    const watermarkCanvas = createCanvas(videoWidth, videoHeight);
    const watermarkCtx = watermarkCanvas.getContext('2d');
    
    // Set watermark properties - prominent top placement with better sizing
    const websiteFontSize = Math.max(36, Math.floor(videoWidth * 0.045)); // Much larger and responsive
    const surahFontSize = Math.max(26, Math.floor(videoWidth * 0.03)); // Larger surah name
    
    // Position at top center
    const topPadding = Math.floor(videoHeight * 0.08); // 8% from top
    const websiteY = topPadding;
    const surahY = websiteY + websiteFontSize + 10; // 10px spacing between lines
    
    // Get surah name
    const surahNamesEnglish = [
      "Al-Fatihah", "Al-Baqarah", "Aal-E-Imran", "An-Nisa", "Al-Maidah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus",
      "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha",
      "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
      "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
      "Fussilat", "Ash-Shuraa", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
      "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah",
      "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
      "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
      "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
      "Ash-Shams", "Al-Layl", "Ad-Duhaa", "Ash-Sharh", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat",
      "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
      "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
    ];
    
    const surahName = surahNamesEnglish[surah - 1] || `Surah ${surah}`;
    const surahWithVerse = `${surahName} - Verse ${ayah}`;
    
    // Style: Bold white text with dark outline for visibility
    watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    watermarkCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    watermarkCtx.lineWidth = 2;
    watermarkCtx.textAlign = 'center';
    watermarkCtx.textBaseline = 'top';
    
    // Draw website name (extra bold and prominent with Impact font)
    watermarkCtx.font = `900 ${websiteFontSize}px "Impact", "Arial Black", sans-serif`;
    watermarkCtx.lineWidth = 4; // Even thicker outline for better visibility
    watermarkCtx.strokeText('I made this on SakinahTimes.com', videoWidth / 2, websiteY);
    watermarkCtx.fillText('I made this on SakinahTimes.com', videoWidth / 2, websiteY);
    
    // Reset line width for surah text
    watermarkCtx.lineWidth = 3;
    
    // Draw surah name with verse number (also with Impact font)
    watermarkCtx.font = `bold ${surahFontSize}px "Impact", "Arial Black", sans-serif`;
    watermarkCtx.strokeText(surahWithVerse, videoWidth / 2, surahY);
    watermarkCtx.fillText(surahWithVerse, videoWidth / 2, surahY);
    
    const tempWatermarkPath = path.join(__dirname, 'temp', `${previewId}_watermark.png`);
    const watermarkBuffer = watermarkCanvas.toBuffer('image/png');
    fs.writeFileSync(tempWatermarkPath, watermarkBuffer);
    
    // Generate quick preview video
    const backgroundPath = path.join(__dirname, 'videos', backgroundFilename);
    const previewOutputPath = path.join(__dirname, 'previews', `${previewId}.mp4`);
    
    // Ensure previews directory exists
    fs.ensureDirSync(path.join(__dirname, 'previews'));
    
    // Use the EXACT same positioning as final video for FFmpeg command
    const previewArabicTextOffset = arabicOffset; // Use same offset as final video
    const previewTranslationTextOffset = translationOffset; // Use same offset as final video

    console.log(`📏 Preview FFmpeg positioning (MATCHES FINAL VIDEO): Arabic offset=${previewArabicTextOffset}, Translation offset=${previewTranslationTextOffset}`);

    const command = ffmpeg()
      .input(backgroundPath)
      .inputOptions(['-stream_loop', '-1', '-t', previewDuration.toString()])
      .input(tempUnifiedOverlayPath)
      .input(tempArabicTextPath)
      .input(tempTranslationTextPath)
      .input(tempWatermarkPath)
      .complexFilter([
        `[0:v]scale=${videoWidth}:${videoHeight}[scaled]`,
        `[scaled][1:v]overlay=0:0[with_overlay]`,
        `[with_overlay][2:v]overlay=(W-w)/2:(H-h)/2-${previewArabicTextOffset}[with_arabic]`,
        `[with_arabic][3:v]overlay=(W-w)/2:(H-h)/2+${previewTranslationTextOffset}[with_translation]`,
        `[with_translation][4:v]overlay=0:0[final]`
      ])
      .outputOptions([
        '-map', '[final]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // Fastest encoding for preview
        '-crf', '28', // Lower quality for speed
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an' // No audio for preview
      ])
      .output(previewOutputPath);
    
    await new Promise((resolve, reject) => {
      command
        .on('end', () => {
          console.log('Preview video generated successfully');
          // Clean up temp files
          fs.unlinkSync(tempArabicTextPath);
          fs.unlinkSync(tempTranslationTextPath);
          fs.unlinkSync(tempUnifiedOverlayPath);
          fs.unlinkSync(tempWatermarkPath);
          resolve();
        })
        .on('error', (err) => {
          console.error('Preview generation error:', err);
          reject(err);
        })
        .run();
    });
    
    // Clean up old preview files (keep only last 10)
    setTimeout(() => {
      try {
        const previewsDir = path.join(__dirname, 'previews');
        const files = fs.readdirSync(previewsDir).filter(f => f.endsWith('.mp4'));
        if (files.length > 10) {
          files
            .map(f => ({ name: f, path: path.join(previewsDir, f), time: fs.statSync(path.join(previewsDir, f)).mtime }))
            .sort((a, b) => b.time - a.time)
            .slice(10) // Keep newest 10, remove the rest
            .forEach(f => {
              try {
                fs.unlinkSync(f.path);
                console.log('Cleaned up old preview:', f.name);
              } catch (err) {
                console.log('Could not delete preview file:', f.name);
              }
            });
        }
      } catch (err) {
        console.log('Preview cleanup error:', err);
      }
    }, 1000);

    res.json({
      success: true,
      previewId: previewId,
      previewUrl: `https://adhkar-app-backend.fly.dev/previews/${previewId}.mp4`,
      duration: previewDuration
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
      thumbnailUrl: `https://adhkar-app-backend.fly.dev/api/thumbnail/${f}`
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
      
      // Apply Unicode normalization to each verse
      verseText = verseText.normalize('NFC');
      
      // Fix specific Arabic character issues - enhanced for diacritics
      verseText = verseText
        .replace(/\u0621\u064E\u0627/g, '\u0623') // ء َ ا → أ (exact pattern from debugging)
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0627/g, '\u0623') // hamza + any diacritics + alif → hamza on alif
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0625/g, '\u0625') // hamza + any diacritics + hamza-under-alif
        .replace(/\u0621[\u064E\u064F\u0650\u0652]*\u0622/g, '\u0622') // hamza + any diacritics + alif-madda
        .replace(/ءا/g, 'أ')
        .replace(/\u0621\u0627/g, '\u0623')
        .replace(/\u0621\u0623/g, '\u0623')
        .replace(/\u0621\u0625/g, '\u0625')
        .replace(/\u0621\u0622/g, '\u0622')
        .replace(/ٱلْءَاخِرَةِ/g, 'الْآخِرَةِ') // Fix "الآخرة" rendering issue
        .replace(/ءَاخِرَةِ/g, 'آخِرَةِ') // Alternative pattern for "الآخرة"
        .replace(/وَبِٱلْءَاخِرَةِ/g, 'وَبِالْآخِرَةِ') // Fix "وبالآخرة" specific issue
        .replace(/بِٱلْءَاخِرَةِ/g, 'بِالْآخِرَةِ') // Fix "بالآخرة" pattern
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
      case 'square':
        videoWidth = 1080;
        videoHeight = 1080;
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
    
    // Test different possible font names for Hafs and find the working one at actual size
    if (requestedFont === 'Uthmanic Hafs') {
      console.log('🔍 Testing Hafs font variations at actual size...');
      const testCanvas = createCanvas(100, 50);
      const testCtx = testCanvas.getContext('2d');
      const testText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
      
      // Get Arial baseline at actual font size
      testCtx.font = `${baseFontSize}px "Arial"`;
      const arialBaseline = testCtx.measureText(testText).width;
      console.log(`Arial baseline at ${baseFontSize}px: ${arialBaseline}px`);
      
      const possibleNames = [
        'KFGQPC HAFS Uthmanic Script',
        'UthmanicHafs1Ver18',
        'Uthmanic Hafs',
        'KFGQPC Hafs Uthmanic Script',
        'Traditional Arabic',
        // Try the actual Windows font names
        'KFGQPC Uthmanic Script HAFS',
        'UthmanicHafs1 Ver18',
        'Uthmanic Hafs Ver18'
      ];
      
      let detectedWorkingFont = null;
      possibleNames.forEach(name => {
        try {
          testCtx.font = `${baseFontSize}px "${name}"`;
          const width = testCtx.measureText(testText).width;
          const diff = Math.abs(width - arialBaseline);
          console.log(`Font "${name}" at ${baseFontSize}px: width=${width}px, diff=${diff}px`);
          
          if (diff > 10 && !detectedWorkingFont) { // Use higher threshold for larger fonts
            detectedWorkingFont = name;
            console.log(`✓ Detected working Hafs font: ${name}`);
          }
        } catch (e) {
          console.log(`Font "${name}": failed - ${e.message}`);
        }
      });
      
      // Update the font mapping if we found a working font
      if (detectedWorkingFont && detectedWorkingFont !== selectedFont) {
        console.log(`🔄 Updating font mapping: "${selectedFont}" → "${detectedWorkingFont}"`);
        fontMapping['Uthmanic Hafs'] = detectedWorkingFont;
        selectedFont = detectedWorkingFont;
      } else if (!detectedWorkingFont && requestedFont === 'Uthmanic Hafs') {
        // If no Hafs font works, try system Arabic fonts
        console.log('🔄 No Hafs font working, trying system Arabic fonts...');
        const systemArabicFonts = ['Traditional Arabic', 'Arabic Typesetting', 'Tahoma'];
        for (const sysFont of systemArabicFonts) {
          testCtx.font = `${baseFontSize}px "${sysFont}"`;
          const sysWidth = testCtx.measureText(testText).width;
          const sysDiff = Math.abs(sysWidth - arialBaseline);
          console.log(`System font "${sysFont}" at ${baseFontSize}px: width=${sysWidth}px, diff=${sysDiff}px`);
          if (sysDiff > 5) {
            selectedFont = sysFont;
            console.log(`✓ Using system Arabic font: ${sysFont}`);
            break;
          }
        }
      }
    }
    
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
    
    // Create watermark overlay that stays throughout the video
    console.log('🏷️ Creating watermark overlay');
    const watermarkCanvas = createCanvas(videoWidth, videoHeight);
    const watermarkCtx = watermarkCanvas.getContext('2d');
    
    // Set watermark properties - prominent top placement with better sizing (responsive)
    const websiteFontSize = Math.max(36, Math.floor(videoWidth * 0.045)); // Much larger and responsive (4.5% of width)
    const surahFontSize = Math.floor(websiteFontSize * 0.8); // 80% of website font size
    const websiteY = Math.floor(videoHeight * 0.05); // 5% from top
    const surahY = websiteY + websiteFontSize + 10; // Below website text with 10px gap
    
    // Get surah name for watermark
    const watermarkQuranData = JSON.parse(fs.readFileSync('quran-uthmani.json', 'utf8'));
    const surahName = watermarkQuranData.data.surahs[surah - 1].englishName;
    const watermarkStartVerse = parseInt(ayah);
    const watermarkEndVerse = ayahTo ? parseInt(ayahTo) : watermarkStartVerse;
    const surahWithVerse = watermarkEndVerse > watermarkStartVerse ? 
      `${surahName} ${watermarkStartVerse}-${watermarkEndVerse}` : 
      `${surahName} ${watermarkStartVerse}`;
    
    // Clear background (transparent)
    watermarkCtx.clearRect(0, 0, videoWidth, videoHeight);
    
    // Draw website watermark
    watermarkCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    watermarkCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    watermarkCtx.lineWidth = 2;
    watermarkCtx.textAlign = 'center';
    watermarkCtx.textBaseline = 'top';
    
    // Website text
    watermarkCtx.font = `900 ${websiteFontSize}px "Impact", "Arial Black", sans-serif`;
    watermarkCtx.lineWidth = 4;
    watermarkCtx.strokeText('I made this on SakinahTimes.com', videoWidth / 2, websiteY);
    watermarkCtx.fillText('I made this on SakinahTimes.com', videoWidth / 2, websiteY);
    
    // Surah name and verse
    watermarkCtx.lineWidth = 3;
    watermarkCtx.font = `bold ${surahFontSize}px "Impact", "Arial Black", sans-serif`;
    watermarkCtx.strokeText(surahWithVerse, videoWidth / 2, surahY);
    watermarkCtx.fillText(surahWithVerse, videoWidth / 2, surahY);
    
    const tempWatermarkPath = path.join(__dirname, 'temp', `${videoId}_watermark.png`);
    const watermarkBuffer = watermarkCanvas.toBuffer('image/png');
    fs.writeFileSync(tempWatermarkPath, watermarkBuffer);
    
    console.log('✅ Watermark overlay created');
    
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