export class ImportError extends Error {}

export type GameUrl =
  | { site: "lichess"; gameId: string }
  | { site: "chesscom"; user: string; gameId: string };

export function classifyGameUrl(url: string): GameUrl | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.hostname === "lichess.org") {
    const m = u.pathname.match(/^\/([A-Za-z0-9]{8,12})(\/|$)/);
    if (m) return { site: "lichess", gameId: m[1] };
  }
  if (/(^|\.)chess\.com$/.test(u.hostname)) {
    const m = u.pathname.match(/^\/game\/(?:live|daily)\/(\d+)/);
    if (m) return { site: "chesscom", user: "", gameId: m[1] };
  }
  return null;
}

export async function fetchPgnFromUrl(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const g = classifyGameUrl(url);
  if (!g) throw new ImportError("Unrecognized game URL");
  if (g.site === "chesscom")
    throw new ImportError("chess.com URLs aren't supported yet — paste the PGN instead (Share → PGN)");
  const res = await fetchFn(`https://lichess.org/game/export/${g.gameId}`,
    { headers: { Accept: "application/x-chess-pgn" } });
  if (!res.ok) throw new ImportError("Game not found");
  return res.text();
}
