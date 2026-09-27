# gr-booking-microservice

Microservicio de reservas de zonas comunes de Gestion Residencial (Modulo 3 del backlog, epica `GR-9`).
Administra las zonas comunes y sus reglas, calcula la disponibilidad por franjas y registra reservas sin
doble asignacion, incluso con varias replicas del servicio atendiendo a la vez.

## Stack

Node 22 + Express 5 + TypeScript, Knex sobre PostgreSQL, Zod para validar la entrada y RabbitMQ para eventos.
Sigue la misma estructura que `gr-wall-microservice` y `gr-api-gateway`: capas separadas y clases con metodos
estaticos.

## Base de datos

Usa el **mismo contenedor Postgres** del resto de la plataforma, pero su **propia base de datos**
(`gr_booking_db`). No hay llaves foraneas hacia otras bases: el apartamento y el residente que reserva son
referencias logicas, y los datos que se muestran (torre, numero, nombre) se copian en la reserva al crearla.

```bash
pnpm db:ensure       # crea gr_booking_db en el contenedor si no existe
pnpm migrate:latest  # aplica las migraciones
```

## Autenticacion

Igual que el gateway y el muro: el JWT viaja en la cookie `access_token` emitida por `gr-user-microservice` y se
verifica localmente con el mismo `JWT_SECRET`. Las mutaciones exigen ademas el encabezado `X-XSRF-TOKEN` con el
mismo valor de la cookie `XSRF-TOKEN` (doble envio, igual contrato que el user-microservice). Los errores tienen
la forma `{ "error": { "code", "message", "details?" } }`.

## Eventos (RabbitMQ)

Publica en el exchange `topic` durable `gr.booking.events`. Si RabbitMQ no esta disponible, la operacion de
negocio no falla: el evento se registra como advertencia en el log.

## Variables de entorno

| Variable | Descripcion | Valor por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | `4200` |
| `JWT_SECRET` | Secreto HMAC compartido con gr-user-microservice (obligatorio, minimo 32 caracteres) | — |
| `ACCESS_TOKEN_COOKIE_NAME` | Cookie del access token | `access_token` |
| `CORS_ALLOWED_ORIGINS` | Origenes permitidos, separados por coma | `http://localhost:3000` |
| `DB_HOST` / `DB_PORT` | Servidor PostgreSQL | `localhost` / `5432` |
| `DB_USERNAME` / `DB_PASSWORD` | Credenciales (obligatorias) | — |
| `DB_NAME` | Base de datos del servicio | `gr_booking_db` |
| `DB_POOL_MAX` | Conexiones maximas del pool | `10` |
| `RABBITMQ_URL` | Broker de eventos | `amqp://localhost:5672` |
| `BOOKING_EVENTS_EXCHANGE` | Exchange de eventos del servicio | `gr.booking.events` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Limite de solicitudes por IP | `60000` / `300` |

## Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm db:ensure
pnpm migrate:latest
pnpm dev
```

Documentacion OpenAPI en `/api-docs` fuera de produccion. Salud: `GET /health` (proceso vivo) y
`GET /health/ready` (base de datos disponible).

## Pruebas

```bash
pnpm test               # unitarias, sin Docker, en segundos
pnpm test:integration   # integracion contra PostgreSQL 16 real (Testcontainers), requiere Docker
```

Las pruebas de integracion viven en `test/integration/*.it.test.ts` y nunca sustituyen PostgreSQL por un motor
en memoria: las restricciones de exclusion, los CHECK y los bloqueos deben probarse contra el motor real.

## Scripts

- `pnpm dev` — desarrollo con recarga automatica
- `pnpm build` / `pnpm start` — build y ejecucion de produccion
- `pnpm lint` / `pnpm lint:fix` / `pnpm typecheck`
- `pnpm migrate:make|latest|rollback|list`
