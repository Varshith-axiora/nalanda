module.exports = {
  apps: [
    {
      name: "nalanda-backend",
      script: "./server.js",
      instances: "max", // Scale to all CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 5000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
