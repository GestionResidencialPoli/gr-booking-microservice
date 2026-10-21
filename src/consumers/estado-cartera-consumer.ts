import amqp, { type ChannelModel, type ConsumeMessage } from "amqplib";
import { z } from "zod";
import config from "../config";
import Logger from "../lib/logger";
import EstadoCarteraRepository from "../repositories/estado-cartera-repository";

const ROUTING_KEY = "cartera.estado-actualizado";
const REINTENTO_MS = 5_000;

const eventoSchema = z.object({
  apartamentoId: z.number().int().positive(),
  saldoVencido: z.number().min(0),
  occurredAt: z.iso.datetime({ offset: true }),
});

interface OpcionesConsumidor {
  url?: string;
  exchange?: string;
  queue?: string;
}

class EstadoCarteraConsumer {
  private static connection: ChannelModel | null = null;

  private static detenido = false;

  public static async procesar(contenido: Buffer): Promise<"aplicado" | "descartado" | "invalido"> {
    let json: unknown;
    try {
      json = JSON.parse(contenido.toString());
    } catch {
      return "invalido";
    }

    const parsed = eventoSchema.safeParse(json);
    if (!parsed.success) return "invalido";

    const aplicado = await EstadoCarteraRepository.aplicarSiEsMasReciente({
      apartamentoId: parsed.data.apartamentoId,
      saldoVencido: parsed.data.saldoVencido,
      actualizadoEn: new Date(parsed.data.occurredAt),
    });
    return aplicado ? "aplicado" : "descartado";
  }

  public static async start(opciones: OpcionesConsumidor = {}): Promise<void> {
    EstadoCarteraConsumer.detenido = false;
    const url = opciones.url ?? config.rabbitmq.url;
    const exchange = opciones.exchange ?? config.rabbitmq.financeExchange;
    const queue = opciones.queue ?? config.rabbitmq.carteraQueue;

    try {
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertExchange(exchange, "topic", { durable: true });
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, exchange, ROUTING_KEY);
      await channel.prefetch(10);

      await channel.consume(queue, (message) => {
        if (message) void EstadoCarteraConsumer.manejar(channel, message);
      });

      connection.on("close", () => {
        EstadoCarteraConsumer.connection = null;
        if (!EstadoCarteraConsumer.detenido) EstadoCarteraConsumer.reintentar(opciones);
      });
      connection.on("error", (error: Error) => Logger.error(error, { source: "estado-cartera-consumer" }));

      EstadoCarteraConsumer.connection = connection;
      Logger.info("Consumiendo el estado de cartera replicado", { exchange, queue });
    } catch (error) {
      Logger.warn("RabbitMQ no disponible para replicar el estado de cartera, se reintenta", {
        error: (error as Error).message,
      });
      EstadoCarteraConsumer.reintentar(opciones);
    }
  }

  public static async stop(): Promise<void> {
    EstadoCarteraConsumer.detenido = true;
    await EstadoCarteraConsumer.connection?.close().catch(() => undefined);
    EstadoCarteraConsumer.connection = null;
  }

  private static reintentar(opciones: OpcionesConsumidor): void {
    setTimeout(() => {
      if (!EstadoCarteraConsumer.detenido) void EstadoCarteraConsumer.start(opciones);
    }, REINTENTO_MS).unref();
  }

  private static async manejar(
    channel: Awaited<ReturnType<ChannelModel["createChannel"]>>,
    message: ConsumeMessage,
  ): Promise<void> {
    try {
      const resultado = await EstadoCarteraConsumer.procesar(message.content);
      if (resultado === "invalido") {
        Logger.warn("Evento de cartera invalido descartado", { routingKey: message.fields.routingKey });
        channel.nack(message, false, false);
        return;
      }
      channel.ack(message);
    } catch (error) {
      Logger.error(error as Error, { source: "estado-cartera-consumer" });
      channel.nack(message, false, !message.fields.redelivered);
    }
  }
}

export default EstadoCarteraConsumer;
