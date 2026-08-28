import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function FamousGames() {
  const list = await db.select().from(games)
    .where(eq(games.isFamous, true)).orderBy(desc(games.createdAt));
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Famous games</h1>
      {list.length === 0 && <p className="opacity-70">Nothing here yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map(g => (
          <Link key={g.id} href={`/?game=${g.id}`}
            className="rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-amber-500 transition-colors">
            <h2 className="font-medium">{g.title}</h2>
            <p className="text-sm opacity-60">{g.result}</p>
            {g.description && <p className="text-sm mt-2 line-clamp-3">{g.description}</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}
