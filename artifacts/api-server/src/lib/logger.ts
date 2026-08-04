import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    // HTTP headers
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-step-up-token']",
    "res.headers['set-cookie']",
    // Request body fields that may contain credentials
    "req.body.password",
    "req.body.newPassword",
    "req.body.currentPassword",
    "req.body.apiKey",
    "req.body.secret",
    "req.body.token",
    "req.body.webhookSecret",
    "req.body.config.password",
    "req.body.config.apiKey",
    "req.body.config.secret",
    "req.body.config.token",
    // Nested paths in logged objects
    "*.password",
    "*.passwordHash",
    "*.hashed_secret",
    "*.refresh_token",
    "*.accessToken",
    "*.refreshToken",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
