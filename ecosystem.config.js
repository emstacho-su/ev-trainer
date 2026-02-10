/**
 * PM2 Ecosystem Configuration
 * Process manager configuration for production Node.js deployment
 *
 * Usage:
 *   pm2 start ecosystem.config.js     # Start application
 *   pm2 restart ecosystem.config.js   # Restart application
 *   pm2 stop ecosystem.config.js      # Stop application
 *   pm2 logs ev-trainer-api           # View logs
 *   pm2 monit                         # Monitor processes
 */

module.exports = {
  apps: [
    {
      name: "ev-trainer-api",
      script: "./dist/server/index.js",

      // Cluster mode for load balancing across CPU cores
      instances: 2,
      exec_mode: "cluster",

      // Environment variables
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },

      // Logging configuration
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Process management
      autorestart: true,
      max_memory_restart: "500M",
      watch: false,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Restart strategy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
