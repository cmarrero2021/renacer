module.exports = {
  apps: [
    {
      name: "auth-service",
      cwd: "/var/www/html/renacer/auth",
      script: "src/index.js",
      instances: 3,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "300M",
      env_development: {
        NODE_ENV: "development",
        PORT: 4110,
        UV_THREADPOOL_SIZE: 64
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4110,
        UV_THREADPOOL_SIZE: 128
      }
    },
    {
      name: "analytics-service",
      cwd: "/var/www/html/renacer/analytics",
      script: "src/index.js",
      instances: 2,
      max_memory_restart: "250M",
      exec_mode: "cluster",
      watch: false,
      env_development: {
        NODE_ENV: "development",
        PORT: 4120
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4120
      }
    }
  ]
};
