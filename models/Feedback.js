const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    snippet: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    emotion: {
        type: String,
        required: true,
        enum: ['Joy', 'Anger', 'Mixed', 'Neutral', 'Frustrated', 'Delighted', 'Satisfied', 'Sadness']
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    sentiment: {
        type: String,
        required: true,
        enum: ['Positive', 'Neutral', 'Critical']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
