import type { Response } from "express";
import HttpStatus from "../types/enums/http-status";

interface SuccessResponse<T> {
  statusCode?: HttpStatus;
  payload?: T;
  message?: string;
}

class BaseController {
  public static handleSuccess<T>(res: Response, response: SuccessResponse<T>): void {
    const { statusCode = HttpStatus.Success, payload, message } = response;
    res.status(statusCode).json({ message, payload });
  }
}

export default BaseController;
