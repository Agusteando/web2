import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serve ANY root-level /<page>.html from public/legacy/<page>.html
 *
 * Examples:
 *   /daycare.html -> public/legacy/daycare.html
 *   /preschool.html -> public/legacy/preschool.html
 *
 * Does NOT serve:
 *   / (handled by server/routes/index.get.ts in your working commit)
 *   /index.html (redirected by server/routes/index.html.get.ts)
 */
export default defineEventHandler(async (event) => {
  const page = getRouterParam(event, "page") || "";

  // Only handle .html
  if (!page.endsWith(".html")) return;

  // Let the explicit route handle this (and keep behavior consistent).
  if (page === "index.html") {
    return sendRedirect(event, "/", 302);
  }

  // Prevent traversal like ../../etc/passwd
  if (page.includes("/") || page.includes("\\") || page.includes("..")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid page name" });
  }

  const devPath = path.resolve(process.cwd(), "public", "legacy", page);
  const prodPath = path.resolve(process.cwd(), ".output", "public", "legacy", page);

  let html: string | null = null;

  try {
    html = await readFile(devPath, "utf8");
  } catch {
    try {
      html = await readFile(prodPath, "utf8");
    } catch {
      html = null;
    }
  }

  if (html == null) {
    throw createError({ statusCode: 404, statusMessage: `Legacy page not found: ${page}` });
  }

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return html;
});
