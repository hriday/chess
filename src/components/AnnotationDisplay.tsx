"use client";
import { useGameStore } from "@/store/gameStore";

export function AnnotationDisplay() {
  const { currentPly, annotations } = useGameStore();
  const note = currentPly >= 0 ? annotations[currentPly] : undefined;
  if (!note) return null;
  return (
    <div className="mt-3 space-y-2">
      {note.admin && (
        <div className="rounded bg-amber-500/10 p-3">
          <p className="text-xs uppercase tracking-wide opacity-60 mb-1">Annotation</p>
          <p className="text-sm leading-relaxed">{note.admin}</p>
        </div>
      )}
      {note.llm && <p className="text-sm leading-relaxed rounded bg-indigo-500/10 p-3">{note.llm}</p>}
    </div>
  );
}
