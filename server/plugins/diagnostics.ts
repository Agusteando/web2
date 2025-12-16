
import { randomBytes } from "node:crypto";

/**
 * Lightweight request/response diagnostics.
 *
 * Enable with: DEBUG_LEGACY=1
 *
 * Logs to the server console and adds headers:
 *   x-diag-id, x-diag-ms, x-diag-bytes, x-diag-path
 */
export default defineNitroPlugin((nitro) => {
  const enabled =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  if (!enabled) return;

  nitro.hooks.hook("request", (event) => {
    const id = randomBytes(4).toString("hex");

    if (!event.context) {
      (event as any).context = {};
    }

    (event.context as any).__diag = { id, t0: Date.now() };

    const url = event.node.req.url || "/";
    const method = event.node.req.method || "GET";

    // Reduce noise a bit: still log everything, but make it readable.
    // eslint-disable-next-line no-console
    console.log(`[diag ${id}] -> ${method} ${url}`);
  });

  nitro.hooks.hook("beforeResponse", (event, res) => {
    const ctx = (event as any)?.context;
    const diag = ctx?.__diag;
    if (!diag) return;

    const ms = Date.now() - (diag.t0 || Date.now());
    const status = event.node.res.statusCode;

    const body = (res as any).body;
    let bytes = 0;
    try {
      if (typeof body === "string") bytes = Buffer.byteLength(body);
      else if (body && Buffer.isBuffer(body)) bytes = body.length;
      else if (body && typeof body === "object") bytes = Buffer.byteLength(JSON.stringify(body));
    } catch {
      bytes = 0;
    }

    const path = event.node.req.url || "/";
    setHeader(event, "x-diag-id", String(diag.id));
    setHeader(event, "x-diag-ms", String(ms));
    setHeader(event, "x-diag-bytes", String(bytes));
    setHeader(event, "x-diag-path", String(path));

    // eslint-disable-next-line no-console
    console.log(`[diag ${diag.id}] <- ${status} ${ms}ms bytes=${bytes}`);
  });

  nitro.hooks.hook("error", (error, event) => {
    const ctx = event ? (event as any).context : undefined;
    const diag = ctx?.__diag;
    const id = diag?.id ?? "????";
    const url = event?.node?.req?.url ?? "(no-url)";

    // eslint-disable-next-line no-console
    console.error(`[diag ${id}] !! ERROR on ${url}\n`, error);
  });
});
