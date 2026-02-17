/**
 * Overview: Express application for solver compute route.
 * Interacts with: Postflop solver route handler.
 * Importance: Hosts the CPU-intensive solver endpoint on Express (separate from Next.js).
 *
 * This Express server has a single purpose: serve the postflop solver route.
 * All other functionality (auth, sessions, stats) is handled by Next.js + Supabase.
 */

import express from "express";
import cors from "cors";

import postflopRoutes from "./routes/postflop.routes";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "10kb" }));

// Solver route -- the only Express endpoint
app.use("/api/postflop", postflopRoutes);

export default app;
