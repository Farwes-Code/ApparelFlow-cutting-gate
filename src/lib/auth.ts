import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { homeFor, isRole } from "./roles";

export const COOKIE = "af_session";
export type Session = { id: number; role: Role; name: string; email: string };

function key() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET is missing or too short (min 16 chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, name: s.name, email: s.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.id))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || !isRole(payload.role)) return null;
    return { id, role: payload.role, name: String(payload.name ?? ""), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

/** Identity always comes from the signed cookie, never from a request body. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

/** Page-level guard (UX only; the API enforces the real boundary). */
export async function requirePage(role: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/");
  if (s.role !== role) redirect(homeFor(s.role));
  return s;
}
