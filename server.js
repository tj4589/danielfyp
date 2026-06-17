require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes/api");
const Feedback = require("./models/Feedback");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from public directory
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api", apiRoutes);

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* -------------------  MongoDB connection ------------------- */

const mongoUri = process.env.MONGODB_URI || process.env.LOCAL_MONGODB_URI;
mongoose
  .connect(mongoUri) // newer driver defaults, no deprecated options needed
  .then(() => {
    console.log("✅ Connected to MongoDB successfully.");
    // Start server only after DB connection is ready
    const server = app.listen(PORT, () =>
      console.log(`🚀 Server is running on http://localhost:${PORT}`),
    );
    // Graceful handling of port conflict
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `❌ Port ${PORT} is already in use. Choose a different PORT or stop the other process.`,
        );
        process.exit(1);
      } else {
        console.error("❌ Server error:", err);
        process.exit(1);
      }
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });



