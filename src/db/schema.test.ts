import { describe, it, expect } from "vitest";
import { users, sessions, games, annotations } from "@/db/schema";
import { getTableColumns } from "drizzle-orm";

describe("schema", () => {
  it("defines the four tables with expected columns", () => {
    expect(Object.keys(getTableColumns(users)).sort()).toEqual(
      ["createdAt", "email", "id", "isPaid", "passwordHash", "role"].sort());
    expect(Object.keys(getTableColumns(sessions)).sort()).toEqual(
      ["expiresAt", "id", "userId"].sort());
    expect(Object.keys(getTableColumns(games)).sort()).toEqual(
      ["blackPlayer", "createdAt", "description", "id", "isFamous",
       "ownerId", "pgn", "result", "title", "whitePlayer"].sort());
    expect(Object.keys(getTableColumns(annotations)).sort()).toEqual(
      ["bestLine", "createdAt", "engineEval", "gameId", "id", "ply", "source", "text"].sort());
  });
});
