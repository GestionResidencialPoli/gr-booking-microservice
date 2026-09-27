import config from "../config";
import Logger from "./logger";
import RabbitMqClient from "./rabbitmq-client";
import RequestContext from "./request-context";

class EventsPublisher {
  public static async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    const message = {
      type: routingKey,
      occurredAt: new Date().toISOString(),
      correlationId: RequestContext.correlationId(),
      ...payload,
    };

    try {
      const channel = await RabbitMqClient.getChannel();
      channel.publish(config.rabbitmq.eventsExchange, routingKey, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: "application/json",
      });
    } catch (error) {
      Logger.warn("No se pudo publicar el evento", { error: (error as Error).message, routingKey });
    }
  }
}

export default EventsPublisher;
