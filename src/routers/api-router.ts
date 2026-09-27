import { Router } from "express";
import requireAuthentication from "../middlewares/require-authentication";
import requireCsrf from "../middlewares/require-csrf";
import reservaRouter from "./reserva-router";
import zonaRouter from "./zona-router";

function apiRouter(): Router {
  const router = Router();

  router.use(requireAuthentication);
  router.use(requireCsrf);

  router.use("/zonas-comunes", zonaRouter());
  router.use("/reservas", reservaRouter());

  return router;
}

export default apiRouter;
