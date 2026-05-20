#!/usr/bin/env node
// Smoke test: verify every route file imported in src/routeTree.gen.ts
// actually exists on disk. Prevents stale-cache "Failed to load url" errors.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const treePath = resolve(root, "src/routeTree.gen.ts");

if (!existsSync(treePath)) {
  console.error(`[check-routes] missing ${treePath}`);
  process.exit(1);
}

const src = readFileSync(treePath, "utf8");
const importRe = /from\s+['"](\.\/[^'"]+)['"]/g;
const missing = [];
const exts = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

for (const m of src.matchAll(importRe)) {
  const rel = m[1];
  const base = resolve(root, "src", rel);
  const found = exts.some((e) => existsSync(base + e));
  if (!found) missing.push(rel);
}

if (missing.length) {
  console.error("[check-routes] missing route files referenced in routeTree.gen.ts:");
  for (const f of missing) console.error("  - " + f);
  console.error("\nFix: delete the stale import from src/routeTree.gen.ts or recreate the file.");
  process.exit(1);
}

console.log(`[check-routes] OK — ${[...src.matchAll(importRe)].length} route imports resolved.`);