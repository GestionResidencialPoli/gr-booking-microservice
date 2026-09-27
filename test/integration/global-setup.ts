import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import Knex from "knex";
import path from "node:path";

let container: StartedPostgreSqlContainer | undefined;

export default async function setup(): Promise<() => Promise<void>> {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("gr_booking_db")
    .withUsername("test")
    .withPassword("test")
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_USERNAME = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.DB_NAME = container.getDatabase();

  const knex = Knex({
    client: "pg",
    connection: container.getConnectionUri(),
    migrations: { directory: path.resolve(__dirname, "../../migrations"), extension: "ts" },
  });
  await knex.migrate.latest();
  await knex.destroy();

  return async () => {
    await container?.stop();
  };
}
