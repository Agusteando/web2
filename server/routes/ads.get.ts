
import { getRequestURL, setHeader } from "h3";
import { getAdConfig, getAdDashboardStats } from "~/server/utils/adsDb";
import { assertAdsDashboardAccess } from "~/server/utils/ads";

export default defineEventHandler(async (event) => {
  await assertAdsDashboardAccess(event);

  const config = await getAdConfig();
  const stats = await getAdDashboardStats();
  const url = getRequestURL(event);

  const globalEnabled = config.global_ads_enabled === 1;
  const internalEnabled = config.ads_for_internal === 1;
  const premiumEnabled = config.ads_for_premium === 1;
  const daycareEnabled = config.ads_for_daycare === 1;
  const organicEnabled = config.ads_for_organic === 1;

  type SegmentKey = "internal" | "premium" | "daycare" | "organic";

  const segmentDefs: Array<{
    key: SegmentKey;
    inputName: string;
    label: string;
    description: string;
  }> = [
    {
      key: "daycare",
      inputName: "ads_for_daycare",
      label: "guardería (login.php, usuario ≠ 6 caracteres)",
      description: "Padres y madres con cuentas de guardería. Suele ser el primer grupo recomendado para iniciar.",
    },
    {
      key: "organic",
      inputName: "ads_for_organic",
      label: "tráfico orgánico (sin login)",
      description: "Visitantes que nunca han iniciado sesión en este navegador.",
    },
    {
      key: "premium",
      inputName: "ads_for_premium",
      label: "familias particulares (login.php, usuario de 6 caracteres)",
      description: "Familias premium con mensualidad. Habilita con cuidado cuando ya tengas confianza en el sistema.",
    },
    {
      key: "internal",
      inputName: "ads_for_internal",
      label: "staff interno (/login con Google)",
      description: "Equipo interno y personal administrativo. Útil para revisiones internas o pruebas.",
    },
  ];

  const bySegmentIndex: Record<
    SegmentKey,
    { visits: number; eligible: number; rendered: number }
  > = {
    internal: { visits: 0, eligible: 0, rendered: 0 },
    premium: { visits: 0, eligible: 0, rendered: 0 },
    daycare: { visits: 0, eligible: 0, rendered: 0 },
    organic: { visits: 0, eligible: 0, rendered: 0 },
  };

  for (const row of stats.bySegment) {
    const key = row.user_segment as SegmentKey;
    if (bySegmentIndex[key]) {
      bySegmentIndex[key] = {
        visits: row.visits,
        eligible: row.eligible,
        rendered: row.rendered,
      };
    }
  }

  const segmentEnabled: Record<SegmentKey, boolean> = {
    internal: internalEnabled,
    premium: premiumEnabled,
    daycare: daycareEnabled,
    organic: organicEnabled,
  };

  const segmentCardsHtml = segmentDefs
    .map((seg) => {
      const metrics = bySegmentIndex[seg.key];
      const enabled = segmentEnabled[seg.key];
      const cardStateClass = enabled ? "segment-on" : "segment-off";
      const statusText = enabled ? "Segmento activo" : "Segmento apagado";
      const statusDetail = enabled
        ? "Puede recibir anuncios cuando el kill switch global está en ON."
        : "No recibe anuncios mientras este segmento esté en OFF.";

      return `
        <label class="segment-card ${cardStateClass}">
          <input
            type="checkbox"
            name="${seg.inputName}"
            value="1"
            class="segment-input"
            ${enabled ? "checked" : ""}
          />
          <div class="segment-content">
            <div class="segment-header">
              <div class="segment-title-wrap">
                <span class="segment-badge">
                  <span class="segment-dot"></span>
                  <span class="segment-status-text">${statusText}</span>
                </span>
                <span class="segment-title">
                  <code>${seg.key}</code> · ${seg.label}
                </span>
              </div>
              <span class="segment-status-detail">${statusDetail}</span>
            </div>
            <p class="segment-desc">
              ${seg.description}
            </p>
            <div class="segment-metrics">
              <div class="metric">
                <span class="metric-label">Visitas</span>
                <span class="metric-value">${metrics.visits}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Elegibles</span>
                <span class="metric-value">${metrics.eligible}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Con anuncio</span>
                <span class="metric-value">${metrics.rendered}</span>
              </div>
            </div>
          </div>
        </label>
      `;
    })
    .join("");

  const killStatusText = globalEnabled ? "Anuncios ACTIVADOS" : "Anuncios DETENIDOS";
  const killSubtitle = globalEnabled
    ? "Los segmentos activos pueden recibir bloques de AdSense."
    : "No se inyectarán bloques de AdSense hasta reactivar este switch.";

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ads Control Dashboard · IECS-IEDIS</title>
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --bg: #020617;
      --bg-elevated: #020617;
      --bg-soft: #0b1120;
      --border-subtle: rgba(148, 163, 184, 0.25);
      --border-strong: rgba(148, 163, 184, 0.5);
      --accent: #22c55e;
      --accent-soft: rgba(34, 197, 94, 0.18);
      --accent-strong: #16a34a;
      --danger: #ef4444;
      --danger-soft: rgba(248, 113, 113, 0.16);
      --text: #e5e7eb;
      --text-soft: #9ca3af;
      --text-subtle: #6b7280;
      --surface-radius: 0.75rem;
      --shadow-soft: 0 0.5rem 1.75rem rgba(15, 23, 42, 0.8);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 1.5rem;
      background: radial-gradient(circle at top, #1f2937 0, #020617 50%);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 1rem;
      line-height: 1.5;
    }

    .page {
      max-width: 70rem;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-radius: var(--surface-radius);
      border: 0.0625rem solid var(--border-subtle);
      background: radial-gradient(circle at top left, #111827 0, #020617 60%);
      box-shadow: var(--shadow-soft);
    }

    .page-header-top {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 999rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(15, 23, 42, 0.9);
      border: 0.0625rem solid var(--border-subtle);
      color: var(--text-soft);
    }

    .badge-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 999rem;
      background: var(--accent);
    }

    h1 {
      margin: 0;
      font-size: 1.6rem;
      letter-spacing: -0.03em;
    }

    .page-header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .meta-item {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }

    .meta-label {
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      margin-right: 0.35rem;
      color: var(--text-soft);
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.8em;
      padding: 0.08rem 0.3rem;
      border-radius: 0.4rem;
      background: rgba(15, 23, 42, 0.8);
      border: 0.0625rem solid rgba(148, 163, 184, 0.35);
      color: #cbd5f5;
    }

    .section {
      padding: 1.25rem 1.5rem;
      border-radius: var(--surface-radius);
      border: 0.0625rem solid var(--border-subtle);
      background: var(--bg-soft);
      box-shadow: var(--shadow-soft);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .section-header {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .section-title {
      margin: 0;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }

    .section-subtitle {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-subtle);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .stat-card {
      border-radius: 0.75rem;
      border: 0.0625rem solid var(--border-subtle);
      background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.95) 0, #020617 70%);
      padding: 0.75rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.09em;
    }

    .stat-value {
      font-size: 1.2rem;
      font-weight: 600;
    }

    .stat-note {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }

    .kill-container {
      border-radius: 1rem;
      padding: 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      border: 0.0625rem solid var(--border-strong);
      background: radial-gradient(circle at top, rgba(34, 197, 94, 0.18) 0, rgba(15, 23, 42, 0.9) 55%);
    }

    .kill-container.kill-off {
      background: radial-gradient(circle at top, rgba(239, 68, 68, 0.16) 0, rgba(15, 23, 42, 0.9) 55%);
    }

    .kill-inner {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      align-items: flex-start;
      cursor: pointer;
    }

    .kill-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
    }

    .kill-text {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .kill-title {
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .kill-container.kill-on .kill-title {
      color: #bbf7d0;
    }

    .kill-container.kill-off .kill-title {
      color: #fecaca;
    }

    .kill-subtitle {
      font-size: 0.85rem;
      color: var(--text-soft);
    }

    .kill-toggle-wrap {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
    }

    .kill-label {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--text-soft);
    }

    .kill-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
    }

    .kill-input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .kill-track {
      width: 4.5rem;
      height: 2.2rem;
      border-radius: 999rem;
      background: rgba(15, 23, 42, 0.9);
      border: 0.09375rem solid rgba(148, 163, 184, 0.75);
      display: flex;
      align-items: center;
      padding: 0 0.25rem;
      box-shadow: inset 0 0.15rem 0.4rem rgba(0, 0, 0, 0.6);
      transition: background-color 0.2s ease, border-color 0.2s ease;
      position: relative;
    }

    .kill-thumb {
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 999rem;
      background: #f9fafb;
      box-shadow: 0 0.25rem 0.6rem rgba(15, 23, 42, 0.8);
      transform: translateX(0);
      transition: transform 0.2s ease, background-color 0.2s ease;
    }

    .kill-container.kill-on .kill-track {
      background: var(--accent);
      border-color: var(--accent-strong);
    }

    .kill-container.kill-on .kill-thumb {
      transform: translateX(2.1rem);
      background: #ecfdf3;
    }

    .kill-container.kill-off .kill-track {
      background: rgba(31, 41, 55, 0.9);
      border-color: rgba(148, 163, 184, 0.8);
    }

    .section-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .segment-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.75rem;
    }

    .segment-card {
      border-radius: 0.85rem;
      border: 0.0625rem solid var(--border-subtle);
      background: rgba(15, 23, 42, 0.9);
      padding: 0.9rem 1rem;
      display: flex;
      flex-direction: row;
      gap: 0.75rem;
      cursor: pointer;
    }

    .segment-card.segment-on {
      background: radial-gradient(circle at top left, var(--accent-soft) 0, rgba(15, 23, 42, 0.98) 55%);
      border-color: rgba(34, 197, 94, 0.6);
    }

    .segment-card.segment-off {
      background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98) 0, #020617 60%);
      border-color: rgba(148, 163, 184, 0.45);
    }

    .segment-input {
      margin: 0;
      margin-top: 0.2rem;
      flex-shrink: 0;
      width: 1.15rem;
      height: 1.15rem;
      accent-color: var(--accent);
    }

    .segment-content {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      width: 100%;
    }

    .segment-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .segment-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    @media (min-width: 40rem) {
      .segment-title-wrap {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
    }

    .segment-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.15rem 0.6rem;
      border-radius: 999rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 0.0625rem solid rgba(148, 163, 184, 0.6);
      background: rgba(15, 23, 42, 0.9);
      color: var(--text-soft);
    }

    .segment-card.segment-on .segment-badge {
      border-color: rgba(34, 197, 94, 0.9);
      background: rgba(22, 163, 74, 0.2);
      color: #bbf7d0;
    }

    .segment-dot {
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 999rem;
      background: rgba(148, 163, 184, 0.9);
    }

    .segment-card.segment-on .segment-dot {
      background: var(--accent);
    }

    .segment-status-text {
      font-weight: 600;
    }

    .segment-title {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .segment-status-detail {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }

    .segment-desc {
      margin: 0;
      font-size: 0.8rem;
      color: var(--text-soft);
    }

    .segment-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      margin-top: 0.15rem;
    }

    .metric {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric-value {
      font-size: 0.95rem;
      font-weight: 600;
    }

    .hint {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }

    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      align-items: center;
    }

    button[type="submit"] {
      border-radius: 999rem;
      border: none;
      padding: 0.55rem 1.6rem;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      background: var(--accent);
      color: #052e16;
      box-shadow: 0 0.35rem 1.4rem rgba(22, 163, 74, 0.55);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    button[type="submit"]:hover {
      filter: brightness(1.06);
    }

    .btn-secondary {
      background: transparent;
      color: #bbf7d0;
      border: 0.0625rem solid rgba(34, 197, 94, 0.8);
      box-shadow: none;
    }

    .btn-secondary:hover {
      background: rgba(22, 163, 74, 0.18);
    }

    .preset-row {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    @media (min-width: 48rem) {
      .stats-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .segment-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .kill-inner {
        flex-direction: column;
      }
    }

    @media (min-width: 60rem) {
      .segment-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="page-header-top">
        <div class="badge">
          <span class="badge-dot"></span>
          <span>/ads · Panel de control de anuncios</span>
        </div>
        <h1>Control en tiempo real de anuncios</h1>
        <p class="hint">
          Ajusta el kill switch global, la matriz de segmentos y los presets de forma segura.
          No hay lógica oculta en el cliente: todo pasa por este panel del servidor.
        </p>
      </div>
      <div class="page-header-meta">
        <div class="meta-item">
          <span class="meta-label">Host</span>
          <code>${url.hostname}</code>
        </div>
        <div class="meta-item">
          <span class="meta-label">Total visitas</span>
          <span>${stats.totalVisits}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Elegibles</span>
          <span>${stats.totalEligible}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Con anuncio</span>
          <span>${stats.totalRendered}</span>
        </div>
      </div>
    </header>

    <form method="post" action="/ads" class="page-form">
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Kill switch global</h2>
          <p class="section-subtitle">
            Corte maestro inmediato de todos los anuncios. Este es el control de pánico:
            si se apaga, ningún visitante recibirá bloques de AdSense.
          </p>
        </div>
        <div class="section-body">
          <div class="kill-container ${globalEnabled ? "kill-on" : "kill-off"}">
            <label class="kill-inner">
              <div class="kill-row">
                <div class="kill-text">
                  <span class="kill-title">${killStatusText}</span>
                  <span class="kill-subtitle">${killSubtitle}</span>
                </div>
                <div class="kill-toggle-wrap">
                  <span class="kill-label">Interruptor maestro</span>
                  <div class="kill-toggle">
                    <input
                      type="checkbox"
                      name="global_ads_enabled"
                      value="1"
                      class="kill-input"
                      ${globalEnabled ? "checked" : ""}
                    />
                    <div class="kill-track">
                      <div class="kill-thumb"></div>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">Visitas totales</span>
              <span class="stat-value">${stats.totalVisits}</span>
              <span class="stat-note">Cada request que pasa por el motor de decisión.</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Elegibles (post-segmentación)</span>
              <span class="stat-value">${stats.totalEligible}</span>
              <span class="stat-note">Segmento activo + sin bloqueo individual.</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Anuncios renderizados</span>
              <span class="stat-value">${stats.totalRendered}</span>
              <span class="stat-note">Solo cuando el kill switch global está en ON.</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Matriz por segmento</h2>
          <p class="section-subtitle">
            Control granular por tipo de usuario. Todo lo que está en ON aquí es potencialmente
            elegible para anuncios cuando el kill switch global está activo.
          </p>
        </div>
        <div class="section-body">
          <div class="segment-grid">
            ${segmentCardsHtml}
          </div>
          <p class="hint">
            Los KPIs por tarjeta muestran cuántas visitas tuvo cada segmento, cuántas fueron
            elegibles y cuántas recibieron realmente un bloque de AdSense.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Acciones rápidas (presets)</h2>
          <p class="section-subtitle">
            Plantillas que ajustan automáticamente la matriz de segmentos y ponen el kill switch global en ON.
          </p>
        </div>
        <div class="section-body preset-row">
          <div class="btn-row">
            <button type="submit" name="preset" value="daycare-only" class="btn-secondary">
              Preset: solo daycare
            </button>
            <button type="submit" name="preset" value="daycare-organic" class="btn-secondary">
              Preset: daycare + orgánico
            </button>
            <button type="submit" name="preset" value="all-segments" class="btn-secondary">
              Preset: todos los segmentos
            </button>
          </div>
          <p class="hint">
            Puedes usar estos presets para avanzar de forma controlada:
            primero solo <code>daycare</code>, luego <code>daycare + organic</code> y,
            cuando haya confianza, habilitar también <code>premium</code> e <code>internal</code>.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Guardar configuración actual</h2>
          <p class="section-subtitle">
            Persiste exactamente el estado actual del kill switch global y de la matriz por segmento.
          </p>
        </div>
        <div class="section-body">
          <div class="btn-row">
            <button type="submit" name="action" value="save">
              Guardar cambios
            </button>
            <p class="hint">
              Los cambios se aplican de inmediato en el servidor. La página principal
              <code>index.html</code> inyectará bloques reales de AdSense solo cuando el motor
              de decisión lo permita.
            </p>
          </div>
        </div>
      </section>
    </form>
  </div>
</body>
</html>`;

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return html;
});
