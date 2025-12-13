/**
 * Preserve designer links like href="index.html".
 * We simply redirect to "/" where your working index injector route serves the page.
 */
export default defineEventHandler((event) => {
  return sendRedirect(event, "/", 302);
});
