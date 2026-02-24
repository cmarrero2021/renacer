module.exports = {
  apps: [
    {
      name: "directorio-auth",
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
    },
    {
      name: "directorio-backend",
      cwd: "./backend",
      script: "index.js",
      watch: false,
      env_development: {
        NODE_ENV: "development",
        PORT: 4000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
