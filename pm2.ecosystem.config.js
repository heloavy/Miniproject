// pm2.ecosystem.config.js
module.exports = {
  apps: [{
    name: "news-sentiment-analyzer",
    script: "scripts/background-collector.js",
    interpreter: "node",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=2048"
    },
    error_file: "logs/error.log",
    out_file: "logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    max_restarts: 10,
    min_uptime: "5s",
    listen_timeout: 8000,
    kill_timeout: 5000
  }],
  
  deploy: {
    production: {
      user: 'node',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-repo-url.git',
      path: '/var/www/news-sentiment-analyzer',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
}