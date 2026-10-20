import { Router } from "express";
import ReservaController from "../controllers/reserva-controller";
import requireRoles from "../middlewares/require-roles";

function reservaRouter(): Router {
  const router = Router();
  const requireResidente = requireRoles("RESIDENTE");
  const requireAdmin = requireRoles("ADMINISTRACION");

  router.get("/", requireAdmin, ReservaController.list);
  router.get("/mias", requireResidente, ReservaController.listMine);
  router.post("/", requireResidente, ReservaController.create);
  router.patch("/:id/cancelacion", requireResidente, ReservaController.cancelOwn);
  router.patch("/:id/cancelacion-administrativa", requireAdmin, ReservaController.cancelAsAdmin);

  return router;
}

export default reservaRouter;
