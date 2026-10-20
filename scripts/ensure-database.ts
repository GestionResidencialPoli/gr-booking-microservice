import "dotenv/config";
import { Client } from "pg";

async function main() {
  const targetDatabase = process.env.DB_NAME ?? "gr_booking_db";
  const client = new Client({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: "postgres",
  });

  await client.connect();

  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDatabase]);

  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${targetDatabase}"`);
    console.log(`Base de datos "${targetDatabase}" creada.`);
  } else {
    console.log(`Base de datos "${targetDatabase}" ya existe.`);
  }

  await client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
