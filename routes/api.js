const express = require('express');
const router = express.Router();

// Fallback in-memory database
let feedbackDB = [];
let idCounter = 1;

// GET /api/feedback - Retrieve all feedback
router.get('/feedback', async (req, res) => {
    try {
        const sorted = [...feedbackDB].sort((a, b) => b.createdAt - a.createdAt);
        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// GET /api/user/feedback - Retrieve recent feedback for the user feed
router.get('/user/feedback', async (req, res) => {
    try {
        // In a real app, this would filter by the logged-in user's ID
        const sorted = [...feedbackDB].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user feedback' });
    }
});

// POST /api/login - Mock Login System
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

// POST /api/analyze - Analyze review text and save
router.post('/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Review text is required' });
        }

        // --- Mock AI Intelligence Logic ---
        // In a real application, this would call an NLP service or LLM.
        
        const textLower = text.toLowerCase();
        let rating = 3;
        let emotion = 'Neutral';
        let sentiment = 'Neutral';
        let confidence = Math.floor(Math.random() * (99 - 80 + 1) + 80); // 80-99%

        // Simple keyword-based mock analysis
        const positiveKeywords = ['amazing', 'great', 'love', 'excellent', 'good', 'best', 'smooth', 'exceeded'];
        const negativeKeywords = ['bad', 'terrible', 'upset', 'hate', 'delayed', 'slow', 'poor', 'ignored', 'frustrated'];

        const positiveCount = positiveKeywords.filter(word => textLower.includes(word)).length;
        const negativeCount = negativeKeywords.filter(word => textLower.includes(word)).length;

        if (positiveCount > negativeCount) {
            rating = Math.min(5, 3 + positiveCount);
            emotion = 'Joy';
            sentiment = 'Positive';
            if (positiveCount > 2) emotion = 'Delighted';
        } else if (negativeCount > positiveCount) {
            rating = Math.max(1, 3 - negativeCount);
            emotion = 'Anger';
            sentiment = 'Critical';
            if (negativeCount > 2) emotion = 'Frustrated';
        } else if (positiveCount > 0 && negativeCount > 0) {
            rating = 3;
            emotion = 'Mixed';
            sentiment = 'Neutral';
            confidence = Math.floor(Math.random() * (79 - 60 + 1) + 60); // lower confidence for mixed
        }

        // Truncate snippet if too long
        const snippet = text.length > 80 ? text.substring(0, 77) + '...' : text;

        // Create new feedback document mock
        const newFeedback = {
            _id: idCounter++,
            snippet,
            rating,
            emotion,
            confidence,
            sentiment,
            createdAt: new Date()
        };

        // Save to DB
        feedbackDB.push(newFeedback);

        // Delay to simulate processing time
        setTimeout(() => {
            res.status(201).json(newFeedback);
        }, 1500);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Analysis failed due to server error' });
    }
});

module.exports = router;
