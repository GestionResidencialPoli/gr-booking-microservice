import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

function list(name: string, fallback: string): string[] {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const jwtSecret = required("JWT_SECRET");

if (jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 caracteres: debe coincidir con el mismo secreto HMAC-SHA256 del user-microservice",
  );
}

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4200),
  jwtSecret,
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME ?? "access_token",
  corsAllowedOrigins: list("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: required("DB_USERNAME"),
    password: required("DB_PASSWORD"),
    database: process.env.DB_NAME ?? "gr_booking_db",
    poolMax: Number(process.env.DB_POOL_MAX ?? 10),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
    eventsExchange: process.env.BOOKING_EVENTS_EXCHANGE ?? "gr.booking.events",
  },
  zonaHoraria: {
    offset: process.env.TIMEZONE_OFFSET ?? "-05:00",
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
} as const;

export default config;
