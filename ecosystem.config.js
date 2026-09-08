
module.exports = {
  apps: [{
    name: "tg-bot",
    script: "./index.js",
    watch: true,
    ignore_watch: [
      "**/*", 
      "!index.js" 
    ],
    autorestart: true,
    max_memory_restart: "800M",
    node_args: "--max-old-space-size=700",
    env: {
      NODE_ENV: "production",
      RESTART_COUNT: "0"
    },
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    combine_logs: true,
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: "10s",
    wait_ready: true,
    listen_timeout: 30000
  }]
};
