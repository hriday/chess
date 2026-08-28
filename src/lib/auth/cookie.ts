export function sessionCookie(token: string, maxAgeSec = 30 * 24 * 3600): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `chess_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}
