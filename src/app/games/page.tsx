import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { getRequestUser } from "@/lib/auth/guards";
import { DeleteGameButton } from "@/components/DeleteGameButton";

export const dynamic = "force-dynamic";

export default async function MyGames() {
  const user = await getRequestUser();
  if (!user) return <main className="p-8">Please <Link className="underline" href="/login">log in</Link> to see your saved games.</main>;
  const list = await db.select().from(games)
    .where(eq(games.ownerId, user.id)).orderBy(desc(games.createdAt));
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">My games</h1>
      {list.length === 0 && <p className="opacity-70">No saved games yet — analyse one on the <Link className="underline" href="/">board</Link> and hit save.</p>}
      <ul className="divide-y divide-black/10 dark:divide-white/15">
        {list.map(g => (
          <li key={g.id} className="py-2 flex justify-between items-center gap-3">
            <Link className="hover:underline" href={`/?game=${g.id}`}>{g.title}</Link>
            <span className="flex items-center gap-3">
              <span className="opacity-60 text-sm">{g.result ?? ""}</span>
              <DeleteGameButton id={g.id} />
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
