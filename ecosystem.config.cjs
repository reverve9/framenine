module.exports = {
  apps: [
    {
      name: 'frame-nine',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/app.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        MEDIA_ROOT: '/Volumes/NINE_MEDIA/WORX',
        ALLOWED_ORIGINS: '*',
        ADMIN_PASSWORD: 'framenine',
PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
      },
    },
  ],
};

