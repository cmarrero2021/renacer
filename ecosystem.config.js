module.exports = {
  apps: [
    {
      name: "auth-service",
      cwd: "./auth",
      script: "src/index.js",
      watch: false,
      env_development: {
        NODE_ENV: "development",
        PORT: 4100
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4100
      }
    }
  ]
};
