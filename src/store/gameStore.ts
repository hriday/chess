import { create } from "zustand";
import type { ParsedGame } from "@/lib/chess/parse";
import type { MoveEval } from "@/lib/chess/classify";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type PreviewState = { fens: string[]; step: number; label: string };

export type GameState = {
  game: ParsedGame | null;
  currentPly: number;
  gameId: string | null;
  meta: { title: string; description?: string } | null;
  sourceText: string | null;
  evals: Record<number, MoveEval>;
  annotations: Record<number, { admin?: string; llm?: string }>;
  preview: PreviewState | null;
  analysisProgress: { done: number; total: number } | null;
  loadGame: (g: ParsedGame, opts?: { gameId?: string; title?: string; description?: string; sourceText?: string; annotations?: { ply: number; source: string; text: string }[] }) => void;
  goTo: (ply: number) => void;
  next: () => void;
  prev: () => void;
  setEval: (ply: number, ev: MoveEval) => void;
  setAnalysisProgress: (p: { done: number; total: number } | null) => void;
  startPreview: (fens: string[], label: string) => void;
  stepPreview: (delta: number) => void;
  endPreview: () => void;
  reset: () => void;
};

const initial = { game: null, currentPly: -1, gameId: null, meta: null, sourceText: null, evals: {}, annotations: {}, preview: null, analysisProgress: null };

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,
  loadGame: (game, opts) => {
    const annotations: Record<number, { admin?: string; llm?: string }> = {};
    for (const a of opts?.annotations ?? []) (annotations[a.ply] ??= {})[a.source as "admin" | "llm"] = a.text;
    set({
      ...initial, game,
      gameId: opts?.gameId ?? null,
      meta: opts?.title ? { title: opts.title, description: opts.description } : null,
      sourceText: opts?.sourceText ?? null,
      annotations,
    });
  },
  goTo: (ply) => {
    const g = get().game;
    if (!g) return;
    set({ currentPly: Math.max(-1, Math.min(ply, g.moves.length - 1)), preview: null });
  },
  next: () => get().goTo(get().currentPly + 1),
  prev: () => get().goTo(get().currentPly - 1),
  setEval: (ply, ev) => set(s => ({ evals: { ...s.evals, [ply]: ev } })),
  setAnalysisProgress: (p) => set({ analysisProgress: p }),
  // Starts at step 1 (not 0) so the first move of the previewed line is
  // immediately visible on the board — step 0 (fens[0]) is just the
  // current position, which the user is already looking at.
  startPreview: (fens, label) => set({ preview: { fens, step: Math.min(1, fens.length - 1), label } }),
  stepPreview: (delta) => set(s => {
    if (!s.preview) return {};
    const step = Math.max(0, Math.min(s.preview.step + delta, s.preview.fens.length - 1));
    return { preview: { ...s.preview, step } };
  }),
  endPreview: () => set({ preview: null }),
  reset: () => set({ ...initial, evals: {} }),
}));

export function currentFen(s: Pick<GameState, "game" | "currentPly" | "preview">): string {
  if (s.preview) return s.preview.fens[s.preview.step];
  return s.game ? s.game.positions[s.currentPly + 1] : START_FEN;
}
