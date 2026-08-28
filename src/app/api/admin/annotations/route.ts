import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { annotations } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/auth/guards";

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const { gameId, ply, text } = await req.json().catch(() => ({}));
    if (typeof gameId !== "string") return Response.json({ error: "gameId required" }, { status: 400 });
    if (typeof ply !== "number") return Response.json({ error: "ply required" }, { status: 400 });
    if (typeof text !== "string") return Response.json({ error: "text required" }, { status: 400 });

    if (text.trim() === "") {
      await db.delete(annotations).where(
        and(eq(annotations.gameId, gameId), eq(annotations.ply, ply), eq(annotations.source, "admin")),
      );
      return Response.json({ ok: true });
    }

    await db.insert(annotations)
      .values({ gameId, ply, source: "admin", text })
      .onConflictDoUpdate({
        target: [annotations.gameId, annotations.ply, annotations.source],
        set: { text },
      });
    return Response.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const { gameId, ply, source } = await req.json().catch(() => ({}));
    if (typeof gameId !== "string") return Response.json({ error: "gameId required" }, { status: 400 });
    if (typeof ply !== "number" || !Number.isInteger(ply) || ply < 0)
      return Response.json({ error: "ply must be a non-negative integer" }, { status: 400 });
    if (source !== "admin" && source !== "llm")
      return Response.json({ error: "source must be \"admin\" or \"llm\"" }, { status: 400 });

    await db.delete(annotations).where(
      and(eq(annotations.gameId, gameId), eq(annotations.ply, ply), eq(annotations.source, source)),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
