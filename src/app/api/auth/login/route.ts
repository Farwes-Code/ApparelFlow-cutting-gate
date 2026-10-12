import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { COOKIE, signSession } from "@/lib/auth";
import { errorResponse, parse, readJson, HttpError } from "@/lib/api";
import { loginSchema } from "@/lib/domain";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(req: Request) {
  try {
    const { email, password } = parse(loginSchema, await readJson(req));
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, "Invalid email or password");

    const token = await signSession({ id: user.id, role: user.role, name: user.fullName, email: user.email });
    const jar = await cookies();
    jar.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return NextResponse.json({ user: { id: user.id, role: user.role, fullName: user.fullName } });
  } catch (e) {
    return errorResponse(e);
  }
}
