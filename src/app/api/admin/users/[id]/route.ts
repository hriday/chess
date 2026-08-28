import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await params;
    const { isPaid } = await req.json().catch(() => ({}));
    if (typeof isPaid !== "boolean") return Response.json({ error: "isPaid must be boolean" }, { status: 400 });
    await db.update(users).set({ isPaid }).where(eq(users.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
