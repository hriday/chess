"use client";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export function MoveNav() {
  const { game, next, prev, goTo, preview, stepPreview } = useGameStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (preview) {
        if (e.key === "ArrowRight") stepPreview(1);
        if (e.key === "ArrowLeft") stepPreview(-1);
        return;
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, preview, stepPreview]);
  if (!game) return null;
  const btn = "px-3 py-2.5 sm:py-1.5 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-lg";
  // While a preview is active, ◀/▶ step through the previewed line (mirroring
  // the keyboard handler above) rather than the game — ⏮/⏭ still jump to the
  // real start/end of the game via goTo, which deliberately clears the preview.
  const onPrev = preview ? () => stepPreview(-1) : prev;
  const onNext = preview ? () => stepPreview(1) : next;
  return (
    <div className="flex gap-2 justify-center" aria-label="move navigation">
      <button className={btn} aria-label="first" onClick={() => goTo(-1)}>⏮</button>
      <button className={btn} aria-label="previous" onClick={onPrev}>◀</button>
      <button className={btn} aria-label="next" onClick={onNext}>▶</button>
      <button className={btn} aria-label="last" onClick={() => goTo(game.moves.length - 1)}>⏭</button>
    </div>
  );
}
