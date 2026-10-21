import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import Knex from "knex";
import type http from "node:http";
import path from "node:path";
import { iniciarUserServiceStub } from "./support/user-service-stub";

let container: StartedPostgreSqlContainer | undefined;
let userServiceStub: http.Server | undefined;

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

  userServiceStub = await iniciarUserServiceStub(process.env.INTERNAL_SERVICE_TOKEN ?? "test-internal-service-token-de-32-caracteres");

  return async () => {
    userServiceStub?.close();
    await container?.stop();
  };
}
