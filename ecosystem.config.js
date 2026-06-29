module.exports = {
  apps: [
    {
      name: "auth-service",
      cwd: "/var/www/html/renacer/auth",
      script: "src/index.js",
      watch: false,
      env_development: {
        NODE_ENV: "development",
        PORT: 4110
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4110
      }
    },
    {
      name: "analytics-service",
      cwd: "/var/www/html/renacer/analytics",
      script: "src/index.js",
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
