import { useEffect, useRef, useState } from "react";

const DEFAULT_WINDOW_MS = 4000;

/**
 * Shared two-step "confirm inline" interaction: first click arms confirmation (and
 * auto-disarms after `windowMs`), second click while armed runs `action`. No native
 * confirm() dialog. Used for destructive actions (deleting a saved game, deleting a
 * famous game) where a full modal would be overkill but a stray click shouldn't delete
 * anything outright.
 */
export function useTwoStepConfirm(action: () => void | Promise<void>, windowMs = DEFAULT_WINDOW_MS) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = async () => {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), windowMs);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    await action();
  };

  return { confirming, onClick };
}
