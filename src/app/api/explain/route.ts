import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { annotations, games } from "@/db/schema";
import { requirePaid, authErrorResponse } from "@/lib/auth/guards";
import { explainMove, type ExplainInput } from "@/lib/llm/explain";
import { rateLimit } from "@/lib/rateLimit";
import { requestIp } from "@/lib/requestIp";

export async function POST(req: Request): Promise<Response> {
  if (!rateLimit("explain", requestIp(req), 30, 10 * 60 * 1000))
    return Response.json({ error: "Too many requests — try again later" }, { status: 429 });

  try {
    const user = await requirePaid();
    const body = await req.json().catch(() => null) as (ExplainInput & { gameId?: string; ply?: number }) | null;
    if (!body || typeof body.fen !== "string" || typeof body.san !== "string" ||
        typeof body.evalBefore !== "number" || typeof body.evalAfter !== "number" ||
        !Array.isArray(body.bestLine) || !body.bestLine.every((m) => typeof m === "string") ||
        !Array.isArray(body.movesSoFar) || !body.movesSoFar.every((m) => typeof m === "string") ||
        typeof body.verdict !== "string")
      return Response.json({ error: "Invalid request" }, { status: 400 });

    const { gameId, ply } = body;
    if (gameId !== undefined) {
      if (typeof gameId !== "string" || typeof ply !== "number" || !Number.isInteger(ply) || ply < 0)
        return Response.json({ error: "Invalid request" }, { status: 400 });

      const rows = await db.select().from(games).where(eq(games.id, gameId));
      const game = rows[0];
      if (!game || !(game.isFamous || game.ownerId === user.id))
        return Response.json({ error: "Not found" }, { status: 404 });

      const cached = await db.select().from(annotations)
        .where(and(eq(annotations.gameId, gameId), eq(annotations.ply, ply), eq(annotations.source, "llm")));
      if (cached.length > 0)
        return Response.json({ text: cached[0].text, cached: true });
    }

    const text = await explainMove(body);
    if (gameId !== undefined && typeof ply === "number") {
      await db.insert(annotations).values({
        gameId, ply, source: "llm", text,
        engineEval: Math.round(body.evalAfter), bestLine: body.bestLine.join(" "),
      }).onConflictDoNothing();
    }
    return Response.json({ text, cached: false });
  } catch (e) {
    return authErrorResponse(e) ?? Response.json({ error: "Explanation failed" }, { status: 500 });
  }
}
