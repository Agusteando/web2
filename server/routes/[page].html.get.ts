import { readFile } from "fs/promises";
import path from "path";

export default defineEventHandler(async (event) => {
  const page = getRouterParam(event, "page");
  if (!page.endsWith(".html")) return; // skip non-HTML
  if (page === "index.html") return;   // let index.get.ts handle it

  const filePath = path.resolve(`public/legacy/${page}`);
  try {
    const html = await readFile(filePath, "utf8");
    setHeader(event, "Content-Type", "text/html; charset=utf-8");
    return html;
  } catch {
    throw createError({ statusCode: 404, statusMessage: `Page ${page} not found` });
  }
});
