import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/auth/guards";

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const list = await db.select({ id: users.id, email: users.email, role: users.role,
      isPaid: users.isPaid, createdAt: users.createdAt }).from(users).orderBy(asc(users.createdAt));
    return Response.json({ users: list });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
