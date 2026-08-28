import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

const email = process.argv[2];
if (!email) { console.error("usage: tsx scripts/make-admin.ts <email>"); process.exit(1); }

(async () => {
  const res = await db.update(users).set({ role: "admin" }).where(eq(users.email, email)).returning();
  console.log(res.length ? `${email} is now admin` : `no user ${email}`);
  process.exit(0);
})();
