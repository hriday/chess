import { cpSync, mkdirSync, readdirSync } from "fs";
import path from "path";

// NOTE: the `stockfish` npm package (v18.x) ships its prebuilt files under
// `bin/`, not `src/` as older versions did, and it ships several build
// variants side by side (multi-threaded, single-threaded, "lite", full) —
// there is no single canonical "stockfish.js" source file to copy blindly.
const src = path.resolve("node_modules/stockfish/bin");
const dest = path.resolve("public/stockfish");
mkdirSync(dest, { recursive: true });

const files = readdirSync(src);

// We want the single-threaded build (no COOP/COEP cross-origin-isolation
// headers required to run it as a Worker) and the "lite" NNUE net (~7MB
// wasm) rather than the full net (~113MB wasm) — the lite net is plenty
// strong for depth-12 analysis and is actually deliverable over the web.
// Prefer an exact "lite" + "single" match; fall back to any single-threaded
// build if the lite variant isn't present in this package version.
function pick(pattern, fallbackPattern) {
  return files.find(f => pattern.test(f)) ?? files.find(f => fallbackPattern.test(f));
}

const js = pick(/lite-single.*\.js$/, /single.*\.js$/);
if (!js) throw new Error(`No single-threaded stockfish js in ${src}: ${files.join(", ")}`);

const wasm = js.replace(/\.js$/, ".wasm");
if (!files.includes(wasm)) {
  throw new Error(`Expected matching wasm "${wasm}" for "${js}" in ${src}: ${files.join(", ")}`);
}

// The engine's loader looks up its wasm binary by a hardcoded literal
// "stockfish.wasm" next to the script's own URL (verified by inspecting the
// copied js: `w="stockfish.wasm"`), regardless of the original filename —
// so both files must be renamed to stockfish.js / stockfish.wasm.
cpSync(path.join(src, js), path.join(dest, "stockfish.js"));
cpSync(path.join(src, wasm), path.join(dest, "stockfish.wasm"));

console.log(`Copied ${js} -> stockfish.js and ${wasm} -> stockfish.wasm in public/stockfish/`);
