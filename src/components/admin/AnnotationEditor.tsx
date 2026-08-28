"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export function AnnotationEditor() {
  const { gameId, currentPly, annotations } = useGameStore();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setText(currentPly >= 0 ? annotations[currentPly]?.admin ?? "" : "");
    setStatus(null);
  }, [currentPly, annotations]);

  if (!gameId || currentPly < 0) return null;
  const save = async () => {
    const res = await fetch("/api/admin/annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, ply: currentPly, text }),
    });
    if (res.ok) {
      const ply = currentPly;
      useGameStore.setState(s => ({
        annotations: { ...s.annotations, [ply]: { ...s.annotations[ply], admin: text || undefined } },
      }));
      setStatus("Saved");
    } else setStatus((await res.json().catch(() => ({}))).error ?? "Save failed");
  };
  const deleteLlm = async () => {
    const ply = currentPly;
    const res = await fetch("/api/admin/annotations", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, ply, source: "llm" }),
    });
    if (res.ok) {
      useGameStore.setState(s => ({
        annotations: { ...s.annotations, [ply]: { ...s.annotations[ply], llm: undefined } },
      }));
      setStatus("AI explanation deleted");
    } else setStatus((await res.json().catch(() => ({}))).error ?? "Delete failed");
  };
  const llmText = annotations[currentPly]?.llm;
  return (
    <div className="rounded-lg border border-amber-500/40 p-3 space-y-2">
      <p className="text-xs uppercase tracking-wide opacity-60">Admin annotation for this move</p>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
        className="w-full rounded border border-black/15 dark:border-white/20 bg-transparent p-2 text-sm" />
      <div className="flex items-center gap-3">
        <button onClick={save} className="px-3 py-1 rounded bg-amber-600 text-white text-sm hover:bg-amber-700">Save</button>
        {llmText && (
          <button onClick={deleteLlm} className="px-3 py-1 rounded text-red-500 text-sm hover:underline">
            Delete AI explanation
          </button>
        )}
        {status && <span className="text-sm opacity-70">{status}</span>}
      </div>
    </div>
  );
}
