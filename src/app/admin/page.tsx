import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/auth/guards";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = await getRequestUser();
  if (!user || user.role !== "admin") redirect("/");
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold mb-6">Admin</h1>
      <AdminTabs />
    </main>
  );
}
