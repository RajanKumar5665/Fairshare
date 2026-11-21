// PM2 process file for the FairShare API on EC2.
// The app lives in /var/www/fairshare/current (a symlink to the latest release);
// secrets come from /var/www/fairshare/shared/backend.env (linked as backend/.env).
module.exports = {
  apps: [
    {
      name: 'fairshare-api',
      cwd: '/var/www/fairshare/current/backend',
      script: 'server.js',
      instances: 1, // socket.io + in-memory rate limits: keep a single process
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '400M',
      kill_timeout: 12000, // matches the graceful shutdown in server.js
      time: true,
      out_file: '/var/www/fairshare/logs/api-out.log',
      error_file: '/var/www/fairshare/logs/api-error.log',
    },
  ],
};
