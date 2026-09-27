import { Router } from "express";
import requireAuthentication from "../middlewares/require-authentication";
import requireCsrf from "../middlewares/require-csrf";

function apiRouter(): Router {
  const router = Router();

  router.use(requireAuthentication);
  router.use(requireCsrf);

  return router;
}

export default apiRouter;
