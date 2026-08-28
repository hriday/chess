import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/auth/guards";
import { FamousGameForm } from "@/components/admin/FamousGameForm";
import { UserTable } from "@/components/admin/UserTable";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = await getRequestUser();
  if (!user || user.role !== "admin") redirect("/");
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <section><h1 className="text-xl font-semibold mb-3">Famous games</h1><FamousGameForm /></section>
      <section><h2 className="text-xl font-semibold mb-3">Users</h2><UserTable /></section>
    </main>
  );
}
