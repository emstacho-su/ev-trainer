/**
 * Overview: Express application configuration with security middleware.
 * Interacts with: All route handlers and middleware chain.
 * Importance: Central application setup with security-first middleware ordering.
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/error.middleware";
import healthRoutes from "./routes/health.routes";

const app = express();

// Security middleware - must be first
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression for response bodies
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Routes
app.use("/health", healthRoutes);

// Error handler - must be last
app.use(errorHandler);

export default app;
