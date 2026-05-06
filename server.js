// src/server.js – Express entry point
"use strict";

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const apiRoutes = require("./routes/api");

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve the frontend stress-test UI from /frontend
app.use(express.static(path.join(__dirname, "../../frontend")));

// ── API routes ──────────────────────────────────────────────
app.use("/api", apiRoutes);

// Root → serve index.html
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

// ── 404 catch-all ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Library Booking API running at http://localhost:${PORT}`);
  console.log(`   Stress-test UI  → http://localhost:${PORT}`);
  console.log(`   List books      → GET  http://localhost:${PORT}/api/books`);
  console.log(`   Book an item    → POST http://localhost:${PORT}/api/book`);
  console.log(`   Reset demo data → DELETE http://localhost:${PORT}/api/reset\n`);
});
