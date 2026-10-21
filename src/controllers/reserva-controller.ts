import type { NextFunction, Request, Response } from "express";
import Session from "../lib/session";
import CancelacionService from "../services/cancelacion-service";
import ReservaService from "../services/reserva-service";
import SupervisionService from "../services/supervision-service";
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

  public static async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      BaseController.handleSuccess(res, { payload: await ReservaService.misReservas(Session.of(req).uid) });
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      BaseController.handleSuccess(res, { payload: await SupervisionService.listar(ReservaValidator.filtro(req.query)) });
    } catch (error) {
      next(error);
    }
  }

  public static async cancelAsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { motivo } = ReservaValidator.cancelacionAdministrativa(req.body);
      const reserva = await SupervisionService.cancelar(Session.of(req).uid, ReservaValidator.id(req.params.id), motivo);
      BaseController.handleSuccess(res, { payload: reserva });
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
