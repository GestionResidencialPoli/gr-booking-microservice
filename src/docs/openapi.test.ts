import type { Router } from "express";
import { describe, expect, it } from "vitest";
import reservaRouter from "../routers/reserva-router";
import zonaRouter from "../routers/zona-router";
import openapi from "./openapi";

interface Capa {
  route?: { path: string; methods: Record<string, boolean> };
}

function comoRutaOpenapi(prefijo: string, ruta: string): string {
  return `${prefijo}${ruta === "/" ? "" : ruta}`.replace(/:([A-Za-z]+)/g, "{$1}");
}

function rutasDe(router: Router, prefijo: string): string[] {
  return (router.stack as unknown as Capa[]).flatMap((capa) =>
    capa.route
      ? Object.keys(capa.route.methods).map((metodo) => `${metodo} ${comoRutaOpenapi(prefijo, capa.route!.path)}`)
      : [],
  );
}

function rutasDocumentadas(): string[] {
  return Object.entries(openapi.paths as Record<string, Record<string, unknown>>).flatMap(([path, metodos]) =>
    Object.keys(metodos).map((metodo) => `${metodo} ${path}`),
  );
}

describe("documentacion OpenAPI de reservas", () => {
  it("documenta cada endpoint real con su metodo y no documenta endpoints inexistentes", () => {
    const reales = [...rutasDe(zonaRouter(), "/zonas-comunes"), ...rutasDe(reservaRouter(), "/reservas")];

    expect(reales).toHaveLength(15);
    expect(new Set(rutasDocumentadas())).toEqual(new Set(reales));
  });
});
