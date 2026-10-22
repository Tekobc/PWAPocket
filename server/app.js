const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration – keep original filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Prefix with timestamp to avoid collisions
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({ storage });

// In‑memory map of captions/hashtags keyed by original filename (without timestamp)
let captionsMap = {};

// Helper to load existing Excel files from the uploads folder on startup
function loadExistingCaptions() {
  const files = fs.readdirSync(uploadDir);
  files.forEach((f) => {
    if (path.extname(f).toLowerCase() === '.xlsx' || path.extname(f).toLowerCase() === '.xls') {
      const workbook = xlsx.readFile(path.join(uploadDir, f));
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);
      rows.forEach((row) => {
        if (row.file && row.caption) {
          captionsMap[row.file] = {
            caption: row.caption,
            hashtags: row.hashtags || '',
          };
        }
      });
    }
  });
}

loadExistingCaptions();

// Route: upload one or many files (field name "files")
app.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded.' });
  }

  // If an excel file is present, parse it and update captionsMap
  req.files.forEach((file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const workbook = xlsx.readFile(file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);
        rows.forEach((row) => {
          if (row.file && row.caption) {
            captionsMap[row.file] = {
              caption: row.caption,
              hashtags: row.hashtags || '',
            };
          }
        });
      } catch (e) {
        console.error('Failed to parse Excel file', e);
      }
    }
  });

  res.json({ message: 'Upload successful', files: req.files.map(f => f.filename) });
});

// Route: list all uploaded assets (excluding Excel files)
app.get('/assets', (req, res) => {
  const files = fs.readdirSync(uploadDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext !== '.xlsx' && ext !== '.xls';
  });
  const assets = files.map((filename) => {
    // Remove timestamp prefix for display purposes
    const displayName = filename.replace(/^\d+_/, '');
    const captionInfo = captionsMap[displayName] || null;
    return {
      filename,
      displayName,
      url: `${req.protocol}://${req.get('host')}/asset/${filename}`,
      caption: captionInfo?.caption || null,
      hashtags: captionInfo?.hashtags || null,
    };
  });
  res.json(assets);
});

// Route: serve a single asset file
app.get('/asset/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
