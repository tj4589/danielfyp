const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Fallback JSON database file path
const dbPath = path.join(__dirname, '../database.json');

// Helper function to read the database
function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

// Helper function to save to the database
function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Initialize ID counter based on existing data
let idCounter = 1;
const initialDb = getDB();
if (initialDb.length > 0) {
    idCounter = Math.max(...initialDb.map(item => item._id || 0)) + 1;
}

// GET /api/feedback - Retrieve all feedback
router.get('/feedback', async (req, res) => {
    try {
        const feedbackDB = getDB();
        const sorted = [...feedbackDB].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// GET /api/user/feedback - Retrieve recent feedback for the user feed
router.get('/user/feedback', async (req, res) => {
    try {
        const feedbackDB = getDB();
        const sorted = [...feedbackDB].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
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

        const textLower = text.toLowerCase();
        let rating = 3;
        let emotion = 'Neutral';
        let sentiment = 'Neutral';
        let confidence = Math.floor(Math.random() * (99 - 80 + 1) + 80); // 80-99%

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

        const snippet = text.length > 80 ? text.substring(0, 77) + '...' : text;

        const newFeedback = {
            _id: idCounter++,
            snippet,
            rating,
            emotion,
            confidence,
            sentiment,
            createdAt: new Date()
        };

        // Save to DB file
        const feedbackDB = getDB();
        feedbackDB.push(newFeedback);
        saveDB(feedbackDB);

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
