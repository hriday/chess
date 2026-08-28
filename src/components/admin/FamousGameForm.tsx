"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTwoStepConfirm } from "@/lib/useTwoStepConfirm";

type FamousRow = { id: string; title: string; result: string | null };

export function FamousGameForm() {
  const [pgn, setPgn] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<FamousRow[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/famous");
    if (res.ok) setList((await res.json()).games);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const publish = async () => {
    setError(null);
    const res = await fetch("/api/admin/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pgn, title, description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? "Failed"); return; }
    setPgn(""); setTitle(""); setDescription("");
    refresh();
  };
  const remove = async (id: string) => {
    await fetch(`/api/admin/games/${id}`, { method: "DELETE" });
    refresh();
  };

  const input = "w-full rounded border border-black/15 dark:border-white/20 bg-transparent p-2 text-sm";
  return (
    <div className="space-y-3">
      <textarea className={`${input} font-mono`} rows={5} placeholder="PGN"
        value={pgn} onChange={e => setPgn(e.target.value)} />
      <input className={input} placeholder="Title (optional — derived from PGN headers)"
        value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={input} rows={2} placeholder="Description"
        value={description} onChange={e => setDescription(e.target.value)} />
      <div className="flex items-center gap-3">
        <button onClick={publish} disabled={!pgn.trim()}
          className="px-4 py-1.5 rounded bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700">
          Publish famous game
        </button>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </div>
      <ul className="divide-y divide-black/10 dark:divide-white/15">
        {list.map(g => (
          <FamousGameRow key={g.id} title={g.title} onDelete={() => remove(g.id)} gameId={g.id} />
        ))}
      </ul>
    </div>
  );
}

function FamousGameRow({ gameId, title, onDelete }: { gameId: string; title: string; onDelete: () => void | Promise<void> }) {
  const { confirming, onClick } = useTwoStepConfirm(onDelete);
  return (
    <li className="py-2 flex items-center gap-3 text-sm">
      <span className="flex-1">{title}</span>
      <Link className="underline" href={`/?game=${gameId}&annotate=1`}>Annotate</Link>
      <button onClick={onClick} className={`hover:underline ${confirming ? "text-red-600 font-medium" : "text-red-500"}`}>
        {confirming ? "Confirm delete" : "Delete"}
      </button>
    </li>
  );
}
