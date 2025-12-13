import { fetchNoticiaById } from "~/server/utils/news";

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid noticia id" });
  }

  const row = await fetchNoticiaById(id);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Noticia not found" });
  }

  const cfg = useRuntimeConfig();
  const siteUrl = String(cfg.public.siteUrl || "").replace(/\/+$/, "");

  return { ...row, fb: `${siteUrl}/noticias/${row.id}` };
});
