
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Ensure /ads.txt is always accessible at the root, even with
 * catch-all routes like server/routes/[page].get.ts present.
 *
 * Reads from:
 *   - public/ads.txt        (dev)
 *   - .output/public/ads.txt (production build)
 */
export default defineEventHandler(async (event) => {
  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  const devPath = join(process.cwd(), "public", "ads.txt");
  const prodPath = join(process.cwd(), ".output", "public", "ads.txt");

  let txt: string | null = null;
  let source: string | null = null;

  try {
    txt = await readFile(devPath, "utf8");
    source = devPath;
  } catch {
    try {
      txt = await readFile(prodPath, "utf8");
      source = prodPath;
    } catch {
      txt = null;
      source = null;
    }
  }

  if (!txt) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.warn("[ads] ads.txt not found in public/ or .output/public/", {
        devPath,
        prodPath,
      });
    }

    throw createError({
      statusCode: 404,
      statusMessage: "ads.txt not found",
    });
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[ads] Serving ads.txt", {
      source,
      length: txt.length,
    });
  }

  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  return txt;
});
