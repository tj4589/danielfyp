const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback'); // Mongoose model

// GET /api/feedback - Retrieve all feedback (newest first)
router.get('/feedback', async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedback);
  } catch (err) {
    console.error('GET /api/feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/user/feedback - Retrieve recent feedback for the user feed (latest 5)
router.get('/user/feedback', async (req, res) => {
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

// POST /api/login - Mock login system
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, role: 'admin', redirect: '/dashboard.html' });
  } else if (username === 'user' && password === 'user123') {
    return res.json({ success: true, role: 'user', redirect: '/feed.html' });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }
});

router.post('/analyze',
  [
    body('text').isString().withMessage('Review text must be a string'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').optional().isString().withMessage('Phone must be a string')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { text, name, email, phone } = req.body;
    // Basic checks (retain original logic for missing text/name/email)
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Review text is required' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    // ---- Simple mock analysis ----
    const textLower = text.toLowerCase();
    const positiveKeywords = ['amazing', 'great', 'love', 'excellent', 'good', 'best', 'smooth', 'exceeded'];
    const negativeKeywords = ['bad', 'terrible', 'upset', 'hate', 'delayed', 'slow', 'poor', 'ignored', 'frustrated'];
    const positiveCount = positiveKeywords.filter(w => textLower.includes(w)).length;
    const negativeCount = negativeKeywords.filter(w => textLower.includes(w)).length;
    let rating = 3;
    let emotion = 'Neutral';
    let sentiment = 'Neutral';
    let confidence = Math.floor(Math.random() * (99 - 80 + 1) + 80);
    if (positiveCount > negativeCount) {
      rating = Math.min(5, 3 + positiveCount);
      emotion = positiveCount > 2 ? 'Delighted' : 'Joy';
      sentiment = 'Positive';
    } else if (negativeCount > positiveCount) {
      rating = Math.max(1, 3 - negativeCount);
      emotion = negativeCount > 2 ? 'Frustrated' : 'Anger';
      sentiment = 'Critical';
    } else if (positiveCount > 0 && negativeCount > 0) {
      rating = 3;
      emotion = 'Mixed';
      sentiment = 'Neutral';
      confidence = Math.floor(Math.random() * (79 - 60 + 1) + 60);
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



// GET single feedback by ID
router.get('/feedback/:id',
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

module.exports = router;
