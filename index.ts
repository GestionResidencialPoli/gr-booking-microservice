import config from "./src/config";
import server from "./src/server";
import Logger from "./src/lib/logger";

server.httpServer.listen(config.port, () => {
  Logger.info(`Booking microservice escuchando en el puerto ${config.port}`, { env: config.env });
});
