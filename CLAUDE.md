# gr-booking-microservice — contexto para agentes

Microservicio de reservas de zonas comunes de Gestion Residencial (Modulo 3 / epica `GR-9` en Jira). Node +
Express + TypeScript, con la misma estructura de `gr-wall-microservice` y `gr-api-gateway`.

## Arquitectura y patrones

```
index.ts                  # entrypoint: levanta el httpServer
src/
  server.ts               # clase Server: middlewares + rutas (sin logica de negocio)
  config/                 # lectura y validacion de variables de entorno
  db/knex.ts              # conexion Knex (Postgres, base gr_booking_db)
  lib/                    # utilidades sin estado: TokenService, Logger, DomainError, RabbitMqClient, EventsPublisher
  middlewares/            # authenticate, require-authentication, require-roles, require-csrf, correlation-id, handle-error
  validators/             # esquemas Zod (DTOs de entrada)
  repositories/           # consultas Knex, sin logica de negocio
  services/               # reglas de negocio y limites transaccionales
  controllers/            # delgados: parsean el request, llaman al service, formatean la respuesta
  routers/                # montan rutas + middlewares de autorizacion por rol
  types/                  # DTOs, enums, extension de Express (req.auth, req.correlationId)
migrations/               # migraciones Knex (unico dueno del esquema)
test/integration/         # pruebas contra PostgreSQL real con Testcontainers (*.it.test.ts)
```

- Clases con **solo metodos estaticos** (nunca instancias, nunca `this` de negocio).
- **Sin comentarios en el codigo** (clean code): la intencion se expresa con nombres, metodos pequenos y
  pruebas. La explicacion de las decisiones va en `README.md` y en `docs/decisiones/`.
- `pg` devuelve `bigint` como `string`: la conversion a `number` ocurre en `services/`.
- Errores de negocio con `DomainError(status, code, message, details?)`; nunca exponer mensajes internos.

## Autenticacion

JWT en la cookie `access_token` emitido por `gr-user-microservice`, verificado localmente con `JWT_SECRET`.
Roles reales: `ADMINISTRACION`, `VIGILANTE`, `RESIDENTE`. Toda ruta bajo `/api/v1` exige sesion y, en
mutaciones, el encabezado `X-XSRF-TOKEN` igual a la cookie `XSRF-TOKEN`.

## Base de datos

Mismo contenedor Postgres de la plataforma, base propia `gr_booking_db`. Sin llaves foraneas hacia otras bases.
Las invariantes de concurrencia (aforo, exclusion de rangos) se declaran en PostgreSQL, no solo en TypeScript.
Nunca editar una migracion ya compartida: crear una nueva.

## Flujo de trabajo

- Rama por work item: `feature/GR-000-descripcion-breve` desde `develop` (`hotfix/` solo desde `main`).
- Commits y titulo de PR: `tipo(scope): GR-000 descripcion breve`.
- Ramas de trabajo a `develop` con squash; entre ramas permanentes (`develop -> qa -> release/* -> main`) merge
  commit.
- Antes de abrir el PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`.
