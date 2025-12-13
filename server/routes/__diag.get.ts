import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Quick sanity endpoint:
 *   GET /__diag
 *
 * Shows which legacy .html files Nitro can see at runtime.
 * (Does NOT expose file contents.)
 */
export default defineEventHandler(async (event) => {
  const legacyDirDev = path.resolve(process.cwd(), "public", "legacy");
  const legacyDirProd = path.resolve(process.cwd(), ".output", "public", "legacy");

  async function list(dir: string) {
    try {
      const items = await readdir(dir, { withFileTypes: true });
      return items
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".html"))
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  }

  const dev = await list(legacyDirDev);
  const prod = await list(legacyDirProd);

  return {
    ok: true,
    now: new Date().toISOString(),
    env: {
      DEBUG_LEGACY: process.env.DEBUG_LEGACY ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    legacy: {
      devDir: legacyDirDev,
      prodDir: legacyDirProd,
      devHtmlFiles: dev,
      prodHtmlFiles: prod,
    },
    notes: [
      "If devHtmlFiles is empty, confirm your pages are in public/legacy/*.html",
      "If clicking a link like daycare.html 404s, confirm the exact filename matches (Linux is case-sensitive).",
      "Headers x-diag-* are added when DEBUG_LEGACY=1",
    ],
  };
});
