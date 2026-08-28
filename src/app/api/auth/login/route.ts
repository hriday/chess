import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/cookie";
import { rateLimit } from "@/lib/rateLimit";
import { requestIp } from "@/lib/requestIp";

// A real argon2id hash of a random, discarded string (generated once locally via
// `node -e` with @node-rs/argon2, matching hashPassword's params — see
// hardening-report.md for provenance). Verified against on a lookup miss so that a
// failed login always pays the same argon2 cost, whether the email exists or not —
// otherwise the email-not-found path returns far faster than the wrong-password path,
// letting an attacker enumerate registered emails by timing.
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$sC0+Po3jNDgA66Iwrbzd/Q$TesMTl9stNDORHV4zIi9WN4yCBJnaBAOEqnkadJcQUw";

export async function POST(req: Request): Promise<Response> {
  const ip = requestIp(req);
  if (!rateLimit("login", ip, 10, 15 * 60 * 1000))
    return Response.json({ error: "Too many requests — try again later" }, { status: 429 });

  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string")
    return Response.json({ error: "Email and password required" }, { status: 400 });
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (rows.length === 0) {
    await verifyPassword(DUMMY_HASH, password);
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!(await verifyPassword(rows[0].passwordHash, password)))
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  const token = await createSession(rows[0].id);
  return Response.json({ email: rows[0].email }, { headers: { "Set-Cookie": sessionCookie(token) } });
}
