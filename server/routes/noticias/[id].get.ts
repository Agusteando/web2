import { fetchNoticiaById } from "~/server/utils/news";
import { escapeHtml, formatFechaEsMX, normalizeImageSrc } from "~/server/utils/format";

function wrapHtml(body: string, title: string) {
  // minimal doc that still loads your existing CSS so it doesn't look broken.
  // You can later replace this with the real designer detail template.
  return `<!doctype html>
<html class="no-js" lang="zxx">
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <base href="/" />
  <link rel="stylesheet" href="/assets/css/bootstrap.css">
  <link rel="stylesheet" href="/assets/css/swiper-bundle.css">
  <link rel="stylesheet" href="/assets/css/magnific-popup.css">
  <link rel="stylesheet" href="/assets/css/font-awesome-pro.css">
  <link rel="stylesheet" href="/assets/css/spacing.css">
  <link rel="stylesheet" href="/assets/css/atropos.min.css">
  <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body class="tp-magic-cursor loaded">
  <div class="container pt-80 pb-80">
    ${body}
  </div>
  <script src="/assets/js/vendor/jquery.js"></script>
  <script src="/assets/js/bootstrap-bundle.js"></script>
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid noticia id" });
  }

  const noticia = await fetchNoticiaById(id);
  if (!noticia) {
    throw createError({ statusCode: 404, statusMessage: "Noticia not found" });
  }

  const title = noticia.titulo || `Noticia ${id}`;
  const fecha = formatFechaEsMX(noticia.fecha);
  const img = normalizeImageSrc(noticia.imagen);

  const body = `
    <a href="/" class="tp-btn-md tp-bg-theme-1 tp-left-right p-relative hover-text-white d-inline-block tp-text-grey-5 lh-1 fs-16 fw-700 tp-ff-dm mb-30">
      <span class="mr10 td-text d-inline-block mr-5">← Volver</span>
    </a>

    <h1 class="tp-ff-familjen tp-text-common-black-5">${escapeHtml(title)}</h1>
    <p class="tp-ff-dm tp-text-grey-7">${escapeHtml(fecha)}</p>
    ${img ? `<img src="${img}" alt="" style="max-width:100%;border-radius:16px;margin:20px 0;">` : ""}
    <div class="tp-ff-dm tp-text-common-black-6" style="white-space:pre-wrap;">${escapeHtml(noticia.contenido || "")}</div>
  `;

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return wrapHtml(body, title);
});
