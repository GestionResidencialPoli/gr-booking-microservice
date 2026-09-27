import type { NextFunction, Request, Response } from "express";
import Session from "../lib/session";
import BloqueoService from "../services/bloqueo-service";
import HttpStatus from "../types/enums/http-status";
import BloqueoValidator from "../validators/bloqueo-validator";
import ZonaValidator from "../validators/zona-validator";
import BaseController from "./base-controller";

class BloqueoController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      BaseController.handleSuccess(res, { payload: await BloqueoService.listar(ZonaValidator.id(req.params.id)) });
    } catch (error) {
      next(error);
    }
  }

  public static async affectedReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reservas = await BloqueoService.reservasAfectadas(ZonaValidator.id(req.params.id), BloqueoValidator.rango(req.query));
      BaseController.handleSuccess(res, { payload: reservas });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creado = await BloqueoService.crear(ZonaValidator.id(req.params.id), BloqueoValidator.bloqueo(req.body), Session.of(req).uid);
      BaseController.handleSuccess(res, { statusCode: HttpStatus.Created, payload: creado });
    } catch (error) {
      next(error);
    }
  }

  public static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await BloqueoService.eliminar(ZonaValidator.id(req.params.id), ZonaValidator.id(req.params.bloqueoId), Session.of(req).uid);
      res.status(HttpStatus.NoContent).send();
    } catch (error) {
      next(error);
    }
  }
}

export default BloqueoController;
