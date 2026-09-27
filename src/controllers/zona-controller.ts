import type { NextFunction, Request, Response } from "express";
import Session from "../lib/session";
import DisponibilidadService from "../services/disponibilidad-service";
import ZonaService from "../services/zona-service";
import HttpStatus from "../types/enums/http-status";
import ZonaValidator from "../validators/zona-validator";
import BaseController from "./base-controller";

class ZonaController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { incluirInactivas } = ZonaValidator.listarQuery(req.query);
      const zonas = await ZonaService.listar(incluirInactivas && Session.esAdministrador(req));
      BaseController.handleSuccess(res, { payload: zonas });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zona = await ZonaService.obtener(ZonaValidator.id(req.params.id), Session.esAdministrador(req));
      BaseController.handleSuccess(res, { payload: zona });
    } catch (error) {
      next(error);
    }
  }

  public static async availability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { desde, hasta } = ZonaValidator.disponibilidadQuery(req.query);
      const disponibilidad = await DisponibilidadService.consultar({
        zonaId: ZonaValidator.id(req.params.id),
        desde,
        hasta,
        puedeVerInactivas: Session.esAdministrador(req),
      });
      BaseController.handleSuccess(res, { payload: disponibilidad });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zona = await ZonaService.crear(ZonaValidator.zona(req.body));
      BaseController.handleSuccess(res, { statusCode: HttpStatus.Created, payload: zona });
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zona = await ZonaService.actualizar(ZonaValidator.id(req.params.id), ZonaValidator.zona(req.body));
      BaseController.handleSuccess(res, { payload: zona });
    } catch (error) {
      next(error);
    }
  }

  public static async changeActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activa } = ZonaValidator.activacion(req.body);
      const resultado = await ZonaService.cambiarActivacion(ZonaValidator.id(req.params.id), activa);
      BaseController.handleSuccess(res, { payload: resultado });
    } catch (error) {
      next(error);
    }
  }
}

export default ZonaController;
