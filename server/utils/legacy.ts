import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Reads a file from `public/legacy/` in dev, or `.output/public/legacy/` in production.
 *
 * This keeps the designer's HTML completely untouched while still allowing Nuxt/Nitro
 * to serve it at nice root URLs (e.g. `/daycare.html`).
 */
export async function readLegacyHtml(filename: string): Promise<string> {
  const devPath = join(process.cwd(), "public", "legacy", filename);
  const prodPath = join(process.cwd(), ".output", "public", "legacy", filename);

  try {
    return await readFile(devPath, "utf-8");
  } catch {
    return await readFile(prodPath, "utf-8");
  }
}
