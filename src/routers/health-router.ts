import { Router } from "express";
import knex from "../db/knex";
import Logger from "../lib/logger";
import HttpStatus from "../types/enums/http-status";

function healthRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/ready", async (_req, res) => {
    try {
      await knex.raw("SELECT 1");
      res.json({ status: "ok" });
    } catch (error) {
      Logger.warn("La base de datos no responde al chequeo de disponibilidad", { error: (error as Error).message });
      res.status(HttpStatus.InternalServerError).json({ status: "unavailable" });
    }
  });

  return router;
}

export default healthRouter;
