module.exports = {
    apps: [
      {
        name: "cronjob-seguros-colte",
        script: "dist/index.js",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "500M",
        env: {
            NODE_ENV: "production",
            PORT: 3034,
            TEST_MODE: "false",
            CRON_SCHEDULE: "*/15 * * * *"
        },
      },
    ],
};