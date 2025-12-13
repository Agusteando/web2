export function formatFechaEsMX(input: unknown): string {
  // Handles: Date, ISO string, mysql datetime strings
  const s = typeof input === "string" ? input : String(input ?? "");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(d);
  } catch {
    // Fallback
    return d.toISOString().slice(0, 10);
  }
}

export function normalizeImageSrc(imagen: string | null | undefined): string | null {
  if (!imagen) return null;
  const img = String(imagen).trim();
  if (!img) return null;
  // Leave absolute URLs untouched
  if (/^https?:\/\//i.test(img)) return img;
  // Leave root-relative and relative paths untouched (base href in HTML handles it)
  return img;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
