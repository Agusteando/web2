import { getRequestURL, setHeader } from "h3";
import { getAdConfig, getAdDashboardStats } from "~/server/utils/adsDb";
import { assertAdsDashboardAccess } from "~/server/utils/ads";

export default defineEventHandler(async (event) => {
  await assertAdsDashboardAccess(event);

  const config = await getAdConfig();
  const stats = await getAdDashboardStats();
  const url = getRequestURL(event);

  const globalEnabled = config.global_ads_enabled === 1;
  const daycareEnabled = config.ads_for_daycare === 1;
  const organicEnabled = config.ads_for_organic === 1;

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ads Control Dashboard · IECS-IEDIS</title>
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f172a;
      --bg-alt: #111827;
      --card-bg: #020617;
      --border: #1f2937;
      --accent: #22c55e;
      --accent-soft: rgba(34,197,94,0.15);
      --text: #f9fafb;
      --muted: #9ca3af;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 1.5rem;
      background: radial-gradient(circle at top, #1d2939 0, #020617 40%);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .page {
      max-width: 64rem;
      margin: 0 auto;
    }
    h1, h2, h3, h4 {
      margin: 0 0 0.75rem 0;
      line-height: 1.1;
    }
    p {
      margin: 0 0 0.75rem 0;
      line-height: 1.5;
    }
    .card {
      background: radial-gradient(circle at top left, var(--bg-alt) 0, var(--card-bg) 60%);
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
    }
    .card-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(15,23,42,0.8);
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .badge-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--accent);
    }
    .badge-danger .badge-dot {
      background: var(--danger);
    }
    .badge-danger {
      border-color: rgba(239,68,68,0.35);
      background: rgba(127,29,29,0.6);
      color: #fecaca;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
    }
    @media (min-width: 48rem) {
      .grid-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .grid-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .stat-label {
      font-size: 0.9rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .table th,
    .table td {
      padding: 0.5rem 0.25rem;
      border-bottom: 1px solid var(--border);
      text-align: left;
      white-space: nowrap;
    }
    .table th {
      font-weight: 500;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.8rem;
    }
    .table tr:last-child td {
      border-bottom: none;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.2rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .pill-on {
      background: var(--accent-soft);
      color: #bbf7d0;
    }
    .pill-off {
      background: rgba(15,23,42,0.9);
      color: var(--muted);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-row {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    @media (min-width: 40rem) {
      .form-row-inline {
        flex-direction: row;
        align-items: center;
        gap: 1rem;
      }
    }
    label {
      font-size: 0.9rem;
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      accent-color: var(--accent);
    }
    input[type="number"] {
      background: rgba(15,23,42,0.9);
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.35rem 0.6rem;
      font-size: 0.9rem;
      max-width: 6rem;
    }
    input[type="number"]:focus {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
      border-color: transparent;
    }
    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      justify-content: flex-start;
    }
    button[type="submit"] {
      border-radius: 9999px;
      border: none;
      padding: 0.5rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      background: var(--accent);
      color: #052e16;
      box-shadow: 0 0.25rem 1rem rgba(22,163,74,0.4);
    }
    button[type="submit"]:hover {
      filter: brightness(1.06);
    }
    .hint {
      font-size: 0.8rem;
      color: var(--muted);
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="card-header">
        <div class="badge">
          <span class="badge-dot"></span>
          <span>/ads · Control de anuncios</span>
        </div>
        <h1>Ads Control Dashboard</h1>
        <p class="hint">
          Esta herramienta es <strong>solo para uso interno</strong>. No compartas esta URL.
          Todas las decisiones de anuncios pasan por esta configuración.
        </p>
        <p class="hint">
          Host actual: <code>${url.hostname}</code>
        </p>
      </div>
      <div class="grid grid-3">
        <div class="stat">
          <span class="stat-label">Visitas totales</span>
          <span class="stat-value">${stats.totalVisits}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Elegibles (post-segmentación)</span>
          <span class="stat-value">${stats.totalEligible}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Anuncios renderizados</span>
          <span class="stat-value">${stats.totalRendered}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Configuración actual</h2>
      </div>
      <div class="grid grid-2">
        <div class="stat">
          <span class="stat-label">Switch global</span>
          <span class="pill ${globalEnabled ? "pill-on" : "pill-off"}">
            ${globalEnabled ? "ON · anuncios habilitados" : "OFF · anuncios detenidos"}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Rollout porcentaje</span>
          <span class="stat-value">${config.rollout_percentage}%</span>
        </div>
      </div>
      <div style="margin-top: 1rem;">
        <table class="table">
          <thead>
            <tr>
              <th>Segmento</th>
              <th>Visitas</th>
              <th>Elegibles</th>
              <th>Renderizados</th>
            </tr>
          </thead>
          <tbody>
            ${stats.bySegment
              .map(
                (row) => `
              <tr>
                <td>${row.user_segment}</td>
                <td>${row.visits}</td>
                <td>${row.eligible}</td>
                <td>${row.rendered}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Editar configuración</h2>
        <p class="hint">
          Los cambios se aplican de inmediato a todas las páginas que usen el motor
          de decisión (actualmente, la página principal index.html).
        </p>
      </div>
      <form method="post" action="/ads">
        <div class="grid">
          <div class="form-row">
            <label>
              <input type="checkbox" name="global_ads_enabled" value="1" ${globalEnabled ? "checked" : ""} />
              Activar anuncios globalmente
            </label>
            <p class="hint">
              Kill switch principal. En <strong>OFF</strong> no se inyecta ningún contenedor de anuncios,
              aunque la segmentación y elegibilidad se sigan registrando para análisis.
            </p>
          </div>

          <div class="form-row">
            <label>
              <input type="checkbox" name="ads_for_daycare" value="1" ${daycareEnabled ? "checked" : ""} />
              Permitir anuncios para segmento <code>daycare</code>
            </label>
            <label>
              <input type="checkbox" name="ads_for_organic" value="1" ${organicEnabled ? "checked" : ""} />
              Permitir anuncios para segmento <code>organic</code>
            </label>
            <p class="hint">
              Los segmentos <code>internal</code> y <code>premium</code> tienen bloqueo duro y nunca verán anuncios.
            </p>
          </div>

          <div class="form-row form-row-inline">
            <div>
              <label for="rollout_percentage">Rollout porcentaje</label>
            </div>
            <div>
              <input
                id="rollout_percentage"
                name="rollout_percentage"
                type="number"
                min="0"
                max="100"
                value="${config.rollout_percentage}"
              />
              <p class="hint">
                Gating por <code>visitor_id</code> usando hash % 100. Ejemplo: 5 = 5% de los visitantes elegibles.
              </p>
            </div>
          </div>
        </div>

        <div class="btn-row">
          <button type="submit">Guardar cambios</button>
          <p class="hint">
            Fases recomendadas:
            <br />
            · Fase 0 (SOAK): <strong>global OFF</strong>, ajusta rollout y segmentación para medir elegibilidad.
            <br />
            · Fase 1 (SOFT LAUNCH): <strong>global ON</strong>, rollout 5–10%, contenedor placeholder (sin AdSense).
            <br />
            · Fase 2 (SCALE): incrementa rollout gradualmente y reemplaza el placeholder por un bloque AdSense.
          </p>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="badge badge-danger">
          <span class="badge-dot"></span>
          <span>Notas importantes</span>
        </div>
      </div>
      <ul class="hint">
        <li>Los segmentos <code>internal</code> y <code>premium</code> nunca reciben anuncios, sin excepción.</li>
        <li>Las cookies de segmentación se comparten en el dominio <code>.casitaiedis.edu.mx</code> y persisten tras logout.</li>
        <li>No implementes ocultado de anuncios por CSS ni toggles en el cliente: todo debe pasar por este panel.</li>
        <li>Para desactivar todo al instante, pon <code>global_ads_enabled = 0</code> o usa el env kill switch.</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return html;
});
