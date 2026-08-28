"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

export function SaveGameButton() {
  const { game, gameId, sourceText, meta } = useGameStore();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!game || gameId || saved || !sourceText) return null;
  const save = async () => {
    const res = await fetch("/api/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pgn: sourceText, title: meta?.title }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setSaved(body.id); useGameStore.setState({ gameId: body.id }); }
    else setError(res.status === 401 ? "Log in to save games" : body.error ?? "Save failed");
  };
  return (
    <div className="text-sm">
      <button onClick={save} className="underline opacity-80 hover:opacity-100">💾 Save this game</button>
      {error && <span className="ml-2 text-red-500">{error}</span>}
    </div>
  );
}
