import { Router } from "express";
import ReservaController from "../controllers/reserva-controller";
import requireRoles from "../middlewares/require-roles";

function reservaRouter(): Router {
  const router = Router();
  const requireResidente = requireRoles("RESIDENTE");

  router.post("/", requireResidente, ReservaController.create);

  return router;
}

export default reservaRouter;
