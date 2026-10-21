import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import http from "http";
import config from "./config";
import authenticate from "./middlewares/authenticate";
import correlationId from "./middlewares/correlation-id";
import handleError from "./middlewares/handle-error";
import apiRouter from "./routers/api-router";
import healthRouter from "./routers/health-router";
import openapi from "./docs/openapi";
import HttpStatus from "./types/enums/http-status";

const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});

class Server {
  public app: Application;

  public httpServer: http.Server;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.setup();
  }

  private setup(): void {
    this.useMiddleware();
    this.mountRoutes();
    this.app.use((_req, res) => {
      res.status(HttpStatus.NotFound).json({ error: { code: "NO_ENCONTRADO", message: "Recurso no encontrado." } });
    });
    this.app.use(handleError);
  }

  private useMiddleware(): void {
    this.app.set("trust proxy", 1);
    this.app.use(helmet());
    this.app.use(cors({ origin: config.corsAllowedOrigins, credentials: true }));
    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(correlationId);
    if (config.env !== "test") {
      this.app.use(morgan(config.env === "production" ? "combined" : "dev"));
    }
    this.app.use(globalRateLimiter);
    this.app.use(authenticate);
  }

  private mountRoutes(): void {
    this.app.use("/health", healthRouter());

    if (config.env !== "production") {
      this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
    }

    this.app.use("/api/v1", apiRouter());
  }
}

export default new Server();
