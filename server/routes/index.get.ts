import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchNoticias } from "~/server/utils/news";
import { escapeHtml, formatFechaEsMX, normalizeImageSrc } from "~/server/utils/format";

function renderPostCol(opts: {
  id: number;
  fechaText: string;
  titulo: string;
  href: string;
  imgSrc: string;
  fadeFrom: "left" | "bottom" | "right";
}): string {
  // SVG copied from your original markup (keeps sizing/appearance identical).
  const dateSvg = `
    <svg class="mr-5" width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 12.0683C0.000926244 12.8416 0.308512 13.5829 0.855289 14.1297C1.40207 14.6765 2.14339 14.984 2.91665 14.985H11.0833C11.8565 14.984 12.5978 14.6765 13.1446 14.1297C13.6914 13.5829 13.999 12.8416 13.9999 12.0683V6.81836H0V12.0683Z" fill="currentColor" />
      <path d="M11.0833 2.15201H10.4999V1.56868C10.4999 1.41397 10.4385 1.2656 10.3291 1.1562C10.2197 1.04681 10.0713 0.985352 9.9166 0.985352C9.76189 0.985352 9.61352 1.04681 9.50412 1.1562C9.39473 1.2656 9.33327 1.41397 9.33327 1.56868V2.15201H4.66663V1.56868C4.66663 1.41397 4.60518 1.2656 4.49578 1.1562C4.38639 1.04681 4.23801 0.985352 4.0833 0.985352C3.9286 0.985352 3.78022 1.04681 3.67083 1.1562C3.56143 1.2656 3.49998 1.41397 3.49998 1.56868V2.15201H2.91665C2.14339 2.15294 1.40207 2.46052 0.855289 3.0073C0.308512 3.55407 0.000926244 4.29539 0 5.06865V5.65198H13.9999V5.06865C13.999 4.29539 13.6914 3.55407 13.1446 3.0073C12.5978 2.46052 11.8565 2.15294 11.0833 2.15201Z" fill="currentColor" />
      <path d="M11.0834 3.31836H10.5V3.90169C10.5 4.0564 10.4386 4.20477 10.3292 4.31416C10.2198 4.42356 10.0714 4.48502 9.91671 4.48502C9.76201 4.48502 9.61363 4.42356 9.50424 4.31416C9.39484 4.20477 9.33339 4.0564 9.33339 3.90169V3.31836H4.66674V3.90169C4.66674 4.0564 4.60528 4.20477 4.49589 4.31416C4.38649 4.42356 4.23812 4.48502 4.08341 4.48502C3.9287 4.48502 3.78033 4.42356 3.67094 4.31416C3.56154 4.20477 3.50008 4.0564 3.50008 3.90169V3.31836H2.91675C2.45278 3.31891 2.00797 3.50344 1.6799 3.83151C1.35184 4.15957 1.1673 4.60439 1.16675 5.06836V5.65169H12.8334V5.06836C12.8328 4.60439 12.6483 4.15957 12.3202 3.83151C11.9922 3.50344 11.5474 3.31891 11.0834 3.31836Z" fill="currentColor" />
    </svg>
  `;

  const safeTitle = escapeHtml(opts.titulo);
  const safeDate = escapeHtml(opts.fechaText);

  return `
    <div class="col-xl-4 col-lg-6 col-md-6 tp_fade_anim" data-delay=".4" data-fade-from="${opts.fadeFrom}" data-ease="bounce">
      <div class="tp-blog-ai-item tp-blog-md-item tp--hover-item tp-round-24 mb-30">
        <a href="${opts.href}" class="tp-round-24 w-100 fix p-relative d-inline-block">
          <div class="tp-blog-ai-thumb w-100 tp--hover-img tp-round-24" data-displacement="assets/img/imghover/stripe-mul.png" data-intensity="0.2" data-speedin="1" data-speedout="1">
            <img class="tp-round-24 w-100" src="${opts.imgSrc}" alt="">
          </div>
        </a>
        <div class="tp-blog-ai-content tp-blog-md-content text-center">
          <div class="tp-blog-md-dates">
            <span class="tp-ff-dm mb-5 fw-500 fs-16 tp-text-common-black-5 d-inline-block">
              ${dateSvg}
              ${safeDate}
            </span>
          </div>
          <h4 class="tp-blog-md-title tp-ff-familjen fs-42 lh-1 ls-m-4 tp-text-common-black-5 mb-25">
            <a href="${opts.href}" class="underline-white">${safeTitle}</a>
          </h4>
          <a href="${opts.href}" class="tp-left-right p-relative hover-text-black d-inline-block text-uppercase tp-text-common-black-5 lh-1 fs-16 fw-700 tp-ff-dm">
            <span class="td-text d-inline-block mr-5">Descubre más</span>
            <span class="tp-arrow-angle">
              <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 11L12 1M12 1H3.44444M12 1V8.77778" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path d="M1 11L12 1M12 1H3.44444M12 1V8.77778" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </div>
  `;
}

export default defineEventHandler(async (event) => {
  const tplPathDev = join(process.cwd(), "public", "legacy", "index.html");
const tplPathProd = join(process.cwd(), ".output", "public", "legacy", "index.html");
const tplPath = await (async () => {
  try {
    await readFile(tplPathDev, "utf-8");
    return tplPathDev;
  } catch {}
  return tplPathProd;
})();

const html = await readFile(tplPath, "utf-8");

  // Fetch latest 3 noticias
  const noticias = await fetchNoticias(3);

  const $ = load(html, { decodeEntities: false });

  // Locate the blog section and the posts row (2nd direct .row inside the container)
  const blogArea = $(".tp-blog-area").first();
  if (blogArea.length) {
    const container = blogArea.find(".container-fluid.container-1824").first();
    const rows = container.children(".row");
    const postsRow = rows.eq(1);

    if (postsRow.length) {
      const fallbacks = [
        "assets/img/IECS-IEDIS IMAGES/ex-news-578x433.webp",
        "assets/img/IECS-IEDIS IMAGES/ex-news2-578x433.webp",
        "assets/img/IECS-IEDIS IMAGES/ex-news3-578x433.webp"
      ];
      const fades: Array<"left" | "bottom" | "right"> = ["left", "bottom", "right"];

      const items = (noticias || []).slice(0, 3).map((n, i) => {
        const img = normalizeImageSrc(n.imagen) || fallbacks[i] || fallbacks[0];
        const fechaText = formatFechaEsMX(n.fecha);
        const href = `/noticias/${n.id}`;
        return renderPostCol({
          id: n.id,
          fechaText,
          titulo: n.titulo,
          href,
          imgSrc: img,
          fadeFrom: fades[i] || "bottom"
        });
      });

      // If there are fewer than 3 news, keep remaining original columns to preserve layout.
      postsRow.html(items.join(""));
    }
  }

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return $.html();
});
