"use client";
import { useState } from "react";

const ORDER = ["light", "dark", "system"] as const;
type Theme = (typeof ORDER)[number];
const ICONS: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "💻" };

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem("theme");
    return (ORDER as readonly string[]).includes(stored ?? "") ? (stored as Theme) : "system";
  } catch {
    return "system";
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore (e.g. Safari private mode, sandboxed iframes) — in-memory state still works
    }
    applyTheme(next);
  };
  return (
    <button onClick={cycle} title={`Theme: ${theme}`} aria-label="toggle theme"
      suppressHydrationWarning
      className="px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10">
      {ICONS[theme]}
    </button>
  );
}
