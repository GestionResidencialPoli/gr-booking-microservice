import "dotenv/config";
import type { Knex } from "knex";

const config: Knex.Config = {
  client: "pg",
  connection: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "gr_booking_db",
  },
  migrations: {
    directory: "./migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

export default config;
