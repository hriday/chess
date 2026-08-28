"use client";
import { useGameStore } from "@/store/gameStore";
import { VERDICT_META, classifyMove } from "@/lib/chess/classify";

export function MoveList() {
  const { game, currentPly, goTo, evals } = useGameStore();
  if (!game) return null;
  const rows: { num: number; white?: number; black?: number }[] = [];
  game.moves.forEach(m => {
    if (m.color === "w") rows.push({ num: m.moveNumber, white: m.ply });
    else {
      if (rows.length === 0 || rows[rows.length - 1].black !== undefined)
        rows.push({ num: m.moveNumber });
      rows[rows.length - 1].black = m.ply;
    }
  });
  const cell = (ply?: number) => {
    if (ply === undefined) return <td className="px-2" />;
    const m = game.moves[ply];
    const ev = evals[ply];
    const verdict = ev ? classifyMove(m, ev) : null;
    return (
      <td className="px-1">
        <button
          data-ply={ply}
          onClick={() => goTo(ply)}
          className={`px-2 py-3 sm:px-1.5 sm:py-0.5 rounded font-mono text-sm hover:bg-black/10 dark:hover:bg-white/10 ${
            ply === currentPly ? "bg-amber-200 dark:bg-amber-700" : ""}`}
        >
          {m.san}
          {verdict && VERDICT_META[verdict].symbol && (
            <span className={`ml-0.5 ${VERDICT_META[verdict].color}`}>{VERDICT_META[verdict].symbol}</span>
          )}
        </button>
      </td>
    );
  };
  return (
    <div className="overflow-y-auto max-h-[420px] rounded border border-black/10 dark:border-white/15">
      <table className="w-full text-left">
        <tbody>
          {rows.map(r => (
            <tr key={r.num} className="odd:bg-black/[.03] dark:odd:bg-white/[.04]">
              <td className="pl-2 py-0.5 w-10 text-sm opacity-60">{r.num}.</td>
              {cell(r.white)}{cell(r.black)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
