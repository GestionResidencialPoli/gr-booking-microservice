import { Router } from "express";
import ZonaController from "../controllers/zona-controller";
import requireRoles from "../middlewares/require-roles";

function zonaRouter(): Router {
  const router = Router();
  const requireAdmin = requireRoles("ADMINISTRACION");

  router.get("/", ZonaController.list);
  router.get("/:id", ZonaController.getById);
  router.post("/", requireAdmin, ZonaController.create);
  router.put("/:id", requireAdmin, ZonaController.update);
  router.patch("/:id/activacion", requireAdmin, ZonaController.changeActivation);

  return router;
}

export default zonaRouter;
