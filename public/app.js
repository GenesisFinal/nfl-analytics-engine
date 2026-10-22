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
  gameWeekFilter: 'ALL', // 'ALL' | '1' | '2' | ...
  gameTeamFilter: 'ALL', // 'ALL' | 'KC' | 'BAL' | ...
  rankingScopeFilter: 'ALL', // 'ALL' | 'CUM_5' | 'WEEK_6' | ...
  rankingTeamFilter: 'ALL', // 'ALL' | 'KC' | 'SF' | ...
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

  // KPI 1: MVP Real (según el corte temporal activo en el Ranking)
  const activeRankSlice = getActiveRankingsSlice();
  const players = activeRankSlice.players;
  const mvp = activeRankSlice.mvp_real || players[0] || null;

  const kpiMvpScore = document.getElementById('kpi-mvp-score');
  const kpiMvpName = document.getElementById('kpi-mvp-name');
  const kpiMvpMeta = document.getElementById('kpi-mvp-meta');
  const kpiMvpMetrics = document.getElementById('kpi-mvp-metrics');

  if (mvp && (mvp.player_name || mvp.name)) {
    const mvpName = sanitizeHyphens(mvp.player_name || mvp.name);
    const mvpPos = sanitizeHyphens(mvp.position || 'QB');
    const mvpTeam = sanitizeHyphens(mvp.team || 'NFL');
    const posHref = getPositionMethodologyAnchor(mvpPos);
    if (kpiMvpScore) kpiMvpScore.textContent = `${formatNumber(mvp.impact_score, 1)} / 100`;
    if (kpiMvpName) kpiMvpName.textContent = mvpName;
    if (kpiMvpMeta) {
      kpiMvpMeta.innerHTML = `<a href="${posHref}" class="metric-ref-link text-emerald-300" title="Ver ecuacion de ${escapeHtml(mvpPos)}">${escapeHtml(mvpPos)}</a> - ${escapeHtml(mvpTeam)}`;
    }
    if (kpiMvpMetrics) {
      kpiMvpMetrics.innerHTML = `<a href="#metodo-epa" class="metric-ref-link text-emerald-300" title="Ver metodologia de EPA">EPA/jug</a>: ${escapeHtml(formatSigned(mvp.epa_per_play, 3))} | <a href="#metodo-wpa" class="metric-ref-link text-cyan-300" title="Ver metodologia de WPA">WPA</a>: ${escapeHtml(formatSigned(mvp.wpa_total, 3))}`;
    }
  } else if (kpiMvpName) {
    kpiMvpName.textContent = 'Sin datos';
  }

  // KPI 2: Estadístico Inflado (según el corte temporal activo)
  const inflated =
    activeRankSlice.inflated_stat_leader ||
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
    const posHref = getPositionMethodologyAnchor(infPos);

    if (kpiInfBadge) kpiInfBadge.textContent = `Indice ${infIdx}`;
    if (kpiInfName) kpiInfName.textContent = infName;
    if (kpiInfMeta) {
      kpiInfMeta.innerHTML = `<a href="${posHref}" class="metric-ref-link text-amber-300" title="Ver ecuacion de ${escapeHtml(infPos)}">${escapeHtml(infPos)}</a> - ${escapeHtml(infTeam)}`;
    }
    if (kpiInfMetrics) {
      kpiInfMetrics.innerHTML = `<a href="#metodo-epa-comp" class="metric-ref-link text-amber-300" title="Ver filtro de Minutos Basura">Yds Basura</a>: ${escapeHtml(gtYards)} yds | <a href="#metodo-inflacion" class="metric-ref-link text-amber-300" title="Ver Indice de Inflacion">Delta EPA</a>: ${escapeHtml(epaDelta)}`;
    }
  } else if (kpiInfName) {
    kpiInfName.textContent = 'Sin datos';
  }

  // KPI 3 y 4: Partidos Monitoreados (Temporada Regular completa sin pretemporada) y Jugada Bisagra Principal
  const allGames = Array.isArray(scoreboard.games) ? scoreboard.games : [];
  const games = allGames.filter((g) => {
    const matchWeek =
      appState.gameWeekFilter === 'ALL' ||
      String(g.week || scoreboard.week || 1) === String(appState.gameWeekFilter);
    const matchTeam =
      appState.gameTeamFilter === 'ALL' ||
      g?.away_team?.abbreviation === appState.gameTeamFilter ||
      g?.home_team?.abbreviation === appState.gameTeamFilter;
    return matchWeek && matchTeam;
  });

  const kpiGamesWeek = document.getElementById('kpi-games-week');
  const kpiGamesCount = document.getElementById('kpi-games-count');
  const kpiGamesStatus = document.getElementById('kpi-games-status-breakdown');
  const kpiGamesCritical = document.getElementById('kpi-games-critical-total');

  const weeksAvail = Array.isArray(scoreboard.weeks_available) && scoreboard.weeks_available.length > 0
    ? scoreboard.weeks_available
    : [scoreboard.week || 1];
  const minW = Math.min(...weeksAvail);
  const maxW = Math.max(...weeksAvail);

  if (kpiGamesWeek) {
    if (appState.gameWeekFilter !== 'ALL') {
      kpiGamesWeek.textContent = `Semana ${appState.gameWeekFilter} (REG)`;
    } else if (minW !== maxW) {
      kpiGamesWeek.textContent = `Sem. ${minW}-${maxW} (REG)`;
    } else {
      kpiGamesWeek.textContent = `Semana ${maxW} (REG)`;
    }
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
        const gWeek = game.week || scoreboard.week || '';
        const baseShort =
          game.short_name ||
          `${game?.away_team?.abbreviation || 'AWAY'} @ ${game?.home_team?.abbreviation || 'HOME'}`;
        topHingeCandidate = {
          absDelta,
          play: candidate,
          game,
          shortName: gWeek ? `${baseShort} (Sem. ${gWeek})` : baseShort,
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
    kpiGamesCritical.innerHTML = `<a href="#metodo-jugada-bisagra" class="metric-ref-link text-cyan-300" title="Ver metodologia de Jugada Bisagra">Momentos criticos (|&Delta;WP| &ge; 12%)</a>: <strong class="text-white">${totalCriticalPlays}</strong>`;
  }

  const kpiHingeDelta = document.getElementById('kpi-hinge-delta');
  const kpiHingeMatchup = document.getElementById('kpi-hinge-matchup');
  const kpiHingeClock = document.getElementById('kpi-hinge-clock');
  const kpiHingeDesc = document.getElementById('kpi-hinge-desc');
  const kpiHingeVideo = document.getElementById('kpi-hinge-video');

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
      kpiHingeDesc.innerHTML = linkifyMetrics(
        escapeHtml(hp.description || 'Jugada clave registrada')
      );
    }
    if (kpiHingeVideo) {
      const vidInfo = resolvePlayVideoLinks(hp, topHingeCandidate.game);
      if (vidInfo.videoUrl) {
        const btnLabel = vidInfo.hasDirectVideo
          ? '▶ Video Oficial ESPN ↗'
          : '▶ Ver Video de la Jugada ↗';
        const pbpHtml = vidInfo.espnPlayUrl
          ? `<a href="${escapeHtml(vidInfo.espnPlayUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 font-mono-num text-[10px] font-medium text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300" title="Abrir Play-by-Play oficial en ESPN">Play-by-Play ↗</a>`
          : '';
        kpiHingeVideo.innerHTML = `
          <div class="flex flex-wrap items-center gap-1.5">
            <a href="${escapeHtml(vidInfo.videoUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 font-mono-num text-[10px] font-bold text-rose-200 transition hover:bg-rose-500/30 hover:text-white" title="${escapeHtml(vidInfo.videoSource)}">
              ${btnLabel}
            </a>
            ${pbpHtml}
          </div>
        `;
      } else {
        kpiHingeVideo.innerHTML = '';
      }
    }
  }
}

/* ========================================================================== */
/* UTILIDADES DE ENLACE PROFUNDO A LA SECCIÓN DE METODOLOGÍA Y VIDEO          */
/* ========================================================================== */

/**
 * Resuelve los enlaces de video y Play-by-Play para una Jugada Bisagra o momento crítico.
 * Usa `play.video_url` precalculado por `src/ingest_espn.py` o construye el enlace
 * de búsqueda de highlights de la jugada si el JSON proviene de un corte anterior.
 * @param {Record<string, any>} play
 * @param {Record<string, any>} [game]
 * @returns {{ videoUrl: string, espnPlayUrl: string, hasDirectVideo: boolean, videoSource: string }}
 */
function resolvePlayVideoLinks(play, game = {}) {
  if (!play || typeof play !== 'object') {
    return { videoUrl: '', espnPlayUrl: '', hasDirectVideo: false, videoSource: '' };
  }

  const eventId = String(game?.event_id || '');
  const awayAbbr = String(game?.away_team?.name || game?.away_team?.abbreviation || 'NFL');
  const homeAbbr = String(game?.home_team?.name || game?.home_team?.abbreviation || 'NFL');
  const qtr = Number(play.qtr || 0);
  const qtrLabel = qtr >= 5 ? 'OT' : qtr > 0 ? `Q${qtr}` : '';

  const hasDirectVideo = Boolean(play.has_direct_video);
  let videoUrl = String(play.video_url || '').trim();

  if (!videoUrl) {
    const desc = String(play.description || '').replace(/\([^)]*\)/g, ' ').trim();
    const shortDesc = desc.split(/\s+/).slice(0, 8).join(' ');
    const query = ['NFL', `${awayAbbr} vs ${homeAbbr}`, shortDesc, qtrLabel, 'highlight']
      .filter(Boolean)
      .join(' ');
    videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  const espnPlayUrl = String(
    play.espn_play_url ||
      game?.game_links?.pbp ||
      game?.game_links?.recap ||
      (eventId ? `https://www.espn.com/nfl/playbyplay/_/gameId/${eventId}` : '')
  ).trim();

  const videoSource = String(
    play.video_source || (hasDirectVideo ? 'ESPN Video Oficial' : 'YouTube NFL Highlights')
  );

  return { videoUrl, espnPlayUrl, hasDirectVideo, videoSource };
}

/**
 * Devuelve el ancla metodológica correspondiente a una posición.
 * @param {string} pos
 * @returns {string}
 */
function getPositionMethodologyAnchor(pos) {
  const clean = String(pos || 'QB').toUpperCase().trim();
  if (clean === 'RB') return '#metodo-ecuacion-rb';
  if (clean === 'WR' || clean === 'TE') return '#metodo-ecuacion-wr-te';
  return '#metodo-ecuacion-qb';
}

/**
 * Convierte menciones de métricas estadísticas en texto ya escapado (HTML-safe)
 * en enlaces directos (`<a href="#metodo-...">`) hacia la sección de Metodología.
 * Usa una única pasada regex para no anidar etiquetas.
 * @param {string} escapedText
 * @returns {string}
 */
function linkifyMetrics(escapedText) {
  if (!escapedText) return '';
  const pattern =
    /\b(Score de Impacto|Impact Score|Indice de Inflacion Estadistica|Índice de Inflación Estadística|Indice de Inflacion|Índice de Inflación|inflation_index|Estadistico Inflado|Estadístico Inflado|MVP Real|EPA competitivo|EPA Comp\.?|EPA\/dropback|EPA\/jugada|EPA\/target|EPA_per_dropback|EPA_per_rush_and_rec|EPA_per_target|YAC_EPA|YAC EPA|yac_epa|Success_Rate|Success Rate|success_rate|Win Probability|winprobability|Jugadas Bisagra|Jugada Bisagra|jugadas bisagra|jugada bisagra|Momentos Criticos|Momentos Críticos|momentos criticos|momentos críticos|Minutos Basura|minutos basura|Garbage Time|delta_wp|WPA_total|WPA|CPOE|EPA|WP)\b|(\|&Delta;WP\||&Delta;WP|ΔWP)/g;

  return escapedText.replace(pattern, (match) => {
    const lower = match.toLowerCase();
    let href = '#glossary-methodology-section';
    let colorClass = 'text-emerald-300';

    if (lower.includes('score')) {
      href = '#metodo-score-impacto';
      colorClass = 'text-emerald-300';
    } else if (
      lower.includes('inflacion') ||
      lower.includes('inflación') ||
      lower.includes('inflation') ||
      lower.includes('inflado')
    ) {
      href = '#metodo-inflacion';
      colorClass = 'text-amber-300';
    } else if (
      lower.includes('basura') ||
      lower.includes('garbage') ||
      lower.includes('mvp real') ||
      lower.includes('epa comp')
    ) {
      href = '#metodo-epa-comp';
      colorClass = 'text-emerald-300';
    } else if (lower.includes('yac')) {
      href = '#metodo-yac-epa';
      colorClass = 'text-amber-300';
    } else if (lower.includes('cpoe')) {
      href = '#metodo-cpoe';
      colorClass = 'text-indigo-300';
    } else if (lower.includes('success')) {
      href = '#metodo-success-rate';
      colorClass = 'text-cyan-300';
    } else if (
      lower.includes('bisagra') ||
      lower.includes('critico') ||
      lower.includes('crítico') ||
      lower.includes('delta_wp') ||
      lower.includes('δwp') ||
      lower.includes('deltawp') ||
      match.includes('ΔWP')
    ) {
      href = '#metodo-jugada-bisagra';
      colorClass = 'text-rose-300';
    } else if (lower === 'wpa' || lower === 'wpa_total') {
      href = '#metodo-wpa';
      colorClass = 'text-cyan-300';
    } else if (lower.includes('epa')) {
      href = '#metodo-epa';
      colorClass = 'text-emerald-300';
    } else if (lower === 'wp' || lower.includes('win probability') || lower === 'winprobability') {
      href = '#metodo-wp';
      colorClass = 'text-cyan-300';
    }

    return `<a href="${href}" class="metric-ref-link font-mono-num ${colorClass}" title="Ver definicion en Metodologia">${match}</a>`;
  });
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

function getActiveRankingsSlice() {
  const rankings = appState.rankings || {};
  const scopes = rankings.rankings_by_scope || {};
  const scopeKey = appState.rankingScopeFilter || 'ALL';

  if (scopeKey !== 'ALL' && scopes[scopeKey]) {
    const sc = scopes[scopeKey];
    return {
      players: Array.isArray(sc.players) ? sc.players : [],
      mvp_real: sc.mvp_real || null,
      inflated_stat_leader: sc.inflated_stat_leader || null,
      label: sc.label || scopeKey,
    };
  }

  const cov = rankings.season_coverage || {};
  const weeks = Array.isArray(cov.weeks_included) && cov.weeks_included.length
    ? cov.weeks_included
    : [1, 2, 3, 4, 5, 6];
  const minW = Math.min(...weeks);
  const maxW = Math.max(...weeks);
  const gamesMon = cov.games_monitored || 93;

  return {
    players: Array.isArray(rankings.players) ? rankings.players : [],
    mvp_real: rankings.mvp_real || null,
    inflated_stat_leader: rankings.inflated_stat_leader || null,
    label: `Temporada Completa (Sem. ${minW}-${maxW} · ${gamesMon} part.)`,
  };
}

function populateScoreboardSelectors() {
  const scoreboard = appState.scoreboard;
  const rankings = appState.rankings || {};
  const allGames = Array.isArray(scoreboard?.games) ? scoreboard.games : [];

  const weekSelect = document.getElementById('scoreboard-week-select');
  if (weekSelect) {
    const weeksSet = new Set();
    allGames.forEach((g) => {
      const w = Number(g.week || scoreboard?.week || 0);
      if (w > 0) weeksSet.add(w);
    });
    const weeks = Array.from(weeksSet).sort((a, b) => b - a);
    const minW = weeks.length ? Math.min(...weeks) : 1;
    const maxW = weeks.length ? Math.max(...weeks) : 1;

    const currentVal = appState.gameWeekFilter || 'ALL';
    weekSelect.innerHTML = [
      `<option value="ALL">Todas (Sem. ${minW}-${maxW} · ${allGames.length} part.)</option>`,
      ...weeks.map((w) => {
        const countW = allGames.filter((g) => Number(g.week || scoreboard?.week || 0) === w).length;
        const isCurrent = w === Number(scoreboard?.week || maxW);
        return `<option value="${w}">Semana ${w}${isCurrent ? ' (Actual)' : ''} (${countW} part.)</option>`;
      }),
    ].join('');
    weekSelect.value = weeks.map(String).includes(String(currentVal)) ? String(currentVal) : 'ALL';
  }

  const teamsMap = new Map();
  allGames.forEach((g) => {
    const awayAbbr = g?.away_team?.abbreviation;
    const awayName = g?.away_team?.name;
    const homeAbbr = g?.home_team?.abbreviation;
    const homeName = g?.home_team?.name;
    if (awayAbbr) teamsMap.set(awayAbbr, awayName || awayAbbr);
    if (homeAbbr) teamsMap.set(homeAbbr, homeName || homeAbbr);
  });
  (Array.isArray(rankings.players) ? rankings.players : []).forEach((p) => {
    if (p.team && !teamsMap.has(p.team)) {
      teamsMap.set(p.team, p.team);
    }
  });
  const sortedTeams = Array.from(teamsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const teamSelect = document.getElementById('scoreboard-team-select');
  if (teamSelect) {
    const currentTeam = appState.gameTeamFilter || 'ALL';
    teamSelect.innerHTML = [
      `<option value="ALL">Todos (${sortedTeams.length})</option>`,
      ...sortedTeams.map(
        ([abbr, name]) => `<option value="${escapeHtml(abbr)}">${escapeHtml(abbr)} - ${escapeHtml(name)}</option>`
      ),
    ].join('');
    teamSelect.value = teamsMap.has(currentTeam) ? currentTeam : 'ALL';
  }

  // Poblar Selector de Periodo/Semana en la sección de Ranking (#ranking-scope-select)
  const rankingScopeSelect = document.getElementById('ranking-scope-select');
  if (rankingScopeSelect) {
    const cov = rankings.season_coverage || {};
    const weeksInc = Array.isArray(cov.weeks_included) && cov.weeks_included.length
      ? cov.weeks_included
      : [1, 2, 3, 4, 5, 6];
    const minW = Math.min(...weeksInc);
    const maxW = Math.max(...weeksInc);
    const gamesMon = cov.games_monitored || 93;
    const scopes = rankings.rankings_by_scope || {};

    const cumOptions = weeksInc
      .filter((w) => w > 1 && w < maxW && scopes[`CUM_${w}`])
      .sort((a, b) => b - a)
      .map((w) => {
        const sc = scopes[`CUM_${w}`];
        return `<option value="CUM_${w}">${escapeHtml(sc.label)}</option>`;
      });

    const weekOptions = [...weeksInc]
      .sort((a, b) => b - a)
      .filter((w) => scopes[`WEEK_${w}`])
      .map((w) => {
        const sc = scopes[`WEEK_${w}`];
        return `<option value="WEEK_${w}">${escapeHtml(sc.label)}</option>`;
      });

    const currentScope = appState.rankingScopeFilter || 'ALL';
    rankingScopeSelect.innerHTML = [
      `<option value="ALL">Temporada Completa (Sem. ${minW}-${maxW} · ${gamesMon} part.)</option>`,
      ...(cumOptions.length ? [`<optgroup label="Acumulado Progresivo">${cumOptions.join('')}</optgroup>`] : []),
      ...(weekOptions.length ? [`<optgroup label="Por Semana Individual">${weekOptions.join('')}</optgroup>`] : []),
    ].join('');
    if (currentScope === 'ALL' || scopes[currentScope]) {
      rankingScopeSelect.value = currentScope;
    }
  }

  // Poblar Selector de Equipo en la sección de Ranking (#ranking-team-select)
  const rankingTeamSelect = document.getElementById('ranking-team-select');
  if (rankingTeamSelect) {
    const currentRTeam = appState.rankingTeamFilter || 'ALL';
    rankingTeamSelect.innerHTML = [
      `<option value="ALL">Todos (${sortedTeams.length})</option>`,
      ...sortedTeams.map(
        ([abbr, name]) => `<option value="${escapeHtml(abbr)}">${escapeHtml(abbr)} - ${escapeHtml(name)}</option>`
      ),
    ].join('');
    rankingTeamSelect.value = teamsMap.has(currentRTeam) ? currentRTeam : 'ALL';
  }
}

function renderScoreboardSection() {
  const container = document.getElementById('scoreboard-grid');
  if (!container) return;

  const scoreboard = appState.scoreboard;
  const rankings = appState.rankings || {};
  const allGames = Array.isArray(scoreboard?.games) ? scoreboard.games : [];

  // Actualizar Barra de Cobertura de Temporada Regular (Sin Pretemporada)
  const covSummaryEl = document.getElementById('season-coverage-summary');
  const covStatusEl = document.getElementById('season-coverage-filter-status');

  const weeksAvail =
    Array.isArray(scoreboard?.weeks_available) && scoreboard.weeks_available.length > 0
      ? scoreboard.weeks_available
      : [scoreboard?.week || 1];
  const minW = Math.min(...weeksAvail);
  const maxW = Math.max(...weeksAvail);
  const completedTotal = allGames.filter(
    (g) => String(g?.status?.state || '').toLowerCase() === 'post' || Boolean(g?.status?.completed)
  ).length;
  const hingeGamesTotal = allGames.filter(
    (g) =>
      Boolean(g?.hinge_play?.exceeds_threshold) ||
      Math.abs(Number(g?.hinge_play?.abs_delta_wp ?? 0)) >= 0.12
  ).length;
  const covObj = rankings.season_coverage || {};
  const compPlaysText = covObj.competitive_plays
    ? ` | ${Number(covObj.competitive_plays).toLocaleString('en-US')} jugadas competitivas nflverse`
    : '';

  if (covSummaryEl) {
    covSummaryEl.innerHTML = ` Temporada ${escapeHtml(scoreboard?.season || 2026)} (Semanas ${minW} a ${maxW}): <strong class="text-white">${allGames.length} partidos oficiales</strong> (${completedTotal} finalizados, <strong class="text-amber-300">${hingeGamesTotal} con Jugada Bisagra</strong>)${escapeHtml(compPlaysText)}.`;
  }

  if (allGames.length === 0) {
    container.innerHTML = `
      <div class="col-span-full rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
        <p class="text-sm font-semibold text-slate-300">No hay partidos registrados en el corte actual.</p>
        <p class="mt-1 text-xs text-slate-500">Ejecuta <code class="font-mono-num text-slate-400">python -m src.ingest_espn</code> para poblar <code class="font-mono-num text-slate-400">public/data/live_scoreboard.json</code>.</p>
      </div>
    `;
    return;
  }

  // Filtrar según Semana, Equipo y Estado seleccionado
  const filteredGames = allGames.filter((game) => {
    const gWeek = String(game.week || scoreboard?.week || 1);
    if (appState.gameWeekFilter !== 'ALL' && gWeek !== String(appState.gameWeekFilter)) {
      return false;
    }
    if (
      appState.gameTeamFilter !== 'ALL' &&
      game?.away_team?.abbreviation !== appState.gameTeamFilter &&
      game?.home_team?.abbreviation !== appState.gameTeamFilter
    ) {
      return false;
    }

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

  if (covStatusEl) {
    const weekLabel =
      appState.gameWeekFilter === 'ALL' ? `Sem. ${minW}-${maxW}` : `Semana ${appState.gameWeekFilter}`;
    const teamLabel = appState.gameTeamFilter === 'ALL' ? 'Todos los equipos' : appState.gameTeamFilter;
    covStatusEl.textContent = `Mostrando ${filteredGames.length} de ${allGames.length} partidos (${weekLabel} · ${teamLabel})`;
  }

  if (filteredGames.length === 0) {
    container.innerHTML = `
      <div class="col-span-full rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-xs text-slate-400">
        Ningun partido coincide con el filtro seleccionado (<code class="font-mono-num text-cyan-300">Semana: ${escapeHtml(appState.gameWeekFilter)} | Equipo: ${escapeHtml(appState.gameTeamFilter)} | Estado: ${escapeHtml(appState.gameFilter)}</code>).
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
      const gameWeek = Number(game.week || scoreboard?.week || 1);
      const gameSeasonType = escapeHtml(game.season_type || 'REG');

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
        const vidInfo = resolvePlayVideoLinks(hingePlay, game);

        const borderClass = isCritical
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/70';
        const badgeClass = isCritical
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700';

        const videoBtnClass = vidInfo.hasDirectVideo
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30'
          : 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/30';
        const videoBtnLabel = vidInfo.hasDirectVideo
          ? '▶ Video Oficial ESPN ↗'
          : '▶ Ver Video de la Jugada ↗';

        hingeHtml = `
          <div class="mt-3.5 rounded-lg border ${borderClass} p-3">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <a href="#metodo-jugada-bisagra" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase transition ${badgeClass}" title="Ver metodologia de Jugada Bisagra">
                ${isCritical ? '⚡ Jugada Bisagra (|ΔWP| >= 12%)' : 'Mayor Variacion WP'}
              </a>
              <a href="#metodo-jugada-bisagra" class="metric-ref-link font-mono-num text-xs font-extrabold ${rawDelta >= 0 ? 'text-emerald-400' : 'text-cyan-400'}" title="Ver calculo de variacion de Win Probability">
                ${formatSigned(deltaPct, 1, '% WP')} (${favTeamAbbr})
              </a>
            </div>
            <p class="mt-1.5 text-xs leading-snug text-slate-200">
              ${escapeHtml(hingePlay.description || 'Jugada clave')}
            </p>
            <div class="mt-2 flex items-center justify-between font-mono-num text-[11px] text-slate-400">
              <span>Q${escapeHtml(hingePlay.qtr || 4)} - ${escapeHtml(hingePlay.clock || '0:00')}</span>
              <a href="#metodo-wp" class="metric-ref-link text-slate-300" title="Ver metodologia de Win Probability (WP)">WP ${homeAbbr}: ${beforePct.toFixed(1)}% -&gt; ${afterPct.toFixed(1)}%</a>
            </div>
            <div class="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/70 pt-2">
              <a href="${escapeHtml(vidInfo.videoUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono-num text-[10px] font-bold transition ${videoBtnClass}" title="${escapeHtml(vidInfo.videoSource)}">
                ${videoBtnLabel}
              </a>
              ${
                vidInfo.espnPlayUrl
                  ? `<a href="${escapeHtml(vidInfo.espnPlayUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-[#090D16] px-2 py-0.5 font-mono-num text-[10px] font-medium text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300" title="Ver registro Play-by-Play oficial en ESPN">Play-by-Play ESPN ↗</a>`
                  : ''
              }
            </div>
          </div>
        `;
      } else {
        hingeHtml = `
          <div class="mt-3.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 text-center font-mono-num text-[11px] text-slate-500">
            Sin variaciones <a href="#metodo-jugada-bisagra" class="metric-ref-link text-slate-400">|&Delta;WP| &ge; 12%</a> registradas en este encuentro
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
            const mVid = resolvePlayVideoLinks(m, game);
            return `
              <li class="rounded border border-slate-800/90 bg-[#090D16]/70 p-2 text-[11px]">
                <div class="flex flex-wrap items-center justify-between gap-1 font-mono-num">
                  <a href="#metodo-jugada-bisagra" class="metric-ref-link font-bold text-amber-300">#${idx + 1} | Q${escapeHtml(m.qtr || 4)} ${escapeHtml(m.clock || '0:00')}</a>
                  <div class="flex items-center gap-2">
                    <a href="#metodo-wpa" class="metric-ref-link font-semibold text-white" title="Ver metodologia de WPA y Delta WP">${formatSigned(dPct, 1, '% WP')} (${wpBefore.toFixed(0)}% -&gt; ${wpAfter.toFixed(0)}%)</a>
                    <a href="${escapeHtml(mVid.videoUrl)}" target="_blank" rel="noopener noreferrer" class="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 transition hover:bg-rose-500/30 hover:text-white" title="Ver video de esta jugada (${escapeHtml(mVid.videoSource)})">▶ Video ↗</a>
                  </div>
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
              <div class="flex items-center gap-1.5">
                <span class="font-mono-num text-xs font-bold tracking-wide text-slate-300">
                  ${awayAbbr} @ ${homeAbbr}
                </span>
                <span class="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-cyan-300">
                  Sem. ${gameWeek} · ${gameSeasonType}
                </span>
              </div>
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
                <a href="#metodo-wp" class="metric-ref-link text-cyan-300" title="Ver metodologia de Win Probability (WP)">${awayAbbr} WP: <strong>${awayWpPct.toFixed(1)}%</strong></a>
                <a href="#metodo-wp" class="metric-ref-link text-emerald-300" title="Ver metodologia de Win Probability (WP)"><strong>${homeWpPct.toFixed(1)}%</strong> :WP ${homeAbbr}</a>
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
  const activeScopeLabel = document.getElementById('rankings-active-scope-label');

  if (!tbody) return;

  const activeSlice = getActiveRankingsSlice();
  const allPlayers = activeSlice.players;
  const mvpId = activeSlice.mvp_real?.player_id || allPlayers[0]?.player_id || null;
  const inflatedId = activeSlice.inflated_stat_leader?.player_id || null;

  if (totalCountEl) totalCountEl.textContent = String(allPlayers.length);
  if (activePosLabel) {
    const teamText = appState.rankingTeamFilter !== 'ALL' ? ` | Equipo: ${appState.rankingTeamFilter}` : '';
    activePosLabel.textContent = sanitizeHyphens(
      `(Posicion: ${appState.positionFilter === 'ALL' ? 'Todos' : appState.positionFilter}${teamText})`
    );
  }
  if (activeScopeLabel) {
    activeScopeLabel.textContent = sanitizeHyphens(`[${activeSlice.label}]`);
  }

  // 1. Filtrar por equipo, posición y búsqueda
  const query = appState.searchQuery.trim().toLowerCase();
  const filtered = allPlayers.filter((p) => {
    const pos = String(p.position || '').toUpperCase();
    const team = String(p.team || '').toUpperCase();
    if (appState.positionFilter !== 'ALL' && pos !== appState.positionFilter) {
      return false;
    }
    if (appState.rankingTeamFilter !== 'ALL' && team !== appState.rankingTeamFilter) {
      return false;
    }
    if (query) {
      const name = String(p.player_name || p.name || '').toLowerCase();
      return name.includes(query) || team.toLowerCase().includes(query) || pos.toLowerCase().includes(query);
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
      const posAnchor = getPositionMethodologyAnchor(pos);

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

      // Badges especiales de auditoría con enlace directo a Metodología
      let specialBadgesHtml = '';
      if (isMvp) {
        specialBadgesHtml += `
          <a href="#metodo-epa-comp" class="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/35" title="Ver metodologia de MVP Real en Tiempo Competitivo">
            ★ MVP REAL
          </a>
        `;
      }
      if (isInflatedLeader) {
        specialBadgesHtml += `
          <a href="#metodo-inflacion" class="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/35" title="Ver metodologia de Estadistico Inflado e Indice de Inflacion">
            ⚠ ESTADISTICO INFLADO
          </a>
        `;
      } else if (inflIndex >= 15 || gtYards >= 120) {
        specialBadgesHtml += `
          <a href="#metodo-inflacion" class="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono-num text-[10px] font-medium text-amber-300 transition hover:bg-amber-500/25" title="Ver metodologia de Indice de Inflacion">
            Inflacion Alta
          </a>
        `;
      }

      // Columna CPOE / YAC EPA contextual por posición (con enlaces a #metodo-cpoe / #metodo-yac-epa)
      let secondaryMetricHtml = '';
      if (pos === 'QB') {
        secondaryMetricHtml = `
          <a href="#metodo-cpoe" class="block font-mono-num font-semibold ${cpoeVal >= 0 ? 'text-emerald-300' : 'text-rose-300'} hover:underline" title="Ver metodologia de CPOE">
            ${formatSigned(cpoeVal, 1, '%')}
          </a>
          <a href="#metodo-cpoe" class="metric-ref-link font-mono-num text-[10px] text-slate-500">CPOE</a>
        `;
      } else if (pos === 'WR' || pos === 'TE') {
        secondaryMetricHtml = `
          <a href="#metodo-yac-epa" class="block font-mono-num font-semibold ${yacEpaVal >= 0 ? 'text-cyan-300' : 'text-rose-300'} hover:underline" title="Ver metodologia de YAC EPA">
            ${formatSigned(yacEpaVal, 2)}
          </a>
          <a href="#metodo-yac-epa" class="metric-ref-link font-mono-num text-[10px] text-slate-500">YAC EPA</a>
        `;
      } else {
        secondaryMetricHtml = `
          <a href="#metodo-ecuacion-rb" class="block font-mono-num font-semibold text-slate-300 hover:underline" title="Ver ecuacion y minimo de participacion de RB">
            ${formatNumber(player.opportunities_per_week, 1)}
          </a>
          <a href="#metodo-ecuacion-rb" class="metric-ref-link font-mono-num text-[10px] text-slate-500">Touches/sem</a>
        `;
      }

      const posBadgeColors = {
        QB: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25',
        RB: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25',
        WR: 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/25',
        TE: 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/25',
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
              <a href="${posAnchor}" class="metric-ref-link text-slate-400" title="Ver minimo de participacion posicional">Oportunidades</a>: ${Number(player.competitive_opportunities ?? player.opportunities ?? 0)} comp / ${Number(player.raw_opportunities ?? player.opportunities ?? 0)} tot (${Number(player.weeks_played ?? 1)} sem)
            </div>
          </td>

          <!-- Posición (enlaza a la ecuación posicional) -->
          <td class="py-3 px-2 text-center">
            <a href="${posAnchor}" class="inline-block rounded border px-2 py-0.5 font-mono-num text-[11px] font-bold transition ${posBadgeClass}" title="Ver ecuacion Z-Score para ${pos}">
              ${pos}
            </a>
          </td>

          <!-- Score de Impacto (0-100) -->
          <td class="py-3 px-3">
            <a href="#metodo-score-impacto" class="flex items-center gap-2.5 group" title="Ver metodologia de Score de Impacto (0-100)">
              <span class="inline-block w-12 rounded border px-1.5 py-0.5 text-center font-mono-num text-xs font-extrabold transition group-hover:scale-105 ${badgeClass}">
                ${impactScore.toFixed(1)}
              </span>
              <div class="hidden sm:block h-2 flex-1 min-w-[72px] max-w-[110px] overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div class="h-full rounded-full ${barClass}" style="width: ${Math.max(2, Math.min(100, impactScore))}%"></div>
              </div>
            </a>
          </td>

          <!-- EPA / Jugada (Sin Minutos Basura) -->
          <td class="py-3 px-3 text-right">
            <a href="#metodo-epa" class="block font-mono-num font-bold ${epaPerPlay >= 0 ? 'text-emerald-400' : 'text-rose-400'} hover:underline" title="Ver metodologia de EPA">
              ${formatSigned(epaPerPlay, 3)}
            </a>
            <div class="font-mono-num text-[10px] text-slate-500">
              <a href="#metodo-epa-comp" class="metric-ref-link" title="EPA Competitivo vs EPA Bruto">Tot: ${formatSigned(epaTotal, 1)} | Bruto: ${formatSigned(rawEpaPerPlay, 3)}</a>
            </div>
          </td>

          <!-- WPA Total -->
          <td class="py-3 px-3 text-right">
            <a href="#metodo-wpa" class="block font-mono-num font-semibold ${wpaTotal >= 0 ? 'text-cyan-300' : 'text-rose-300'} hover:underline" title="Ver metodologia de WPA (Win Probability Added)">
              ${formatSigned(wpaTotal, 3)}
            </a>
            <div class="font-mono-num text-[10px] text-slate-500">
              <a href="#metodo-wpa" class="metric-ref-link">Bruto: ${formatSigned(rawWpaTotal, 3)}</a>
            </div>
          </td>

          <!-- CPOE / YAC EPA -->
          <td class="py-3 px-3 text-right">
            ${secondaryMetricHtml}
          </td>

          <!-- Success Rate -->
          <td class="py-3 px-3 text-right font-mono-num">
            <a href="#metodo-success-rate" class="block font-semibold text-slate-200 hover:underline" title="Ver metodologia de Success Rate">${srPct.toFixed(1)}%</a>
            <a href="#metodo-epa" class="metric-ref-link text-[10px] text-slate-500">EPA &gt; 0</a>
          </td>

          <!-- Yardas Competitivas vs Brutas (Basura) -->
          <td class="py-3 px-3 text-right font-mono-num">
            <a href="#metodo-epa-comp" class="block text-slate-200 hover:underline" title="Ver filtro de Tiempo Competitivo vs Minutos Basura">
              <span class="font-semibold text-white">${compYards.toFixed(0)}</span>
              <span class="text-slate-500">/</span>
              <span class="text-slate-400">${rawYards.toFixed(0)} yds</span>
            </a>
            <a href="#metodo-epa-comp" class="metric-ref-link text-[10px] ${gtYards > 0 ? 'text-amber-300' : 'text-slate-500'}">
              Basura: +${gtYards.toFixed(0)} yds (${gtPlays} jug)
            </a>
          </td>

          <!-- Índice de Inflación Estadística -->
          <td class="py-3 pl-3 pr-4 text-right font-mono-num">
            <a href="#metodo-inflacion" class="inline-block rounded border px-2 py-0.5 text-xs font-bold transition hover:scale-105 ${
              isInflatedLeader || inflIndex >= 15
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }" title="Ver metodologia de Indice de Inflacion Estadistica">
              ${inflIndex.toFixed(2)}
            </a>
            <div class="mt-0.5 text-[10px] ${epaDelta > 0.5 ? 'text-amber-400' : 'text-slate-500'}">
              <a href="#metodo-inflacion" class="metric-ref-link">&Delta;EPA: ${formatSigned(epaDelta, 2)}</a>
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
 * Renderiza píldoras de métricas numéricas citadas, enlazando cada una a su bloque
 * en la sección de Metodología.
 * @param {Record<string, any>} metricsObj
 * @returns {string}
 */
function renderMetricsPills(metricsObj) {
  if (!metricsObj || typeof metricsObj !== 'object') return '';
  const metaMap = {
    impact_score: { label: 'Impact Score', href: '#metodo-score-impacto' },
    epa_total: { label: 'EPA Comp', href: '#metodo-epa-comp' },
    raw_epa_total: { label: 'EPA Bruto', href: '#metodo-epa' },
    epa_per_play: { label: 'EPA/Jugada', href: '#metodo-epa' },
    wpa_total: { label: 'WPA Total', href: '#metodo-wpa' },
    cpoe: { label: 'CPOE %', href: '#metodo-cpoe' },
    yac_epa: { label: 'YAC EPA', href: '#metodo-yac-epa' },
    success_rate_pct: { label: 'Success %', href: '#metodo-success-rate' },
    success_rate: { label: 'Success Rate', href: '#metodo-success-rate' },
    inflation_index: { label: 'Indice Inflacion', href: '#metodo-inflacion' },
    epa_inflation_delta: { label: 'ΔEPA Basura', href: '#metodo-inflacion' },
    raw_yards: { label: 'Yds Brutas', href: '#metodo-epa-comp' },
    competitive_yards: { label: 'Yds Comp', href: '#metodo-epa-comp' },
    garbage_time_yards: { label: 'Yds Basura', href: '#metodo-epa-comp' },
    home_wp: { label: 'WP Local', href: '#metodo-wp' },
    delta_wp: { label: 'ΔWP', href: '#metodo-jugada-bisagra' },
    abs_delta_wp: { label: '|ΔWP| Max', href: '#metodo-jugada-bisagra' },
    critical_plays_count: { label: 'Jugadas Bisagra', href: '#metodo-jugada-bisagra' },
    qtr: { label: 'Cuarto (Q)', href: '#metodo-epa-comp' },
  };

  return Object.entries(metricsObj)
    .map(([key, val]) => {
      if (val === null || val === undefined) return '';
      const info = metaMap[key] || { label: key, href: '#glossary-methodology-section' };
      let formatted = String(val);
      const num = Number(val);
      if (Number.isFinite(num)) {
        if (key === 'home_wp') {
          formatted = `${toPercentage(num).toFixed(1)}%`;
        } else if (key.includes('epa') || key.includes('wpa') || key.includes('delta_wp')) {
          formatted = formatSigned(num, 3);
        } else if (key.includes('yards')) {
          formatted = `${num.toFixed(0)} yds`;
        } else if (key === 'qtr') {
          formatted = `Q${num.toFixed(0)}`;
        } else {
          formatted = formatNumber(num, 2);
        }
      }
      return `
        <a href="${info.href}" class="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-[#090D16] px-2 py-0.5 font-mono-num text-[11px] text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-300" title="Ver metodologia de ${escapeHtml(info.label)}">
          <span class="text-slate-400 underline decoration-dotted underline-offset-2">${escapeHtml(info.label)}:</span>
          <strong class="text-white">${escapeHtml(formatted)}</strong>
        </a>
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
    summaryEl.innerHTML = linkifyMetrics(
      escapeHtml(
        critiquesData.executive_summary ||
          'Resumen ejecutivo pendiente de generacion.'
      )
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
    const mPosAnchor = getPositionMethodologyAnchor(mPos);
    if (mvpTitleEl) {
      mvpTitleEl.innerHTML = `${escapeHtml(mName)} (<a href="${mPosAnchor}" class="metric-ref-link text-emerald-300" title="Ver ecuacion de ${escapeHtml(mPos)}">${escapeHtml(mPos)}</a> - ${escapeHtml(mTeam)})`;
    }
    if (mvpScoreEl) mvpScoreEl.textContent = `${formatNumber(mvp.impact_score, 1)}`;
    if (mvpBodyEl) {
      mvpBodyEl.innerHTML = linkifyMetrics(
        escapeHtml(
          `Lider absoluto en valoracion limpia sin minutos basura. Registra ${formatSigned(mvp.epa_total, 2)} EPA competitivo total (${formatSigned(mvp.epa_per_play, 3)} EPA/jugada), WPA acumulado de ${formatSigned(mvp.wpa_total, 3)}, CPOE de ${formatSigned(mvp.cpoe, 2)}% y ${formatNumber(mvp.competitive_yards, 0)} yardas competitivas.`
        )
      );
    }
    if (mvpPillsEl) {
      mvpPillsEl.innerHTML = renderMetricsPills({
        impact_score: mvp.impact_score,
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
    const iPosAnchor = getPositionMethodologyAnchor(iPos);
    if (infTitleEl) {
      infTitleEl.innerHTML = `${escapeHtml(iName)} (<a href="${iPosAnchor}" class="metric-ref-link text-amber-300" title="Ver ecuacion de ${escapeHtml(iPos)}">${escapeHtml(iPos)}</a> - ${escapeHtml(iTeam)})`;
    }
    if (infIndexEl) infIndexEl.textContent = `${formatNumber(inflated.inflation_index, 2)}`;
    if (infBodyEl) {
      infBodyEl.innerHTML = linkifyMetrics(
        escapeHtml(
          `Mayor divergencia entre volumen bruto (${formatNumber(inflated.raw_yards, 0)} yds) y eficiencia en tiempo competitivo (${formatNumber(inflated.competitive_yards, 0)} yds). Acumula ${formatNumber(inflated.garbage_time_yards, 0)} yardas en minutos basura (Q4 con WP < 5% o > 95%) y una inflacion de EPA de ${formatSigned(inflated.epa_inflation_delta, 2)}.`
        )
      );
    }
    if (infPillsEl) {
      infPillsEl.innerHTML = renderMetricsPills({
        inflation_index: inflated.inflation_index,
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

  const scoreboardGames = Array.isArray(state.scoreboard?.games) ? state.scoreboard.games : [];

  critiquesGrid.innerHTML = list
    .map((item) => {
      const category = escapeHtml(item.category || item.type || 'Analisis');
      const title = linkifyMetrics(escapeHtml(item.title || item.headline || 'Cronica Cuantitativa'));
      const subtitle = linkifyMetrics(escapeHtml(item.subtitle || ''));
      const body = linkifyMetrics(escapeHtml(item.body || ''));
      const teams = Array.isArray(item.teams) ? item.teams : [];

      let catBadgeClass = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
      let catHref = '#metodo-jugada-bisagra';
      if (category.toLowerCase().includes('mvp')) {
        catBadgeClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
        catHref = '#metodo-epa-comp';
      } else if (category.toLowerCase().includes('inflado') || category.toLowerCase().includes('inflacion')) {
        catBadgeClass = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
        catHref = '#metodo-inflacion';
      }

      const teamsHtml = teams
        .map(
          (t) =>
            `<span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-slate-300">${escapeHtml(t)}</span>`
        )
        .join('');

      // Si la crónica corresponde a un partido con Jugada Bisagra, añadir enlace de video
      const matchedGame = scoreboardGames.find(
        (g) =>
          (item.event_id && String(g.event_id) === String(item.event_id)) ||
          (teams.length === 2 &&
            g.away_team?.abbreviation === teams[0] &&
            g.home_team?.abbreviation === teams[1])
      );
      let critiqueVideoHtml = '';
      if (matchedGame && matchedGame.hinge_play) {
        const vInfo = resolvePlayVideoLinks(matchedGame.hinge_play, matchedGame);
        if (vInfo.videoUrl) {
          critiqueVideoHtml = `
            <a href="${escapeHtml(vInfo.videoUrl)}" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 font-mono-num text-[10px] font-bold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/25 hover:text-white"
              title="${escapeHtml(vInfo.videoTitle)} (${escapeHtml(vInfo.videoSource)})">
              <span>▶ Video Jugada Bisagra</span>
              <span class="text-[9px] opacity-75">↗</span>
            </a>
          `;
        }
      }

      return `
        <article class="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-md transition hover:border-slate-700">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <a href="${catHref}" class="rounded border px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase transition hover:opacity-85 ${catBadgeClass}">
                ${category}
              </a>
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
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            <div class="flex flex-wrap gap-1.5">
              ${renderMetricsPills(item.metrics_cited || {})}
            </div>
            ${critiqueVideoHtml}
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
          ? 'game-filter-btn rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 transition'
          : 'game-filter-btn rounded-lg border border-slate-800 bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-white';
      });

      renderScoreboardSection();
    });
  });

  // 1B. Selector de Semana de Temporada Regular y Selector de Equipo en Scoreboard
  const weekSelect = document.getElementById('scoreboard-week-select');
  if (weekSelect) {
    weekSelect.addEventListener('change', (event) => {
      const val = event.target.value || 'ALL';
      appState.gameWeekFilter = val;
      // Si existe ese corte semanal en rankings_by_scope, sincronizar también el Ranking
      const scopes = appState.rankings?.rankings_by_scope || {};
      const rScopeSelect = document.getElementById('ranking-scope-select');
      if (val === 'ALL') {
        appState.rankingScopeFilter = 'ALL';
        if (rScopeSelect) rScopeSelect.value = 'ALL';
      } else if (scopes[`WEEK_${val}`]) {
        appState.rankingScopeFilter = `WEEK_${val}`;
        if (rScopeSelect) rScopeSelect.value = `WEEK_${val}`;
      }
      renderHeaderAndKpis();
      renderScoreboardSection();
      renderPlayerRankingsTable();
    });
  }

  const teamSelect = document.getElementById('scoreboard-team-select');
  if (teamSelect) {
    teamSelect.addEventListener('change', (event) => {
      const val = event.target.value || 'ALL';
      appState.gameTeamFilter = val;
      appState.rankingTeamFilter = val;
      const rTeamSelect = document.getElementById('ranking-team-select');
      if (rTeamSelect) rTeamSelect.value = val;
      renderHeaderAndKpis();
      renderScoreboardSection();
      renderPlayerRankingsTable();
    });
  }

  // 1C. Selector de Periodo/Semana y Selector de Equipo directamente en la Tabla de Ranking
  const rankingScopeSelect = document.getElementById('ranking-scope-select');
  if (rankingScopeSelect) {
    rankingScopeSelect.addEventListener('change', (event) => {
      appState.rankingScopeFilter = event.target.value || 'ALL';
      renderHeaderAndKpis();
      renderPlayerRankingsTable();
    });
  }

  const rankingTeamSelect = document.getElementById('ranking-team-select');
  if (rankingTeamSelect) {
    rankingTeamSelect.addEventListener('change', (event) => {
      const val = event.target.value || 'ALL';
      appState.rankingTeamFilter = val;
      appState.gameTeamFilter = val;
      if (teamSelect) teamSelect.value = val;
      renderHeaderAndKpis();
      renderScoreboardSection();
      renderPlayerRankingsTable();
    });
  }

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

  // 6. Resaltado interactivo al hacer clic en cualquier link hacia #metodo-*
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#metodo-"]');
    if (!anchor) return;
    const targetId = anchor.getAttribute('href')?.slice(1);
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    document.querySelectorAll('.method-card.method-highlight').forEach((el) => {
      el.classList.remove('method-highlight');
    });
    targetEl.classList.add('method-highlight');
    setTimeout(() => {
      targetEl.classList.remove('method-highlight');
    }, 2600);
  });
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

  populateScoreboardSelectors();
  renderHeaderAndKpis();
  renderScoreboardSection();
  renderPlayerRankingsTable();
  renderCritiquesSection();
}

document.addEventListener('DOMContentLoaded', () => {
  bindUiEvents();
  loadAllDashboardData();
});
