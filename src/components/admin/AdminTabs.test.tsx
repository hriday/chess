// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

import { AdminTabs } from "@/components/admin/AdminTabs";

// Mock the child components
vi.mock("@/components/admin/FamousGameForm", () => ({
  FamousGameForm: () => <div data-testid="famous-game-form">Famous Game Form</div>,
}));

vi.mock("@/components/admin/UserTable", () => ({
  UserTable: () => <div data-testid="user-table">User Table</div>,
}));

describe("AdminTabs", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders both panels with famous games tab active by default", () => {
    render(<AdminTabs />);

    const gamesPanel = screen.getByTestId("famous-game-form");
    const usersPanel = screen.getByTestId("user-table");

    expect(gamesPanel).toBeTruthy();
    expect(usersPanel).toBeTruthy();
  });

  it("only shows the famous games panel initially", () => {
    render(<AdminTabs />);

    const gamesPanelParent = screen.getByTestId("famous-game-form").parentElement;
    const usersPanelParent = screen.getByTestId("user-table").parentElement;

    expect(gamesPanelParent?.classList.contains("hidden")).toBe(false);
    expect(usersPanelParent?.classList.contains("hidden")).toBe(true);
  });

  it("switches to users panel when users tab is clicked", () => {
    render(<AdminTabs />);

    const usersTab = screen.getByRole("tab", { name: /users/i });
    fireEvent.click(usersTab);

    const gamesPanelParent = screen.getByTestId("famous-game-form").parentElement;
    const usersPanelParent = screen.getByTestId("user-table").parentElement;

    expect(gamesPanelParent?.classList.contains("hidden")).toBe(true);
    expect(usersPanelParent?.classList.contains("hidden")).toBe(false);
  });

  it("switches back to games panel when games tab is clicked", () => {
    render(<AdminTabs />);

    const usersTab = screen.getByRole("tab", { name: /users/i });
    const gamesTab = screen.getByRole("tab", { name: /famous games/i });

    fireEvent.click(usersTab);
    fireEvent.click(gamesTab);

    const gamesPanelParent = screen.getByTestId("famous-game-form").parentElement;
    const usersPanelParent = screen.getByTestId("user-table").parentElement;

    expect(gamesPanelParent?.classList.contains("hidden")).toBe(false);
    expect(usersPanelParent?.classList.contains("hidden")).toBe(true);
  });

  it("has correct aria-selected attributes for tabs", () => {
    render(<AdminTabs />);

    const gamesTab = screen.getByRole("tab", { name: /famous games/i });
    const usersTab = screen.getByRole("tab", { name: /users/i });

    expect(gamesTab.getAttribute("aria-selected")).toBe("true");
    expect(usersTab.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(usersTab);

    expect(gamesTab.getAttribute("aria-selected")).toBe("false");
    expect(usersTab.getAttribute("aria-selected")).toBe("true");
  });
});
