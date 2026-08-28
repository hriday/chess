"use client";
import { useEffect } from "react";
import { parseGame } from "@/lib/chess/parse";
import { useGameStore } from "@/store/gameStore";

export function LoadSavedGame({ id }: { id: string }) {
  const loadGame = useGameStore(s => s.loadGame);
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) return;
      const { game, annotations } = await res.json();
      loadGame(parseGame(game.pgn), {
        gameId: game.id, title: game.title,
        description: game.description ?? undefined, sourceText: game.pgn,
        annotations,
      });
    })();
  }, [id, loadGame]);
  return null;
}
