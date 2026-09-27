import amqp, { type Channel, type ChannelModel } from "amqplib";
import config from "../config";
import Logger from "./logger";

const RECONNECT_DELAY_MS = 3_000;
const EXCHANGE_TYPE = "topic";

class RabbitMqClient {
  private static connection: ChannelModel | null = null;

  private static channel: Channel | null = null;

  private static connecting: Promise<Channel> | null = null;

  public static async getChannel(): Promise<Channel> {
    if (this.channel) return this.channel;
    if (!this.connecting) this.connecting = this.connect();
    return this.connecting;
  }

  public static async getConnection(): Promise<ChannelModel> {
    await this.getChannel();
    return this.connection as ChannelModel;
  }

  public static async assertExchange(channel: Channel, exchange: string): Promise<void> {
    await channel.assertExchange(exchange, EXCHANGE_TYPE, { durable: true });
  }

  public static async close(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.channel = null;
    this.connecting = null;
    await connection?.close().catch(() => undefined);
  }

  private static async connect(): Promise<Channel> {
    try {
      const connection = await amqp.connect(config.rabbitmq.url);
      const channel = await connection.createChannel();
      await this.assertExchange(channel, config.rabbitmq.eventsExchange);

      connection.on("error", (error: Error) => {
        Logger.error(error, { source: "rabbitmq-connection" });
      });

      connection.on("close", () => {
        Logger.warn("Conexion a RabbitMQ cerrada, se reintenta en el proximo uso", { source: "rabbitmq-connection" });
        this.connection = null;
        this.channel = null;
        setTimeout(() => {
          this.connecting = null;
        }, RECONNECT_DELAY_MS);
      });

      this.connection = connection;
      this.channel = channel;
      return channel;
    } catch (error) {
      this.connecting = null;
      throw error;
    }
  }
}

export default RabbitMqClient;
