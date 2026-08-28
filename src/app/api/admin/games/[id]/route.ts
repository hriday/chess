import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.delete(games).where(and(eq(games.id, id), eq(games.isFamous, true)));
    return Response.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
