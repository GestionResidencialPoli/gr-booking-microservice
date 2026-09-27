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

### Modelo de datos

| Tabla | Proposito |
|---|---|
| `zonas_comunes` | Zona reservable con horario, duracion de franja, aforo simultaneo y anticipaciones. Las franjas no se guardan una por una: se derivan de estos parametros. |
| `franjas_ocupacion` | Contador por franja reservada (`zona_id`, `inicio`) con su aforo y ocupacion. `CHECK (ocupados >= 0 AND ocupados <= aforo)`. |
| `reservas` | Reserva de un apartamento sobre una franja. Nunca se borra: cancelar es una transicion a `CANCELADA` con responsable, tipo y motivo. |
| `bloqueos_mantenimiento` | Rango de fechas en que una zona no admite reservas, con eliminacion logica. |

Invariantes declaradas en PostgreSQL (la ultima linea de defensa, valida para cualquier numero de replicas y para
escrituras por fuera de la aplicacion):

- `ex_reservas_exclusivas_sin_solapamiento`: restriccion de exclusion `EXCLUDE USING gist (zona_id WITH =,
  tstzrange(inicio, fin) WITH &&)` sobre reservas confirmadas de zonas con aforo 1 (requiere `btree_gist`).
- `ck_franjas_ocupados`: el contador de una franja nunca supera su aforo ni queda negativo.
- `fk_reservas_franja`: toda reserva pertenece a una franja contabilizada.
- Indices `idx_reservas_zona_rango` (consulta de solapamiento), `idx_reservas_apartamento_inicio` (reservas del
  apartamento) e `idx_bloqueos_vigentes_rango` (GiST parcial sobre bloqueos vigentes).

## Autenticacion

Igual que el gateway y el muro: el JWT viaja en la cookie `access_token` emitida por `gr-user-microservice` y se
verifica localmente con el mismo `JWT_SECRET`. Las mutaciones exigen ademas el encabezado `X-XSRF-TOKEN` con el
mismo valor de la cookie `XSRF-TOKEN` (doble envio, igual contrato que el user-microservice). Los errores tienen
la forma `{ "error": { "code", "message", "details?" } }`.

## Eventos (RabbitMQ)

Publica en el exchange `topic` durable `gr.booking.events`. Si RabbitMQ no esta disponible, la operacion de
negocio no falla: el evento se registra como advertencia en el log.

## Endpoints

Todas las rutas viven bajo `/api/v1`, exigen sesion y, en mutaciones, CSRF. Respuesta exitosa: `{ payload }`.

### Zonas comunes (HU-3.1)

| Metodo | Ruta | Rol | Notas |
|---|---|---|---|
| GET | `/zonas-comunes?incluirInactivas=` | cualquiera | Residentes solo ven zonas activas |
| GET | `/zonas-comunes/{id}` | cualquiera | 404 `ZONA_NO_ENCONTRADA` si no existe o esta inactiva para un residente |
| POST | `/zonas-comunes` | ADMINISTRACION | 422 `FRANJA_INCOMPLETA` si la duracion no cabe exacta: repetir con `confirmarFranjaIncompleta: true` |
| PUT | `/zonas-comunes/{id}` | ADMINISTRACION | 409 si cambia el horario con reservas futuras o si el aforo queda por debajo de lo ya reservado |
| PATCH | `/zonas-comunes/{id}/activacion` | ADMINISTRACION | `{ activa }`. Devuelve `{ zona, reservasFuturas }`: las reservas se conservan |
| GET | `/zonas-comunes/{id}/disponibilidad?desde=&hasta=` | cualquiera | Fechas `YYYY-MM-DD`, por defecto hoy y 7 dias. Maximo 60 dias (422 `RANGO_DEMASIADO_AMPLIO`) |

La disponibilidad devuelve `{ zonaId, desde, hasta, consultadaEn, dias: [{ fecha, franjas: [{ inicio, fin,
horaInicio, horaFin, estado, aforo, cuposRestantes, motivoBloqueo }] }] }`, con `estado` en `DISPONIBLE`,
`PARCIAL`, `COMPLETA`, `BLOQUEADA` o `FUERA_DE_ANTICIPACION`. Es **informativa**: la garantia la da la reserva
(ver `docs/arquitectura/reservas.md`).

Las horas de las zonas se interpretan en hora de Colombia (`TIMEZONE_OFFSET`) y las franjas se derivan de la
apertura, el cierre y la duracion; si la duracion no cabe un numero entero de veces, la ultima franja termina al
cierre.

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
| `TIMEZONE_OFFSET` | Desfase de la hora local de la copropiedad (Colombia no tiene horario de verano) | `-05:00` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Limite de solicitudes por IP | `60000` / `300` |

## Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm db:ensure
pnpm migrate:latest
pnpm seed:run     # zonas de ejemplo: Salon Social, Piscina, Cancha Multiple y Zona BBQ
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
