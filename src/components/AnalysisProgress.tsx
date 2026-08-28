"use client";
import { useGameStore } from "@/store/gameStore";

export function AnalysisProgress() {
  const analysisProgress = useGameStore(s => s.analysisProgress);
  if (!analysisProgress || analysisProgress.done >= analysisProgress.total) return null;

  const { done, total } = analysisProgress;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div data-testid="analysis-progress" className="text-xs opacity-70 space-y-1">
      <p>Analyzing moves… {done}/{total}</p>
      <div className="h-1 rounded bg-black/10 dark:bg-white/15 overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
