import { afterAll, beforeAll } from "vitest";
import server from "../../src/server";

beforeAll(async () => {
  if (!server.httpServer.listening) {
    await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  }
});

afterAll(async () => {
  server.httpServer.closeAllConnections();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
});
