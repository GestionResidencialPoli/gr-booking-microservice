import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import requireCsrf from "./require-csrf";

function mockRequest(method: string, cookieToken?: string, headerToken?: string): Request {
  return {
    method,
    cookies: cookieToken ? { "XSRF-TOKEN": cookieToken } : {},
    header: (name: string) => (name === "x-xsrf-token" ? headerToken : undefined),
  } as unknown as Request;
}

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("requireCsrf", () => {
  it("deja pasar los metodos seguros sin token", () => {
    const next = vi.fn();
    requireCsrf(mockRequest("GET"), mockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rechaza una mutacion sin encabezado", () => {
    const res = mockResponse();
    const next = vi.fn();
    requireCsrf(mockRequest("POST", "abc"), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza una mutacion cuando la cookie y el encabezado no coinciden", () => {
    const res = mockResponse();
    const next = vi.fn();
    requireCsrf(mockRequest("PATCH", "abc", "abd"), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("deja pasar una mutacion cuando la cookie y el encabezado coinciden", () => {
    const next = vi.fn();
    requireCsrf(mockRequest("DELETE", "abc", "abc"), mockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
