import { and, eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { db } from "../src/db";
import { games } from "../src/db/schema";
import { parseGame, gameMeta } from "../src/lib/chess/parse";

type FamousGame = { title: string; description: string; pgn: string };

const entries: FamousGame[] = JSON.parse(
  readFileSync(__dirname + "/famous-games.json", "utf8")
);

(async () => {
  let inserted = 0;
  let skipped = 0;
  const failures: { title: string; reason: string }[] = [];

  for (const entry of entries) {
    let meta;
    try {
      const parsed = parseGame(entry.pgn);
      meta = gameMeta(parsed);
    } catch (e) {
      failures.push({ title: entry.title, reason: e instanceof Error ? e.message : String(e) });
      continue;
    }

    const existing = await db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.isFamous, true), eq(games.title, entry.title)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`skip     ${entry.title}`);
      skipped++;
      continue;
    }

    await db.insert(games).values({
      ownerId: null,
      isFamous: true,
      title: entry.title,
      description: entry.description,
      pgn: entry.pgn,
      whitePlayer: meta.whitePlayer,
      blackPlayer: meta.blackPlayer,
      result: meta.result,
    });
    console.log(`insert   ${entry.title}`);
    inserted++;
  }

  console.log(`\nSummary: inserted ${inserted}, skipped ${skipped}, failed ${failures.length}`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f.title}: ${f.reason}`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
})();
