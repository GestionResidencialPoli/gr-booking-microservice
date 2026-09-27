import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import amqp from "amqplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import EstadoCarteraConsumer from "../../src/consumers/estado-cartera-consumer";
import knex from "../../src/db/knex";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { apartamentoIdDe } from "./support/user-service-stub";

const EXCHANGE = "gr.finance.events";
const ROUTING_KEY = "cartera.estado-actualizado";

let rabbit: StartedRabbitMQContainer;

async function publicar(url: string, evento: unknown): Promise<void> {
  const connection = await amqp.connect(url);
  const channel = await connection.createConfirmChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  channel.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(evento)), { persistent: true });
  await channel.waitForConfirms();
  await connection.close();
}

async function esperarSaldo(apartamentoId: number, saldo: number): Promise<void> {
  for (let intento = 0; intento < 50; intento += 1) {
    const fila = await knex("estado_cartera").where({ apartamento_id: apartamentoId }).first();
    if (fila && Number(fila.saldo_vencido) === saldo) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`El saldo del apartamento ${apartamentoId} no llego a ${saldo}`);
}

describe("replica del paz y salvo por eventos de RabbitMQ", () => {
  beforeAll(async () => {
    rabbit = await new RabbitMQContainer("rabbitmq:4-alpine").start();
    await EstadoCarteraConsumer.start({ url: rabbit.getAmqpUrl() });
  }, 120_000);

  afterAll(async () => {
    await EstadoCarteraConsumer.stop();
    await rabbit?.stop();
    await knex.destroy();
  });

  it("un evento financiero publicado en RabbitMQ bloquea la reserva de un apartamento en mora y otro lo desbloquea", async () => {
    const uid = 3011;
    const apartamentoId = apartamentoIdDe(uid);
    const zonaId = await crearZona({ aforo: 5 });

    await publicar(rabbit.getAmqpUrl(), { apartamentoId, saldoVencido: 120000, occurredAt: new Date().toISOString() });
    await esperarSaldo(apartamentoId, 120000);
    expect((await reservar(uid, zonaId, fechaEn(3), "08:00")).body.error.code).toBe("SIN_PAZ_Y_SALVO");

    await publicar(rabbit.getAmqpUrl(), { apartamentoId, saldoVencido: 0, occurredAt: new Date(Date.now() + 1000).toISOString() });
    await esperarSaldo(apartamentoId, 0);
    expect((await reservar(uid, zonaId, fechaEn(3), "08:00")).status).toBe(201);
  });

  it("ignora un evento mas antiguo que el ultimo aplicado, sin importar el orden de llegada", async () => {
    const apartamentoId = 3021;
    const reciente = new Date("2030-01-02T00:00:00Z").toISOString();
    const antiguo = new Date("2030-01-01T00:00:00Z").toISOString();

    expect(await EstadoCarteraConsumer.procesar(Buffer.from(JSON.stringify({ apartamentoId, saldoVencido: 0, occurredAt: reciente })))).toBe(
      "aplicado",
    );
    expect(await EstadoCarteraConsumer.procesar(Buffer.from(JSON.stringify({ apartamentoId, saldoVencido: 500, occurredAt: antiguo })))).toBe(
      "descartado",
    );

    const fila = await knex("estado_cartera").where({ apartamento_id: apartamentoId }).first();
    expect(Number(fila.saldo_vencido)).toBe(0);
  });

  it("descarta eventos invalidos sin afectar la replica", async () => {
    expect(await EstadoCarteraConsumer.procesar(Buffer.from("no es json"))).toBe("invalido");
    expect(await EstadoCarteraConsumer.procesar(Buffer.from(JSON.stringify({ apartamentoId: -1, saldoVencido: 1 })))).toBe("invalido");
  });
});
