import { pgTable, text, boolean, integer, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }), // null = famous game
  title: text("title").notNull(),
  whitePlayer: text("white_player"),
  blackPlayer: text("black_player"),
  result: text("result"),
  pgn: text("pgn").notNull(),
  isFamous: boolean("is_famous").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  ply: integer("ply").notNull(),
  source: text("source", { enum: ["admin", "llm"] }).notNull(),
  text: text("text").notNull(),
  engineEval: integer("engine_eval"),
  bestLine: text("best_line"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("annotations_game_ply_source_idx").on(t.gameId, t.ply, t.source)]);

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Annotation = typeof annotations.$inferSelect;
