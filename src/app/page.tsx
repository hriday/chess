import { Board } from "@/components/Board";
import { MoveList } from "@/components/MoveList";
import { MoveNav } from "@/components/MoveNav";
import { CommentaryPanel } from "@/components/CommentaryPanel";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { DropZone } from "@/components/DropZone";
import { EvalBar } from "@/components/EvalBar";
import { EngineHost } from "@/components/EngineHost";
import { AnnotationDisplay } from "@/components/AnnotationDisplay";
import { ExplainButton } from "@/components/ExplainButton";
import { LoadSavedGame } from "@/components/LoadSavedGame";
import { SaveGameButton } from "@/components/SaveGameButton";
import { AnnotationEditor } from "@/components/admin/AnnotationEditor";

export default async function Home({ searchParams }: { searchParams: Promise<{ game?: string; annotate?: string }> }) {
  const { game, annotate } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl p-4 grid gap-6 md:grid-cols-[minmax(0,560px)_1fr]">
      <EngineHost />
      {game && <LoadSavedGame id={game} />}
      <div className="space-y-3">
        <div className="flex gap-2 min-w-0">
          <EvalBar />
          <Board />
        </div>
        <MoveNav />
        <AnalysisProgress />
        <CommentaryPanel><AnnotationDisplay /><ExplainButton /></CommentaryPanel>
        {annotate === "1" && <AnnotationEditor />}
      </div>
      <div className="space-y-3">
        <DropZone />
        <MoveList />
        <SaveGameButton />
      </div>
    </main>
  );
}
