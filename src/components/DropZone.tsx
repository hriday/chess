"use client";
import { useState, useCallback } from "react";
import { parseGame, gameMeta, ParseError } from "@/lib/chess/parse";
import { useGameStore } from "@/store/gameStore";

export function DropZone() {
  const { game, loadGame } = useGameStore();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async (input: string) => {
    setError(null); setBusy(true);
    try {
      let source = input.trim();
      if (/^https?:\/\//.test(source)) {
        const res = await fetch("/api/import/url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: source }),
        });
        const body = await res.json();
        if (!res.ok) throw new ParseError(body.error ?? "Import failed");
        source = body.pgn;
      }
      const parsed = parseGame(source);
      loadGame(parsed, { title: gameMeta(parsed).title, sourceText: source });
      setText(""); setCollapsed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that game");
    } finally {
      setBusy(false);
    }
  }, [loadGame]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) load(await file.text());
    else load(e.dataTransfer.getData("text/plain"));
  }, [load]);

  if (game && collapsed) return (
    <button onClick={() => setCollapsed(false)}
      className="w-full py-2 rounded border border-dashed border-black/20 dark:border-white/25 text-sm opacity-70 hover:opacity-100">
      Load another game
    </button>
  );

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed p-4 space-y-2 transition-colors ${
        dragOver ? "border-amber-500 bg-amber-500/10" : "border-black/20 dark:border-white/25"}`}
    >
      <p className="text-sm font-medium">Drop a .pgn file here, or paste a game below</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={"1. e4 e5 2. Nf3 ...\nor a full PGN, or a lichess game URL"}
        aria-label="game input"
        rows={5}
        className="w-full rounded border border-black/15 dark:border-white/20 bg-transparent p-2 font-mono text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => load(text)}
          disabled={busy || !text.trim()}
          className="px-4 py-2.5 sm:py-1.5 rounded bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700"
        >
          {busy ? "Loading…" : "Load game"}
        </button>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
