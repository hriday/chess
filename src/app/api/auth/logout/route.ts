import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/cookie";

export async function POST(): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", 0) } });
}
