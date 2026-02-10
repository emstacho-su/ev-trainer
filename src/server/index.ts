/**
 * Overview: Express server entry point.
 * Interacts with: Express app and route mounting.
 * Importance: Starts HTTP server and handles uncaught errors.
 */

import app from "./app";
import sessionRoutes from "./routes/session.routes";

// Mount session routes
app.use("/api/session", sessionRoutes);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Session API: http://localhost:${PORT}/api/session`);
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
