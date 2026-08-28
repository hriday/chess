import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

export async function GET(): Promise<Response> {
  const list = await db.select({
    id: games.id, title: games.title, whitePlayer: games.whitePlayer,
    blackPlayer: games.blackPlayer, result: games.result, description: games.description,
  }).from(games).where(eq(games.isFamous, true)).orderBy(desc(games.createdAt));
  return Response.json({ games: list });
}
