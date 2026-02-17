/**
 * Overview: Express server entry point for solver compute.
 * Interacts with: Express app hosting postflop solver route.
 * Importance: Starts HTTP server for CPU-intensive solver requests.
 *
 * The server's only job is hosting the postflop solver compute route.
 * All other backend functionality is handled by Next.js API routes + Supabase.
 */

import app from "./app";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Solver server running on port ${PORT}`);
  console.log(`Solver endpoint: http://localhost:${PORT}/api/postflop/solve`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
