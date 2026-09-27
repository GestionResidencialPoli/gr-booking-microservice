import type { NextFunction, Request, Response } from "express";
import Session from "../lib/session";
import CancelacionService from "../services/cancelacion-service";
import ReservaService from "../services/reserva-service";
import HttpStatus from "../types/enums/http-status";
import ReservaValidator from "../validators/reserva-validator";
import BaseController from "./base-controller";

class ReservaController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reserva = await ReservaService.reservar(Session.of(req).uid, ReservaValidator.crear(req.body));
      BaseController.handleSuccess(res, { statusCode: HttpStatus.Created, payload: reserva });
    } catch (error) {
      next(error);
    }
  }

  public static async cancelOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reserva = await CancelacionService.cancelarPropia(Session.of(req).uid, ReservaValidator.id(req.params.id));
      BaseController.handleSuccess(res, { payload: reserva });
    } catch (error) {
      next(error);
    }
  }
}

export default ReservaController;
