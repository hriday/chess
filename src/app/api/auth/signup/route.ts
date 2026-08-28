import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/cookie";
import { rateLimit } from "@/lib/rateLimit";
import { requestIp } from "@/lib/requestIp";

export async function POST(req: Request): Promise<Response> {
  if (!rateLimit("signup", requestIp(req), 10, 15 * 60 * 1000))
    return Response.json({ error: "Too many requests — try again later" }, { status: 429 });

  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return Response.json({ error: "Invalid email" }, { status: 400 });
  if (typeof password !== "string" || password.length < 8)
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0)
    return Response.json({ error: "Email already registered" }, { status: 409 });

  let user;
  try {
    [user] = await db.insert(users)
      .values({ email: email.toLowerCase(), passwordHash: await hashPassword(password) })
      .returning();
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505")
      return Response.json({ error: "Email already registered" }, { status: 409 });
    throw e;
  }
  const token = await createSession(user.id);
  return Response.json({ email: user.email }, { headers: { "Set-Cookie": sessionCookie(token) } });
}
