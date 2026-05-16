// backend/middleware/cors.js
// Allows your Netlify frontend to talk to this Express backend.
// Import and register this as the FIRST middleware in backend/server.js

const cors = require("cors");

const allowedOrigins = [
  "https://nalandalms.netlify.app", // Production — Netlify frontend
  "http://localhost:5173", // Local dev — Vite default port
  "http://localhost:4173", // Local dev — Vite preview port
  "http://localhost:3000", // Local dev — fallback
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin} is not an allowed origin`));
    }
  },
  credentials: true, // Required for Authorization header and cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);

// ─── Add these 2 lines to backend/server.js ──────────────────────────────────
//
//   const corsMiddleware = require('./middleware/cors');
//   app.use(corsMiddleware);   // ← MUST be the first app.use() call
//
// ─────────────────────────────────────────────────────────────────────────────
