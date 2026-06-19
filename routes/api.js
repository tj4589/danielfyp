const User = require("../models/User");
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback'); // Mongoose model
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
const MAX_CSV_SIZE = 50 * 1024 * 1024; // 50MB

const POSITIVE_KEYWORDS = [
  'amazing', 'great', 'love', 'excellent', 'good', 'best', 'smooth', 'exceeded', 'happy', 'fantastic', 'awesome', 'perfect', 'easy', 'helpful', 'fast', 'enjoy', 'satisfied'
];
const NEGATIVE_KEYWORDS = [
  'bad', 'terrible', 'upset', 'hate', 'delayed', 'slow', 'poor', 'ignored', 'frustrated', 'worst', 'broken', 'issue', 'problem', 'angry', 'delay', 'refund', 'late', 'rude', 'unsatisfied', 'missing', 'damaged'
];

function normalizeCsvRow(row) {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    const normalizedKey = String(key || '').trim().toLowerCase();
    normalized[normalizedKey] = row[key] == null ? '' : String(row[key]).trim();
  });
  return normalized;
}

function getCsvFieldValue(row, keys = [], allowFallback = false) {
  for (const key of keys) {
    const value = row[key] || '';
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  if (allowFallback) {
    const fallback = Object.values(row).find(
      (field) => typeof field === 'string' && field.trim().length > 40,
    );
    return fallback ? fallback.trim() : '';
  }

  return '';
}

function extractCsvReviewData(normalizedRow) {
  const reviewText = getCsvFieldValue(normalizedRow, [
    'text',
    'review',
    'snippet',
    'comment',
    'feedback',
    'review text',
    'review_text',
    'reviewtext',
    'customer review',
    'message'
  ], true);

  const name = getCsvFieldValue(normalizedRow, [
    'name',
    'customer',
    'reviewer',
    'user',
    'author'
  ]);

  const email = getCsvFieldValue(normalizedRow, [
    'email',
    'e-mail',
    'email address',
    'email_address'
  ]);

  const phone = getCsvFieldValue(normalizedRow, [
    'phone',
    'telephone',
    'mobile',
    'contact',
    'phone number',
    'phone_number'
  ]);

  return { reviewText, name, email, phone };
}

function isValidEmail(email) {
  return typeof email === 'string' && email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function analyzeReviewSubmission({ text, name, email, phone }) {
  const reviewText = typeof text === 'string' ? text.trim() : '';
  const normalizedText = reviewText.toLowerCase();
  const safeName = name && typeof name === 'string' && name.trim() ? name.trim() : 'Anonymous';
  const safeEmail = isValidEmail(email) ? email.trim() : 'anonymous@example.com';
  const safePhone = phone && typeof phone === 'string' ? phone.trim() : '';

  const positiveCount = POSITIVE_KEYWORDS.filter((term) => normalizedText.includes(term)).length;
  const negativeCount = NEGATIVE_KEYWORDS.filter((term) => normalizedText.includes(term)).length;

  let sentiment = 'Neutral';
  let emotion = 'Neutral';
  let rating = 3;
  let confidence = Math.floor(Math.random() * (90 - 75 + 1) + 75);

  if (positiveCount > 0 && negativeCount > 0) {
    sentiment = 'Neutral';
    emotion = 'Neutral';
    rating = 3;
    confidence = Math.floor(Math.random() * (85 - 65 + 1) + 65);
  } else if (positiveCount > negativeCount) {
    sentiment = 'Positive';
    emotion = positiveCount > 2 ? 'Delighted' : 'Joy';
    rating = Math.min(5, 3 + positiveCount);
  } else if (negativeCount > positiveCount) {
    sentiment = 'Critical';
    emotion = negativeCount > 2 ? 'Frustrated' : 'Anger';
    rating = Math.max(1, 3 - negativeCount);
  }

  if (positiveCount === 0 && negativeCount === 0) {
    sentiment = 'Neutral';
    emotion = 'Neutral';
    rating = 3;
    confidence = Math.floor(Math.random() * (80 - 65 + 1) + 65);
  }

  rating = Math.min(5, Math.max(1, rating));
  const snippet = reviewText.length > 80 ? reviewText.substring(0, 77) + '...' : reviewText;

  return {
    snippet,
    rating,
    emotion,
    confidence,
    sentiment,
    name: safeName,
    email: safeEmail,
    phone: safePhone,
    createdAt: new Date()
  };
}

// GET /api/feedback - Retrieve all feedback (admin only)
router.get('/feedback', authenticate, authorize('admin'), async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedback);
  } catch (err) {
    console.error('GET /api/feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/user/feedback - Retrieve recent feedback for the user feed (admin only)
router.get('/user/feedback', authenticate, authorize('admin'), async (req, res) => {
  try {
    const recent = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(recent);
  } catch (err) {
    console.error('GET /api/user/feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch user feedback' });
  }
});
router.post("/register", async (req, res) => {

  try {

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({
      username
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Username already exists"
      });
    }

    // Hash the password before saving
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashed,
      role: "user"
    });

    await user.save();

    res.json({
      success: true,
      message: "Registration successful"
    });

  } catch (err) {

    res.status(500).json({
      error: "Registration failed"
    });

  }

});
// POST /api/login - Login with hardcoded admin or registered users
router.post("/login", async (req, res) => {

  try {

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    // Check hardcoded admin credentials
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign({ id: 'admin-user', role: 'admin' }, jwtSecret, { expiresIn: '8h' });
      return res.json({
        success: true,
        role: 'admin',
        token,
        redirect: '/dashboard.html'
      });
    }

    // Check registered users in database
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const redirect =
      user.role === "admin"
        ? "/dashboard.html"
        : "/feed.html";

    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '8h' });

    res.json({
      success: true,
      role: user.role,
      token,
      redirect
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: "Login failed"
    });
  }
});

router.post('/analyze',
    [
      body('text').isString().withMessage('Review text must be a string'),
      body('name').optional().isString().withMessage('Name must be a string'),
      body('email').optional().isString().withMessage('Email must be a string'),
      body('phone').optional().isString().withMessage('Phone must be a string')
    ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const text = req.body.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Review text is required' });
    }

    const feedbackData = analyzeReviewSubmission({
      text,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone
    });

    try {
      const newFeedback = new Feedback(feedbackData);
      const savedFeedback = await newFeedback.save();
      setTimeout(() => res.status(201).json(savedFeedback), 1500);
    } catch (err) {
      console.error('POST /api/analyze save error:', err);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
);



// GET single feedback by ID (admin only)
router.get('/feedback/:id', authenticate, authorize('admin'),
  param('id').isMongoId().withMessage('Invalid ID'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    Feedback.findById(req.params.id)
      .then(feedback => {
        if (!feedback) {
          return res.status(404).json({ error: 'Feedback not found' });
        }
        res.json(feedback);
      })
      .catch(err => {
        console.error('GET /api/feedback/:id error:', err);
        res.status(500).json({ error: 'Failed to fetch feedback' });
      });
  });

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const ADMIN_TOKEN = 'admin-secret'; // Simple admin token for CSV uploads

// Multer configuration for file uploads
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// CSV upload endpoint – secured with admin token
router.post('/csv', upload.single('file'), async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileExt = path.extname(req.file.originalname || '').toLowerCase();
  if (fileExt !== '.csv') {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Uploaded file must be a CSV.' });
  }

  if (req.file.size > MAX_CSV_SIZE) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'CSV file exceeds maximum size of 50MB.' });
  }

  const rows = [];
  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv({
          mapHeaders: ({ header }) => (header ? header.trim() : ''),
          skipLines: 0,
          trim: true
        }))
        .on('data', (data) => rows.push(data))
        .on('error', reject)
        .on('end', resolve);
    });
  } catch (err) {
    console.error('CSV upload parse error:', err);
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Unable to parse CSV file. Please ensure the file is well-formed and includes headers.' });
  }

  if (rows.length === 0) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'CSV file contains no data rows.' });
  }

  const feedbackDocs = [];
  const invalidRows = [];

  rows.forEach((row, index) => {
    const normalized = normalizeCsvRow(row);
    const { reviewText, name, email, phone } = extractCsvReviewData(normalized);

    if (!reviewText || typeof reviewText !== 'string' || !reviewText.trim()) {
      invalidRows.push({ row: index + 2, error: 'Missing review text' });
      return;
    }

    feedbackDocs.push(analyzeReviewSubmission({ text: reviewText, name, email, phone }));
  });

  if (invalidRows.length > 0) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      error: 'CSV contains malformed rows.',
      details: invalidRows.slice(0, 10)
    });
  }

  if (feedbackDocs.length === 0) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'No valid feedback rows were found in the CSV file.' });
  }

  try {
    const inserted = [];
    const batchSize = 1000;
    for (let i = 0; i < feedbackDocs.length; i += batchSize) {
      const batch = feedbackDocs.slice(i, i + batchSize);
      const savedBatch = await Feedback.insertMany(batch, { ordered: true });
      inserted.push(...savedBatch);
    }

    await fs.promises.unlink(req.file.path).catch(() => {});
    res.json({ inserted: inserted.length, totalRows: feedbackDocs.length });
  } catch (err) {
    console.error('CSV upload error:', err);
    await fs.promises.unlink(req.file.path).catch(() => {});
    const errorResponse = { error: 'Failed to save CSV feedback to the database.' };
    if (err && err.name === 'ValidationError') {
      errorResponse.details = err.errors;
    }
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
