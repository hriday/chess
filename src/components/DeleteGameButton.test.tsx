// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

import { DeleteGameButton } from "@/components/DeleteGameButton";

describe("DeleteGameButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires a second click before deleting, and reloads on success", async () => {
    const reload = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
    Object.defineProperty(window, "location", { value: { reload }, writable: true });

    render(<DeleteGameButton id="g1" />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Delete");

    fireEvent.click(button);
    expect(button.textContent).toBe("Confirm delete");
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(button);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/games/g1", { method: "DELETE" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("shows an inline failure instead of reloading when the delete request fails", async () => {
    const reload = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) })));
    Object.defineProperty(window, "location", { value: { reload }, writable: true });

    render(<DeleteGameButton id="g1" />);
    const button = screen.getByRole("button");
    fireEvent.click(button); // arm
    fireEvent.click(button); // confirm -> fails

    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Delete failed"));
    expect(reload).not.toHaveBeenCalled();
  });
});
