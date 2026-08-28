"use client";
import { useRef, useState } from "react";
import { useTwoStepConfirm } from "@/lib/useTwoStepConfirm";

const ERROR_DISPLAY_MS = 4000;

export function DeleteGameButton({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirming, onClick } = useTwoStepConfirm(async () => {
    const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
      return;
    }
    setFailed(true);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setFailed(false), ERROR_DISPLAY_MS);
  });

  return (
    <button onClick={onClick}
      className={`text-sm hover:underline ${confirming || failed ? "text-red-600 font-medium" : "text-red-500"}`}>
      {failed ? "Delete failed" : confirming ? "Confirm delete" : "Delete"}
    </button>
  );
}
