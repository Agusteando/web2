import { fetchNoticias } from "~/server/utils/news";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const limit = q.limit ? Number(q.limit) : undefined;
  const rows = await fetchNoticias(Number.isFinite(limit) ? limit : undefined);

  const cfg = useRuntimeConfig();
  const siteUrl = String(cfg.public.siteUrl || "").replace(/\/+$/, "");

  return rows.map((r) => ({
    ...r,
    fb: `${siteUrl}/noticias/${r.id}`
  }));
});
