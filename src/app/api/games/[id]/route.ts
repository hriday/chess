import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games, annotations } from "@/db/schema";
import { getRequestUser, requireUser, authErrorResponse } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const user = await getRequestUser();
  const rows = await db.select().from(games).where(eq(games.id, id));
  const game = rows[0];
  if (!game || (!game.isFamous && game.ownerId !== user?.id))
    return Response.json({ error: "Not found" }, { status: 404 });
  const notes = await db.select({ ply: annotations.ply, source: annotations.source, text: annotations.text })
    .from(annotations).where(eq(annotations.gameId, id)).orderBy(asc(annotations.ply));
  const isPaid = !!user && (user.isPaid || user.role === "admin");
  const visible = isPaid ? notes : notes.filter((n) => n.source !== "llm");
  return Response.json({ game, annotations: visible });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const { id } = await params;
    const user = await requireUser();
    const rows = await db.select().from(games).where(eq(games.id, id));
    if (!rows[0] || rows[0].ownerId !== user.id)
      return Response.json({ error: "Not found" }, { status: 404 });
    await db.delete(games).where(eq(games.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
