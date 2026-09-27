import config from "./src/config";
import server from "./src/server";
import Logger from "./src/lib/logger";
import EstadoCarteraConsumer from "./src/consumers/estado-cartera-consumer";

server.httpServer.listen(config.port, () => {
  Logger.info(`Booking microservice escuchando en el puerto ${config.port}`, { env: config.env });
});

void EstadoCarteraConsumer.start();
