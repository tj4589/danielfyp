require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const Feedback = require('./models/Feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database Connection
// Since MongoDB is not installed locally, we are using an in-memory array in api.js for this demo.
console.log('Skipping MongoDB connection. Using in-memory fallback database.');

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
