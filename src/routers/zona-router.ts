import { Router } from "express";
import BloqueoController from "../controllers/bloqueo-controller";
import ZonaController from "../controllers/zona-controller";
import requireRoles from "../middlewares/require-roles";

function zonaRouter(): Router {
  const router = Router();
  const requireAdmin = requireRoles("ADMINISTRACION");

  router.get("/", ZonaController.list);
  router.get("/:id", ZonaController.getById);
  router.get("/:id/disponibilidad", ZonaController.availability);
  router.post("/", requireAdmin, ZonaController.create);
  router.put("/:id", requireAdmin, ZonaController.update);
  router.patch("/:id/activacion", requireAdmin, ZonaController.changeActivation);
  router.get("/:id/bloqueos", requireAdmin, BloqueoController.list);
  router.get("/:id/bloqueos/reservas-afectadas", requireAdmin, BloqueoController.affectedReservations);
  router.post("/:id/bloqueos", requireAdmin, BloqueoController.create);
  router.delete("/:id/bloqueos/:bloqueoId", requireAdmin, BloqueoController.remove);

  return router;
}

export default zonaRouter;
