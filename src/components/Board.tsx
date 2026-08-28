"use client";
import { Chessboard } from "react-chessboard";
import type { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import { useGameStore, currentFen } from "@/store/gameStore";
import { sanToFromTo, stripSanSuffix } from "@/lib/chess/sanToMove";

export function Board() {
  const fen = useGameStore(s => currentFen(s));
  const { game, currentPly, evals, preview } = useGameStore();

  const customArrows: Arrow[] = [];
  if (!preview && game && currentPly >= 0) {
    const move = game.moves[currentPly];
    customArrows.push([move.from as Square, move.to as Square, "rgb(217, 119, 6)"]); // amber: move played
    const ev = evals[currentPly];
    if (ev?.bestMoveSan && stripSanSuffix(ev.bestMoveSan) !== stripSanSuffix(move.san)) {
      const best = sanToFromTo(game.positions[currentPly], ev.bestMoveSan);
      if (best) customArrows.push([best.from as Square, best.to as Square, "rgb(22, 163, 74)"]); // green: engine's best
    }
  }

  return (
    <div data-testid="board"
      className={`w-full min-w-0 max-w-[min(560px,calc(100vw-4.5rem))] aspect-square rounded-lg ${
        preview ? "ring-2 ring-indigo-500" : ""}`}>
      <Chessboard
        position={fen}
        arePiecesDraggable={false}
        customArrows={customArrows}
        customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
        customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
      />
    </div>
  );
}
