import { fetchPgnFromUrl, ImportError } from "@/lib/import/url";

export async function POST(req: Request): Promise<Response> {
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== "string")
    return Response.json({ error: "url required" }, { status: 400 });
  try {
    return Response.json({ pgn: await fetchPgnFromUrl(url) });
  } catch (e) {
    if (e instanceof ImportError)
      return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
