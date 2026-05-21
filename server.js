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

/* -------------------  MongoDB connection ------------------- */
// Prefer Atlas; fallback to local MongoDB if Atlas URI not provided
const primaryUri = process.env.MONGODB_URI;            // Atlas connection string
const fallbackUri = process.env.LOCAL_MONGODB_URI;    // Local MongoDB URI
const mongoUri = primaryUri || fallbackUri;

mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
    // Start server only after DB connection is ready
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
