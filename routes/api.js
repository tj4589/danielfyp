const User = require("../models/User");
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback'); // Mongoose model
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

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
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const name = req.body.name && req.body.name.trim() ? req.body.name.trim() : 'Anonymous';
    const email = req.body.email && req.body.email.trim() ? req.body.email.trim() : 'anonymous@example.com';
    const phone = req.body.phone ? req.body.phone.trim() : '';
    // Remove previous destructuring of name,email,phone
    // const { text, name, email, phone } = req.body;
    // Extract text from request body
    const text = req.body.text;
    // Basic checks (retain original logic for missing text/name/email)
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Review text is required' });
    }

    // ---- Simple mock analysis ----
    const textLower = text.toLowerCase();
    const positiveKeywords = ['amazing', 'great', 'love', 'excellent', 'good', 'best', 'smooth', 'exceeded', 'happy', 'fantastic', 'awesome', 'perfect', 'easy', 'helpful', 'fast', 'enjoy', 'satisfied'];
    const negativeKeywords = ['bad', 'terrible', 'upset', 'hate', 'delayed', 'slow', 'poor', 'ignored', 'frustrated', 'worst', 'broken', 'issue', 'problem', 'angry', 'delay', 'refund', 'late', 'rude', 'unsatisfied', 'missing', 'damaged'];
    const positiveCount = positiveKeywords.filter(w => textLower.includes(w)).length;
    const negativeCount = negativeKeywords.filter(w => textLower.includes(w)).length;
    let rating = 3;
    let emotion = 'Neutral';
    let sentiment = 'Neutral';
    let confidence = Math.floor(Math.random() * (90 - 75 + 1) + 75);

    if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'Neutral';
      emotion = 'Neutral';
      rating = 3;
      confidence = Math.floor(Math.random() * (85 - 65 + 1) + 65);
    } else if (positiveCount > negativeCount) {
      rating = Math.min(5, 3 + positiveCount);
      emotion = positiveCount > 2 ? 'Delighted' : 'Joy';
      sentiment = 'Positive';
    } else if (negativeCount > positiveCount) {
      rating = Math.max(1, 3 - negativeCount);
      emotion = negativeCount > 2 ? 'Frustrated' : 'Anger';
      sentiment = 'Critical';
    }

    if (positiveCount === 0 && negativeCount === 0) {
      sentiment = 'Neutral';
      emotion = 'Neutral';
      rating = 3;
      confidence = Math.floor(Math.random() * (80 - 65 + 1) + 65);
    }
    const snippet = text.length > 80 ? text.substring(0, 77) + '...' : text;
    const newFeedback = new Feedback({
      snippet,
      rating,
      emotion,
      confidence,
      sentiment,
      name,
      email,
      phone,
      createdAt: new Date()
    });
    newFeedback.save()
      .then(() => {
        setTimeout(() => res.status(201).json(newFeedback), 1500);
      })
      .catch(err => {
        console.error('POST /api/analyze save error:', err);
        res.status(500).json({ error: 'Failed to save feedback' });
      });
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
router.post('/csv', upload.single('file'), (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token !== ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Invalid admin token' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            // Map CSV rows to Feedback documents
            const feedbacks = results.map(row => ({
                snippet: row.snippet || row.Snippet || '',
                rating: Number(row.rating) || 0,
                emotion: row.emotion || '',
                confidence: Number(row.confidence) || 0,
                sentiment: row.sentiment || '',
                name: row.name || '',
                email: row.email || '',
                phone: row.phone || '',
                createdAt: new Date()
            }));
            Feedback.insertMany(feedbacks)
                .then(() => {
                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);
                    res.json({ inserted: feedbacks.length });
                })
                .catch(err => {
                    console.error('CSV upload error:', err);
                    res.status(500).json({ error: 'Failed to insert feedback' });
                });
        });
});

module.exports = router;
