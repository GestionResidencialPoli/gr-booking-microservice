const errorResponses = {
  "400": { description: "SOLICITUD_INVALIDA: el cuerpo o los parametros no son validos" },
  "401": { description: "NO_AUTENTICADO: falta la cookie access_token o es invalida" },
  "403": { description: "ACCESO_DENEGADO por rol, o CSRF_INVALIDO en una mutacion" },
};

const zonaComun = {
  type: "object",
  properties: {
    id: { type: "integer" },
    nombre: { type: "string" },
    descripcion: { type: "string", nullable: true },
    horaApertura: { type: "string", example: "08:00" },
    horaCierre: { type: "string", example: "22:00" },
    duracionFranjaMinutos: { type: "integer", example: 240 },
    aforo: { type: "integer", example: 1 },
    anticipacionMinimaHoras: { type: "integer" },
    anticipacionMaximaDias: { type: "integer" },
    anticipacionCancelacionHoras: { type: "integer" },
    activa: { type: "boolean" },
    franjasPorDia: { type: "integer" },
    ultimaFranjaIncompleta: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const zonaComunInput = {
  type: "object",
  required: ["nombre", "horaApertura", "horaCierre", "duracionFranjaMinutos"],
  properties: {
    nombre: { type: "string", maxLength: 100 },
    descripcion: { type: "string", maxLength: 500, nullable: true },
    horaApertura: { type: "string", example: "08:00" },
    horaCierre: { type: "string", example: "22:00" },
    duracionFranjaMinutos: { type: "integer", minimum: 15, maximum: 1440 },
    aforo: { type: "integer", minimum: 1, default: 1 },
    anticipacionMinimaHoras: { type: "integer", minimum: 0, default: 0 },
    anticipacionMaximaDias: { type: "integer", minimum: 1, default: 30 },
    anticipacionCancelacionHoras: { type: "integer", minimum: 0, default: 0 },
    confirmarFranjaIncompleta: { type: "boolean", default: false },
  },
};

const idParam = { name: "id", in: "path", required: true, schema: { type: "integer" } };

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "GR Booking Microservice",
    version: "1.0.0",
    description:
      "API de reservas de zonas comunes. Autenticacion por la cookie access_token emitida por gr-user-microservice; las mutaciones exigen el encabezado X-XSRF-TOKEN igual a la cookie XSRF-TOKEN. Las respuestas exitosas vienen envueltas en { payload } y los errores en { error: { code, message, details? } }.",
  },
  servers: [{ url: "/api/v1" }],
  components: { schemas: { ZonaComun: zonaComun, ZonaComunInput: zonaComunInput } },
  paths: {
    "/zonas-comunes": {
      get: {
        summary: "Listar zonas comunes (activas; administracion puede pedir incluirInactivas=true)",
        parameters: [{ name: "incluirInactivas", in: "query", schema: { type: "boolean", default: false } }],
        responses: { "200": { description: "Zonas" }, ...errorResponses },
      },
      post: {
        summary: "Crear una zona comun (solo ADMINISTRACION)",
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/ZonaComunInput" } } } },
        responses: {
          "201": { description: "Zona creada" },
          "409": { description: "ZONA_DUPLICADA" },
          "422": { description: "HORARIO_INVALIDO, DURACION_FRANJA_INVALIDA o FRANJA_INCOMPLETA (repetir con confirmarFranjaIncompleta=true)" },
          ...errorResponses,
        },
      },
    },
    "/zonas-comunes/{id}": {
      get: {
        summary: "Detalle de una zona (las inactivas solo para ADMINISTRACION)",
        parameters: [idParam],
        responses: { "200": { description: "Zona" }, "404": { description: "ZONA_NO_ENCONTRADA" }, ...errorResponses },
      },
      put: {
        summary: "Editar una zona (solo ADMINISTRACION)",
        parameters: [idParam],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/ZonaComunInput" } } } },
        responses: {
          "200": { description: "Zona actualizada" },
          "409": { description: "ZONA_DUPLICADA, ZONA_CON_RESERVAS_FUTURAS o AFORO_MENOR_QUE_OCUPACION" },
          "422": { description: "HORARIO_INVALIDO, DURACION_FRANJA_INVALIDA o FRANJA_INCOMPLETA" },
          ...errorResponses,
        },
      },
    },
    "/zonas-comunes/{id}/disponibilidad": {
      get: {
        summary: "Disponibilidad por franjas de una zona en un rango de fechas (informativa, no reserva nada)",
        parameters: [
          idParam,
          { name: "desde", in: "query", schema: { type: "string", format: "date" } },
          { name: "hasta", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": { description: "{ zonaId, desde, hasta, consultadaEn, dias: [{ fecha, franjas }] }" },
          "404": { description: "ZONA_NO_ENCONTRADA" },
          "422": { description: "RANGO_INVALIDO o RANGO_DEMASIADO_AMPLIO (mas de 60 dias)" },
          ...errorResponses,
        },
      },
    },
    "/reservas": {
      post: {
        summary: "Reservar una franja de una zona comun (solo RESIDENTE); la reserva pertenece al apartamento",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["zonaId", "fecha", "horaInicio"],
                properties: {
                  zonaId: { type: "integer" },
                  fecha: { type: "string", format: "date", example: "2026-10-10" },
                  horaInicio: { type: "string", example: "08:00" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Reserva confirmada" },
          "404": { description: "ZONA_NO_ENCONTRADA" },
          "409": { description: "FRANJA_SIN_CUPO: la franja acaba de ser tomada; refrescar la disponibilidad" },
          "422": {
            description:
              "Regla incumplida: ZONA_INACTIVA, FRANJA_BLOQUEADA, FRANJA_PASADA, ANTICIPACION_MINIMA, ANTICIPACION_MAXIMA, LIMITE_RESERVAS_ACTIVAS, SIN_PAZ_Y_SALVO, FRANJA_INVALIDA, SIN_APARTAMENTO, APARTAMENTO_INACTIVO",
          },
          "502": { description: "DIRECTORIO_NO_DISPONIBLE: gr-user-microservice no respondio" },
          ...errorResponses,
        },
      },
    },
    "/zonas-comunes/{id}/activacion": {
      patch: {
        summary: "Activar o desactivar una zona (solo ADMINISTRACION); devuelve las reservas futuras que se conservan",
        parameters: [idParam],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { activa: { type: "boolean" } } } } },
        },
        responses: { "200": { description: "{ zona, reservasFuturas }" }, "404": { description: "ZONA_NO_ENCONTRADA" }, ...errorResponses },
      },
    },
  },
};

export default openapi;
