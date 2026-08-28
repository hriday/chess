"use client";
import { useState } from "react";
import { FamousGameForm } from "@/components/admin/FamousGameForm";
import { UserTable } from "@/components/admin/UserTable";

export function AdminTabs() {
  const [active, setActive] = useState<"games" | "users">("games");

  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-black/10 dark:border-white/15">
        <button
          type="button"
          role="tab"
          id="tab-games"
          aria-selected={active === "games"}
          aria-controls="panel-games"
          onClick={() => setActive("games")}
          className={`px-3 py-3 text-sm font-medium transition-all ${
            active === "games"
              ? "border-b-2 border-amber-600 font-semibold text-amber-600"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          Famous games
        </button>
        <button
          type="button"
          role="tab"
          id="tab-users"
          aria-selected={active === "users"}
          aria-controls="panel-users"
          onClick={() => setActive("users")}
          className={`px-3 py-3 text-sm font-medium transition-all ${
            active === "users"
              ? "border-b-2 border-amber-600 font-semibold text-amber-600"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          Users
        </button>
      </div>
      <div className="pt-6">
        <div
          role="tabpanel"
          id="panel-games"
          aria-labelledby="tab-games"
          className={active === "games" ? "" : "hidden"}
        >
          <FamousGameForm />
        </div>
        <div
          role="tabpanel"
          id="panel-users"
          aria-labelledby="tab-users"
          className={active === "users" ? "" : "hidden"}
        >
          <UserTable />
        </div>
      </div>
    </div>
  );
}
