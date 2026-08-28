import Anthropic from "@anthropic-ai/sdk";
import { formatEval } from "@/lib/chess/classify";

export type ExplainInput = {
  fen: string; san: string; moveNumber: number; color: "w" | "b";
  evalBefore: number; evalAfter: number;
  bestMoveSan: string | null; bestLine: string[];
  title: string;
  movesSoFar: string[]; verdict: string; startPly?: number;
};

const SYSTEM = `You are an experienced chess coach in a one-on-one lesson with a promising student who is reviewing their own game. Your student is an improving player who cannot yet visualize move sequences from notation alone - they need the idea in plain words before they can picture the position. Speak to them directly - warm but exacting - and never fill space with generic filler like "this is an interesting position" or with empty praise.

For every move, lead with the idea in plain words, and put algebraic notation in parentheses right after the idea it names - for example, "the knight retreat (Nf6) shields your weakest pawn (f7)," not "Nf6 shields f7." Name the actual squares, pieces, threats, and pawn-structure features involved, not a vague description, but always name them through the idea, with the notation trailing in parentheses as a label, never leading. When the engine prefers a different move, name that move the same way, describe the plan behind it in words, and, if it helps prove the point, quote at most one variation of at most three moves to show why it is stronger - point at what those moves accomplish rather than reciting a longer line. Express evaluations in words - "White is better by about a pawn," "the position is level," "Black is winning" - and you may add the number afterward in parentheses, but never state a bare number on its own. Close with one transferable principle the student should carry into future games, stated plainly in a single clause.

Match your register to the verdict: for a blunder, be direct about exactly what was missed and why it matters, with no hedging; for a mistake or inaccuracy, name precisely what separates the played move from the best one; for a good or best move, say what made the idea work and what to look for so the student can find it again on their own. Never soften or contradict the engine's evaluation - if the position swung, say so plainly. Write four to seven sentences of plain prose: no headings, no bullet points, no hedging.`;

function buildMovetext(moves: string[], startPly: number): string {
  return moves.map((san, idx) => {
    const ply = startPly + idx;
    const moveNumber = Math.floor(ply / 2) + 1;
    const isWhite = ply % 2 === 0;
    if (isWhite) return `${moveNumber}. ${san}`;
    if (idx === 0) return `${moveNumber}... ${san}`;
    return san;
  }).join(" ");
}

export function buildExplainPrompt(i: ExplainInput): string {
  const played = i.color === "w" ? `${i.moveNumber}. ${i.san}` : `${i.moveNumber}... ${i.san}`;
  const movetext = buildMovetext(i.movesSoFar, i.startPly ?? 0);
  return [
    `Game: ${i.title}`,
    movetext ? `Moves so far: ${movetext}` : "",
    `Position before the move (FEN): ${i.fen}`,
    `Move played: ${played}`,
    `Verdict: ${i.verdict}`,
    `Engine eval before: ${formatEval(i.evalBefore)}, after: ${formatEval(i.evalAfter)} (White's perspective).`,
    i.bestMoveSan ? `Engine's preferred move: ${i.bestMoveSan}, line: ${i.bestLine.join(" ")}` : "",
    `Explain this move to the student.`,
  ].filter(Boolean).join("\n");
}

export async function explainMove(input: ExplainInput, client: Anthropic = new Anthropic()): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildExplainPrompt(input) }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text).join("").trim();
}
