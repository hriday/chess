"use client";
import { useState } from "react";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { window.location.href = "/"; return; }
    setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
    setBusy(false);
  };
  const input = "w-full rounded border border-black/15 dark:border-white/20 bg-transparent p-2";
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <input className={input} type="email" required placeholder="Email"
        value={email} onChange={e => setEmail(e.target.value)} />
      <input className={input} type="password" required minLength={8} placeholder="Password"
        value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button disabled={busy} className="w-full py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
        {mode === "login" ? "Log in" : "Sign up"}
      </button>
      <p className="text-sm opacity-70">
        {mode === "login"
          ? <>No account? <Link className="underline" href="/signup">Sign up</Link></>
          : <>Have an account? <Link className="underline" href="/login">Log in</Link></>}
      </p>
    </form>
  );
}
