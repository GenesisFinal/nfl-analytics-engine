/**
 * NFL 360° Analytics Command Hub - Frontend Engine (v4.0)
 * Aesthetic: Mockup 5 (360° Modular Bento Command Hub) + Charts from Mockups 1-4.
 *
 * Strict Architecture Invariants (AGENTS.md):
 * 1. 100% Static Local JSON reads (./data/live_scoreboard.json, ./data/player_rankings.json,
 *    ./data/game_critiques.json, ./data/nfl_news.json). ZERO browser CORS calls to external APIs.
 * 2. Zero em-dashes or en-dashes anywhere; strictly use simple hyphen (-).
 * 3. Deep-link every statistical reference to its #metodo-* anchor in the Methodology section.
 */

const DATA_PATHS = {
  scoreboard: './data/live_scoreboard.json',
  rankings: './data/player_rankings.json',
  critiques: './data/game_critiques.json',
  news: './data/nfl_news.json',
};

const appState = {
  scoreboard: null,
  rankings: null,
  critiques: null,
  news: null,
  activeTab: 'hub',
  positionFilter: 'ALL',
  teamFilter: 'ALL',
  rankingWeekFilter: 'season',
  scoreboardWeekFilter: 'ALL',
  gameStatusFilter: 'ALL',
  bentoLayer: 'master',
  newsCategoryFilter: 'ALL',
  searchQuery: '',
  sortField: 'rank_overall',
  sortDirection: 'asc',
  spotlightPlayerId: null,
  savantTeamAbbr: 'ALL',
  h2hPlayerA: null,
  h2hPlayerB: null,
};

const NFL_TEAM_LOGOS = {
  ARI: 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
  ATL: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
  BAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
  BUF: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  CAR: 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
  CHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
  CIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
  CLE: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
  DAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
  DEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
  DET: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
  GB: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
  HOU: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
  IND: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
  JAX: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
  KC: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
  LAC: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  LA: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  LAR: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  LV: 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
  MIA: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
  MIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
  NE: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
  NO: 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
  NYG: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
  NYJ: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
  PHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
  PIT: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
  SEA: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
  SF: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  TB: 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
  TEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
  WAS: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
  WSH: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
};

function sanitizeHyphens(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/\u2014|\u2013/g, '-');
}

function escapeHtml(text) {
  const clean = sanitizeHyphens(text);
  const div = document.createElement('div');
  div.textContent = clean;
  return div.innerHTML;
}

function getTeamLogo(abbr) {
  if (!abbr) return '';
  const key = String(abbr).toUpperCase().trim();
  return NFL_TEAM_LOGOS[key] || '';
}

function formatSigned(val, decimals = 2, suffix = '') {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return 'N/A';
  const num = Number(val);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}${suffix}`;
}

function formatNum(val, decimals = 1, suffix = '') {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return 'N/A';
  return `${Number(val).toFixed(decimals)}${suffix}`;
}

function formatUtcTimestamp(isoStr) {
  if (!isoStr) return '--';
  try {
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return sanitizeHyphens(isoStr);
    return dt.toLocaleString('es-AR', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return sanitizeHyphens(isoStr);
  }
}

function normalizePlayerList(list) {
  if (!Array.isArray(list)) return [];
  const posCounters = {};
  return list.map((raw, idx) => {
    const p = { ...raw };
    const pos = p.position || 'WR';
    posCounters[pos] = (posCounters[pos] || 0) + 1;

    p.rank_overall = p.rank_overall ?? p.rank ?? idx + 1;
    p.rank_position = p.rank_position ?? posCounters[pos];
    p.epa_per_play_competitive = p.epa_per_play_competitive ?? p.epa_per_play ?? 0;
    p.wpa_competitive = p.wpa_competitive ?? p.wpa_total ?? 0;
    p.cpoe_competitive = p.cpoe_competitive ?? p.cpoe ?? 0;
    p.success_rate_competitive = p.success_rate_competitive ?? p.success_rate ?? 0;
    p.statistical_inflation_index = p.statistical_inflation_index ?? p.inflation_index ?? 0;
    p.garbage_yards = p.garbage_yards ?? p.garbage_time_yards ?? 0;
    p.yardage_inflation_pct = p.yardage_inflation_pct ?? p.yards_inflation_pct ?? 0;

    if (typeof p.ngs_primary_metric !== 'object' || p.ngs_primary_metric === null) {
      const val1 = Number(p.ngs_primary_metric ?? 0);
      p.ngs_primary_metric = {
        label: pos === 'QB' ? 'TTT' : pos === 'RB' ? 'RYOE/Att' : 'Sep',
        value: val1,
        unit: pos === 'QB' ? 's' : 'y',
      };
    }
    if (typeof p.ngs_secondary_metric !== 'object' || p.ngs_secondary_metric === null) {
      const val2 = Number(p.ngs_secondary_metric ?? 0);
      p.ngs_secondary_metric = {
        label: pos === 'QB' ? 'Agg%' : pos === 'RB' ? '8+Box' : 'Cush',
        value: val2,
        unit: pos === 'QB' || pos === 'RB' ? '%' : 'y',
      };
    }

    p.clutch_snaps = p.clutch_snaps ?? p.clutch_plays ?? Math.max(6, Math.round(Number(p.competitive_opportunities || 20) * 0.18));
    p.clutch_wpa_total = p.clutch_wpa_total ?? p.clutch_wpa ?? Number(p.wpa_competitive || 0) * 0.62;
    p.clutch_index =
      p.clutch_index ??
      Math.min(99.4, Math.max(25.0, Number(p.impact_score || 50) * 0.78 + Number(p.wpa_competitive || 0) * 16.0 + 14.0));

    return p;
  });
}

function normalizeTeamList(teams) {
  if (!Array.isArray(teams)) return [];
  const labelMap = {
    deep_left: { depth: 'deep', direction: 'left', label: 'Deep Left (>=15 yd)' },
    deep_middle: { depth: 'deep', direction: 'middle', label: 'Deep Middle (>=15 yd)' },
    deep_right: { depth: 'deep', direction: 'right', label: 'Deep Right (>=15 yd)' },
    short_left: { depth: 'short', direction: 'left', label: 'Short Left (<15 yd)' },
    short_middle: { depth: 'short', direction: 'middle', label: 'Short Middle (<15 yd)' },
    short_right: { depth: 'short', direction: 'right', label: 'Short Right (<15 yd)' },
  };

  return teams.map((raw, idx) => {
    const t = { ...raw };
    t.rank_team = t.rank_team ?? t.rank ?? idx + 1;
    t.def_epa_per_play = t.def_epa_per_play ?? t.def_epa_allowed ?? 0;

    if (t.pass_zones && !Array.isArray(t.pass_zones) && typeof t.pass_zones === 'object') {
      t.pass_zones = Object.keys(labelMap).map((zid) => {
        const z = t.pass_zones[zid] || {};
        return {
          zone_id: zid,
          ...labelMap[zid],
          attempts: Number(z.attempts || 0),
          completions: Number(z.completions || 0),
          comp_pct: Number(z.comp_pct || 0),
          epa_per_pass: Number(z.epa_per_pass ?? z.epa_per_play ?? 0),
          tds: Number(z.tds || 0),
        };
      });
    }
    return t;
  });
}

function normalizeAllData() {
  if (appState.rankings) {
    appState.rankings.players = normalizePlayerList(appState.rankings.players);
    const rawTeams = appState.rankings.team_rankings || appState.rankings.teams || [];
    appState.rankings.team_rankings = normalizeTeamList(rawTeams);
    appState.rankings.teams = appState.rankings.team_rankings;

    if (appState.rankings.rankings_by_scope) {
      Object.keys(appState.rankings.rankings_by_scope).forEach((k) => {
        const sc = appState.rankings.rankings_by_scope[k];
        if (sc && Array.isArray(sc.players)) {
          sc.players = normalizePlayerList(sc.players);
        }
        if (sc && Array.isArray(sc.teams)) {
          sc.teams = normalizeTeamList(sc.teams);
        }
      });
    }
  }

  if (appState.scoreboard && Array.isArray(appState.scoreboard.games)) {
    appState.scoreboard.games = appState.scoreboard.games.map((g) => {
      const game = { ...g };
      game.wp_series = (game.wp_series || game.wp_timeline || []).map((pt) => ({
        ...pt,
        home_wp: pt.home_wp ?? pt.homeWinPercentage ?? 0.5,
      }));
      if (game.hinge_play) {
        game.hinge_play = {
          ...game.hinge_play,
          video_search_url: game.hinge_play.video_search_url || game.hinge_play.youtube_search_url || game.hinge_play.video_url,
          social_clip_url: game.hinge_play.social_clip_url || game.hinge_play.x_video_url,
          exceeds_threshold: game.hinge_play.exceeds_threshold ?? Number(game.hinge_play.abs_delta_wp || 0) >= 0.12,
        };
      }
      if (Array.isArray(game.critical_moments)) {
        game.critical_moments = game.critical_moments.map((m) => ({
          ...m,
          video_search_url: m.video_search_url || m.youtube_search_url || m.video_url,
          social_clip_url: m.social_clip_url || m.x_video_url,
        }));
      }
      return game;
    });
  }

  if (appState.news && Array.isArray(appState.news.items)) {
    appState.news.items = appState.news.items.map((it) => ({
      ...it,
      headline: it.headline || it.title || '',
      source_badge: it.source_badge || it.short_label || it.source_name || 'NFL',
    }));
  }

  if (appState.critiques && appState.rankings) {
    if (!appState.critiques.real_mvp && appState.rankings.mvp_real) {
      const m = normalizePlayerList([appState.rankings.mvp_real])[0];
      appState.critiques.real_mvp = {
        ...m,
        analysis: `Lidera la NFL en tiempo competitivo con Impact Score ${formatNum(m.impact_score, 1)}, PFF Grade ${formatNum(m.pff_grade, 1)} y EPA/play ${formatSigned(m.epa_per_play_competitive, 3)}.`,
      };
    }
    if (!appState.critiques.inflated_stat_player && appState.rankings.inflated_stat_leader) {
      const inf = normalizePlayerList([appState.rankings.inflated_stat_leader])[0];
      appState.critiques.inflated_stat_player = {
        ...inf,
        analysis: `Registra un Indice de Inflacion de +${formatNum(inf.statistical_inflation_index, 1)} con ${inf.garbage_yards || 0} yardas acumuladas en minutos basura del 4to cuarto.`,
      };
    }
  }
}

function getActivePlayersDataset() {
  if (!appState.rankings) return [];
  const wk = appState.rankingWeekFilter;
  if (wk && wk !== 'season') {
    const byScope = appState.rankings.rankings_by_scope || {};
    if (byScope[wk] && Array.isArray(byScope[wk].players)) {
      return byScope[wk].players;
    }
    const byWeek = appState.rankings.rankings_by_week || {};
    const weekData = byWeek[String(wk)];
    if (weekData && Array.isArray(weekData.players)) {
      return weekData.players;
    }
  }
  return Array.isArray(appState.rankings.players) ? appState.rankings.players : [];
}

function getFilteredPlayers() {
  const raw = getActivePlayersDataset();
  const pos = appState.positionFilter;
  const team = appState.teamFilter;
  const q = appState.searchQuery.trim().toLowerCase();

  const filtered = raw.filter((p) => {
    if (pos !== 'ALL' && p.position !== pos) return false;
    if (team !== 'ALL' && p.team !== team) return false;
    if (q) {
      const hay = `${p.player_name || ''} ${p.team || ''} ${p.position || ''} ${p.college || ''} ${p.cap_roi_tier || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const field = appState.sortField;
  const dir = appState.sortDirection === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    let va = a[field];
    let vb = b[field];
    if (field === 'ngs_primary_value') {
      va = a.ngs_primary_metric ? a.ngs_primary_metric.value : null;
      vb = b.ngs_primary_metric ? b.ngs_primary_metric.value : null;
    }
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir;
    }
    return (Number(va) - Number(vb)) * dir;
  });

  return filtered;
}

function getPffBadgeHtml(grade, tier) {
  const num = Number(grade || 60);
  let colorClasses = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
  let ringColor = '#F59E0B';
  if (num >= 90) {
    colorClasses = 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300';
    ringColor = '#10B981';
  } else if (num >= 80) {
    colorClasses = 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300';
    ringColor = '#06B6D4';
  } else if (num >= 70) {
    colorClasses = 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300';
    ringColor = '#6366F1';
  }
  const cleanTier = sanitizeHyphens(tier || (num >= 90 ? 'ELITE' : num >= 80 ? 'HIGH QUALITY' : num >= 70 ? 'STARTER' : 'BACKUP'));
  return `
    <div class="inline-flex items-center gap-1.5" title="PFF Calibrated Grade: ${num.toFixed(1)} (${cleanTier})">
      <span class="pff-ring h-7 w-7 border-2 text-[11px] ${colorClasses}" style="border-color: ${ringColor}">
        ${num.toFixed(1)}
      </span>
      <span class="hidden sm:inline font-mono-num text-[9px] font-bold uppercase tracking-tight text-slate-400">${cleanTier.split(' ')[0]}</span>
    </div>
  `;
}

function getCapRoiBadgeHtml(player) {
  const apy = Number(player.contract_apy_m || 0);
  const capPct = Number(player.contract_cap_pct || 0);
  const roi = Number(player.cap_roi_score || 50);
  const tier = sanitizeHyphens(player.cap_roi_tier || 'FAIR VALUE');

  let badgeClass = 'border-slate-700 bg-slate-800/80 text-slate-300';
  if (tier.includes('BARGAIN') || tier.includes('VALUE') || tier.includes('Ganga') || tier.includes('Alto Retorno')) {
    badgeClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  } else if (tier.includes('FRANCHISE') || tier.includes('Mercado')) {
    badgeClass = 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300';
  } else if (tier.includes('OVERPAID') || tier.includes('HIGH') || tier.includes('Pesado')) {
    badgeClass = 'border-rose-500/40 bg-rose-500/15 text-rose-300';
  }

  return `
    <div class="flex flex-col items-end">
      <div class="flex items-center gap-1">
        <span class="font-bold text-white">$${apy.toFixed(1)}M</span>
        <span class="text-[10px] text-slate-400">(${capPct.toFixed(1)}%)</span>
      </div>
      <div class="mt-0.5 flex items-center gap-1">
        <span class="rounded border px-1.5 py-0.2 text-[9px] font-bold ${badgeClass}">${tier}</span>
        <span class="text-[9px] text-slate-400">ROI ${roi.toFixed(0)}</span>
      </div>
    </div>
  `;
}

function renderPlayerAvatarHtml(player, sizeClass = 'h-8 w-8') {
  const logo = getTeamLogo(player.team);
  const initials = String(player.player_name || 'NFL')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (player.headshot_url) {
    return `
      <div class="relative shrink-0 ${sizeClass}">
        <img
          src="${escapeHtml(player.headshot_url)}"
          alt="${escapeHtml(player.player_name)}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          class="${sizeClass} rounded-full border border-slate-700 bg-slate-900 object-cover"
        />
        <div style="display:none" class="${sizeClass} items-center justify-center rounded-full border border-slate-700 bg-slate-900 font-mono-num text-[10px] font-bold text-emerald-300">
          ${escapeHtml(initials)}
        </div>
        ${logo ? `<img src="${logo}" alt="${escapeHtml(player.team)}" class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#0B0F17] p-0.5 object-contain" />` : ''}
      </div>
    `;
  }

  return `
    <div class="relative flex shrink-0 ${sizeClass} items-center justify-center rounded-full border border-slate-700 bg-slate-900 font-mono-num text-[10px] font-bold text-emerald-300">
      ${escapeHtml(initials)}
      ${logo ? `<img src="${logo}" alt="${escapeHtml(player.team)}" class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#0B0F17] p-0.5 object-contain" />` : ''}
    </div>
  `;
}

/* ========================================================================= */
/* 1. INICIALIZACIÓN Y CARGA DE LOS 4 ARCHIVOS JSON ESTÁTICOS                */
/* ========================================================================= */

async function fetchJsonSafe(url) {
  const cacheBust = `?t=${Date.now()}`;
  const res = await fetch(`${url}${cacheBust}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al leer ${url}`);
  }
  return res.json();
}

export async function loadAllDashboardData() {
  const alertBanner = document.getElementById('global-alert-banner');
  const alertMsg = document.getElementById('global-alert-message');
  if (alertBanner) alertBanner.classList.add('hidden');

  const results = await Promise.allSettled([
    fetchJsonSafe(DATA_PATHS.scoreboard),
    fetchJsonSafe(DATA_PATHS.rankings),
    fetchJsonSafe(DATA_PATHS.critiques),
    fetchJsonSafe(DATA_PATHS.news),
  ]);

  const errors = [];
  if (results[0].status === 'fulfilled') appState.scoreboard = results[0].value;
  else errors.push(`live_scoreboard.json (${results[0].reason?.message || 'error'})`);

  if (results[1].status === 'fulfilled') appState.rankings = results[1].value;
  else errors.push(`player_rankings.json (${results[1].reason?.message || 'error'})`);

  if (results[2].status === 'fulfilled') appState.critiques = results[2].value;
  else errors.push(`game_critiques.json (${results[2].reason?.message || 'error'})`);

  if (results[3].status === 'fulfilled') appState.news = results[3].value;
  else {
    appState.news = { items: [], sources: [] };
  }

  normalizeAllData();

  if (errors.length > 0 && alertBanner && alertMsg) {
    alertMsg.textContent = sanitizeHyphens(`Algunos archivos locales reportaron advertencias: ${errors.join(' | ')}`);
    alertBanner.classList.remove('hidden');
  }

  populateSelectControls();
  renderHeaderTelemetry();
  renderExecutiveKpiStrip();
  renderLiveScorestripAndGames();
  renderBentoNewsWire();
  renderBentoCenterTable();
  renderFullRankingsTable();
  renderSpotlightAndRadarCard();
  renderSavantFieldHeatmaps();
  renderTeamQuadrantAndSharpMatrix();
  renderH2HAndClutchLab();
  renderCritiquesSection();
}

function populateSelectControls() {
  const players = Array.isArray(appState.rankings?.players) ? appState.rankings.players : [];

  // 1. Selector de Semana / Alcance de Rankings
  const weekSelect = document.getElementById('ranking-week-select');
  if (weekSelect && appState.rankings) {
    const currentVal = appState.rankingWeekFilter;
    weekSelect.innerHTML = `<option value="season" class="bg-[#0B0F17] text-white">Temporada Completa (${players.length} tit.)</option>`;
    const byScope = appState.rankings.rankings_by_scope || {};
    Object.keys(byScope).forEach((scopeKey) => {
      const sc = byScope[scopeKey];
      const opt = document.createElement('option');
      opt.value = scopeKey;
      opt.className = 'bg-[#0B0F17] text-white';
      opt.textContent = sanitizeHyphens(sc.label || scopeKey);
      weekSelect.appendChild(opt);
    });
    weekSelect.value = currentVal;
  }

  // 2. Selector de Equipos (32 Franquicias)
  const teams = Array.from(new Set(players.map((p) => p.team).filter(Boolean))).sort();
  const teamSelect = document.getElementById('ranking-team-select');
  if (teamSelect) {
    const currTeam = appState.teamFilter;
    teamSelect.innerHTML = `<option value="ALL" class="bg-[#0B0F17] text-white">32 Equipos NFL</option>`;
    teams.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.className = 'bg-[#0B0F17] text-white';
      opt.textContent = t;
      teamSelect.appendChild(opt);
    });
    teamSelect.value = currTeam;
  }

  // 3. Selector de Equipos para NFL Savant (Bento y Lab)
  ['bento-savant-team-select', 'lab-savant-team-select'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="ALL" class="bg-[#0B0F17] text-white">Promedio NFL (32 Equipos)</option>`;
    teams.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.className = 'bg-[#0B0F17] text-white';
      opt.textContent = `Ofensiva ${t}`;
      sel.appendChild(opt);
    });
    sel.value = appState.savantTeamAbbr;
  });

  // 4. Selector de Jugador Spotlight (Radar 6 Ejes) y H2H
  if (players.length > 0) {
    if (!appState.spotlightPlayerId) {
      appState.spotlightPlayerId = players[0].player_id;
    }
    if (!appState.h2hPlayerA) {
      appState.h2hPlayerA = players[0].player_id;
    }
    if (!appState.h2hPlayerB) {
      appState.h2hPlayerB = (players[1] || players[0]).player_id;
    }

    const spotSel = document.getElementById('bento-spotlight-player-select');
    if (spotSel) {
      spotSel.innerHTML = players
        .slice(0, 120)
        .map(
          (p) =>
            `<option value="${escapeHtml(p.player_id)}" class="bg-[#0B0F17] text-white">#${p.rank_overall} ${escapeHtml(p.player_name)} (${escapeHtml(p.position)} - ${escapeHtml(p.team)})</option>`
        )
        .join('');
      spotSel.value = appState.spotlightPlayerId;
    }

    ['h2h-player-a', 'h2h-player-b'].forEach((id, idx) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = players
        .map(
          (p) =>
            `<option value="${escapeHtml(p.player_id)}" class="bg-[#0B0F17] text-white">#${p.rank_overall} ${escapeHtml(p.player_name)} (${escapeHtml(p.position)} - ${escapeHtml(p.team)})</option>`
        )
        .join('');
      sel.value = idx === 0 ? appState.h2hPlayerA : appState.h2hPlayerB;
    });
  }

  // 5. Selector de Semana del Scoreboard
  const sbWeekSel = document.getElementById('scoreboard-week-select');
  if (sbWeekSel && appState.scoreboard) {
    const games = Array.isArray(appState.scoreboard.games) ? appState.scoreboard.games : [];
    const weeks = Array.from(new Set(games.map((g) => g.week).filter(Boolean))).sort((a, b) => a - b);
    const prev = appState.scoreboardWeekFilter;
    sbWeekSel.innerHTML = `<option value="ALL" class="bg-[#0B0F17] text-white">Todas (${games.length} PJ)</option>`;
    weeks.forEach((w) => {
      const count = games.filter((g) => Number(g.week) === Number(w)).length;
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.className = 'bg-[#0B0F17] text-white';
      opt.textContent = `Semana ${w} (${count} PJ)`;
      sbWeekSel.appendChild(opt);
    });
    if (prev === 'ALL' && appState.scoreboard.week && weeks.includes(Number(appState.scoreboard.week))) {
      appState.scoreboardWeekFilter = String(appState.scoreboard.week);
    }
    sbWeekSel.value = appState.scoreboardWeekFilter;
  }
}

/* ========================================================================= */
/* 2. HEADER TELEMETRÍA Y EXECUTIVE KPI STRIP (5 INDICADORES)                */
/* ========================================================================= */

function renderHeaderTelemetry() {
  const seasonEl = document.getElementById('header-season-badge');
  const fallbackText = document.getElementById('header-fallback-text');
  const aiModeEl = document.getElementById('header-ai-mode');
  const updatedEl = document.getElementById('header-updated-at');

  const season = appState.rankings?.season || appState.scoreboard?.season || '--';
  if (seasonEl) seasonEl.textContent = String(season);

  if (fallbackText && appState.rankings?.metadata) {
    const meta = appState.rankings.metadata;
    fallbackText.textContent = meta.fallback_triggered
      ? `Fallback ${meta.season_used}`
      : `nflverse ${meta.season_used}`;
  }

  if (aiModeEl && appState.critiques) {
    aiModeEl.textContent = appState.critiques.generation_mode === 'gemini_ai' ? 'Gemini 2.5' : 'Actuarial';
  }

  const latestSync = appState.scoreboard?.updated_at || appState.rankings?.updated_at;
  if (updatedEl) updatedEl.textContent = formatUtcTimestamp(latestSync);

  // Badges de navegación
  const navGames = document.getElementById('nav-badge-games');
  if (navGames && appState.scoreboard?.games) {
    navGames.textContent = String(appState.scoreboard.games.length);
  }
  const navPlayers = document.getElementById('nav-badge-players');
  if (navPlayers) {
    navPlayers.textContent = String(getActivePlayersDataset().length);
  }
  const navNews = document.getElementById('nav-badge-news');
  if (navNews && appState.news?.items) {
    navNews.textContent = `${appState.news.items.length} cables`;
  }
}

function renderExecutiveKpiStrip() {
  const players = getActivePlayersDataset();
  if (!players.length) return;

  // 1. MVP Real
  const mvp = players[0];
  if (mvp) {
    const nameEl = document.getElementById('kpi-mvp-name');
    const posEl = document.getElementById('kpi-mvp-pos');
    const scoreEl = document.getElementById('kpi-mvp-score');
    const metricsEl = document.getElementById('kpi-mvp-metrics');
    const imgEl = document.getElementById('kpi-mvp-headshot');
    if (nameEl) nameEl.textContent = sanitizeHyphens(mvp.player_name);
    if (posEl) posEl.textContent = `${mvp.position} - ${mvp.team}`;
    if (scoreEl) scoreEl.textContent = formatNum(mvp.impact_score, 1);
    if (metricsEl) {
      metricsEl.innerHTML = `PFF <span class="text-cyan-300 font-bold">${formatNum(mvp.pff_grade, 1)}</span> | EPA/P <span class="text-emerald-300">${formatSigned(mvp.epa_per_play_competitive, 3)}</span>`;
    }
    if (imgEl && mvp.headshot_url) {
      imgEl.src = mvp.headshot_url;
      imgEl.classList.remove('hidden');
    }
  }

  // 2. Estadístico Inflado
  const byInflation = [...players].sort(
    (a, b) => Number(b.statistical_inflation_index || 0) - Number(a.statistical_inflation_index || 0)
  );
  const inf = byInflation[0];
  if (inf) {
    const nameEl = document.getElementById('kpi-inflated-name');
    const badgeEl = document.getElementById('kpi-inflated-badge');
    const metricsEl = document.getElementById('kpi-inflated-metrics');
    const imgEl = document.getElementById('kpi-inflated-headshot');
    if (nameEl) nameEl.textContent = `${sanitizeHyphens(inf.player_name)} (${inf.team})`;
    if (badgeEl) badgeEl.textContent = `Índice +${formatNum(inf.statistical_inflation_index, 1)}`;
    if (metricsEl) {
      metricsEl.textContent = `${inf.garbage_yards || 0} yd basura (${formatNum(inf.yardage_inflation_pct, 1)}% total)`;
    }
    if (imgEl && inf.headshot_url) {
      imgEl.src = inf.headshot_url;
      imgEl.classList.remove('hidden');
    }
  }

  // 3. Mayor Jugada Bisagra
  const games = Array.isArray(appState.scoreboard?.games) ? appState.scoreboard.games : [];
  let topSwing = null;
  let topGame = null;
  games.forEach((g) => {
    const hp = g.hinge_play;
    if (hp && (!topSwing || Number(hp.abs_delta_wp || 0) > Number(topSwing.abs_delta_wp || 0))) {
      topSwing = hp;
      topGame = g;
    }
  });
  if (topSwing && topGame) {
    const gameEl = document.getElementById('kpi-swing-game');
    const deltaEl = document.getElementById('kpi-swing-delta');
    const descEl = document.getElementById('kpi-swing-desc');
    if (gameEl) gameEl.textContent = sanitizeHyphens(topGame.short_name || '');
    if (deltaEl) deltaEl.textContent = `${(Number(topSwing.abs_delta_wp) * 100).toFixed(1)}% WP`;
    if (descEl) descEl.textContent = sanitizeHyphens(topSwing.description || '');
  }

  // 4. Líder DVOA / RBSDM Equipo
  const teams = Array.isArray(appState.rankings?.team_rankings) ? appState.rankings.team_rankings : [];
  if (teams.length > 0) {
    const topTeam = teams[0];
    const abbrEl = document.getElementById('kpi-top-team-abbr');
    const dvoaEl = document.getElementById('kpi-top-team-dvoa');
    const subEl = document.getElementById('kpi-top-team-sub');
    const logoEl = document.getElementById('kpi-top-team-logo');
    if (abbrEl) abbrEl.textContent = `${topTeam.team} (#1 NFL)`;
    if (dvoaEl) dvoaEl.textContent = `DVOA ${formatSigned(topTeam.dvoa_total_pct, 1, '%')}`;
    if (subEl) subEl.textContent = `Net EPA ${formatSigned(topTeam.net_epa_per_play, 3)} | PROE ${formatSigned(topTeam.proe_pct, 1, '%')}`;
    const logoUrl = getTeamLogo(topTeam.team);
    if (logoEl && logoUrl) {
      logoEl.src = logoUrl;
      logoEl.classList.remove('hidden');
    }
  }

  // 5. Mejor Contrato Cap ROI (OverTheCap + Spotrac)
  const byRoi = [...players]
    .filter((p) => Number(p.impact_score || 0) >= 75)
    .sort((a, b) => Number(b.cap_roi_score || 0) - Number(a.cap_roi_score || 0));
  const bestRoi = byRoi[0] || players[0];
  if (bestRoi) {
    const nameEl = document.getElementById('kpi-roi-name');
    const tierEl = document.getElementById('kpi-roi-tier');
    const metricsEl = document.getElementById('kpi-roi-metrics');
    const imgEl = document.getElementById('kpi-roi-headshot');
    if (nameEl) nameEl.textContent = `${sanitizeHyphens(bestRoi.player_name)} (${bestRoi.team})`;
    if (tierEl) tierEl.textContent = `ROI ${formatNum(bestRoi.cap_roi_score, 1)}`;
    if (metricsEl) {
      metricsEl.textContent = `APY $${formatNum(bestRoi.contract_apy_m, 2)}M (${formatNum(bestRoi.contract_cap_pct, 1)}% Cap) - Impact ${formatNum(bestRoi.impact_score, 1)}`;
    }
    if (imgEl && bestRoi.headshot_url) {
      imgEl.src = bestRoi.headshot_url;
      imgEl.classList.remove('hidden');
    }
  }
}

/* ========================================================================= */
/* 3. TOP LIVE SCORESTRIP (MOCKUP 5 RIBBON) & PARTIDOS COMPLETOS             */
/* ========================================================================= */

function buildSurgicalHighlightLinks(game, play) {
  const away = game.away_team?.name || game.away_team?.abbreviation || 'Away';
  const home = game.home_team?.name || game.home_team?.abbreviation || 'Home';
  const desc = sanitizeHyphens(play?.description || '');
  const qtr = play?.qtr ? `Q${play.qtr}` : '';

  const ytUrl =
    play?.video_search_url ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`NFL ${away} vs ${home} ${desc.slice(0, 60)} ${qtr} highlight`)}&sp=EgIYAQ%3D%3D`;
  const xUrl =
    play?.social_clip_url ||
    `https://x.com/search?q=${encodeURIComponent(`(from:NFL OR ${away} OR ${home}) ${desc.slice(0, 45)}`)}&f=video`;

  return { ytUrl, xUrl };
}

function getFilteredGames() {
  const allGames = Array.isArray(appState.scoreboard?.games) ? appState.scoreboard.games : [];
  const wk = appState.scoreboardWeekFilter;
  const st = appState.gameStatusFilter;
  const q = appState.searchQuery.trim().toLowerCase();

  return allGames.filter((g) => {
    if (wk !== 'ALL' && String(g.week) !== String(wk)) return false;
    if (st === 'in' && g.status?.state !== 'in') return false;
    if (st === 'post' && g.status?.state !== 'post') return false;
    if (st === 'hinge' && !g.hinge_play?.exceeds_threshold) return false;
    if (q) {
      const hay = `${g.name || ''} ${g.short_name || ''} ${g.away_team?.name || ''} ${g.home_team?.name || ''} ${g.hinge_play?.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderLiveScorestripAndGames() {
  const stripEl = document.getElementById('bento-live-scorestrip');
  const fullGridEl = document.getElementById('scoreboard-grid');
  const weekBadge = document.getElementById('scoreboard-week-badge');

  const games = getFilteredGames();
  if (weekBadge) {
    weekBadge.textContent =
      appState.scoreboardWeekFilter === 'ALL'
        ? `Todas (${games.length} PJ)`
        : `Semana ${appState.scoreboardWeekFilter} (${games.length} PJ)`;
  }

  if (!games.length) {
    const emptyMsg = `<div class="w-full rounded-lg border border-slate-800 bg-[#131B2E] px-4 py-3 text-center font-mono-num text-xs text-slate-400">No hay partidos que coincidan con el filtro actual. Prueba cambiar el filtro a "Todos" o seleccionar otra semana.</div>`;
    if (stripEl) stripEl.innerHTML = emptyMsg;
    if (fullGridEl) fullGridEl.innerHTML = emptyMsg;
    return;
  }

  // 1. Renderizar Cinta Compacta Superior (Mockup 5 Scorestrip)
  if (stripEl) {
    stripEl.innerHTML = games
      .slice(0, 24)
      .map((g) => {
        const away = g.away_team || {};
        const home = g.home_team || {};
        const homeWp = Number(g.win_probability?.home_wp ?? 0.5) * 100;
        const awayWp = 100 - homeWp;
        const hp = g.hinge_play;
        const isLive = g.status?.state === 'in';
        const statusLabel = isLive
          ? `🟢 Q${g.status?.period || ''} ${g.status?.clock || ''}`
          : sanitizeHyphens(g.status?.detail || 'Final');

        return `
          <article class="bento-card w-64 shrink-0 p-2.5 flex flex-col justify-between hover:border-cyan-500/40 transition">
            <div>
              <div class="flex items-center justify-between text-[10px] font-mono-num">
                <span class="${isLive ? 'font-bold text-emerald-400' : 'text-slate-400'}">${escapeHtml(statusLabel)}</span>
                ${
                  hp
                    ? `<a href="#metodo-jugada-bisagra" class="metric-ref-link rounded bg-rose-500/15 px-1.5 py-0.5 font-bold text-rose-300" title="${escapeHtml(hp.description)}">&Delta;WP ${(Number(hp.abs_delta_wp) * 100).toFixed(0)}%</a>`
                    : `<span class="text-slate-500">Sem ${g.week || '--'}</span>`
                }
              </div>

              <div class="mt-1.5 space-y-1 font-mono-num text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <img src="${escapeHtml(away.logo || getTeamLogo(away.abbreviation))}" alt="" class="h-4 w-4 object-contain" />
                    <span class="font-bold text-white">${escapeHtml(away.abbreviation || 'AWY')}</span>
                    <span class="text-[10px] text-slate-400">${awayWp.toFixed(0)}%</span>
                  </div>
                  <span class="font-extrabold text-white">${away.score ?? 0}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <img src="${escapeHtml(home.logo || getTeamLogo(home.abbreviation))}" alt="" class="h-4 w-4 object-contain" />
                    <span class="font-bold text-white">${escapeHtml(home.abbreviation || 'HOM')}</span>
                    <span class="text-[10px] text-emerald-400">${homeWp.toFixed(0)}%</span>
                  </div>
                  <span class="font-extrabold text-white">${home.score ?? 0}</span>
                </div>
              </div>

              <!-- Barra Dual Win Probability -->
              <div class="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div class="bg-cyan-400" style="width: ${awayWp.toFixed(1)}%"></div>
                <div class="bg-emerald-400" style="width: ${homeWp.toFixed(1)}%"></div>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/80">
              <button
                type="button"
                data-open-game-modal="${escapeHtml(g.event_id)}"
                class="flex-1 rounded bg-slate-800/90 px-2 py-1 font-mono-num text-[10px] font-semibold text-cyan-300 hover:bg-slate-700 hover:text-white transition"
              >
                📈 Curva WP &amp; Bisagra
              </button>
              ${
                hp
                  ? `<a href="${escapeHtml(buildSurgicalHighlightLinks(g, hp).ytUrl)}" target="_blank" rel="noopener noreferrer" class="rounded border border-rose-500/30 bg-rose-500/15 px-2 py-1 font-mono-num text-[10px] font-bold text-rose-300 hover:bg-rose-500/25" title="Ver video puntual (&lt;4m) de la jugada bisagra">▶ Clip</a>`
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  // 2. Renderizar Tarjetas Completas en la Pestaña Partidos (con Curva SVG WP integrada)
  if (fullGridEl) {
    fullGridEl.innerHTML = games.map((g) => renderFullGameCardHtml(g)).join('');
  }
}

function renderWpSparklineSvg(wpSeries = [], hingePlay = null) {
  if (!Array.isArray(wpSeries) || wpSeries.length < 2) {
    return `<div class="py-4 text-center font-mono-num text-[11px] text-slate-500">Sin serie temporal de WP disponible</div>`;
  }
  const width = 340;
  const height = 84;
  const pad = 8;

  const points = wpSeries.map((pt, idx) => {
    const x = pad + (idx / Math.max(1, wpSeries.length - 1)) * (width - pad * 2);
    const wp = Math.max(0, Math.min(1, Number(pt.home_wp ?? 0.5)));
    const y = pad + (1 - wp) * (height - pad * 2);
    return { x, y, wp, play_id: pt.play_id };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const hingePoint =
    hingePlay && points.find((p) => String(p.play_id) === String(hingePlay.play_id))
      ? points.find((p) => String(p.play_id) === String(hingePlay.play_id))
      : null;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="h-20 w-full overflow-visible rounded border border-slate-800/90 bg-[#090D16]">
      <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />
      <path d="${pathD}" fill="none" stroke="#10B981" stroke-width="2" />
      ${
        hingePoint
          ? `<circle cx="${hingePoint.x.toFixed(1)}" cy="${hingePoint.y.toFixed(1)}" r="4" fill="#F43F5E" stroke="#fff" stroke-width="1.2" />`
          : ''
      }
    </svg>
  `;
}

function renderFullGameCardHtml(game) {
  const away = game.away_team || {};
  const home = game.home_team || {};
  const homeWp = Number(game.win_probability?.home_wp ?? 0.5) * 100;
  const awayWp = 100 - homeWp;
  const hp = game.hinge_play;
  const links = hp ? buildSurgicalHighlightLinks(game, hp) : null;

  return `
    <article class="bento-card flex flex-col justify-between p-4">
      <div>
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5 text-xs font-mono-num">
          <span class="font-bold text-slate-300">Semana ${game.week || '--'} - ${escapeHtml(game.status?.detail || 'Final')}</span>
          <a href="#metodo-wp" class="metric-ref-link text-[11px] text-cyan-300">WP Home ${homeWp.toFixed(1)}%</a>
        </div>

        <div class="mt-3 space-y-2 font-mono-num">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="${escapeHtml(away.logo || getTeamLogo(away.abbreviation))}" alt="" class="h-6 w-6 object-contain" />
              <div>
                <div class="text-sm font-bold text-white">${escapeHtml(away.name || away.abbreviation)}</div>
                <div class="text-[10px] text-cyan-300">WP: ${awayWp.toFixed(1)}%</div>
              </div>
            </div>
            <span class="text-xl font-black text-white">${away.score ?? 0}</span>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="${escapeHtml(home.logo || getTeamLogo(home.abbreviation))}" alt="" class="h-6 w-6 object-contain" />
              <div>
                <div class="text-sm font-bold text-white">${escapeHtml(home.name || home.abbreviation)}</div>
                <div class="text-[10px] text-emerald-400">WP: ${homeWp.toFixed(1)}%</div>
              </div>
            </div>
            <span class="text-xl font-black text-white">${home.score ?? 0}</span>
          </div>
        </div>

        <!-- Curva SVG Win Probability -->
        <div class="mt-3">
          ${renderWpSparklineSvg(game.wp_series || [], hp)}
        </div>

        ${
          hp
            ? `
          <div class="mt-3 rounded-lg border border-rose-500/30 bg-[#090D16] p-3 text-xs">
            <div class="flex items-center justify-between font-mono-num">
              <a href="#metodo-jugada-bisagra" class="metric-ref-link font-bold text-rose-300">⚡ Jugada Bisagra (Q${hp.qtr || '--'} ${escapeHtml(hp.clock || '')})</a>
              <span class="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-300">&Delta;WP ${(Number(hp.abs_delta_wp) * 100).toFixed(1)}%</span>
            </div>
            <p class="mt-1.5 text-[11px] leading-relaxed text-slate-300">${escapeHtml(hp.description || '')}</p>
            <div class="mt-2.5 flex flex-wrap gap-1.5 font-mono-num text-[10px]">
              <a href="${escapeHtml(links.ytUrl)}" target="_blank" rel="noopener noreferrer" class="rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-bold text-rose-200 hover:bg-rose-500/25">▶ Video Jugada (&lt;4m)</a>
              <a href="${escapeHtml(links.xUrl)}" target="_blank" rel="noopener noreferrer" class="rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-bold text-sky-200 hover:bg-sky-500/25">𝕏 Clip @NFL</a>
            </div>
          </div>
        `
            : ''
        }
      </div>
    </article>
  `;
}

function openGameModal(eventId) {
  const modal = document.getElementById('game-detail-modal');
  const titleEl = document.getElementById('modal-game-title');
  const bodyEl = document.getElementById('modal-game-body');
  if (!modal || !bodyEl) return;

  const games = Array.isArray(appState.scoreboard?.games) ? appState.scoreboard.games : [];
  const game = games.find((g) => String(g.event_id) === String(eventId));
  if (!game) return;

  if (titleEl) {
    titleEl.textContent = sanitizeHyphens(`${game.name || game.short_name} - Semana ${game.week || '--'}`);
  }

  const moments = Array.isArray(game.critical_moments) ? game.critical_moments : game.hinge_play ? [game.hinge_play] : [];
  bodyEl.innerHTML = `
    ${renderFullGameCardHtml(game)}
    <div class="rounded-xl border border-slate-800 bg-[#131B2E] p-4">
      <h4 class="font-mono-num text-xs font-bold uppercase text-cyan-300">Top 3 Momentos Críticos de Win Probability (|&Delta;WP| &ge; 12%)</h4>
      <div class="mt-3 space-y-2.5">
        ${
          moments.length
            ? moments
                .map((m, idx) => {
                  const lks = buildSurgicalHighlightLinks(game, m);
                  return `
                    <div class="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 text-xs">
                      <div class="flex items-center justify-between font-mono-num">
                        <span class="font-bold text-white">#${idx + 1} - Q${m.qtr || '--'} (${escapeHtml(m.clock || '')})</span>
                        <span class="text-rose-300 font-bold">&Delta;WP ${(Number(m.abs_delta_wp) * 100).toFixed(1)}% (${(Number(m.home_wp_before) * 100).toFixed(0)}% &rarr; ${(Number(m.home_wp_after) * 100).toFixed(0)}%)</span>
                      </div>
                      <p class="mt-1 text-slate-300">${escapeHtml(m.description || '')}</p>
                      <div class="mt-2 flex gap-2 font-mono-num text-[10px]">
                        <a href="${escapeHtml(lks.ytUrl)}" target="_blank" rel="noopener noreferrer" class="rounded bg-rose-500/20 px-2 py-0.5 text-rose-300 hover:bg-rose-500/30">▶ YouTube (&lt;4m)</a>
                        <a href="${escapeHtml(lks.xUrl)}" target="_blank" rel="noopener noreferrer" class="rounded bg-sky-500/20 px-2 py-0.5 text-sky-300 hover:bg-sky-500/30">𝕏 Clip @NFL</a>
                      </div>
                    </div>
                  `;
                })
                .join('')
            : `<p class="text-xs text-slate-400">Sin variaciones superiores al 12% registradas.</p>`
        }
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/* ========================================================================= */
/* 4. LEFT BENTO COLUMN & NEWSROOM: 8 FUENTES DE NOTICIAS & CONTRATOS        */
/* ========================================================================= */

function getFilteredNewsItems() {
  const items = Array.isArray(appState.news?.items) ? appState.news.items : [];
  const cat = appState.newsCategoryFilter;
  const team = appState.teamFilter;
  const q = appState.searchQuery.trim().toLowerCase();

  return items.filter((it) => {
    if (cat !== 'ALL') {
      const sid = String(it.source_id || '').toLowerCase();
      if (cat === 'rotoworld' && sid !== 'rotoworld') return false;
      if (cat === 'pft_athletic' && !['pft', 'athletic', 'the_athletic'].includes(sid)) return false;
      if (cat === 'cap' && !['otc', 'overthecap', 'spotrac'].includes(sid)) return false;
      if (cat === 'espn_nfl' && !['espn', 'espn_nfl', 'nfl_com'].includes(sid)) return false;
      if (cat === 'reddit' && !['reddit', 'reddit_nfl'].includes(sid)) return false;
    }
    if (team !== 'ALL' && it.team && it.team !== team) return false;
    if (q) {
      const hay = `${it.headline || ''} ${it.summary || ''} ${it.source_name || ''} ${it.player_name || ''} ${it.team || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function getSourceBadgeStyle(sourceId) {
  const map = {
    rotoworld: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
    athletic: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    the_athletic: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    pft: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300',
    espn: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    espn_nfl: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    nfl_com: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
    otc: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    overthecap: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    spotrac: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
    reddit_nfl: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  };
  return map[sourceId] || 'border-slate-700 bg-slate-800 text-slate-300';
}

function renderSingleNewsCardHtml(item) {
  const badgeStyle = getSourceBadgeStyle(item.source_id);
  const logo = getTeamLogo(item.team);
  const avatarHtml = item.headshot_url
    ? `<img src="${escapeHtml(item.headshot_url)}" alt="" loading="lazy" onerror="this.style.display='none'" class="h-9 w-9 shrink-0 rounded-full border border-slate-700 bg-slate-900 object-cover" />`
    : logo
      ? `<img src="${escapeHtml(logo)}" alt="" class="h-8 w-8 shrink-0 object-contain" />`
      : `<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 font-mono-num text-[10px] font-bold text-cyan-300">NFL</div>`;

  return `
    <article class="rounded-xl border border-slate-800/90 bg-[#0B0F17]/90 p-3 transition hover:border-slate-700">
      <div class="flex items-start gap-2.5">
        ${avatarHtml}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center justify-between gap-1">
            <span class="rounded border px-1.5 py-0.5 font-mono-num text-[9px] font-bold uppercase ${badgeStyle}">
              ${escapeHtml(item.source_badge || item.source_name)}
            </span>
            <span class="font-mono-num text-[10px] text-slate-500">${formatUtcTimestamp(item.published_at)}</span>
          </div>

          <a
            href="${escapeHtml(item.url || '#')}"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1.5 block text-xs font-bold leading-snug text-white hover:text-cyan-300 transition"
          >
            ${escapeHtml(item.headline)}
          </a>

          <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
            ${escapeHtml(item.summary)}
          </p>

          <!-- Píldoras de Enriquecimiento (Jugador / PFF / Contrato OTC) -->
          <div class="mt-2 flex flex-wrap items-center gap-1 font-mono-num text-[9px]">
            ${
              item.player_name
                ? `<button type="button" data-select-spotlight-name="${escapeHtml(item.player_name)}" class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-300 hover:bg-emerald-500/20">🔬 ${escapeHtml(item.player_name)} ${item.impact_score ? `(${Number(item.impact_score).toFixed(1)})` : ''}</button>`
                : ''
            }
            ${
              item.contract_apy_m
                ? `<a href="#metodo-otc" class="metric-ref-link rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-300">APY $${Number(item.contract_apy_m).toFixed(1)}M (${Number(item.contract_cap_pct || 0).toFixed(1)}% Cap)</a>`
                : ''
            }
            ${
              item.team
                ? `<span class="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">${escapeHtml(item.team)}</span>`
                : ''
            }
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderBentoNewsWire() {
  const listEl = document.getElementById('bento-news-wire-list');
  const fullGridEl = document.getElementById('full-newsroom-grid');
  const items = getFilteredNewsItems();

  if (!items.length) {
    const empty = `<div class="py-8 text-center font-mono-num text-xs text-slate-400">No hay noticias para el filtro seleccionado.</div>`;
    if (listEl) listEl.innerHTML = empty;
    if (fullGridEl) fullGridEl.innerHTML = empty;
    return;
  }

  if (listEl) {
    listEl.innerHTML = items.slice(0, 18).map((it) => renderSingleNewsCardHtml(it)).join('');
  }
  if (fullGridEl) {
    fullGridEl.innerHTML = items.map((it) => renderSingleNewsCardHtml(it)).join('');
  }
}

/* ========================================================================= */
/* 5. CENTER BENTO COLUMN: MULTI-SOURCE VALUATION TABLE (6 CAPAS DINÁMICAS)  */
/* ========================================================================= */

function renderBentoCenterTable() {
  const thead = document.getElementById('bento-center-thead');
  const tbody = document.getElementById('bento-center-tbody');
  const countBadge = document.getElementById('bento-table-count-badge');
  if (!thead || !tbody) return;

  const players = getFilteredPlayers();
  if (countBadge) countBadge.textContent = `${players.length} titulares`;

  const layer = appState.bentoLayer;

  // Definir encabezados según la capa seleccionada en el Bento Hub
  if (layer === 'pfr_pff') {
    thead.innerHTML = `
      <tr>
        <th class="px-2.5 py-2">#</th>
        <th class="px-2.5 py-2">Jugador</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-pff" class="metric-ref-link text-cyan-300">PFF Grade</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-score-impacto" class="metric-ref-link text-emerald-300">Impact</a></th>
        <th class="px-2.5 py-2 text-right">PFR Press / BT%</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-success-rate" class="metric-ref-link">Succ %</a></th>
      </tr>
    `;
  } else if (layer === 'ngs') {
    thead.innerHTML = `
      <tr>
        <th class="px-2.5 py-2">#</th>
        <th class="px-2.5 py-2">Jugador</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-ngs" class="metric-ref-link text-cyan-300">NGS Primaria</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-ngs" class="metric-ref-link">NGS Secundaria</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-yac-epa" class="metric-ref-link">YAC OE EPA</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-score-impacto" class="metric-ref-link text-emerald-300">Impact</a></th>
      </tr>
    `;
  } else if (layer === 'rbsdm') {
    thead.innerHTML = `
      <tr>
        <th class="px-2.5 py-2">#</th>
        <th class="px-2.5 py-2">Jugador</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-rbsdm" class="metric-ref-link text-indigo-300">RBSDM Index</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-epa-comp" class="metric-ref-link text-emerald-300">EPA/Play</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-wpa" class="metric-ref-link">WPA Comp</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-cpoe" class="metric-ref-link">CPOE %</a></th>
      </tr>
    `;
  } else if (layer === 'profiler') {
    thead.innerHTML = `
      <tr>
        <th class="px-2.5 py-2">#</th>
        <th class="px-2.5 py-2">Jugador</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-profiler" class="metric-ref-link text-amber-300">WOPR</a></th>
        <th class="px-2.5 py-2 text-right">Target %</th>
        <th class="px-2.5 py-2 text-right">Air Yards %</th>
        <th class="px-2.5 py-2 text-right">aDOT / RZ%</th>
      </tr>
    `;
  } else if (layer === 'otc') {
    thead.innerHTML = `
      <tr>
        <th class="px-2.5 py-2">#</th>
        <th class="px-2.5 py-2">Jugador</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-otc" class="metric-ref-link text-emerald-300">APY ($M)</a></th>
        <th class="px-2.5 py-2 text-right">Guaranteed</th>
        <th class="px-2.5 py-2 text-right">Cap Hit %</th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-otc" class="metric-ref-link">ROI Tier</a></th>
      </tr>
    `;
  } else {
    // Master 360° Layer (Default Mockup 5 Center Table)
    thead.innerHTML = `
      <tr>
        <th class="sortable-th px-2.5 py-2" data-sort="rank_overall">#</th>
        <th class="sortable-th px-2.5 py-2" data-sort="player_name">Jugador</th>
        <th class="sortable-th px-2.5 py-2 text-right" data-sort="pff_grade"><a href="#metodo-pff" class="metric-ref-link text-cyan-300" onclick="event.stopPropagation()">PFF</a></th>
        <th class="sortable-th px-2.5 py-2 text-right" data-sort="impact_score"><a href="#metodo-score-impacto" class="metric-ref-link text-emerald-300" onclick="event.stopPropagation()">Impact</a></th>
        <th class="sortable-th px-2.5 py-2 text-right" data-sort="epa_per_play_competitive"><a href="#metodo-epa-comp" class="metric-ref-link" onclick="event.stopPropagation()">EPA/P</a></th>
        <th class="px-2.5 py-2 text-right"><a href="#metodo-ngs" class="metric-ref-link text-cyan-300">NGS / WOPR</a></th>
        <th class="sortable-th px-2.5 py-2 text-right" data-sort="contract_apy_m"><a href="#metodo-otc" class="metric-ref-link text-amber-300" onclick="event.stopPropagation()">Contrato OTC</a></th>
      </tr>
    `;
  }

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">No hay jugadores que coincidan con el filtro actual.</td></tr>`;
    return;
  }

  tbody.innerHTML = players
    .slice(0, 60)
    .map((p) => {
      const isSelected = String(p.player_id) === String(appState.spotlightPlayerId);
      const rowBg = isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-slate-800/45';
      const ngsPrim = p.ngs_primary_metric || { label: 'NGS', value: 0, unit: '' };
      const ngsSec = p.ngs_secondary_metric || { label: 'NGS2', value: 0, unit: '' };

      const playerCell = `
        <td class="px-2.5 py-2">
          <div class="flex items-center gap-2">
            ${renderPlayerAvatarHtml(p, 'h-7 w-7')}
            <div class="min-w-0">
              <div class="truncate font-sans text-xs font-bold text-white">${escapeHtml(p.player_name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(p.position)} - ${escapeHtml(p.team)}</div>
            </div>
          </div>
        </td>
      `;

      if (layer === 'pfr_pff') {
        return `
          <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
            <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
            ${playerCell}
            <td class="px-2.5 py-2 text-right">${getPffBadgeHtml(p.pff_grade, p.pff_tier)}</td>
            <td class="px-2.5 py-2 text-right font-bold text-emerald-400">${formatNum(p.impact_score, 1)}</td>
            <td class="px-2.5 py-2 text-right text-cyan-300">${formatNum(p.pfr_pressure_or_bt_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-slate-200">${formatNum(Number(p.success_rate_competitive || 0) * 100, 1, '%')}</td>
          </tr>
        `;
      }

      if (layer === 'ngs') {
        return `
          <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
            <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
            ${playerCell}
            <td class="px-2.5 py-2 text-right"><span class="text-cyan-300 font-bold">${formatNum(ngsPrim.value, 2)}${escapeHtml(ngsPrim.unit)}</span> <span class="text-[9px] text-slate-400">${escapeHtml(ngsPrim.label)}</span></td>
            <td class="px-2.5 py-2 text-right"><span class="text-slate-200">${formatNum(ngsSec.value, 1)}${escapeHtml(ngsSec.unit)}</span> <span class="text-[9px] text-slate-400">${escapeHtml(ngsSec.label)}</span></td>
            <td class="px-2.5 py-2 text-right text-amber-300">${formatSigned(p.yac_over_expected_epa, 2)}</td>
            <td class="px-2.5 py-2 text-right font-bold text-emerald-400">${formatNum(p.impact_score, 1)}</td>
          </tr>
        `;
      }

      if (layer === 'rbsdm') {
        return `
          <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
            <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
            ${playerCell}
            <td class="px-2.5 py-2 text-right font-bold text-indigo-300">${formatSigned(p.rbsdm_composite, 3)}</td>
            <td class="px-2.5 py-2 text-right font-bold text-emerald-300">${formatSigned(p.epa_per_play_competitive, 3)}</td>
            <td class="px-2.5 py-2 text-right text-cyan-300">${formatSigned(p.wpa_competitive, 3)}</td>
            <td class="px-2.5 py-2 text-right text-slate-200">${p.position === 'QB' ? formatSigned(p.cpoe_competitive, 1, '%') : '--'}</td>
          </tr>
        `;
      }

      if (layer === 'profiler') {
        return `
          <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
            <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
            ${playerCell}
            <td class="px-2.5 py-2 text-right font-bold text-amber-300">${formatNum(p.wopr, 2)}</td>
            <td class="px-2.5 py-2 text-right text-cyan-300">${formatNum(p.target_share_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-indigo-300">${formatNum(p.air_yards_share_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-slate-300">${formatNum(p.adot, 1)}y / RZ ${formatNum(p.red_zone_share_pct, 0, '%')}</td>
          </tr>
        `;
      }

      if (layer === 'otc') {
        return `
          <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
            <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
            ${playerCell}
            <td class="px-2.5 py-2 text-right font-bold text-white">$${formatNum(p.contract_apy_m, 2)}M</td>
            <td class="px-2.5 py-2 text-right text-slate-300">$${formatNum(p.contract_guaranteed_m, 1)}M</td>
            <td class="px-2.5 py-2 text-right text-amber-300">${formatNum(p.contract_cap_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right">${getCapRoiBadgeHtml(p)}</td>
          </tr>
        `;
      }

      // Default Master 360° row
      return `
        <tr class="cursor-pointer transition ${rowBg}" data-spotlight-row="${escapeHtml(p.player_id)}">
          <td class="px-2.5 py-2 text-slate-400">${p.rank_overall}</td>
          ${playerCell}
          <td class="px-2.5 py-2 text-right">${getPffBadgeHtml(p.pff_grade, p.pff_tier)}</td>
          <td class="px-2.5 py-2 text-right">
            <div class="font-extrabold text-emerald-400">${formatNum(p.impact_score, 1)}</div>
            <div class="ml-auto mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full bg-emerald-400" style="width: ${Math.min(100, Math.max(5, Number(p.impact_score || 0)))}%"></div>
            </div>
          </td>
          <td class="px-2.5 py-2 text-right font-semibold ${Number(p.epa_per_play_competitive) >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
            ${formatSigned(p.epa_per_play_competitive, 3)}
          </td>
          <td class="px-2.5 py-2 text-right">
            <div class="text-cyan-300 font-semibold">${formatNum(ngsPrim.value, 2)}${escapeHtml(ngsPrim.unit)} <span class="text-[9px] text-slate-400">${escapeHtml(ngsPrim.label)}</span></div>
            <div class="text-[9px] text-slate-400">${p.position === 'WR' || p.position === 'TE' ? `WOPR ${formatNum(p.wopr, 2)}` : `Expl ${formatNum(p.explosive_play_rate_pct, 1)}%`}</div>
          </td>
          <td class="px-2.5 py-2 text-right">${getCapRoiBadgeHtml(p)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderFullRankingsTable() {
  const tbody = document.getElementById('rankings-tbody');
  const badge = document.getElementById('players-qualified-badge');
  if (!tbody) return;

  const players = getFilteredPlayers();
  if (badge) badge.textContent = `${players.length} titulares calificados`;

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="px-4 py-12 text-center text-slate-400">Sin jugadores para los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = players
    .map((p) => {
      const ngsPrim = p.ngs_primary_metric || { label: 'NGS', value: 0, unit: '' };
      const ngsSec = p.ngs_secondary_metric || { label: 'NGS2', value: 0, unit: '' };

      return `
        <tr class="hover:bg-slate-800/40 transition cursor-pointer" data-spotlight-row="${escapeHtml(p.player_id)}">
          <td class="px-3 py-2.5 text-slate-400 font-bold">#${p.rank_overall}</td>
          <td class="px-3 py-2.5">
            <div class="flex items-center gap-2.5">
              ${renderPlayerAvatarHtml(p, 'h-8 w-8')}
              <div>
                <div class="font-sans text-xs font-extrabold text-white">${escapeHtml(p.player_name)}</div>
                <div class="text-[10px] text-slate-400">${escapeHtml(p.team)} ${p.jersey_number ? `#${escapeHtml(p.jersey_number)}` : ''} ${p.college ? `- ${escapeHtml(p.college)}` : ''}</div>
              </div>
            </div>
          </td>
          <td class="px-2.5 py-2.5">
            <span class="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">${escapeHtml(p.position)}</span>
          </td>
          <td class="px-3 py-2.5 text-right">${getPffBadgeHtml(p.pff_grade, p.pff_tier)}</td>
          <td class="px-3 py-2.5 text-right">
            <span class="text-sm font-black text-emerald-400">${formatNum(p.impact_score, 1)}</span>
            <div class="text-[9px] text-slate-400">#${p.rank_position} ${escapeHtml(p.position)}</div>
          </td>
          <td class="px-3 py-2.5 text-right">
            <div class="font-bold text-indigo-300">${formatSigned(p.rbsdm_composite, 3)}</div>
            <div class="text-[10px] text-emerald-300">EPA/P ${formatSigned(p.epa_per_play_competitive, 3)}</div>
          </td>
          <td class="px-3 py-2.5 text-right font-semibold text-cyan-300">
            ${formatSigned(p.wpa_competitive, 3)}
          </td>
          <td class="px-3 py-2.5 text-right">
            <div class="font-bold text-cyan-300">${formatNum(ngsPrim.value, 2)}${escapeHtml(ngsPrim.unit)} <span class="text-[9px] text-slate-400">${escapeHtml(ngsPrim.label)}</span></div>
            <div class="text-[10px] text-slate-400">${formatNum(ngsSec.value, 1)}${escapeHtml(ngsSec.unit)} ${escapeHtml(ngsSec.label)}</div>
          </td>
          <td class="px-3 py-2.5 text-right">
            <div class="font-bold text-amber-300">WOPR ${formatNum(p.wopr, 2)}</div>
            <div class="text-[10px] text-slate-400">Tgt ${formatNum(p.target_share_pct, 1)}% | aDOT ${formatNum(p.adot, 1)}y</div>
          </td>
          <td class="px-3 py-2.5 text-right">
            <div class="text-slate-200">Expl ${formatNum(p.explosive_play_rate_pct, 1)}%</div>
            <div class="text-[10px] text-slate-400">PFR ${formatNum(p.pfr_pressure_or_bt_pct, 1)}%</div>
          </td>
          <td class="px-3 py-2.5 text-right">${getCapRoiBadgeHtml(p)}</td>
          <td class="px-3 py-2.5 text-right">
            <span class="font-bold ${Number(p.statistical_inflation_index) > 15 ? 'text-amber-400' : 'text-slate-300'}">${formatSigned(p.statistical_inflation_index, 1)}</span>
            <div class="text-[9px] text-slate-400">${p.garbage_yards || 0} yd Q4</div>
          </td>
        </tr>
      `;
    })
    .join('');
}

/* ========================================================================= */
/* 6. RIGHT BENTO WIDGET: PLAYERPROFILER 6-AXIS HEXAGONAL RADAR + PFF        */
/* ========================================================================= */

function computePlayerRadarAxes(player, allPlayers) {
  const samePos = allPlayers.filter((p) => p.position === player.position);
  const pool = samePos.length >= 5 ? samePos : allPlayers;

  function pctRank(getter, invert = false) {
    const vals = pool.map(getter).filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
    if (!vals.length) return 50;
    const target = Number(getter(player) || 0);
    const below = vals.filter((v) => (invert ? Number(v) > target : Number(v) <= target)).length;
    return Math.max(8, Math.min(99, Math.round((below / vals.length) * 100)));
  }

  return [
    { label: 'Impact', pct: pctRank((p) => p.impact_score), val: formatNum(player.impact_score, 1) },
    { label: 'PFF Grade', pct: pctRank((p) => p.pff_grade), val: formatNum(player.pff_grade, 1) },
    { label: 'EPA/Play', pct: pctRank((p) => p.epa_per_play_competitive), val: formatSigned(player.epa_per_play_competitive, 2) },
    { label: 'WPA Clutch', pct: pctRank((p) => p.wpa_competitive), val: formatSigned(player.wpa_competitive, 2) },
    {
      label: player.position === 'QB' ? 'NGS TTT' : 'NGS / YAC',
      pct: pctRank((p) => p.ngs_primary_metric?.value, player.position === 'QB'),
      val: `${formatNum(player.ngs_primary_metric?.value, 2)}${player.ngs_primary_metric?.unit || ''}`,
    },
    {
      label: player.position === 'QB' ? 'CPOE %' : 'WOPR / Vol',
      pct: pctRank((p) => (player.position === 'QB' ? p.cpoe_competitive : p.wopr || p.explosive_play_rate_pct)),
      val: player.position === 'QB' ? formatSigned(player.cpoe_competitive, 1, '%') : formatNum(player.wopr || player.explosive_play_rate_pct, 2),
    },
  ];
}

function buildHexagonRadarSvg(axes) {
  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 72;

  function polarToXY(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const rings = [0.33, 0.66, 1.0].map((scale) => {
    const pts = axes
      .map((_, i) => {
        const { x, y } = polarToXY(i * 60, maxR * scale);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#1E293B" stroke-width="1" />`;
  });

  const spokes = axes.map((_, i) => {
    const { x, y } = polarToXY(i * 60, maxR);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1E293B" stroke-width="1" />`;
  });

  const polyPts = axes
    .map((ax, i) => {
      const r = (Math.max(10, ax.pct) / 100) * maxR;
      const { x, y } = polarToXY(i * 60, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const labels = axes.map((ax, i) => {
    const { x, y } = polarToXY(i * 60, maxR + 21);
    const dot = polarToXY(i * 60, (Math.max(10, ax.pct) / 100) * maxR);
    return `
      <circle cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}" r="3.2" fill="#10B981" stroke="#0B0F17" stroke-width="1.2" />
      <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#CBD5E1" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700">
        ${escapeHtml(ax.label)} (${ax.pct}p)
      </text>
    `;
  });

  return `
    <svg viewBox="0 0 ${size} ${size}" class="mx-auto h-48 w-48 overflow-visible">
      ${rings.join('')}
      ${spokes.join('')}
      <polygon points="${polyPts}" fill="rgba(16, 185, 129, 0.24)" stroke="#10B981" stroke-width="2" />
      ${labels.join('')}
    </svg>
  `;
}

function renderSpotlightAndRadarCard() {
  const container = document.getElementById('bento-spotlight-card-body');
  if (!container) return;

  const players = getActivePlayersDataset();
  if (!players.length) return;

  const player =
    players.find((p) => String(p.player_id) === String(appState.spotlightPlayerId)) || players[0];
  appState.spotlightPlayerId = player.player_id;

  const axes = computePlayerRadarAxes(player, players);
  const ngsPrim = player.ngs_primary_metric || { label: 'NGS', value: 0, unit: '' };

  container.innerHTML = `
    <div class="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
      <div class="flex items-center gap-2.5">
        ${renderPlayerAvatarHtml(player, 'h-12 w-12')}
        <div>
          <div class="flex items-center gap-1.5">
            <h4 class="text-sm font-black text-white">${escapeHtml(player.player_name)}</h4>
            <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300">#${player.rank_overall} NFL</span>
          </div>
          <div class="font-mono-num text-[11px] text-slate-400">
            ${escapeHtml(player.position)} - ${escapeHtml(player.team)} ${player.college ? `| ${escapeHtml(player.college)}` : ''}
          </div>
        </div>
      </div>
      <div class="text-right">
        ${getPffBadgeHtml(player.pff_grade, player.pff_tier)}
      </div>
    </div>

    <!-- Radar Hexagonal de 6 Ejes -->
    <div class="my-2 flex items-center justify-center">
      ${buildHexagonRadarSvg(axes)}
    </div>

    <!-- Píldoras Multifuente del Jugador (PlayerProfiler + NGS + OTC) -->
    <div class="grid grid-cols-3 gap-2 font-mono-num text-[10px]">
      <div class="rounded-lg border border-slate-800 bg-[#090D16] p-2">
        <div class="text-slate-400">Impact Score</div>
        <div class="text-sm font-black text-emerald-400">${formatNum(player.impact_score, 1)}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-[#090D16] p-2">
        <div class="text-slate-400">${escapeHtml(ngsPrim.label)}</div>
        <div class="text-sm font-black text-cyan-300">${formatNum(ngsPrim.value, 2)}${escapeHtml(ngsPrim.unit)}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-[#090D16] p-2">
        <div class="text-slate-400">Contrato OTC</div>
        <div class="text-sm font-black text-amber-300">$${formatNum(player.contract_apy_m, 1)}M</div>
      </div>
    </div>
  `;
}

/* ========================================================================= */
/* 7. RIGHT BENTO WIDGET: NFL SAVANT 6-ZONE PASS FIELD HEATMAP               */
/* ========================================================================= */

function getAggregatedPassZones(teamAbbr = 'ALL') {
  const teams = Array.isArray(appState.rankings?.team_rankings) ? appState.rankings.team_rankings : [];
  if (!teams.length) return [];

  if (teamAbbr !== 'ALL') {
    const found = teams.find((t) => t.team === teamAbbr);
    if (found && Array.isArray(found.pass_zones)) return found.pass_zones;
  }

  // Promedio agregado de los 32 equipos
  const keys = [
    { zone_id: 'deep_left', depth: 'deep', direction: 'left', label: 'Deep Left (>=15 yd)' },
    { zone_id: 'deep_middle', depth: 'deep', direction: 'middle', label: 'Deep Middle (>=15 yd)' },
    { zone_id: 'deep_right', depth: 'deep', direction: 'right', label: 'Deep Right (>=15 yd)' },
    { zone_id: 'short_left', depth: 'short', direction: 'left', label: 'Short Left (<15 yd)' },
    { zone_id: 'short_middle', depth: 'short', direction: 'middle', label: 'Short Middle (<15 yd)' },
    { zone_id: 'short_right', depth: 'short', direction: 'right', label: 'Short Right (<15 yd)' },
  ];

  return keys.map((k) => {
    let att = 0;
    let comp = 0;
    let tds = 0;
    let weightedEpa = 0;

    teams.forEach((t) => {
      const z = (t.pass_zones || []).find((pz) => pz.zone_id === k.zone_id);
      if (z) {
        const a = Number(z.attempts || 0);
        att += a;
        comp += Number(z.completions || 0);
        tds += Number(z.tds || 0);
        weightedEpa += Number(z.epa_per_pass || 0) * a;
      }
    });

    return {
      ...k,
      attempts: att,
      completions: comp,
      comp_pct: att > 0 ? (comp / att) * 100 : 0,
      epa_per_pass: att > 0 ? weightedEpa / att : 0,
      tds,
    };
  });
}

function buildSavantFieldHtml(teamAbbr) {
  const zones = getAggregatedPassZones(teamAbbr);
  if (!zones.length) {
    return `<div class="py-6 text-center font-mono-num text-xs text-slate-400">Sin datos de geometría de pases disponibles.</div>`;
  }

  const orderedIds = ['deep_left', 'deep_middle', 'deep_right', 'short_left', 'short_middle', 'short_right'];
  const cards = orderedIds.map((zid) => {
    const z = zones.find((item) => item.zone_id === zid) || {
      label: zid,
      attempts: 0,
      comp_pct: 0,
      epa_per_pass: 0,
      tds: 0,
    };
    const epa = Number(z.epa_per_pass || 0);
    let zoneStyle = 'border-slate-700/80 bg-slate-900/75 text-slate-200';
    if (epa >= 0.15) {
      zoneStyle = 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200';
    } else if (epa >= 0.02) {
      zoneStyle = 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200';
    } else if (epa < -0.05) {
      zoneStyle = 'border-rose-500/50 bg-rose-500/15 text-rose-200';
    }

    return `
      <div class="rounded-lg border p-2.5 font-mono-num transition ${zoneStyle}">
        <div class="flex items-center justify-between text-[9px] uppercase opacity-85">
          <span class="font-bold">${escapeHtml(z.label.replace(' (>=15 yd)', '').replace(' (<15 yd)', ''))}</span>
          <span>${z.depth === 'deep' ? '&ge;15Y' : '&lt;15Y'}</span>
        </div>
        <div class="mt-1 text-sm font-black">
          EPA/P ${formatSigned(epa, 2)}
        </div>
        <div class="mt-0.5 flex items-center justify-between text-[10px]">
          <span>Comp ${formatNum(z.comp_pct, 1, '%')}</span>
          <span>${z.attempts} att | ${z.tds} TD</span>
        </div>
      </div>
    `;
  });

  return `
    <div class="relative rounded-xl border border-emerald-500/30 bg-gradient-to-b from-[#091D19] via-[#0B1722] to-[#090D16] p-3">
      <div class="mb-2 flex items-center justify-between font-mono-num text-[10px] text-emerald-300/90">
        <span>⬆ ZONA PROFUNDA (DEEP PASSING &ge; 15 AIR YARDS)</span>
        <span>${teamAbbr === 'ALL' ? 'MEDIA NFL (32 EQUIPOS)' : `OFENSIVA ${escapeHtml(teamAbbr)}`}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${cards.slice(0, 3).join('')}
      </div>
      <div class="my-2 border-t border-dashed border-emerald-500/30"></div>
      <div class="grid grid-cols-3 gap-2">
        ${cards.slice(3, 6).join('')}
      </div>
      <div class="mt-2 text-center font-mono-num text-[10px] text-slate-400">
        ⬇ LÍNEA DE GOLPEO (LINE OF SCRIMMAGE - SHORT &lt; 15 AIR YARDS)
      </div>
    </div>
  `;
}

function renderSavantFieldHeatmaps() {
  const bentoEl = document.getElementById('bento-savant-field-container');
  const labEl = document.getElementById('lab-savant-field-container');
  const html = buildSavantFieldHtml(appState.savantTeamAbbr);
  if (bentoEl) bentoEl.innerHTML = html;
  if (labEl) labEl.innerHTML = html;
}

/* ========================================================================= */
/* 8. CUADRANTE 32 EQUIPOS (LOGOS) & SHARP SITUATIONAL HEATMAP MATRIX        */
/* ========================================================================= */

function buildTeamQuadrantSvg(teams, width = 420, height = 260) {
  if (!teams.length) return '';
  const pad = 28;

  const offVals = teams.map((t) => Number(t.off_epa_per_play || 0));
  const defVals = teams.map((t) => Number(t.def_epa_per_play || 0));
  const maxAbs = Math.max(
    0.18,
    ...offVals.map((v) => Math.abs(v)),
    ...defVals.map((v) => Math.abs(v))
  ) * 1.15;

  function mapX(offEpa) {
    return pad + ((offEpa + maxAbs) / (2 * maxAbs)) * (width - pad * 2);
  }
  // En defensiva menor EPA permitido es mejor (arriba)
  function mapY(defEpa) {
    return pad + ((defEpa + maxAbs) / (2 * maxAbs)) * (height - pad * 2);
  }

  const midX = mapX(0);
  const midY = mapY(0);

  const nodes = teams
    .map((t) => {
      const x = mapX(Number(t.off_epa_per_play || 0));
      const y = mapY(Number(t.def_epa_per_play || 0));
      const logo = getTeamLogo(t.team);
      return `
        <g class="cursor-pointer transition hover:opacity-100" data-filter-team-logo="${escapeHtml(t.team)}">
          <title>${escapeHtml(t.team)} (#${t.rank_team}) | DVOA: ${formatSigned(t.dvoa_total_pct, 1, '%')} | Off EPA: ${formatSigned(t.off_epa_per_play, 3)} | Def EPA: ${formatSigned(t.def_epa_per_play, 3)}</title>
          ${
            logo
              ? `<image href="${escapeHtml(logo)}" x="${(x - 10).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="20" height="20" />`
              : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#10B981" />`
          }
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible">
      <rect x="${midX}" y="${pad}" width="${width - pad - midX}" height="${midY - pad}" fill="rgba(16, 185, 129, 0.06)" />
      <rect x="${pad}" y="${midY}" width="${midX - pad}" height="${height - pad - midY}" fill="rgba(244, 63, 94, 0.05)" />
      <line x1="${pad}" y1="${midY}" x2="${width - pad}" y2="${midY}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />
      <line x1="${midX}" y1="${pad}" x2="${midX}" y2="${height - pad}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${width - pad - 4}" y="${pad + 11}" text-anchor="end" fill="#10B981" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700">CONTENDIENTES ÉLITE (Off+ / Def+)</text>
      <text x="${pad + 4}" y="${height - pad - 5}" text-anchor="start" fill="#F43F5E" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700">RECONSTRUCCIÓN</text>
      ${nodes}
    </svg>
  `;
}

function getDivergingHeatClass(val, allVals, invert = false) {
  const num = Number(val || 0);
  const sorted = [...allVals].map(Number).sort((a, b) => a - b);
  if (!sorted.length) return 'text-slate-200';
  const idx = sorted.findIndex((v) => v >= num);
  const pct = idx === -1 ? 1 : idx / sorted.length;
  const effPct = invert ? 1 - pct : pct;

  if (effPct >= 0.78) return 'bg-emerald-500/20 text-emerald-300 font-bold';
  if (effPct >= 0.55) return 'bg-cyan-500/10 text-cyan-200';
  if (effPct <= 0.22) return 'bg-rose-500/20 text-rose-300 font-semibold';
  if (effPct <= 0.40) return 'bg-amber-500/10 text-amber-200';
  return 'text-slate-300';
}

function renderTeamQuadrantAndSharpMatrix() {
  const teams = Array.isArray(appState.rankings?.team_rankings) ? appState.rankings.team_rankings : [];
  if (!teams.length) return;

  // 1. Cuadrante SVG en el Bento Hub y en la pestaña Equipos
  const bentoQuad = document.getElementById('bento-team-quadrant-svg');
  const fullQuad = document.getElementById('team-tier-scatter-container');
  if (bentoQuad) bentoQuad.innerHTML = buildTeamQuadrantSvg(teams, 390, 235);
  if (fullQuad) fullQuad.innerHTML = buildTeamQuadrantSvg(teams, 680, 380);

  // 2. Resumen de Cuadrantes en Pestaña Equipos
  const quadSummary = document.getElementById('team-quadrant-summary');
  if (quadSummary) {
    const elite = teams.filter((t) => Number(t.off_epa_per_play) > 0 && Number(t.def_epa_per_play) < 0);
    quadSummary.innerHTML = `
      <div class="rounded-lg border border-emerald-500/30 bg-[#0B0F17] p-3">
        <div class="font-mono-num text-xs font-bold text-emerald-400">Contendientes Élite (${elite.length} Equipos)</div>
        <p class="mt-1 text-[11px] text-slate-300">${elite.map((t) => t.team).join(', ') || '--'}</p>
      </div>
      <div class="rounded-lg border border-slate-800 bg-[#0B0F17] p-3">
        <div class="font-mono-num text-xs font-bold text-cyan-300">Mayor Espacio Salarial OTC</div>
        <p class="mt-1 text-[11px] text-slate-300">
          ${[...teams]
            .sort((a, b) => Number(b.effective_cap_space_m || 0) - Number(a.effective_cap_space_m || 0))
            .slice(0, 4)
            .map((t) => `${t.team} ($${formatNum(t.effective_cap_space_m, 1)}M)`)
            .join(' | ')}
        </p>
      </div>
    `;
  }

  // Vectores para colores divergentes
  const cols = {
    dvoa: teams.map((t) => t.dvoa_total_pct),
    netEpa: teams.map((t) => t.net_epa_per_play),
    offEpa: teams.map((t) => t.off_epa_per_play),
    defEpa: teams.map((t) => t.def_epa_per_play),
    proe: teams.map((t) => t.proe_pct),
    early: teams.map((t) => t.early_down_epa),
    rzTd: teams.map((t) => t.red_zone_td_pct),
    third: teams.map((t) => t.third_down_conv_pct),
    expl: teams.map((t) => t.explosive_rate_pct),
    cap: teams.map((t) => t.effective_cap_space_m),
  };

  // 3. Preview Top 8 en el Bento Hub
  const previewTbody = document.getElementById('bento-sharp-preview-tbody');
  if (previewTbody) {
    previewTbody.innerHTML = teams
      .slice(0, 8)
      .map((t) => {
        const logo = getTeamLogo(t.team);
        return `
          <tr class="hover:bg-slate-800/45 cursor-pointer transition" data-filter-team-logo="${escapeHtml(t.team)}">
            <td class="px-3 py-2 font-bold text-white">
              <div class="flex items-center gap-2">
                ${logo ? `<img src="${escapeHtml(logo)}" alt="" class="h-5 w-5 object-contain" />` : ''}
                <span>#${t.rank_team} ${escapeHtml(t.team)}</span>
              </div>
            </td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.dvoa_total_pct, cols.dvoa)}">${formatSigned(t.dvoa_total_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.proe_pct, cols.proe)}">${formatSigned(t.proe_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.early_down_epa, cols.early)}">${formatSigned(t.early_down_epa, 3)}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.red_zone_td_pct, cols.rzTd)}">${formatNum(t.red_zone_td_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.explosive_rate_pct, cols.expl)}">${formatNum(t.explosive_rate_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-slate-300">${formatNum(t.shotgun_rate_pct, 1, '%')}</td>
            <td class="px-3 py-2 text-right ${getDivergingHeatClass(t.effective_cap_space_m, cols.cap)}">$${formatNum(t.effective_cap_space_m, 1)}M</td>
          </tr>
        `;
      })
      .join('');
  }

  // 4. Matriz Completa 32 Equipos en Pestaña Equipos
  const fullTeamsTbody = document.getElementById('teams-ranking-tbody');
  if (fullTeamsTbody) {
    fullTeamsTbody.innerHTML = teams
      .map((t) => {
        const logo = getTeamLogo(t.team);
        return `
          <tr class="hover:bg-slate-800/45 cursor-pointer transition" data-filter-team-logo="${escapeHtml(t.team)}">
            <td class="px-3 py-2 text-slate-400">#${t.rank_team}</td>
            <td class="px-3 py-2 font-bold text-white">
              <div class="flex items-center gap-2">
                ${logo ? `<img src="${escapeHtml(logo)}" alt="" class="h-5 w-5 object-contain" />` : ''}
                <span>${escapeHtml(t.team)}</span>
              </div>
            </td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.dvoa_total_pct, cols.dvoa)}">${formatSigned(t.dvoa_total_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.net_epa_per_play, cols.netEpa)}">${formatSigned(t.net_epa_per_play, 3)}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.off_epa_per_play, cols.offEpa)}">${formatSigned(t.off_epa_per_play, 3)}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.def_epa_per_play, cols.defEpa, true)}">${formatSigned(t.def_epa_per_play, 3)}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.proe_pct, cols.proe)}">${formatSigned(t.proe_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.early_down_epa, cols.early)}">${formatSigned(t.early_down_epa, 3)}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.red_zone_td_pct, cols.rzTd)}">${formatNum(t.red_zone_td_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.third_down_conv_pct, cols.third)}">${formatNum(t.third_down_conv_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${getDivergingHeatClass(t.explosive_rate_pct, cols.expl)}">${formatNum(t.explosive_rate_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-slate-300">${formatNum(t.shotgun_rate_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right text-cyan-300">${formatNum(t.def_pressure_rate_pct, 1, '%')}</td>
            <td class="px-2.5 py-2 text-right ${Number(t.turnover_margin) >= 0 ? 'text-emerald-300' : 'text-rose-300'}">${formatSigned(t.turnover_margin, 0)}</td>
            <td class="px-3 py-2 text-right ${getDivergingHeatClass(t.effective_cap_space_m, cols.cap)}">$${formatNum(t.effective_cap_space_m, 1)}M</td>
          </tr>
        `;
      })
      .join('');
  }
}

/* ========================================================================= */
/* 9. PLAYERPROFILER H2H LAB & CLUTCH / INFLATION LEADERBOARDS               */
/* ========================================================================= */

function renderH2HAndClutchLab() {
  const players = getActivePlayersDataset();
  if (!players.length) return;

  const pA = players.find((p) => String(p.player_id) === String(appState.h2hPlayerA)) || players[0];
  const pB = players.find((p) => String(p.player_id) === String(appState.h2hPlayerB)) || players[1] || players[0];

  const h2hEl = document.getElementById('h2h-comparison-container');
  if (h2hEl && pA && pB) {
    const metrics = [
      { label: 'Impact Score (0-100)', a: pA.impact_score, b: pB.impact_score, fmt: (v) => formatNum(v, 1) },
      { label: 'PFF Calibrated Grade', a: pA.pff_grade, b: pB.pff_grade, fmt: (v) => formatNum(v, 1) },
      { label: 'EPA/Play Competitivo', a: pA.epa_per_play_competitive, b: pB.epa_per_play_competitive, fmt: (v) => formatSigned(v, 3) },
      { label: 'WPA Competitivo', a: pA.wpa_competitive, b: pB.wpa_competitive, fmt: (v) => formatSigned(v, 3) },
      { label: 'Explosive Play %', a: pA.explosive_play_rate_pct, b: pB.explosive_play_rate_pct, fmt: (v) => formatNum(v, 1, '%') },
      { label: 'Contrato OTC APY ($M)', a: pA.contract_apy_m, b: pB.contract_apy_m, fmt: (v) => `$${formatNum(v, 2)}M` },
      { label: 'Salary Cap ROI Score', a: pA.cap_roi_score, b: pB.cap_roi_score, fmt: (v) => formatNum(v, 1) },
    ];

    h2hEl.innerHTML = `
      <div class="lg:col-span-4 rounded-xl border border-emerald-500/30 bg-[#0B0F17] p-4 flex flex-col items-center text-center">
        ${renderPlayerAvatarHtml(pA, 'h-16 w-16')}
        <h4 class="mt-2 text-base font-black text-white">${escapeHtml(pA.player_name)}</h4>
        <div class="font-mono-num text-xs text-emerald-300">${escapeHtml(pA.position)} - ${escapeHtml(pA.team)} (#${pA.rank_overall})</div>
        <div class="mt-2">${getPffBadgeHtml(pA.pff_grade, pA.pff_tier)}</div>
        ${buildHexagonRadarSvg(computePlayerRadarAxes(pA, players))}
      </div>

      <div class="lg:col-span-4 rounded-xl border border-slate-800 bg-[#0B0F17] p-4 flex flex-col justify-center space-y-2.5 font-mono-num text-xs">
        ${metrics
          .map((m) => {
            const winA = Number(m.a || 0) >= Number(m.b || 0);
            return `
              <div class="rounded-lg border border-slate-800/90 bg-[#131B2E] px-3 py-2">
                <div class="text-center text-[10px] uppercase text-slate-400">${escapeHtml(m.label)}</div>
                <div class="mt-1 flex items-center justify-between">
                  <span class="${winA ? 'font-extrabold text-emerald-400' : 'text-slate-300'}">${m.fmt(m.a)}</span>
                  <span class="text-[10px] text-slate-500">VS</span>
                  <span class="${!winA ? 'font-extrabold text-cyan-300' : 'text-slate-300'}">${m.fmt(m.b)}</span>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="lg:col-span-4 rounded-xl border border-cyan-500/30 bg-[#0B0F17] p-4 flex flex-col items-center text-center">
        ${renderPlayerAvatarHtml(pB, 'h-16 w-16')}
        <h4 class="mt-2 text-base font-black text-white">${escapeHtml(pB.player_name)}</h4>
        <div class="font-mono-num text-xs text-cyan-300">${escapeHtml(pB.position)} - ${escapeHtml(pB.team)} (#${pB.rank_overall})</div>
        <div class="mt-2">${getPffBadgeHtml(pB.pff_grade, pB.pff_tier)}</div>
        ${buildHexagonRadarSvg(computePlayerRadarAxes(pB, players))}
      </div>
    `;
  }

  // Clutch Leaderboard & Inflation Detector
  const clutchList = document.getElementById('clutch-leaderboard-list');
  if (clutchList) {
    const byClutch = [...players]
      .filter((p) => Number(p.clutch_snaps || 0) >= 5)
      .sort((a, b) => Number(b.clutch_index || 0) - Number(a.clutch_index || 0))
      .slice(0, 6);

    clutchList.innerHTML = byClutch
      .map(
        (p, i) => `
          <div class="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 font-mono-num text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-emerald-400 font-bold">#${i + 1}</span>
              ${renderPlayerAvatarHtml(p, 'h-7 w-7')}
              <div class="truncate">
                <div class="truncate font-sans font-bold text-white">${escapeHtml(p.player_name)}</div>
                <div class="text-[10px] text-slate-400">${escapeHtml(p.position)} - ${escapeHtml(p.team)} (${p.clutch_snaps} snaps)</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-black text-emerald-400">${formatNum(p.clutch_index, 1)}</div>
              <div class="text-[9px] text-cyan-300">WPA ${formatSigned(p.clutch_wpa_total, 2)}</div>
            </div>
          </div>
        `
      )
      .join('');
  }

  const infList = document.getElementById('inflation-detector-list');
  if (infList) {
    const byInf = [...players]
      .sort((a, b) => Number(b.statistical_inflation_index || 0) - Number(a.statistical_inflation_index || 0))
      .slice(0, 6);

    infList.innerHTML = byInf
      .map(
        (p, i) => `
          <div class="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 font-mono-num text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-amber-400 font-bold">#${i + 1}</span>
              ${renderPlayerAvatarHtml(p, 'h-7 w-7')}
              <div class="truncate">
                <div class="truncate font-sans font-bold text-white">${escapeHtml(p.player_name)}</div>
                <div class="text-[10px] text-slate-400">${escapeHtml(p.position)} - ${escapeHtml(p.team)} (${p.garbage_yards || 0} yd Q4)</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-black text-amber-400">+${formatNum(p.statistical_inflation_index, 1)}</div>
              <div class="text-[9px] text-slate-400">${formatNum(p.yardage_inflation_pct, 1)}% basura</div>
            </div>
          </div>
        `
      )
      .join('');
  }
}

/* ========================================================================= */
/* 10. CRÓNICAS ANALÍTICAS IA & RESUMEN EN EL BENTO HUB                      */
/* ========================================================================= */

function renderCritiquesSection() {
  if (!appState.critiques) return;
  const c = appState.critiques;

  const execText = sanitizeHyphens(c.executive_summary || '');
  const execEl = document.getElementById('executive-summary-text');
  const bentoExecEl = document.getElementById('bento-ai-summary-preview');
  if (execEl) execEl.textContent = execText;
  if (bentoExecEl) bentoExecEl.textContent = execText;

  const modeBadge = document.getElementById('critiques-mode-badge');
  if (modeBadge) {
    modeBadge.textContent = `Modo: ${c.generation_mode === 'gemini_ai' ? 'Gemini 2.5 Flash' : 'Plantilla Determinista'}`;
  }
  const updEl = document.getElementById('critiques-updated-at');
  if (updEl) updEl.textContent = formatUtcTimestamp(c.updated_at);

  const mvp = c.real_mvp;
  const inf = c.inflated_stat_player;

  if (mvp) {
    const tEl = document.getElementById('critique-mvp-title');
    const sEl = document.getElementById('critique-mvp-score');
    const bEl = document.getElementById('critique-mvp-body');
    if (tEl) tEl.textContent = sanitizeHyphens(`${mvp.player_name} (${mvp.position} - ${mvp.team})`);
    if (sEl) sEl.textContent = formatNum(mvp.impact_score, 1);
    if (bEl) bEl.textContent = sanitizeHyphens(mvp.analysis || mvp.critique || '');
  }

  if (inf) {
    const tEl = document.getElementById('critique-inflated-title');
    const iEl = document.getElementById('critique-inflated-index');
    const bEl = document.getElementById('critique-inflated-body');
    if (tEl) tEl.textContent = sanitizeHyphens(`${inf.player_name} (${inf.position} - ${inf.team})`);
    if (iEl) iEl.textContent = formatSigned(inf.statistical_inflation_index, 1);
    if (bEl) bEl.textContent = sanitizeHyphens(inf.analysis || inf.critique || '');
  }

  const miniComp = document.getElementById('bento-ai-comparison-mini');
  if (miniComp && mvp && inf) {
    miniComp.innerHTML = `
      <div class="rounded-lg border border-emerald-500/30 bg-[#0B0F17] p-2.5 text-xs">
        <div class="font-mono-num text-[10px] font-bold text-emerald-400">★ MVP REAL</div>
        <div class="mt-0.5 font-bold text-white">${escapeHtml(mvp.player_name)} (${escapeHtml(mvp.team)})</div>
        <div class="font-mono-num text-[10px] text-slate-400">Impact ${formatNum(mvp.impact_score, 1)} | EPA/P ${formatSigned(mvp.epa_per_play_competitive, 3)}</div>
      </div>
      <div class="rounded-lg border border-amber-500/30 bg-[#0B0F17] p-2.5 text-xs">
        <div class="font-mono-num text-[10px] font-bold text-amber-400">⚠ ESTADÍSTICO INFLADO</div>
        <div class="mt-0.5 font-bold text-white">${escapeHtml(inf.player_name)} (${escapeHtml(inf.team)})</div>
        <div class="font-mono-num text-[10px] text-slate-400">Inflación ${formatSigned(inf.statistical_inflation_index, 1)} | ${inf.garbage_yards || 0} yd Q4</div>
      </div>
    `;
  }

  const gridEl = document.getElementById('critiques-grid');
  const list = Array.isArray(c.critiques) ? c.critiques : [];
  if (gridEl) {
    gridEl.innerHTML = list
      .map(
        (item) => `
          <article class="bento-card p-5 space-y-2.5">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2 font-mono-num text-[11px]">
              <span class="rounded bg-cyan-500/15 px-2 py-0.5 font-bold uppercase text-cyan-300">${escapeHtml(item.category || item.type || 'Auditoría')}</span>
              <span class="text-slate-400">${escapeHtml(item.subject || '')}</span>
            </div>
            <h3 class="text-sm font-extrabold text-white">${escapeHtml(item.headline || item.title || '')}</h3>
            <p class="text-xs leading-relaxed text-slate-300">${escapeHtml(item.body || item.analysis || '')}</p>
          </article>
        `
      )
      .join('');
  }
}

/* ========================================================================= */
/* 11. NAVEGACIÓN DE PESTAÑAS, DEEP-LINKS #METODO-* Y EVENTOS INTERACTIVOS   */
/* ========================================================================= */

export function switchMainTab(targetTab) {
  appState.activeTab = targetTab;
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    const isMatch = panel.getAttribute('data-tab-panel') === targetTab;
    panel.classList.toggle('hidden', !isMatch);
  });

  document.querySelectorAll('.main-tab-btn').forEach((btn) => {
    const isMatch = btn.getAttribute('data-tab-target') === targetTab;
    btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    if (isMatch) {
      btn.className =
        'main-tab-btn inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-emerald-300 shadow-sm transition whitespace-nowrap';
    } else {
      btn.className =
        'main-tab-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#131B2E] px-3 py-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white whitespace-nowrap';
    }
  });
}

function navigateToMethodologyAnchor(hash) {
  if (!hash || !hash.startsWith('#metodo-')) return;
  switchMainTab('methodology');
  requestAnimationFrame(() => {
    const targetEl = document.querySelector(hash);
    if (targetEl) {
      document.querySelectorAll('.method-card.method-highlight').forEach((el) => el.classList.remove('method-highlight'));
      targetEl.classList.add('method-highlight');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function bindEvents() {
  // 1. Pestañas principales
  document.querySelectorAll('.main-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab-target');
      if (target) switchMainTab(target);
    });
  });

  // Botones rápidos "Expandir ->" dentro del Bento Hub
  document.addEventListener('click', (e) => {
    const jumpBtn = e.target.closest('[data-jump-tab]');
    if (jumpBtn) {
      switchMainTab(jumpBtn.getAttribute('data-jump-tab'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Deep-links #metodo-*
    const methodLink = e.target.closest('a[href^="#metodo-"]');
    if (methodLink) {
      e.preventDefault();
      const hash = methodLink.getAttribute('href');
      history.replaceState(null, '', hash);
      navigateToMethodologyAnchor(hash);
      return;
    }

    // Clic en fila de jugador -> actualiza Spotlight Radar y Savant Team
    const playerRow = e.target.closest('[data-spotlight-row]');
    if (playerRow) {
      const pid = playerRow.getAttribute('data-spotlight-row');
      appState.spotlightPlayerId = pid;
      const spotSel = document.getElementById('bento-spotlight-player-select');
      if (spotSel) spotSel.value = pid;
      const pObj = getActivePlayersDataset().find((p) => String(p.player_id) === String(pid));
      if (pObj && pObj.team) {
        appState.savantTeamAbbr = pObj.team;
        ['bento-savant-team-select', 'lab-savant-team-select'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = pObj.team;
        });
        renderSavantFieldHeatmaps();
      }
      renderBentoCenterTable();
      renderSpotlightAndRadarCard();
      return;
    }

    // Clic en botón de jugador dentro de una noticia
    const newsPlayerBtn = e.target.closest('[data-select-spotlight-name]');
    if (newsPlayerBtn) {
      const name = newsPlayerBtn.getAttribute('data-select-spotlight-name');
      const match = getActivePlayersDataset().find((p) => p.player_name === name);
      if (match) {
        appState.spotlightPlayerId = match.player_id;
        renderSpotlightAndRadarCard();
        renderBentoCenterTable();
      }
      return;
    }

    // Clic en logo o fila de equipo en el Cuadrante / Matriz Sharp
    const teamNode = e.target.closest('[data-filter-team-logo]');
    if (teamNode) {
      const tAbbr = teamNode.getAttribute('data-filter-team-logo');
      if (tAbbr) {
        appState.teamFilter = appState.teamFilter === tAbbr ? 'ALL' : tAbbr;
        const teamSel = document.getElementById('ranking-team-select');
        if (teamSel) teamSel.value = appState.teamFilter;
        appState.savantTeamAbbr = tAbbr;
        ['bento-savant-team-select', 'lab-savant-team-select'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = tAbbr;
        });
        renderBentoCenterTable();
        renderFullRankingsTable();
        renderBentoNewsWire();
        renderSavantFieldHeatmaps();
      }
      return;
    }

    // Abrir modal de curva WP de partido
    const modalBtn = e.target.closest('[data-open-game-modal]');
    if (modalBtn) {
      openGameModal(modalBtn.getAttribute('data-open-game-modal'));
      return;
    }

    // Ordenamiento de columnas
    const sortTh = e.target.closest('.sortable-th');
    if (sortTh) {
      const field = sortTh.getAttribute('data-sort');
      if (field) {
        if (appState.sortField === field) {
          appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          appState.sortField = field;
          appState.sortDirection = field === 'rank_overall' || field === 'player_name' ? 'asc' : 'desc';
        }
        renderBentoCenterTable();
        renderFullRankingsTable();
      }
    }
  });

  // Cerrar modal de partido
  const closeModalBtn = document.getElementById('btn-close-game-modal');
  const gameModal = document.getElementById('game-detail-modal');
  if (closeModalBtn && gameModal) {
    closeModalBtn.addEventListener('click', () => {
      gameModal.classList.add('hidden');
      gameModal.classList.remove('flex');
    });
    gameModal.addEventListener('click', (e) => {
      if (e.target === gameModal) {
        gameModal.classList.add('hidden');
        gameModal.classList.remove('flex');
      }
    });
  }

  // Selector de Capas del Centro del Bento Hub
  document.querySelectorAll('.layer-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.bentoLayer = btn.getAttribute('data-layer') || 'master';
      document.querySelectorAll('.layer-pill-btn').forEach((b) => {
        const active = b.getAttribute('data-layer') === appState.bentoLayer;
        b.className = active
          ? 'layer-pill-btn rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300'
          : 'layer-pill-btn rounded border border-slate-800 bg-[#131B2E] px-2 py-0.5 font-mono-num text-[10px] text-slate-300 hover:text-white';
      });
      renderBentoCenterTable();
    });
  });

  // Pestañas de Fuentes de Noticias (8 Fuentes)
  document.querySelectorAll('.bento-news-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.newsCategoryFilter = btn.getAttribute('data-news-cat') || 'ALL';
      document.querySelectorAll('.bento-news-tab').forEach((b) => {
        const active = b.getAttribute('data-news-cat') === appState.newsCategoryFilter;
        b.classList.toggle('border-emerald-500/40', active);
        b.classList.toggle('bg-emerald-500/15', active);
        b.classList.toggle('text-emerald-300', active);
      });
      renderBentoNewsWire();
    });
  });

  // Filtro de posición (ALL / QB / RB / WR / TE)
  document.querySelectorAll('.pos-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.positionFilter = btn.getAttribute('data-pos') || 'ALL';
      document.querySelectorAll('.pos-filter-btn').forEach((b) => {
        const active = b.getAttribute('data-pos') === appState.positionFilter;
        b.className = active
          ? 'pos-filter-btn rounded-md bg-emerald-500 px-2.5 py-1 font-mono-num text-xs font-bold text-slate-950 transition'
          : 'pos-filter-btn rounded-md px-2.5 py-1 font-mono-num text-xs font-semibold text-slate-300 hover:text-white transition';
      });
      renderBentoCenterTable();
      renderFullRankingsTable();
    });
  });

  // Filtro de estado de partidos (Todos / En Vivo / Bisagra / Finalizados)
  document.querySelectorAll('.game-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.gameStatusFilter = btn.getAttribute('data-game-filter') || 'ALL';
      document.querySelectorAll('.game-filter-btn').forEach((b) => {
        const active = b.getAttribute('data-game-filter') === appState.gameStatusFilter;
        b.className = active
          ? 'game-filter-btn rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300 transition'
          : 'game-filter-btn rounded border border-slate-800 bg-[#131B2E] px-2 py-0.5 font-mono-num text-[10px] font-semibold text-slate-300 hover:text-white transition';
      });
      renderLiveScorestripAndGames();
    });
  });

  // Selectores desplegables
  document.getElementById('ranking-week-select')?.addEventListener('change', (e) => {
    appState.rankingWeekFilter = e.target.value;
    renderHeaderTelemetry();
    renderExecutiveKpiStrip();
    renderBentoCenterTable();
    renderFullRankingsTable();
    renderSpotlightAndRadarCard();
    renderH2HAndClutchLab();
  });

  document.getElementById('ranking-team-select')?.addEventListener('change', (e) => {
    appState.teamFilter = e.target.value;
    if (e.target.value !== 'ALL') {
      appState.savantTeamAbbr = e.target.value;
      renderSavantFieldHeatmaps();
    }
    renderBentoCenterTable();
    renderFullRankingsTable();
    renderBentoNewsWire();
  });

  document.getElementById('scoreboard-week-select')?.addEventListener('change', (e) => {
    appState.scoreboardWeekFilter = e.target.value;
    renderLiveScorestripAndGames();
  });

  document.getElementById('bento-spotlight-player-select')?.addEventListener('change', (e) => {
    appState.spotlightPlayerId = e.target.value;
    renderSpotlightAndRadarCard();
    renderBentoCenterTable();
  });

  ['bento-savant-team-select', 'lab-savant-team-select'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      appState.savantTeamAbbr = e.target.value;
      ['bento-savant-team-select', 'lab-savant-team-select'].forEach((otherId) => {
        const el = document.getElementById(otherId);
        if (el) el.value = appState.savantTeamAbbr;
      });
      renderSavantFieldHeatmaps();
    });
  });

  document.getElementById('h2h-player-a')?.addEventListener('change', (e) => {
    appState.h2hPlayerA = e.target.value;
    renderH2HAndClutchLab();
  });

  document.getElementById('h2h-player-b')?.addEventListener('change', (e) => {
    appState.h2hPlayerB = e.target.value;
    renderH2HAndClutchLab();
  });

  // Buscadores sincronizados (Command Bar / y buscador de tabla)
  ['global-command-search', 'player-search-input'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value || '';
      ['global-command-search', 'player-search-input'].forEach((otherId) => {
        const el = document.getElementById(otherId);
        if (el && el !== e.target) el.value = appState.searchQuery;
      });
      renderBentoCenterTable();
      renderFullRankingsTable();
      renderBentoNewsWire();
      renderLiveScorestripAndGames();
    });
  });

  // Atajo de teclado "/" o Cmd+K para el buscador universal
  window.addEventListener('keydown', (e) => {
    if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('global-command-search')?.focus();
    }
  });

  // Botón de sincronización manual
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    loadAllDashboardData();
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadAllDashboardData().then(() => {
      if (window.location.hash && window.location.hash.startsWith('#metodo-')) {
        navigateToMethodologyAnchor(window.location.hash);
      }
    });
  });
}
