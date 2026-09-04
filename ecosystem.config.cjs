module.exports = {
  apps: [
    {
      name: 'fal-backend',
      script: 'dist/main.js',
      cwd: 'C:\\Users\\Arnon Locks\\Desktop\\Docker - Metodo FAL\\fal-digital-diagnostics\\backend',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
    },
    {
      name: 'fal-frontend',
      script: 'node_modules/vite/bin/vite.js',
      cwd: 'C:\\Users\\Arnon Locks\\Desktop\\Docker - Metodo FAL\\fal-digital-diagnostics',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
