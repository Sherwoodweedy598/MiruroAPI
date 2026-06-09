const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : null;

app.use(
  cors({
    origin: function (origin, callback) {
      if (!allowedOrigins || allowedOrigins.includes("*") || !origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Security headers
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: 16,
    providers: ["kiwi", "pewe", "bee", "bonk", "bun", "ally", "nun", "twin", "cog", "moo", "hop", "telli"],
  });
});

// Swagger UI page
app.get("/docs", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MiruroAPI — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body{margin:0;background:#0b1622;}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      defaultModelsExpandDepth: -1,
      docExpansion: "list",
    });
  </script>
</body>
</html>`);
});

// Routes
const apiRoutes = require("./src/routes/apiRoutes");
app.use("/api", apiRoutes);

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`MiruroAPI running on port ${PORT}`);
});

module.exports = app;
