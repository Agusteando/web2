import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

/**
 * Middleware that serves ANY /<name>.html page from public/legacy/<name>.html
 * while preserving the designer's markup exactly.
 *
 * - Does NOT touch / or /index.html (those are handled by the index injector routes)
 * - Does NOT affect assets (/assets/*, /img/*, etc.)
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Let the existing index routes handle these.
  if (pathname === "/" || pathname === "/index.html") return;

  // Only handle root-level .html files (designer pages).
  if (!pathname.endsWith(".html")) return;
  if (pathname.includes("/")) {
    // pathname always starts with '/', so only allow a single segment like '/daycare.html'
    // i.e. no nested dirs like '/foo/bar.html'
    const trimmed = pathname.replace(/^\//, "");
    if (trimmed.includes("/")) return;
  }

  const filename = pathname.replace(/^\//, "");

  // Prevent directory traversal.
  const safeName = normalize(filename).replace(/^\.(\/|\\)/, "");
  if (safeName !== filename) return;

  const devPath = join(process.cwd(), "public", "legacy", filename);
  const prodPath = join(process.cwd(), ".output", "public", "legacy", filename);

  let html: string | null = null;
  try {
    html = await readFile(devPath, "utf-8");
  } catch {
    try {
      html = await readFile(prodPath, "utf-8");
    } catch {
      html = null;
    }
  }

  if (html == null) return; // fall through to Nuxt's normal 404 handling

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return html;
});
