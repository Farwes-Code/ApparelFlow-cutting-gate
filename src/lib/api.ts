import { NextResponse } from "next/server";
import type { z } from "zod";
import type { Role } from "@prisma/client";
import { getSession, type Session } from "./auth";
import { HttpError } from "./errors";

export { HttpError };
export type Ctx<P> = { user: Session; req: Request; params: P };

/**
 * Every protected endpoint goes through here:
 * 401 if no valid session, 403 if the role is not allowed, then the handler runs.
 */
export function handle<P = Record<string, never>>(roles: Role[], fn: (c: Ctx<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const user = await getSession();
      if (!user) throw new HttpError(401, "Not authenticated");
      if (!roles.includes(user.role)) throw new HttpError(403, "Forbidden: your role cannot perform this action");
      const params = await ctx.params;
      return NextResponse.json(await fn({ user, req, params }));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid, non-empty JSON");
  }
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    throw new HttpError(422, `Validation failed: ${msg}`);
  }
  return r.data;
}

export function idOf(raw: string): number {
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < 1) throw new HttpError(400, "Invalid id");
  return n;
}
