import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import requireRoles from "./require-roles";

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("requireRoles", () => {
  it("responde 403 cuando el usuario no tiene ninguno de los roles permitidos", () => {
    const middleware = requireRoles("ADMINISTRACION");
    const req = { auth: { sub: "1", uid: 1, roles: ["RESIDENTE"] } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("responde 403 cuando no hay auth en absoluto", () => {
    const middleware = requireRoles("ADMINISTRACION");
    const req = { auth: null } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("llama a next cuando el usuario tiene uno de los roles permitidos", () => {
    const middleware = requireRoles("ADMINISTRACION", "VIGILANTE");
    const req = { auth: { sub: "1", uid: 1, roles: ["VIGILANTE"] } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
