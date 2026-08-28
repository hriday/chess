import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { parseGame, gameMeta, ParseError } from "@/lib/chess/parse";

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const list = await db.select({ id: games.id, title: games.title, result: games.result, createdAt: games.createdAt })
      .from(games).where(eq(games.ownerId, user.id)).orderBy(desc(games.createdAt));
    return Response.json({ games: list });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const { pgn, title } = await req.json().catch(() => ({}));
    if (typeof pgn !== "string")
      return Response.json({ error: "pgn required" }, { status: 400 });
    let meta;
    try { meta = gameMeta(parseGame(pgn)); }
    catch (e) {
      if (e instanceof ParseError) return Response.json({ error: e.message }, { status: 400 });
      throw e;
    }
    const [row] = await db.insert(games).values({
      ownerId: user.id, pgn,
      title: typeof title === "string" && title.trim() ? title.trim() : meta.title,
      whitePlayer: meta.whitePlayer, blackPlayer: meta.blackPlayer, result: meta.result,
    }).returning();
    return Response.json({ id: row.id });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Failed" }, { status: 500 });
  }
}
