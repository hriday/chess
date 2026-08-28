import { test, expect } from "@playwright/test";

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no horizontal overflow, board and nav usable, commentary visible", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("game input").fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6");
    await page.getByRole("button", { name: "Load game" }).click();

    // No horizontal scroll on the loaded page
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Board is visible and sized to fit within the viewport (not clipped, not collapsed)
    const board = page.getByTestId("board");
    await expect(board).toBeVisible();
    const boardBox = await board.boundingBox();
    expect(boardBox?.width ?? 0).toBeGreaterThan(300);
    expect(boardBox?.width ?? 0).toBeLessThanOrEqual(390);

    // MoveNav "next" button meets a comfortable touch-target height
    const next = page.getByRole("button", { name: "next", exact: true });
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    // MoveList cell buttons meet a comfortable touch-target height
    const firstMove = page.locator("[data-ply='0']");
    await expect(firstMove).toBeVisible();
    const firstMoveBox = await firstMove.boundingBox();
    expect(firstMoveBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Commentary becomes visible after selecting a move
    await page.getByRole("button", { name: "Bb5" }).click();
    const commentary = page.getByTestId("commentary");
    await expect(commentary).toBeVisible();
    await expect(commentary).toContainText(/Bb5/, { timeout: 30_000 });
  });
});

test("import a game, navigate, see engine commentary", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("game input").fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6");
  await page.getByRole("button", { name: "Load game" }).click();

  // Move list appears; click the third move
  await expect(page.getByRole("button", { name: "Bb5" })).toBeVisible();
  await page.getByRole("button", { name: "Bb5" }).click();

  // Commentary panel resolves from "Analyzing…" to a verdict sentence (engine wasm can be slow first load)
  const commentary = page.getByTestId("commentary");
  await expect(commentary).toContainText(/Bb5/, { timeout: 30_000 });

  // Arrow-key navigation moves the highlight
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-ply='3']")).toHaveClass(/bg-amber/);
});

test("guest cannot get LLM explanations", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("game input").fill("1. e4 e5");
  await page.getByRole("button", { name: "Load game" }).click();
  await page.getByRole("button", { name: "e4", exact: true }).click();
  const explain = page.getByRole("button", { name: /Explain this move/ });
  await explain.click({ timeout: 30_000 });
  await expect(page.getByText(/log in/i)).toBeVisible();
});

test("theme toggle flips dark class", async ({ page }) => {
  await page.goto("/");
  const initiallyDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"));
  await page.getByLabel("toggle theme").click();
  // cycling light -> dark -> system must change the class at least once within two clicks
  const after1 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (after1 === initiallyDark) {
    await page.getByLabel("toggle theme").click();
    const after2 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(after2).not.toBe(initiallyDark);
  }
});
