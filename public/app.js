/**
 * NFL Analytics Engine - Frontend Quant Dashboard Controller (public/app.js)
 *
 * REGLA ESTRICTA DE ARQUITECTURA (AGENTS.md):
 * - PROHIBIDO llamar a la API de ESPN o servicios externos desde el navegador.
 * - Este módulo lee EXCLUSIVAMENTE los archivos JSON estáticos locales generados
 *   por el pipeline de Python en `./data/`:
 *     1. ./data/live_scoreboard.json
 *     2. ./data/player_rankings.json
 *     3. ./data/game_critiques.json
 */

const DATA_ENDPOINTS = Object.freeze({
  scoreboard: './data/live_scoreboard.json',
  rankings: './data/player_rankings.json',
  critiques: './data/game_critiques.json',
});

/** Estado reactivo local de la interfaz */
const appState = {
  scoreboard: null,
  rankings: null,
  critiques: null,
  gameFilter: 'all', // 'all' | 'live' | 'hinge' | 'final'
  positionFilter: 'ALL', // 'ALL' | 'QB' | 'RB' | 'WR' | 'TE'
  searchQuery: '',
  sortColumn: 'impact_score',
  sortDirection: 'desc', // 'asc' | 'desc'
};

/**
 * Reemplaza cualquier guion largo o medio por guion simple (-) cumpliendo AGENTS.md.
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeHyphens(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2015/g, '-')
    .replace(/\u2212/g, '-');
}

/**
 * Escapa caracteres HTML para prevenir inyección al renderizar plantillas.
 * @param {unknown} raw
 * @returns {string}
 */
function escapeHtml(raw) {
  const clean = sanitizeHyphens(raw);
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formatea un número con signo explícito (+ / -).
 * @param {number|string|null|undefined} value
 * @param {number} decimals
 * @param {string} suffix
 * @returns {string}
 */
function formatSigned(value, decimals = 2, suffix = '') {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  const sign = num > 0 ? '+' : '';
  return sanitizeHyphens(`${sign}${num.toFixed(decimals)}${suffix}`);
}

/**
 * Formatea un número estándar con decimales fijos.
 * @param {number|string|null|undefined} value
 * @param {number} decimals
 * @param {string} suffix
 * @returns {string}
 */
function formatNumber(value, decimals = 1, suffix = '') {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return sanitizeHyphens(`${num.toFixed(decimals)}${suffix}`);
}

/**
 * Normaliza una probabilidad en escala [0, 1] o [0, 100] a porcentaje [0, 100].
 * @param {number|string|null|undefined} wp
 * @returns {number}
 */
function toPercentage(wp) {
  const num = Number(wp);
  if (!Number.isFinite(num)) return 50.0;
  const scaled = Math.abs(num) <= 1.0001 ? num * 100.0 : num;
  return Math.max(0.0, Math.min(100.0, scaled));
}

/**
 * Formatea un timestamp ISO-8601 a formato legible UTC/Local.
 * @param {string|null|undefined} isoString
 * @returns {string}
 */
function formatTimestamp(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return sanitizeHyphens(String(isoString));
  return sanitizeHyphens(
    date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  );
}

/**
 * Descarga un archivo JSON estático local sin llamar a ninguna API externa.
 * @param {string} relativePath
 * @returns {Promise<Record<string, any> | null>}
 */
async function fetchLocalJson(relativePath) {
  try {
    const bust = `t=${Date.now()}`;
    const separator = relativePath.includes('?') ? '&' : '?';
    const response = await fetch(`${relativePath}${separator}${bust}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al leer ${relativePath}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`[NFL Analytics Engine] No se pudo cargar ${relativePath}:`, error);
    return null;
  }
}

/* ========================================================================== */
/* 1. RENDERIZADO DEL HEADER EJECUTIVO Y TARJETAS KPI                         */
/* ========================================================================== */

function renderHeaderAndKpis() {
  const rankings = appState.rankings || {};
  const scoreboard = appState.scoreboard || {};
  const critiques = appState.critiques || {};

  const activeSeason =
    rankings.season ||
    scoreboard.season ||
    critiques.season ||
    new Date().getFullYear();
  const requestedSeason = rankings.requested_season || activeSeason;
  const fallbackUsed = Boolean(rankings.fallback_used);
  const fallbackReason = sanitizeHyphens(rankings.fallback_reason || '');

  // Temporada activa
  const seasonBadge = document.getElementById('header-season-badge');
  if (seasonBadge) {
    seasonBadge.textContent = String(activeSeason);
  }

  // Fallback indicator
  const fallbackDot = document.getElementById('header-fallback-dot');
  const fallbackText = document.getElementById('header-fallback-text');
  const statusBanner = document.getElementById('system-status-banner');
  const statusBannerText = document.getElementById('system-status-banner-text');

  if (fallbackUsed) {
    if (fallbackDot) {
      fallbackDot.className = 'h-2 w-2 rounded-full bg-amber-400';
    }
    if (fallbackText) {
      fallbackText.textContent = `Fallback ${requestedSeason} -> ${activeSeason}`;
      fallbackText.className = 'font-mono-num text-[11px] font-semibold text-amber-300';
    }
    if (statusBanner && statusBannerText) {
      statusBanner.classList.remove('hidden');
      statusBannerText.textContent = sanitizeHyphens(
        `Aviso de Calendario nflverse: Se solicito temporada ${requestedSeason} pero se activo fallback automatico a temporada ${activeSeason} (${fallbackReason || 'dataset en pretemporada / HTTP 404'}).`
      );
    }
  } else {
    if (fallbackDot) {
      fallbackDot.className = 'h-2 w-2 rounded-full bg-emerald-400';
    }
    if (fallbackText) {
      fallbackText.textContent = `PBP ${activeSeason} Nominal`;
      fallbackText.className = 'font-mono-num text-[11px] text-emerald-300';
    }
    if (statusBanner) {
      statusBanner.classList.add('hidden');
    }
  }

  // Modo de generación de críticas
  const aiModeEl = document.getElementById('header-ai-mode');
  const modeRaw = sanitizeHyphens(critiques.generation_mode || 'deterministic_template');
  if (aiModeEl) {
    aiModeEl.textContent = modeRaw === 'deterministic_template' ? 'Plantilla Determinista' : modeRaw;
  }

  // Última actualización
  const updatedAtEl = document.getElementById('header-updated-at');
  const latestTimestamp =
    scoreboard.updated_at || rankings.updated_at || critiques.updated_at || null;
  if (updatedAtEl) {
    updatedAtEl.textContent = formatTimestamp(latestTimestamp);
  }

  // KPI 1: MVP Real
  const players = Array.isArray(rankings.players) ? rankings.players : [];
  const mvp = rankings.mvp_real || critiques.mvp_real || players[0] || null;

  const kpiMvpScore = document.getElementById('kpi-mvp-score');
  const kpiMvpName = document.getElementById('kpi-mvp-name');
  const kpiMvpMeta = document.getElementById('kpi-mvp-meta');
  const kpiMvpMetrics = document.getElementById('kpi-mvp-metrics');

  if (mvp && (mvp.player_name || mvp.name)) {
    const mvpName = sanitizeHyphens(mvp.player_name || mvp.name);
    const mvpPos = sanitizeHyphens(mvp.position || 'QB');
    const mvpTeam = sanitizeHyphens(mvp.team || 'NFL');
    if (kpiMvpScore) kpiMvpScore.textContent = `${formatNumber(mvp.impact_score, 1)} / 100`;
    if (kpiMvpName) kpiMvpName.textContent = mvpName;
    if (kpiMvpMeta) kpiMvpMeta.textContent = `${mvpPos} - ${mvpTeam}`;
    if (kpiMvpMetrics) {
      kpiMvpMetrics.textContent = sanitizeHyphens(
        `EPA/jug: ${formatSigned(mvp.epa_per_play, 3)} | WPA: ${formatSigned(mvp.wpa_total, 3)}`
      );
    }
  } else if (kpiMvpName) {
    kpiMvpName.textContent = 'Sin datos';
  }

  // KPI 2: Estadístico Inflado
  const inflated =
    rankings.inflated_stat_leader ||
    critiques.inflated_player ||
    critiques.inflated_stat_leader ||
    null;

  const kpiInfBadge = document.getElementById('kpi-inflated-badge');
  const kpiInfName = document.getElementById('kpi-inflated-name');
  const kpiInfMeta = document.getElementById('kpi-inflated-meta');
  const kpiInfMetrics = document.getElementById('kpi-inflated-metrics');

  if (inflated && (inflated.player_name || inflated.name)) {
    const infName = sanitizeHyphens(inflated.player_name || inflated.name);
    const infPos = sanitizeHyphens(inflated.position || 'QB');
    const infTeam = sanitizeHyphens(inflated.team || 'NFL');
    const infIdx = formatNumber(inflated.inflation_index, 1);
    const gtYards = formatNumber(inflated.garbage_time_yards, 0);
    const epaDelta = formatSigned(inflated.epa_inflation_delta, 2);

    if (kpiInfBadge) kpiInfBadge.textContent = `Indice ${infIdx}`;
    if (kpiInfName) kpiInfName.textContent = infName;
    if (kpiInfMeta) kpiInfMeta.textContent = `${infPos} - ${infTeam}`;
    if (kpiInfMetrics) {
      kpiInfMetrics.textContent = sanitizeHyphens(
        `Yds Basura: ${gtYards} yds | Delta EPA: ${epaDelta}`
      );
    }
  } else if (kpiInfName) {
    kpiInfName.textContent = 'Sin datos';
  }

  // KPI 3 y 4: Partidos Monitoreados y Jugada Bisagra Principal
  const games = Array.isArray(scoreboard.games) ? scoreboard.games : [];
  const kpiGamesWeek = document.getElementById('kpi-games-week');
  const kpiGamesCount = document.getElementById('kpi-games-count');
  const kpiGamesStatus = document.getElementById('kpi-games-status-breakdown');
  const kpiGamesCritical = document.getElementById('kpi-games-critical-total');

  if (kpiGamesWeek) {
    kpiGamesWeek.textContent = `Semana ${scoreboard.week || 1}`;
  }
  if (kpiGamesCount) {
    kpiGamesCount.textContent = String(games.length);
  }

  let liveCount = 0;
  let finalCount = 0;
  let preCount = 0;
  let totalCriticalPlays = 0;
  let topHingeCandidate = null;

  games.forEach((game) => {
    const state = String(game?.status?.state || 'pre').toLowerCase();
    if (state === 'in') liveCount += 1;
    else if (state === 'post' || game?.status?.completed) finalCount += 1;
    else preCount += 1;

    const moments = Array.isArray(game.critical_moments) ? game.critical_moments : [];
    totalCriticalPlays += moments.length;

    const candidate = game.hinge_play || moments[0] || null;
    if (candidate) {
      const absDelta = Math.abs(Number(candidate.abs_delta_wp ?? candidate.delta_wp ?? 0));
      if (!topHingeCandidate || absDelta > topHingeCandidate.absDelta) {
        topHingeCandidate = {
          absDelta,
          play: candidate,
          shortName:
            game.short_name ||
            `${game?.away_team?.abbreviation || 'AWAY'} @ ${game?.home_team?.abbreviation || 'HOME'}`,
        };
      }
    }
  });

  if (kpiGamesStatus) {
    kpiGamesStatus.textContent = sanitizeHyphens(
      `${liveCount} Vivo - ${finalCount} Final - ${preCount} Pre`
    );
  }
  if (kpiGamesCritical) {
    kpiGamesCritical.textContent = sanitizeHyphens(
      `Momentos criticos (|ΔWP| >= 12%): ${totalCriticalPlays}`
    );
  }

  const kpiHingeDelta = document.getElementById('kpi-hinge-delta');
  const kpiHingeMatchup = document.getElementById('kpi-hinge-matchup');
  const kpiHingeClock = document.getElementById('kpi-hinge-clock');
  const kpiHingeDesc = document.getElementById('kpi-hinge-desc');

  if (topHingeCandidate && topHingeCandidate.play) {
    const hp = topHingeCandidate.play;
    const rawDelta = Number(hp.delta_wp ?? 0);
    const deltaPct = Math.abs(rawDelta) <= 1.0001 ? rawDelta * 100 : rawDelta;
    if (kpiHingeDelta) {
      kpiHingeDelta.textContent = `${formatSigned(deltaPct, 1, '% WP')}`;
    }
    if (kpiHingeMatchup) {
      kpiHingeMatchup.textContent = sanitizeHyphens(topHingeCandidate.shortName);
    }
    if (kpiHingeClock) {
      kpiHingeClock.textContent = sanitizeHyphens(`Q${hp.qtr || 4} - ${hp.clock || '0:00'}`);
    }
    if (kpiHingeDesc) {
      kpiHingeDesc.textContent = sanitizeHyphens(hp.description || 'Jugada clave registrada');
    }
  }
}

/* ========================================================================== */
/* 2. SECCIÓN DE MARCADORES EN VIVO, WIN PROBABILITY Y JUGADAS BISAGRA        */
/* ========================================================================== */

/**
 * Genera el HTML del logo del equipo con fallback limpio a monograma si no hay URL.
 * @param {Record<string, any>} team
 * @returns {string}
 */
function renderTeamLogo(team) {
  const abbr = escapeHtml(team?.abbreviation || 'NFL');
  const logoUrl = team?.logo ? escapeHtml(team.logo) : '';
  if (!logoUrl) {
    return `<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 font-mono-num text-[11px] font-bold text-slate-200">${abbr}</div>`;
  }
  return `
    <div class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-1">
      <img
        src="${logoUrl}"
        alt="${abbr}"
        loading="lazy"
        class="h-full w-full object-contain"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <span style="display:none" class="h-full w-full items-center justify-center font-mono-num text-[10px] font-bold text-slate-300">${abbr}</span>
    </div>
  `;
}

function renderScoreboardSection() {
  const container = document.getElementById('scoreboard-grid');
  if (!container) return;

  const scoreboard = appState.scoreboard;
  const allGames = Array.isArray(scoreboard?.games) ? scoreboard.games : [];

  if (allGames.length === 0) {
    container.innerHTML = `
      <div class="col-span-full rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
        <p class="text-sm font-semibold text-slate-300">No hay partidos registrados en el corte actual.</p>
        <p class="mt-1 text-xs text-slate-500">Ejecuta <code class="font-mono-num text-slate-400">python -m src.ingest_espn</code> para poblar <code class="font-mono-num text-slate-400">public/data/live_scoreboard.json</code>.</p>
      </div>
    `;
    return;
  }

  // Filtrar según selección activa
  const filteredGames = allGames.filter((game) => {
    const state = String(game?.status?.state || 'pre').toLowerCase();
    const moments = Array.isArray(game?.critical_moments) ? game.critical_moments : [];
    const hingeExceeds =
      Boolean(game?.hinge_play?.exceeds_threshold) ||
      Math.abs(Number(game?.hinge_play?.abs_delta_wp ?? 0)) >= 0.12 ||
      moments.length > 0;

    if (appState.gameFilter === 'live') return state === 'in';
    if (appState.gameFilter === 'final') return state === 'post' || Boolean(game?.status?.completed);
    if (appState.gameFilter === 'hinge') return hingeExceeds;
    return true;
  });

  if (filteredGames.length === 0) {
    container.innerHTML = `
      <div class="col-span-full rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-xs text-slate-400">
        Ningun partido coincide con el filtro seleccionado (<code class="font-mono-num text-cyan-300">${escapeHtml(appState.gameFilter)}</code>).
      </div>
    `;
    return;
  }

  container.innerHTML = filteredGames
    .map((game) => {
      const away = game.away_team || {};
      const home = game.home_team || {};
      const awayAbbr = escapeHtml(away.abbreviation || 'AWAY');
      const homeAbbr = escapeHtml(home.abbreviation || 'HOME');
      const awayName = escapeHtml(away.name || awayAbbr);
      const homeName = escapeHtml(home.name || homeAbbr);
      const awayScore = Number(away.score ?? 0);
      const homeScore = Number(home.score ?? 0);

      const state = String(game?.status?.state || 'pre').toLowerCase();
      const statusDetail = escapeHtml(
        game?.status?.detail || (state === 'post' ? 'Final' : state === 'in' ? 'En Vivo' : 'Programado')
      );

      let statusBadgeHtml = '';
      if (state === 'in') {
        statusBadgeHtml = `
          <span class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono-num text-[11px] font-bold text-emerald-300">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot"></span>
            EN VIVO - ${statusDetail}
          </span>
        `;
      } else if (state === 'post' || game?.status?.completed) {
        statusBadgeHtml = `
          <span class="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/90 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-slate-300">
            ${statusDetail}
          </span>
        `;
      } else {
        statusBadgeHtml = `
          <span class="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono-num text-[11px] font-medium text-cyan-300">
            ${statusDetail}
          </span>
        `;
      }

      // Win Probability
      const wpObj = game.win_probability || {};
      const homeWpPct = toPercentage(wpObj.home_wp ?? game.home_wp ?? 0.5);
      const awayWpPct = Math.max(0.0, Math.min(100.0, 100.0 - homeWpPct));

      // Jugadas críticas y Jugada Bisagra
      const criticalMoments = Array.isArray(game.critical_moments) ? game.critical_moments : [];
      const hingePlay = game.hinge_play || criticalMoments[0] || null;

      let hingeHtml = '';
      if (hingePlay) {
        const rawDelta = Number(hingePlay.delta_wp ?? 0);
        const absDelta = Math.abs(Number(hingePlay.abs_delta_wp ?? rawDelta));
        const deltaPct = Math.abs(rawDelta) <= 1.0001 ? rawDelta * 100.0 : rawDelta;
        const isCritical = absDelta >= 0.12 || Boolean(hingePlay.exceeds_threshold);
        const beforePct = toPercentage(hingePlay.home_wp_before ?? 0.5);
        const afterPct = toPercentage(hingePlay.home_wp_after ?? 0.5);
        const favTeamAbbr = rawDelta >= 0 ? homeAbbr : awayAbbr;

        const borderClass = isCritical
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/70';
        const badgeClass = isCritical
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          : 'bg-slate-800 text-slate-300 border border-slate-700';

        hingeHtml = `
          <div class="mt-3.5 rounded-lg border ${borderClass} p-3">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${badgeClass}">
                ${isCritical ? '⚡ Jugada Bisagra (|ΔWP| >= 12%)' : 'Mayor Variacion WP'}
              </span>
              <span class="font-mono-num text-xs font-extrabold ${rawDelta >= 0 ? 'text-emerald-400' : 'text-cyan-400'}">
                ${formatSigned(deltaPct, 1, '% WP')} (${favTeamAbbr})
              </span>
            </div>
            <p class="mt-1.5 text-xs leading-snug text-slate-200">
              ${escapeHtml(hingePlay.description || 'Jugada clave')}
            </p>
            <div class="mt-2 flex items-center justify-between font-mono-num text-[11px] text-slate-400">
              <span>Q${escapeHtml(hingePlay.qtr || 4)} - ${escapeHtml(hingePlay.clock || '0:00')}</span>
              <span>WP ${homeAbbr}: ${beforePct.toFixed(1)}% -> ${afterPct.toFixed(1)}%</span>
            </div>
          </div>
        `;
      } else {
        hingeHtml = `
          <div class="mt-3.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 text-center font-mono-num text-[11px] text-slate-500">
            Sin variaciones |ΔWP| >= 12% registradas en este encuentro
          </div>
        `;
      }

      // Lista de las Top 3 Jugadas Críticas
      let topMomentsHtml = '';
      if (criticalMoments.length > 0) {
        const itemsHtml = criticalMoments
          .slice(0, 3)
          .map((m, idx) => {
            const dRaw = Number(m.delta_wp ?? 0);
            const dPct = Math.abs(dRaw) <= 1.0001 ? dRaw * 100.0 : dRaw;
            const wpBefore = toPercentage(m.home_wp_before ?? 0.5);
            const wpAfter = toPercentage(m.home_wp_after ?? 0.5);
            return `
              <li class="rounded border border-slate-800/90 bg-[#090D16]/70 p-2 text-[11px]">
                <div class="flex items-center justify-between font-mono-num">
                  <span class="font-bold text-amber-300">#${idx + 1} | Q${escapeHtml(m.qtr || 4)} ${escapeHtml(m.clock || '0:00')}</span>
                  <span class="font-semibold text-white">${formatSigned(dPct, 1, '% WP')} (${wpBefore.toFixed(0)}% -> ${wpAfter.toFixed(0)}%)</span>
                </div>
                <p class="mt-1 line-clamp-2 text-slate-300">${escapeHtml(m.description || '')}</p>
              </li>
            `;
          })
          .join('');

        topMomentsHtml = `
          <details class="group mt-2.5">
            <summary class="flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 font-mono-num text-[11px] font-medium text-slate-300 transition hover:border-slate-700 hover:text-white">
              <span>Top ${Math.min(3, criticalMoments.length)} Jugadas Criticas (|ΔWP| >= 12%)</span>
              <span class="text-slate-500 transition group-open:rotate-180">▼</span>
            </summary>
            <ul class="mt-2 space-y-1.5">
              ${itemsHtml}
            </ul>
          </details>
        `;
      }

      const awayLeading = awayScore > homeScore;
      const homeLeading = homeScore > awayScore;

      return `
        <article class="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-4 shadow-lg transition hover:border-slate-700">
          <div>
            <!-- Header del Partido -->
            <div class="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <span class="font-mono-num text-xs font-bold tracking-wide text-slate-400">
                ${awayAbbr} @ ${homeAbbr}
              </span>
              ${statusBadgeHtml}
            </div>

            <!-- Equipos y Marcador -->
            <div class="mt-3 space-y-2.5">
              <!-- Visitante -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${renderTeamLogo(away)}
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono-num text-xs font-bold text-white">${awayAbbr}</span>
                      <span class="text-[10px] uppercase text-slate-500">VIS</span>
                    </div>
                    <p class="truncate text-xs text-slate-400">${awayName}</p>
                  </div>
                </div>
                <span class="font-mono-num text-xl font-extrabold ${awayLeading ? 'text-white' : 'text-slate-400'}">
                  ${awayScore}
                </span>
              </div>

              <!-- Local -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${renderTeamLogo(home)}
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono-num text-xs font-bold text-white">${homeAbbr}</span>
                      <span class="text-[10px] uppercase text-slate-500">LOC</span>
                    </div>
                    <p class="truncate text-xs text-slate-400">${homeName}</p>
                  </div>
                </div>
                <span class="font-mono-num text-xl font-extrabold ${homeLeading ? 'text-white' : 'text-slate-400'}">
                  ${homeScore}
                </span>
              </div>
            </div>

            <!-- Barra Visual de Win Probability -->
            <div class="mt-4">
              <div class="flex items-center justify-between font-mono-num text-[11px]">
                <span class="text-cyan-300">${awayAbbr} WP: <strong>${awayWpPct.toFixed(1)}%</strong></span>
                <span class="text-emerald-300"><strong>${homeWpPct.toFixed(1)}%</strong> :WP ${homeAbbr}</span>
              </div>
              <div class="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-900 p-0.5 border border-slate-800">
                <div
                  class="h-full rounded-l-full bg-cyan-500 transition-all duration-500"
                  style="width: ${awayWpPct.toFixed(1)}%"
                  title="${awayAbbr} Win Probability: ${awayWpPct.toFixed(1)}%"
                ></div>
                <div
                  class="h-full rounded-r-full bg-emerald-500 transition-all duration-500"
                  style="width: ${homeWpPct.toFixed(1)}%"
                  title="${homeAbbr} Win Probability: ${homeWpPct.toFixed(1)}%"
                ></div>
              </div>
            </div>

            <!-- Alerta de Jugada Bisagra -->
            ${hingeHtml}
          </div>

          <!-- Desplegable de Top 3 Jugadas Críticas -->
          ${topMomentsHtml}
        </article>
      `;
    })
    .join('');
}

/* ========================================================================== */
/* 3. TABLA INTERACTIVA DE VALORACIÓN OBJETIVA (0-100)                        */
/* ========================================================================== */

/**
 * Devuelve la clase de color para la barra y badge de Score de Impacto (0-100).
 * @param {number} score
 * @returns {{ barClass: string, badgeClass: string }}
 */
function getImpactScoreStyling(score) {
  if (score >= 85) {
    return {
      barClass: 'bg-emerald-400',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    };
  }
  if (score >= 70) {
    return {
      barClass: 'bg-cyan-400',
      badgeClass: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
    };
  }
  if (score >= 50) {
    return {
      barClass: 'bg-sky-400',
      badgeClass: 'border-slate-700 bg-slate-800 text-slate-200',
    };
  }
  return {
    barClass: 'bg-amber-400',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  };
}

/**
 * Obtiene el valor comparable de una columna para el ordenamiento de jugadores.
 * @param {Record<string, any>} player
 * @param {string} column
 * @returns {number|string}
 */
function getPlayerSortValue(player, column) {
  switch (column) {
    case 'player_name':
      return String(player.player_name || player.name || '').toLowerCase();
    case 'impact_score':
      return Number(player.impact_score ?? 0);
    case 'epa_per_play':
      return Number(player.epa_per_play ?? 0);
    case 'wpa_total':
      return Number(player.wpa_total ?? 0);
    case 'cpoe': {
      const pos = String(player.position || '');
      if (pos === 'WR' || pos === 'TE') {
        return Number(player.yac_epa ?? 0);
      }
      return Number(player.cpoe ?? 0);
    }
    case 'success_rate':
      return Number(player.success_rate ?? 0);
    case 'garbage_time_yards':
      return Number(player.garbage_time_yards ?? 0);
    case 'inflation_index':
      return Number(player.inflation_index ?? 0);
    default:
      return Number(player[column] ?? 0);
  }
}

function updateSortIndicators() {
  const indicators = document.querySelectorAll('.sort-indicator');
  indicators.forEach((el) => {
    const col = el.getAttribute('data-col');
    if (col === appState.sortColumn) {
      el.textContent = appState.sortDirection === 'asc' ? '↑' : '↓';
      el.className = 'sort-indicator text-cyan-400 font-bold';
    } else {
      el.textContent = '↕';
      el.className = 'sort-indicator text-slate-600';
    }
  });
}

function renderPlayerRankingsTable() {
  const tbody = document.getElementById('player-rankings-tbody');
  const visibleCountEl = document.getElementById('rankings-visible-count');
  const totalCountEl = document.getElementById('rankings-total-count');
  const activePosLabel = document.getElementById('rankings-active-pos-label');

  if (!tbody) return;

  const rankings = appState.rankings || {};
  const allPlayers = Array.isArray(rankings.players) ? rankings.players : [];
  const mvpId = rankings.mvp_real?.player_id || allPlayers[0]?.player_id || null;
  const inflatedId = rankings.inflated_stat_leader?.player_id || null;

  if (totalCountEl) totalCountEl.textContent = String(allPlayers.length);
  if (activePosLabel) {
    activePosLabel.textContent = sanitizeHyphens(
      `(Posicion: ${appState.positionFilter === 'ALL' ? 'Todos' : appState.positionFilter})`
    );
  }

  // 1. Filtrar por posición y búsqueda
  const query = appState.searchQuery.trim().toLowerCase();
  const filtered = allPlayers.filter((p) => {
    const pos = String(p.position || '').toUpperCase();
    if (appState.positionFilter !== 'ALL' && pos !== appState.positionFilter) {
      return false;
    }
    if (query) {
      const name = String(p.player_name || p.name || '').toLowerCase();
      const team = String(p.team || '').toLowerCase();
      return name.includes(query) || team.includes(query) || pos.toLowerCase().includes(query);
    }
    return true;
  });

  // 2. Ordenar según columna activa
  const sorted = [...filtered].sort((a, b) => {
    const valA = getPlayerSortValue(a, appState.sortColumn);
    const valB = getPlayerSortValue(b, appState.sortColumn);

    if (typeof valA === 'string' && typeof valB === 'string') {
      return appState.sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    const numA = Number(valA);
    const numB = Number(valB);
    return appState.sortDirection === 'asc' ? numA - numB : numB - numA;
  });

  if (visibleCountEl) visibleCountEl.textContent = String(sorted.length);
  updateSortIndicators();

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-10 text-center text-xs text-slate-400">
          No se encontraron jugadores para los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted
    .map((player, index) => {
      const pid = String(player.player_id || '');
      const name = escapeHtml(player.player_name || player.name || 'Jugador');
      const team = escapeHtml(player.team || 'NFL');
      const pos = escapeHtml(player.position || 'QB');

      const isMvp = pid && pid === String(mvpId);
      const isInflatedLeader = pid && pid === String(inflatedId);

      const impactScore = Number(player.impact_score ?? 0);
      const { barClass, badgeClass } = getImpactScoreStyling(impactScore);

      const epaPerPlay = Number(player.epa_per_play ?? 0);
      const rawEpaPerPlay = Number(player.raw_epa_per_play ?? epaPerPlay);
      const epaTotal = Number(player.epa_total ?? 0);
      const wpaTotal = Number(player.wpa_total ?? 0);
      const rawWpaTotal = Number(player.raw_wpa_total ?? wpaTotal);

      const cpoeVal = Number(player.cpoe ?? 0);
      const yacEpaVal = Number(player.yac_epa ?? 0);

      const srRatio = Number(player.success_rate ?? 0);
      const srPct = srRatio <= 1.0001 ? srRatio * 100.0 : srRatio;

      const compYards = Number(player.competitive_yards ?? 0);
      const rawYards = Number(player.raw_yards ?? compYards);
      const gtYards = Number(player.garbage_time_yards ?? Math.max(0, rawYards - compYards));
      const gtPlays = Number(player.garbage_time_plays ?? 0);
      const inflIndex = Number(player.inflation_index ?? 0);
      const epaDelta = Number(player.epa_inflation_delta ?? 0);

      // Badges especiales de auditoría
      let specialBadgesHtml = '';
      if (isMvp) {
        specialBadgesHtml += `
          <span class="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300">
            ★ MVP REAL
          </span>
        `;
      }
      if (isInflatedLeader) {
        specialBadgesHtml += `
          <span class="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-amber-300">
            ⚠ ESTADISTICO INFLADO
          </span>
        `;
      } else if (inflIndex >= 15 || gtYards >= 120) {
        specialBadgesHtml += `
          <span class="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono-num text-[10px] font-medium text-amber-300">
            Inflacion Alta
          </span>
        `;
      }

      // Columna CPOE / YAC EPA contextual por posición
      let secondaryMetricHtml = '';
      if (pos === 'QB') {
        secondaryMetricHtml = `
          <div class="font-mono-num font-semibold ${cpoeVal >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
            ${formatSigned(cpoeVal, 1, '%')}
          </div>
          <div class="font-mono-num text-[10px] text-slate-500">CPOE</div>
        `;
      } else if (pos === 'WR' || pos === 'TE') {
        secondaryMetricHtml = `
          <div class="font-mono-num font-semibold ${yacEpaVal >= 0 ? 'text-cyan-300' : 'text-rose-300'}">
            ${formatSigned(yacEpaVal, 2)}
          </div>
          <div class="font-mono-num text-[10px] text-slate-500">YAC EPA</div>
        `;
      } else {
        secondaryMetricHtml = `
          <div class="font-mono-num font-semibold text-slate-300">
            ${formatNumber(player.opportunities_per_week, 1)}
          </div>
          <div class="font-mono-num text-[10px] text-slate-500">Touches/sem</div>
        `;
      }

      const posBadgeColors = {
        QB: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        RB: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
        WR: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
        TE: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      };
      const posBadgeClass =
        posBadgeColors[pos] || 'border-slate-700 bg-slate-800 text-slate-300';

      const rowHighlightClass = isMvp
        ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
        : isInflatedLeader
          ? 'bg-amber-950/15 hover:bg-amber-950/25'
          : 'hover:bg-slate-800/45';

      return `
        <tr class="transition ${rowHighlightClass}">
          <!-- Rank -->
          <td class="py-3 pl-4 pr-2 text-center font-mono-num text-xs font-semibold text-slate-500">
            ${index + 1}
          </td>

          <!-- Jugador / Equipo / Badges -->
          <td class="py-3 px-3">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-semibold text-white">${name}</span>
              <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-slate-300">${team}</span>
              ${specialBadgesHtml}
            </div>
            <div class="mt-0.5 font-mono-num text-[10px] text-slate-500">
              Oportunidades: ${Number(player.competitive_opportunities ?? player.opportunities ?? 0)} comp / ${Number(player.raw_opportunities ?? player.opportunities ?? 0)} tot (${Number(player.weeks_played ?? 1)} sem)
            </div>
          </td>

          <!-- Posición -->
          <td class="py-3 px-2 text-center">
            <span class="inline-block rounded border px-2 py-0.5 font-mono-num text-[11px] font-bold ${posBadgeClass}">
              ${pos}
            </span>
          </td>

          <!-- Score de Impacto (0-100) -->
          <td class="py-3 px-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-block w-12 rounded border px-1.5 py-0.5 text-center font-mono-num text-xs font-extrabold ${badgeClass}">
                ${impactScore.toFixed(1)}
              </span>
              <div class="hidden sm:block h-2 flex-1 min-w-[72px] max-w-[110px] overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div class="h-full rounded-full ${barClass}" style="width: ${Math.max(2, Math.min(100, impactScore))}%"></div>
              </div>
            </div>
          </td>

          <!-- EPA / Jugada (Sin Minutos Basura) -->
          <td class="py-3 px-3 text-right">
            <div class="font-mono-num font-bold ${epaPerPlay >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              ${formatSigned(epaPerPlay, 3)}
            </div>
            <div class="font-mono-num text-[10px] text-slate-500">
              Tot: ${formatSigned(epaTotal, 1)} | Bruto: ${formatSigned(rawEpaPerPlay, 3)}
            </div>
          </td>

          <!-- WPA Total -->
          <td class="py-3 px-3 text-right">
            <div class="font-mono-num font-semibold ${wpaTotal >= 0 ? 'text-cyan-300' : 'text-rose-300'}">
              ${formatSigned(wpaTotal, 3)}
            </div>
            <div class="font-mono-num text-[10px] text-slate-500">
              Bruto: ${formatSigned(rawWpaTotal, 3)}
            </div>
          </td>

          <!-- CPOE / YAC EPA -->
          <td class="py-3 px-3 text-right">
            ${secondaryMetricHtml}
          </td>

          <!-- Success Rate -->
          <td class="py-3 px-3 text-right font-mono-num">
            <div class="font-semibold text-slate-200">${srPct.toFixed(1)}%</div>
            <div class="text-[10px] text-slate-500">EPA &gt; 0</div>
          </td>

          <!-- Yardas Competitivas vs Brutas (Basura) -->
          <td class="py-3 px-3 text-right font-mono-num">
            <div class="text-slate-200">
              <span class="font-semibold text-white">${compYards.toFixed(0)}</span>
              <span class="text-slate-500">/</span>
              <span class="text-slate-400">${rawYards.toFixed(0)} yds</span>
            </div>
            <div class="text-[10px] ${gtYards > 0 ? 'text-amber-300' : 'text-slate-500'}">
              Basura: +${gtYards.toFixed(0)} yds (${gtPlays} jug)
            </div>
          </td>

          <!-- Índice de Inflación Estadística -->
          <td class="py-3 pl-3 pr-4 text-right font-mono-num">
            <span class="inline-block rounded border px-2 py-0.5 text-xs font-bold ${
              isInflatedLeader || inflIndex >= 15
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }">
              ${inflIndex.toFixed(2)}
            </span>
            <div class="mt-0.5 text-[10px] ${epaDelta > 0.5 ? 'text-amber-400' : 'text-slate-500'}">
              ΔEPA: ${formatSigned(epaDelta, 2)}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

/* ========================================================================== */
/* 4. SECCIÓN DE CRÓNICAS ANALÍTICAS BASADAS EN DATOS (game_critiques.json)   */
/* ========================================================================== */

/**
 * Renderiza píldoras de métricas numéricas citadas.
 * @param {Record<string, any>} metricsObj
 * @returns {string}
 */
function renderMetricsPills(metricsObj) {
  if (!metricsObj || typeof metricsObj !== 'object') return '';
  const labelMap = {
    impact_score: 'Impact Score',
    epa_total: 'EPA Comp',
    raw_epa_total: 'EPA Bruto',
    epa_per_play: 'EPA/Jugada',
    wpa_total: 'WPA Total',
    cpoe: 'CPOE %',
    yac_epa: 'YAC EPA',
    success_rate_pct: 'Success %',
    inflation_index: 'Indice Inflacion',
    raw_yards: 'Yds Brutas',
    competitive_yards: 'Yds Comp',
    garbage_time_yards: 'Yds Basura',
    home_wp: 'WP Local',
    delta_wp: 'ΔWP',
    critical_plays_count: 'Jugadas Criticas',
  };

  return Object.entries(metricsObj)
    .map(([key, val]) => {
      if (val === null || val === undefined) return '';
      const label = labelMap[key] || key;
      let formatted = String(val);
      const num = Number(val);
      if (Number.isFinite(num)) {
        if (key === 'home_wp') {
          formatted = `${toPercentage(num).toFixed(1)}%`;
        } else if (key.includes('epa') || key.includes('wpa') || key === 'delta_wp') {
          formatted = formatSigned(num, 3);
        } else if (key.includes('yards')) {
          formatted = `${num.toFixed(0)} yds`;
        } else {
          formatted = formatNumber(num, 2);
        }
      }
      return `
        <span class="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-[#090D16] px-2 py-0.5 font-mono-num text-[11px] text-slate-300">
          <span class="text-slate-500">${escapeHtml(label)}:</span>
          <strong class="text-white">${escapeHtml(formatted)}</strong>
        </span>
      `;
    })
    .join('');
}

function renderCritiquesSection() {
  const critiquesData = appState.critiques || {};
  const rankingsData = appState.rankings || {};

  // Modo de generación y fecha
  const modeBadge = document.getElementById('critiques-mode-badge');
  const updatedEl = document.getElementById('critiques-updated-at');
  const summaryEl = document.getElementById('executive-summary-text');

  const mode = sanitizeHyphens(critiquesData.generation_mode || 'deterministic_template');
  if (modeBadge) {
    modeBadge.textContent =
      mode === 'deterministic_template'
        ? 'Modo: Plantilla Determinista Cuantitativa'
        : `Modo IA: ${mode}`;
  }
  if (updatedEl) {
    updatedEl.textContent = `Actualizado: ${formatTimestamp(critiquesData.updated_at)}`;
  }
  if (summaryEl) {
    summaryEl.textContent = sanitizeHyphens(
      critiquesData.executive_summary ||
        'Resumen ejecutivo pendiente de generacion.'
    );
  }

  // Comparativa Cara a Cara: MVP Real vs Estadístico Inflado
  const mvp = critiquesData.mvp_real || rankingsData.mvp_real || null;
  const inflated =
    critiquesData.inflated_player ||
    critiquesData.inflated_stat_leader ||
    rankingsData.inflated_stat_leader ||
    null;

  const mvpTitleEl = document.getElementById('critique-mvp-title');
  const mvpScoreEl = document.getElementById('critique-mvp-score');
  const mvpBodyEl = document.getElementById('critique-mvp-body');
  const mvpPillsEl = document.getElementById('critique-mvp-pills');

  if (mvp && (mvp.player_name || mvp.name)) {
    const mName = sanitizeHyphens(mvp.player_name || mvp.name);
    const mPos = sanitizeHyphens(mvp.position || 'QB');
    const mTeam = sanitizeHyphens(mvp.team || 'NFL');
    if (mvpTitleEl) mvpTitleEl.textContent = `${mName} (${mPos} - ${mTeam})`;
    if (mvpScoreEl) mvpScoreEl.textContent = `${formatNumber(mvp.impact_score, 1)}`;
    if (mvpBodyEl) {
      mvpBodyEl.textContent = sanitizeHyphens(
        `Lider absoluto en valoracion limpia sin minutos basura. Registra ${formatSigned(mvp.epa_total, 2)} EPA competitivo total (${formatSigned(mvp.epa_per_play, 3)} EPA/jugada), WPA acumulado de ${formatSigned(mvp.wpa_total, 3)}, CPOE de ${formatSigned(mvp.cpoe, 2)}% y ${formatNumber(mvp.competitive_yards, 0)} yardas competitivas.`
      );
    }
    if (mvpPillsEl) {
      mvpPillsEl.innerHTML = renderMetricsPills({
        epa_per_play: mvp.epa_per_play,
        epa_total: mvp.epa_total,
        wpa_total: mvp.wpa_total,
        cpoe: mvp.cpoe,
        competitive_yards: mvp.competitive_yards,
      });
    }
  }

  const infTitleEl = document.getElementById('critique-inflated-title');
  const infIndexEl = document.getElementById('critique-inflated-index');
  const infBodyEl = document.getElementById('critique-inflated-body');
  const infPillsEl = document.getElementById('critique-inflated-pills');

  if (inflated && (inflated.player_name || inflated.name)) {
    const iName = sanitizeHyphens(inflated.player_name || inflated.name);
    const iPos = sanitizeHyphens(inflated.position || 'QB');
    const iTeam = sanitizeHyphens(inflated.team || 'NFL');
    if (infTitleEl) infTitleEl.textContent = `${iName} (${iPos} - ${iTeam})`;
    if (infIndexEl) infIndexEl.textContent = `${formatNumber(inflated.inflation_index, 2)}`;
    if (infBodyEl) {
      infBodyEl.textContent = sanitizeHyphens(
        `Mayor divergencia entre volumen bruto (${formatNumber(inflated.raw_yards, 0)} yds) y eficiencia en tiempo competitivo (${formatNumber(inflated.competitive_yards, 0)} yds). Acumula ${formatNumber(inflated.garbage_time_yards, 0)} yardas en minutos basura (Q4 con WP < 5% o > 95%) y una inflacion de EPA de ${formatSigned(inflated.epa_inflation_delta, 2)}.`
      );
    }
    if (infPillsEl) {
      infPillsEl.innerHTML = renderMetricsPills({
        garbage_time_yards: inflated.garbage_time_yards,
        raw_yards: inflated.raw_yards,
        competitive_yards: inflated.competitive_yards,
        epa_total: inflated.epa_total,
        raw_epa_total: inflated.raw_epa_total,
      });
    }
  }

  // Grilla de crónicas detalladas
  const critiquesGrid = document.getElementById('critiques-grid');
  if (!critiquesGrid) return;

  const list = Array.isArray(critiquesData.critiques) ? critiquesData.critiques : [];
  if (list.length === 0) {
    critiquesGrid.innerHTML = `
      <div class="col-span-full rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-xs text-slate-400">
        No hay cronicas analiticas disponibles en <code class="font-mono-num text-slate-300">./data/game_critiques.json</code>.
      </div>
    `;
    return;
  }

  critiquesGrid.innerHTML = list
    .map((item) => {
      const category = escapeHtml(item.category || 'Analisis');
      const title = escapeHtml(item.title || 'Cronica Cuantitativa');
      const subtitle = escapeHtml(item.subtitle || '');
      const body = escapeHtml(item.body || '');
      const teams = Array.isArray(item.teams) ? item.teams : [];

      let catBadgeClass = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
      if (category.toLowerCase().includes('mvp')) {
        catBadgeClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
      } else if (category.toLowerCase().includes('inflado')) {
        catBadgeClass = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
      }

      const teamsHtml = teams
        .map(
          (t) =>
            `<span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-slate-300">${escapeHtml(t)}</span>`
        )
        .join('');

      return `
        <article class="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-md transition hover:border-slate-700">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="rounded border px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase ${catBadgeClass}">
                ${category}
              </span>
              <div class="flex items-center gap-1">${teamsHtml}</div>
            </div>
            <h3 class="mt-2.5 text-base font-bold text-white">${title}</h3>
            ${
              subtitle
                ? `<p class="mt-0.5 font-mono-num text-xs font-medium text-cyan-400">${subtitle}</p>`
                : ''
            }
            <p class="mt-3 text-xs leading-relaxed text-slate-300">${body}</p>
          </div>
          <div class="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800/80 pt-3">
            ${renderMetricsPills(item.metrics_cited || {})}
          </div>
        </article>
      `;
    })
    .join('');
}

/* ========================================================================== */
/* EVENT LISTENERS E INICIALIZACIÓN                                           */
/* ========================================================================== */

function bindUiEvents() {
  // 1. Filtros de partidos (Todos / En Vivo / Jugada Bisagra / Finalizados)
  const gameFilterButtons = document.querySelectorAll('.game-filter-btn');
  gameFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-game-filter') || 'all';
      appState.gameFilter = filter;

      gameFilterButtons.forEach((b) => {
        const isActive = b.getAttribute('data-game-filter') === filter;
        b.className = isActive
          ? 'game-filter-btn rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition'
          : 'game-filter-btn rounded-lg border border-slate-800 bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-white';
      });

      renderScoreboardSection();
    });
  });

  // 2. Filtros de posición (ALL / QB / RB / WR / TE)
  const posFilterButtons = document.querySelectorAll('.pos-filter-btn');
  posFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pos = btn.getAttribute('data-pos-filter') || 'ALL';
      appState.positionFilter = pos;

      posFilterButtons.forEach((b) => {
        const isActive = b.getAttribute('data-pos-filter') === pos;
        b.className = isActive
          ? 'pos-filter-btn rounded-lg bg-emerald-500/20 px-3 py-1.5 font-mono-num text-xs font-bold text-emerald-300 transition'
          : 'pos-filter-btn rounded-lg px-3 py-1.5 font-mono-num text-xs font-semibold text-slate-400 transition hover:text-white';
      });

      renderPlayerRankingsTable();
    });
  });

  // 3. Buscador de jugadores por nombre o equipo
  const searchInput = document.getElementById('player-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      appState.searchQuery = event.target.value || '';
      renderPlayerRankingsTable();
    });
  }

  // 4. Ordenamiento interactivo por columnas de la tabla
  const sortableHeaders = document.querySelectorAll('.sortable-th');
  sortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (!col) return;
      if (appState.sortColumn === col) {
        appState.sortDirection = appState.sortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        appState.sortColumn = col;
        appState.sortDirection = col === 'player_name' ? 'asc' : 'desc';
      }
      renderPlayerRankingsTable();
    });
  });

  // 5. Botón de recarga manual de los JSON locales
  const refreshBtn = document.getElementById('btn-refresh-data');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      await loadAllDashboardData();
      refreshBtn.disabled = false;
    });
  }
}

async function loadAllDashboardData() {
  const [scoreboard, rankings, critiques] = await Promise.all([
    fetchLocalJson(DATA_ENDPOINTS.scoreboard),
    fetchLocalJson(DATA_ENDPOINTS.rankings),
    fetchLocalJson(DATA_ENDPOINTS.critiques),
  ]);

  appState.scoreboard = scoreboard || { games: [] };
  appState.rankings = rankings || { players: [] };
  appState.critiques = critiques || { critiques: [] };

  renderHeaderAndKpis();
  renderScoreboardSection();
  renderPlayerRankingsTable();
  renderCritiquesSection();
}

document.addEventListener('DOMContentLoaded', () => {
  bindUiEvents();
  loadAllDashboardData();
});
