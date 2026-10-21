import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export interface Replica {
  url: string;
  detener: () => Promise<void>;
}

const RAIZ = path.resolve(__dirname, "../../..");
const TSX = path.join(RAIZ, "node_modules", ".bin", "tsx");

async function esperarDisponible(url: string, proceso: ChildProcess): Promise<void> {
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`La replica termino con codigo ${proceso.exitCode}`);
    try {
      const res = await fetch(`${url}/health/ready`);
      if (res.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`La replica ${url} no estuvo disponible a tiempo`);
}

export async function levantarReplica(puerto: number): Promise<Replica> {
  const proceso = spawn(TSX, ["index.ts"], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(puerto), NODE_ENV: "test", DB_POOL_MAX: "20" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  const url = `http://127.0.0.1:${puerto}`;
  await esperarDisponible(url, proceso);

  return {
    url,
    detener: () =>
      new Promise((resolve) => {
        if (proceso.exitCode !== null) return resolve();
        proceso.once("exit", () => resolve());
        proceso.kill("SIGTERM");
      }),
  };
}
