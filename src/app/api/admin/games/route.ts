import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/auth/guards";
import { parseGame, gameMeta, ParseError } from "@/lib/chess/parse";

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const { pgn, title, description } = await req.json().catch(() => ({}));
    if (typeof pgn !== "string") return Response.json({ error: "pgn required" }, { status: 400 });
    let meta;
    try { meta = gameMeta(parseGame(pgn)); }
    catch (e) {
      if (e instanceof ParseError) return Response.json({ error: e.message }, { status: 400 });
      throw e;
    }
    const [row] = await db.insert(games).values({
      ownerId: null, isFamous: true, pgn,
      title: typeof title === "string" && title.trim() ? title.trim() : meta.title,
      description: typeof description === "string" ? description : null,
      whitePlayer: meta.whitePlayer, blackPlayer: meta.blackPlayer, result: meta.result,
    }).returning();
    return Response.json({ id: row.id });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
