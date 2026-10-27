/* ==========================================================================
   NFL Analytics & X Tips Studio — Frontend Engine (Estilo 4: Sharp Matchup)
   ========================================================================== */

const STATE = {
  data: null,
  selectedWeek: 7,
  selectedSlot: "ALL",
  selectedGameId: null,
  customMatchup: null, // { away_team, home_team }
  activeView: "matchups",
  tipGroupFilter: "ALL",
  selectedPos: "ALL",
  teamSortCol: "rank_total",
  teamSortAsc: true,
  selectedTipIds: new Set(),
  cardState: {}, // { [tipId]: { linkType: 'source' | 'page', pubMode: 'now' | 'offset' | 'datetime', offsetVal: 30, offsetUnit: 'minutes', dtVal: '', title: '', body: '', illustration: '' } }
  usedIllustrations: new Set(),
  dashboardPublicUrl: "https://genesisfinal.github.io/nfl-analytics-engine/",
  autoRefreshTimer: null,
};

const CLAY_GALLERY = [
  { label: "TNF Aéreo: Drake Maye #10 (NE) vs Jaylon Johnson #33 (CHI)", path: "assets/clay/clay_ne_chi.jpg" },
  { label: "TNF Trincheras: Montez Sweat #98 (CHI) vs Ben Brown #77 (NE)", path: "assets/clay/clay_ne_chi_trenches.jpg" },
  { label: "DOM Aéreo: Christian McCaffrey #23 (SF) vs Kaden Elliss #55 (ATL)", path: "assets/clay/clay_sf_atl.jpg" },
  { label: "DOM Terrestre: Bijan Robinson #7 (ATL) vs Fred Warner #54 (SF)", path: "assets/clay/clay_atl_sf_ground.jpg" },
  { label: "DOM Pass Rush: Jonathan Greenard #58 (MIN) vs Quenton Nelson #56 (IND)", path: "assets/clay/clay_ind_min.jpg" },
  { label: "DOM Zona Roja: Chris Olave #12 (NO) vs T.J. Watt #90 (PIT)", path: "assets/clay/clay_pit_no.jpg" },
  { label: "DOM Equipos Especiales: Daniel Carlson #17 (LV) vs Kobie Turner #44 (LA)", path: "assets/clay/clay_la_lv.jpg" },
  { label: "MNF Trincheras: Zack Martin #70 (DAL) vs Jalen Carter #98 (PHI)", path: "assets/clay/clay_dal_phi.jpg" },
  { label: "MNF 3ra y Gol: CeeDee Lamb #88 (DAL) vs Quinyon Mitchell #27 (PHI)", path: "assets/clay/clay_dal_phi_mnf2.jpg" },
  { label: "QB Analytics: Jared Goff #16 (Detroit Lions)", path: "assets/clay/clay_det_goff.jpg" },
  { label: "WR Analytics: Jaxon Smith-Njigba #11 (Seattle Seahawks)", path: "assets/clay/clay_sea_jsn.jpg" },
  { label: "News Parte Médico: Saquon Barkley #26 (Philadelphia Eagles)", path: "assets/clay/clay_news_barkley_phi26.jpg" },
  { label: "News Explosión MNF: Javonte Williams #33 (DAL) vs Eagles #53", path: "assets/clay/clay_news_javonte_dal33.jpg" },
  { label: "News Cirugía Tobillo: Taylor Moton #72 (Carolina Panthers)", path: "assets/clay/clay_news_moton_car72.jpg" },
  { label: "News Trade Radar: Garrett Wilson #5 (NYJ · KC / SF)", path: "assets/clay/clay_news_gwilson_nyj5.jpg" },
];

const TEAM_VISUAL_SPECS_JS = {
  ARI: { name: "Arizona Cardinals", helmet: "white helmet with red Cardinal logo", jersey: "cardinal red jersey with white numerals", qb: ["Kyler Murray", "#1"], rb: ["James Conner", "#6"], wr: ["Marvin Harrison Jr.", "#18"], ol: ["Paris Johnson Jr.", "#70"], pr: ["Zaven Collins", "#25"], db: ["Budda Baker", "#3"] },
  ATL: { name: "Atlanta Falcons", helmet: "matte black helmet with red Falcon logo", jersey: "black jersey with red trim and white numerals", qb: ["Kirk Cousins", "#18"], rb: ["Bijan Robinson", "#7"], wr: ["Drake London", "#5"], ol: ["Chris Lindstrom", "#63"], pr: ["Kaden Elliss", "#55"], db: ["Jessie Bates III", "#3"] },
  BAL: { name: "Baltimore Ravens", helmet: "metallic black helmet with purple Raven logo", jersey: "purple jersey with gold-trimmed white numerals", qb: ["Lamar Jackson", "#8"], rb: ["Derrick Henry", "#22"], wr: ["Zay Flowers", "#4"], ol: ["Tyler Linderbaum", "#64"], pr: ["Nnamdi Madubuike", "#92"], db: ["Kyle Hamilton", "#14"] },
  BUF: { name: "Buffalo Bills", helmet: "white helmet with charging blue/red Buffalo logo", jersey: "royal blue jersey with white numerals", qb: ["Josh Allen", "#17"], rb: ["James Cook", "#4"], wr: ["Khalil Shakir", "#10"], ol: ["Dion Dawkins", "#73"], pr: ["Greg Rousseau", "#50"], db: ["Taron Johnson", "#7"] },
  CAR: { name: "Carolina Panthers", helmet: "metallic silver helmet with black/blue Panther logo", jersey: "black jersey with electric blue trim and white numerals", qb: ["Bryce Young", "#9"], rb: ["Chuba Hubbard", "#30"], wr: ["Xavier Legette", "#17"], ol: ["Taylor Moton", "#72"], pr: ["Jadeveon Clowney", "#7"], db: ["Jaycee Horn", "#8"] },
  CHI: { name: "Chicago Bears", helmet: "dark navy helmet with orange wishbone C logo", jersey: "dark navy jersey with orange-outlined white numerals", qb: ["Caleb Williams", "#18"], rb: ["D'Andre Swift", "#4"], wr: ["DJ Moore", "#2"], ol: ["Darnell Wright", "#58"], pr: ["Montez Sweat", "#98"], db: ["Jaylon Johnson", "#33"] },
  CIN: { name: "Cincinnati Bengals", helmet: "orange helmet with black Bengal tiger stripes", jersey: "black jersey with orange tiger stripes and white numerals", qb: ["Joe Burrow", "#9"], rb: ["Chase Brown", "#30"], wr: ["Ja'Marr Chase", "#1"], ol: ["Orlando Brown Jr.", "#75"], pr: ["Trey Hendrickson", "#91"], db: ["Cam Taylor-Britt", "#29"] },
  CLE: { name: "Cleveland Browns", helmet: "orange helmet with brown/white center stripe", jersey: "dark brown jersey with orange numerals", qb: ["Jameis Winston", "#5"], rb: ["Nick Chubb", "#24"], wr: ["Jerry Jeudy", "#3"], ol: ["Joel Bitonio", "#75"], pr: ["Myles Garrett", "#95"], db: ["Denzel Ward", "#21"] },
  DAL: { name: "Dallas Cowboys", helmet: "metallic silver helmet with navy Lone Star logo", jersey: "white jersey with royal blue numerals", qb: ["Dak Prescott", "#4"], rb: ["Javonte Williams", "#33"], wr: ["CeeDee Lamb", "#88"], ol: ["Zack Martin", "#70"], pr: ["Micah Parsons", "#11"], db: ["Trevon Diggs", "#7"] },
  DEN: { name: "Denver Broncos", helmet: "navy helmet with orange Bronco horse logo", jersey: "sunset orange jersey with white numerals", qb: ["Bo Nix", "#10"], rb: ["Jaleel McLaughlin", "#38"], wr: ["Courtland Sutton", "#14"], ol: ["Quinn Meinerz", "#77"], pr: ["Nik Bonitto", "#15"], db: ["Pat Surtain II", "#2"] },
  DET: { name: "Detroit Lions", helmet: "Honolulu blue metallic helmet with silver Lion logo", jersey: "Honolulu blue jersey with silver numerals", qb: ["Jared Goff", "#16"], rb: ["Jahmyr Gibbs", "#26"], wr: ["Amon-Ra St. Brown", "#14"], ol: ["Penei Sewell", "#58"], pr: ["Aidan Hutchinson", "#97"], db: ["Brian Branch", "#32"] },
  GB: { name: "Green Bay Packers", helmet: "golden yellow helmet with dark green G logo", jersey: "dark forest green jersey with white numerals", qb: ["Jordan Love", "#10"], rb: ["Josh Jacobs", "#8"], wr: ["Jayden Reed", "#11"], ol: ["Elgton Jenkins", "#74"], pr: ["Rashan Gary", "#52"], db: ["Xavier McKinney", "#29"] },
  HOU: { name: "Houston Texans", helmet: "deep steel navy helmet with red/white Bull logo", jersey: "deep steel navy jersey with red trim and white numerals", qb: ["C.J. Stroud", "#7"], rb: ["Joe Mixon", "#28"], wr: ["Nico Collins", "#12"], ol: ["Laremy Tunsil", "#78"], pr: ["Will Anderson Jr.", "#51"], db: ["Derek Stingley Jr.", "#24"] },
  IND: { name: "Indianapolis Colts", helmet: "white helmet with royal blue Horseshoe logo", jersey: "royal blue jersey with white numerals", qb: ["Anthony Richardson", "#5"], rb: ["Jonathan Taylor", "#28"], wr: ["Michael Pittman Jr.", "#11"], ol: ["Quenton Nelson", "#56"], pr: ["DeForest Buckner", "#99"], db: ["Kenny Moore II", "#23"] },
  JAX: { name: "Jacksonville Jaguars", helmet: "glossy black helmet with gold/teal Jaguar logo", jersey: "teal jersey with white numerals", qb: ["Trevor Lawrence", "#16"], rb: ["Travis Etienne Jr.", "#1"], wr: ["Brian Thomas Jr.", "#7"], ol: ["Brandon Scherff", "#68"], pr: ["Josh Hines-Allen", "#41"], db: ["Tyson Campbell", "#3"] },
  KC: { name: "Kansas City Chiefs", helmet: "bright red helmet with white KC arrowhead logo", jersey: "bright red jersey with white numerals", qb: ["Patrick Mahomes", "#15"], rb: ["Kareem Hunt", "#29"], wr: ["Travis Kelce", "#87"], ol: ["Creed Humphrey", "#52"], pr: ["Chris Jones", "#95"], db: ["Trent McDuffie", "#22"] },
  LA: { name: "Los Angeles Rams", helmet: "metallic royal blue helmet with yellow Ram horns", jersey: "royal blue jersey with yellow numerals", qb: ["Matthew Stafford", "#9"], rb: ["Kyren Williams", "#23"], wr: ["Puka Nacua", "#17"], ol: ["Kevin Dotson", "#69"], pr: ["Jared Verse", "#8"], db: ["Kobie Turner", "#44"] },
  LAC: { name: "Los Angeles Chargers", helmet: "white helmet with gold lightning bolt", jersey: "powder blue jersey with white numerals", qb: ["Justin Herbert", "#10"], rb: ["J.K. Dobbins", "#27"], wr: ["Ladd McConkey", "#15"], ol: ["Rashawn Slater", "#70"], pr: ["Khalil Mack", "#52"], db: ["Derwin James Jr.", "#3"] },
  LV: { name: "Las Vegas Raiders", helmet: "metallic silver helmet with Raiders shield logo", jersey: "black jersey with silver numerals", qb: ["Gardner Minshew", "#15"], rb: ["Alexander Mattison", "#22"], wr: ["Brock Bowers", "#89"], ol: ["Kolton Miller", "#74"], pr: ["Maxx Crosby", "#98"], db: ["Daniel Carlson", "#17"] },
  MIA: { name: "Miami Dolphins", helmet: "white helmet with aqua/orange Dolphin logo", jersey: "aqua jersey with white numerals", qb: ["Tua Tagovailoa", "#1"], rb: ["De'Von Achane", "#28"], wr: ["Tyreek Hill", "#10"], ol: ["Terron Armstead", "#72"], pr: ["Calais Campbell", "#93"], db: ["Jalen Ramsey", "#5"] },
  MIN: { name: "Minnesota Vikings", helmet: "matte purple helmet with white Viking horns", jersey: "purple jersey with white numerals", qb: ["Sam Darnold", "#14"], rb: ["Aaron Jones", "#33"], wr: ["Justin Jefferson", "#18"], ol: ["Christian Darrisaw", "#71"], pr: ["Jonathan Greenard", "#58"], db: ["Byron Murphy Jr.", "#7"] },
  NE: { name: "New England Patriots", helmet: "metallic silver helmet with Flying Elvis logo", jersey: "nautical navy jersey with red/white stripes and white numerals", qb: ["Drake Maye", "#10"], rb: ["Rhamondre Stevenson", "#38"], wr: ["DeMario Douglas", "#3"], ol: ["Ben Brown", "#77"], pr: ["Keion White", "#99"], db: ["Christian Gonzalez", "#0"] },
  NO: { name: "New Orleans Saints", helmet: "metallic old gold helmet with black Fleur-de-Lis", jersey: "black jersey with old gold numerals", qb: ["Derek Carr", "#4"], rb: ["Alvin Kamara", "#41"], wr: ["Chris Olave", "#12"], ol: ["Erik McCoy", "#78"], pr: ["Cameron Jordan", "#94"], db: ["Tyrann Mathieu", "#32"] },
  NYG: { name: "New York Giants", helmet: "metallic dark blue helmet with white NY logo", jersey: "royal blue jersey with white numerals", qb: ["Daniel Jones", "#8"], rb: ["Tyrone Tracy Jr.", "#29"], wr: ["Malik Nabers", "#1"], ol: ["Andrew Thomas", "#78"], pr: ["Dexter Lawrence", "#97"], db: ["Deonte Banks", "#3"] },
  NYJ: { name: "New York Jets", helmet: "metallic Gotham green helmet with white JETS logo", jersey: "Gotham green jersey with white numerals", qb: ["Aaron Rodgers", "#8"], rb: ["Breece Hall", "#20"], wr: ["Garrett Wilson", "#5"], ol: ["Alijah Vera-Tucker", "#75"], pr: ["Quinnen Williams", "#95"], db: ["Sauce Gardner", "#1"] },
  PHI: { name: "Philadelphia Eagles", helmet: "metallic midnight green helmet with silver Eagles wings", jersey: "midnight green jersey with white numerals", qb: ["Jalen Hurts", "#1"], rb: ["Saquon Barkley", "#26"], wr: ["A.J. Brown", "#11"], ol: ["Lane Johnson", "#65"], pr: ["Jalen Carter", "#98"], db: ["Quinyon Mitchell", "#27"] },
  PIT: { name: "Pittsburgh Steelers", helmet: "glossy black helmet with Steelmark logo", jersey: "black jersey with gold/black stripes and white numerals", qb: ["Russell Wilson", "#3"], rb: ["Najee Harris", "#22"], wr: ["George Pickens", "#14"], ol: ["Isaac Seumalo", "#73"], pr: ["T.J. Watt", "#90"], db: ["Minkah Fitzpatrick", "#39"] },
  SEA: { name: "Seattle Seahawks", helmet: "college navy helmet with action green Seahawk logo", jersey: "college navy jersey with action green trim and white numerals", qb: ["Geno Smith", "#7"], rb: ["Kenneth Walker III", "#9"], wr: ["Jaxon Smith-Njigba", "#11"], ol: ["Charles Cross", "#67"], pr: ["Leonard Williams", "#99"], db: ["Devon Witherspoon", "#21"] },
  SF: { name: "San Francisco 49ers", helmet: "metallic gold helmet with red/white SF oval logo", jersey: "scarlet red jersey with white numerals", qb: ["Brock Purdy", "#13"], rb: ["Christian McCaffrey", "#23"], wr: ["Deebo Samuel", "#1"], ol: ["Trent Williams", "#71"], pr: ["Nick Bosa", "#97"], db: ["Fred Warner", "#54"] },
  TB: { name: "Tampa Bay Buccaneers", helmet: "pewter helmet with red pirate flag logo", jersey: "red jersey with white numerals", qb: ["Baker Mayfield", "#6"], rb: ["Bucky Irving", "#7"], wr: ["Mike Evans", "#13"], ol: ["Tristan Wirfs", "#78"], pr: ["Vita Vea", "#50"], db: ["Antoine Winfield Jr.", "#31"] },
  TEN: { name: "Tennessee Titans", helmet: "navy helmet with flaming Titan sword logo", jersey: "navy jersey with Titan blue shoulders and white numerals", qb: ["Will Levis", "#8"], rb: ["Tony Pollard", "#20"], wr: ["Calvin Ridley", "#0"], ol: ["Peter Skoronski", "#77"], pr: ["Jeffery Simmons", "#98"], db: ["Amani Hooker", "#37"] },
  WAS: { name: "Washington Commanders", helmet: "matte burgundy helmet with gold W logo", jersey: "burgundy jersey with gold numerals", qb: ["Jayden Daniels", "#5"], rb: ["Brian Robinson Jr.", "#8"], wr: ["Terry McLaurin", "#17"], ol: ["Sam Cosmi", "#76"], pr: ["Daron Payne", "#94"], db: ["Bobby Wagner", "#54"] },
};

function getNextUniqueClaySeed() {
  let prevSeeds = [];
  try {
    prevSeeds = JSON.parse(localStorage.getItem("nfl_used_clay_seeds") || "[]");
  } catch (_) {}
  let seed = Math.floor(100000 + Math.random() * 899999);
  while (prevSeeds.includes(seed)) {
    seed = Math.floor(100000 + Math.random() * 899999);
  }
  prevSeeds.push(seed);
  try {
    localStorage.setItem("nfl_used_clay_seeds", JSON.stringify(prevSeeds.slice(-500)));
  } catch (_) {}
  return seed;
}

function buildUniqueDynamicClayUrl(promptText) {
  const seed = getNextUniqueClaySeed();
  const cleanPrompt = `${promptText} [Unique render seed #${seed}]`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1600&height=900&nologo=true&model=flux&seed=${seed}`;
  STATE.usedIllustrations.add(url);
  return url;
}

async function generateAndAssignUniqueTipImage(tip) {
  // Si el servidor local server_nfl.py está corriendo, persiste la imagen única en assets/clay/ y data/used_images_registry.json
  try {
    const resp = await fetch("/api/generate-tip-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tip }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.illustration) {
        tip.illustration = data.illustration;
        tip.clay_prompt = data.clay_prompt || tip.clay_prompt;
        if (STATE.cardState[tip.id]) {
          STATE.cardState[tip.id].illustration = data.illustration;
        }
        STATE.usedIllustrations.add(data.illustration);
        renderXTipsFeed();
        return;
      }
    }
  } catch (_) {}
}

function showToast(msg, duration = 3800) {
  const el = document.getElementById("toastNotification");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), duration);
}

function formatNowART() {
  try {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${fmt.format(new Date())} ART`;
  } catch (_) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " ART";
  }
}

function updateTimestampUI(stampText, hasLiveGames = false) {
  const sideEl = document.getElementById("updatedStamp");
  const topEl = document.getElementById("topUpdatedStamp");
  const badgeEl = document.getElementById("topAutoBadge");
  if (sideEl) sideEl.textContent = `🕒 Última act.: ${stampText}`;
  if (topEl) topEl.textContent = `🕒 Última actualización: ${stampText}`;
  if (badgeEl) {
    if (hasLiveGames) {
      badgeEl.textContent = "🟢 PARTIDO EN VIVO · Auto-update cada 30 min";
      badgeEl.classList.add("live-active");
    } else {
      badgeEl.textContent = "⏱️ Auto-update: Noticias cada 1h · Vivo cada 30m";
      badgeEl.classList.remove("live-active");
    }
  }
}

function populateWeekSelector(data) {
  const weekSel = document.getElementById("selectWeek");
  if (!weekSel || !data) return;
  const avail = data.available_weeks && data.available_weeks.length ? data.available_weeks : [6, 7, 8];
  const curr = Number(data.current_week || 7);

  weekSel.innerHTML = avail
    .map((wk) => {
      let suffix = "";
      if (wk === curr) suffix = " (Semana Activa · MNF)";
      else if (wk < curr) suffix = " (Anterior)";
      else suffix = " (Próxima)";
      return `<option value="${wk}" ${wk === STATE.selectedWeek ? "selected" : ""}>Semana ${wk}${suffix}</option>`;
    })
    .join("");
}

function getDefaultFutureDatetimeART(addMinutes = 60) {
  const now = new Date(Date.now() + addMinutes * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function initTipCardState(tip) {
  if (!STATE.cardState[tip.id]) {
    STATE.cardState[tip.id] = {
      linkType: "source", // 'source' o 'page' (Selector Dual pedido en punto 1)
      pubMode: "now",     // 'now' | 'offset' | 'datetime' (Pedido en punto 2)
      offsetVal: 30,
      offsetUnit: "minutes",
      dtVal: getDefaultFutureDatetimeART(60),
      title: tip.title || "",
      body: tip.body || "",
      illustration: tip.illustration || "assets/clay/clay_dal_phi.jpg",
    };
  }
  return STATE.cardState[tip.id];
}

function buildFinalPostText(tip) {
  const st = initTipCardState(tip);
  const chosenLink = st.linkType === "page" ? tip.page_link : tip.source_link;
  return `${st.body.trim()}\n👉 ${chosenLink}`;
}

function estimateXCharLength(tip) {
  const st = initTipCardState(tip);
  // En X/Twitter todo link ocupa 23 caracteres (t.co) + "\n👉 " (4 chars) = 27 chars
  return st.body.trim().length + 27;
}

/* ==========================================================================
   CARGA INICIAL DE DATOS & SINCRONIZACIÓN EN VIVO
   ========================================================================== */
async function loadDashboardData(preserveWeek = false) {
  try {
    const resp = await fetch(`data/nfl_dashboard_data.json?t=${Date.now()}`);
    const data = await resp.json();
    STATE.data = data;
    if (!preserveWeek) {
      STATE.selectedWeek = Number(data.current_week || 7);
    }

    populateWeekSelector(data);
    updateTimestampUI(data.updated_at || formatNowART(), Boolean(data.has_live_games));
    document.getElementById("newsCountBadge").textContent = String((data.news || []).length);

    (data.tips_x || []).forEach((t) => {
      initTipCardState(t);
      STATE.cardState[t.id].illustration = t.illustration;
    });

    // Seleccionar partido de la semana actual (priorizando MNF si es lunes/martes madrugada o partido en vivo)
    const wkGames = (data.games || []).filter((g) => g.week === STATE.selectedWeek);
    if (wkGames.length > 0 && !STATE.selectedGameId) {
      const liveOrMnf = wkGames.find((g) => g.status_state === "in") || wkGames.find((g) => g.day_slot === "MNF") || wkGames[0];
      STATE.selectedGameId = liveOrMnf.id;
    }

    populateSimulatorSelects();
    renderAll();
    loadServerConfig();
    scheduleAutoRefresh(Boolean(data.has_live_games));
  } catch (err) {
    console.error("Error cargando nfl_dashboard_data.json:", err);
    showToast("⚠️ Error al cargar data/nfl_dashboard_data.json");
  }
}

function renderAll() {
  if (!STATE.data) return;
  renderGameRibbon();
  renderMatchupBoard();
  renderTeamsTable();
  renderPlayersGrid();
  renderNewsGrid();
  renderSourcesDirectory();
  renderXTipsFeed();
}

/* ==========================================================================
   CINTA SUPERIOR DE PARTIDOS (GAME RIBBON)
   ========================================================================== */
function renderGameRibbon() {
  const track = document.getElementById("gameRibbonTrack");
  if (!track || !STATE.data) return;

  const games = (STATE.data.games || []).filter((g) => {
    const matchWeek = g.week === Number(STATE.selectedWeek);
    const matchSlot = STATE.selectedSlot === "ALL" || g.day_slot === STATE.selectedSlot;
    return matchWeek && matchSlot;
  });

  if (games.length > 0 && !games.some((g) => g.id === STATE.selectedGameId) && !STATE.customMatchup) {
    const mnfOrFirst = games.find((g) => g.status_state === "in") || games.find((g) => g.day_slot === "MNF") || games[0];
    STATE.selectedGameId = mnfOrFirst.id;
  }

  track.innerHTML = games
    .map((g) => {
      const aw = STATE.data.teams[g.away_team] || { abbr: g.away_team, logo: "" };
      const hm = STATE.data.teams[g.home_team] || { abbr: g.home_team, logo: "" };
      const isSel = !STATE.customMatchup && g.id === STATE.selectedGameId;
      const slotLabel = g.day_slot === "TNF" ? "JUE" : g.day_slot === "MNF" ? "LUN" : "DOM";
      const hasScore = g.status_state === "in" || g.status_state === "post";
      const scoreOrVs = hasScore
        ? `<strong style="font-size:11px; color:${g.status_state === "in" ? "#dc2626" : "#0f172a"}">${g.away_score ?? 0}-${g.home_score ?? 0}</strong>`
        : `<span class="rg-vs">vs</span>`;
      const statusText =
        g.status_state === "in"
          ? `🔴 VIVO · ${g.status_detail || "En juego"}`
          : g.status_state === "post"
          ? `FINAL`
          : g.display_time.replace(" ART", "");

      return `
        <div class="ribbon-game-card ${isSel ? "selected" : ""}" data-gameid="${g.id}">
          <div class="rg-teams-row">
            <div class="rg-team">
              <img src="${aw.logo}" alt="${aw.abbr}" loading="lazy" />
              <span>${aw.abbr}</span>
            </div>
            ${scoreOrVs}
            <div class="rg-team">
              <img src="${hm.logo}" alt="${hm.abbr}" loading="lazy" />
              <span>${hm.abbr}</span>
            </div>
          </div>
          <div class="rg-meta-row">
            <span class="rg-slot-tag rg-slot-${g.day_slot}">${slotLabel}</span>
            <span>${statusText}</span>
          </div>
        </div>
      `;
    })
    .join("");

  track.querySelectorAll(".ribbon-game-card").forEach((card) => {
    card.addEventListener("click", () => {
      STATE.customMatchup = null;
      STATE.selectedGameId = card.dataset.gameid;
      switchView("matchups");
      renderGameRibbon();
      renderMatchupBoard();
    });
  });
}

/* ==========================================================================
   HELPERS DE BARRAS TÁCTICAS Y COLORES DE VENTAJA (ESTILO 4)
   ========================================================================== */
function getAdvantageClasses(valA, valB, higherIsBetter = true, scaleRef = 1.0) {
  const diff = higherIsBetter ? valA - valB : valB - valA;
  const norm = diff / (scaleRef || 1);
  if (norm >= 0.35) return { bg: "bg-sig-pos", txt: "txt-sig-pos" };
  if (norm >= 0.12) return { bg: "bg-mod-pos", txt: "txt-mod-pos" };
  if (norm > -0.12) return { bg: "bg-neutral", txt: "txt-neutral" };
  if (norm > -0.35) return { bg: "bg-mod-neg", txt: "txt-mod-neg" };
  return { bg: "bg-sig-neg", txt: "txt-sig-neg" };
}

function buildTacticalCompRow({ leftTag, leftVal, leftFmt, metricLabel, rightVal, rightFmt, rightTag, minVal, maxVal, higherIsBetter = true }) {
  const pctLeft = Math.max(12, Math.min(98, ((leftVal - minVal) / (maxVal - minVal || 1)) * 100));
  const pctRight = Math.max(12, Math.min(98, ((rightVal - minVal) / (maxVal - minVal || 1)) * 100));

  const scale = (maxVal - minVal) * 0.35 || 1;
  const clsL = getAdvantageClasses(leftVal, rightVal, higherIsBetter, scale);
  const clsR = getAdvantageClasses(rightVal, leftVal, higherIsBetter, scale);

  return `
    <div class="tactical-comp-row">
      <div class="tc-source-tag" title="${leftTag}">${leftTag}</div>
      <div class="tc-bar-track left-track">
        <div class="tc-bar-fill ${clsL.bg}" style="width: ${higherIsBetter ? pctLeft : 110 - pctLeft}%"></div>
      </div>
      <div class="tc-val left-val ${clsL.txt}">
        <span>→</span> <span>${leftFmt}</span>
      </div>
      <div class="tc-metric-label">${metricLabel}</div>
      <div class="tc-val right-val ${clsR.txt}">
        <span>${rightFmt}</span> <span>←</span>
      </div>
      <div class="tc-bar-track right-track">
        <div class="tc-bar-fill ${clsR.bg}" style="width: ${higherIsBetter ? pctRight : 110 - pctRight}%"></div>
      </div>
      <div class="tc-source-tag right" title="${rightTag}">${rightTag}</div>
    </div>
  `;
}

/* ==========================================================================
   VISTA 1: PIZARRA TÁCTICA CARA A CARA (MATCHUP BOARD - ESTILO 4)
   ========================================================================== */
function getActiveMatchupTeams() {
  if (!STATE.data) return null;
  if (STATE.customMatchup) {
    const aw = STATE.data.teams[STATE.customMatchup.away_team];
    const hm = STATE.data.teams[STATE.customMatchup.home_team];
    return {
      away: aw,
      home: hm,
      game: {
        id: `SIM-${aw.abbr}-${hm.abbr}`,
        week: STATE.selectedWeek,
        day_slot: "SIMULADOR",
        display_time: "Duelo Personalizado",
        away_record: aw.record,
        home_record: hm.record,
        spread: "Simulación Cara a Cara",
        over_under: (aw.off_ppg + hm.off_ppg).toFixed(1),
      },
    };
  }
  const g = (STATE.data.games || []).find((x) => x.id === STATE.selectedGameId) || (STATE.data.games || [])[0];
  if (!g) return null;
  return {
    away: STATE.data.teams[g.away_team],
    home: STATE.data.teams[g.home_team],
    game: g,
  };
}

function renderMatchupBoard() {
  const m = getActiveMatchupTeams();
  if (!m || !m.away || !m.home) return;
  const { away: aw, home: hm, game: g } = m;

  const hasScore = g.status_state === "in" || g.status_state === "post";
  const centerCircleHtml = hasScore
    ? `<div class="mb-vs-circle" style="width:auto; padding:0 12px; border-radius:16px; background:${g.status_state === "in" ? "#dc2626" : "#013369"}; color:#fff; font-size:14px;">${aw.abbr} ${g.away_score ?? 0} - ${g.home_score ?? 0} ${hm.abbr}</div>`
    : `<div class="mb-vs-circle">VS</div>`;
  const statusLineText =
    g.status_state === "in"
      ? `🔴 EN VIVO (${g.status_detail || "En juego"}) · Línea: ${g.spread} · O/U ${g.over_under}`
      : g.status_state === "post"
      ? `FINAL (${g.display_time}) · Línea: ${g.spread} · O/U ${g.over_under}`
      : `${g.display_time} · Línea: ${g.spread} · O/U ${g.over_under}`;

  // 1. Cabecera del Duelo
  const banner = document.getElementById("matchupBannerHeader");
  banner.innerHTML = `
    <div class="mb-team-side">
      <img src="${aw.logo}" alt="${aw.name}" class="mb-team-logo" />
      <div class="mb-team-info">
        <h2>${aw.name.toUpperCase()}</h2>
        <div class="mb-team-sub">AWAY · Récord (${g.away_record || aw.record}) · ${aw.div}</div>
        <div class="mb-pills-row">
          <span class="stat-mini-pill">Rank Total #${aw.rank_total}</span>
          <span class="stat-mini-pill">${aw.off_ppg} PPG</span>
          <span class="stat-mini-pill">EPA/jug ${aw.off_epa_play >= 0 ? "+" : ""}${aw.off_epa_play}</span>
        </div>
      </div>
    </div>

    <div class="mb-center-vs">
      <div class="mb-week-label">SEMANA ${g.week}: ${aw.short.toUpperCase()} vs ${hm.short.toUpperCase()}</div>
      ${centerCircleHtml}
      <div class="mb-odds-line">${statusLineText}</div>
    </div>

    <div class="mb-team-side right">
      <img src="${hm.logo}" alt="${hm.name}" class="mb-team-logo" />
      <div class="mb-team-info">
        <h2>${hm.name.toUpperCase()}</h2>
        <div class="mb-team-sub">HOME · Récord (${g.home_record || hm.record}) · ${hm.div}</div>
        <div class="mb-pills-row">
          <span class="stat-mini-pill">Rank Total #${hm.rank_total}</span>
          <span class="stat-mini-pill">${hm.off_ppg} PPG</span>
          <span class="stat-mini-pill">EPA/jug ${hm.off_epa_play >= 0 ? "+" : ""}${hm.off_epa_play}</span>
        </div>
      </div>
    </div>
  `;

  // 2. Bloque 1: Ataque Aéreo vs Secundaria
  document.getElementById("airLeftTitle").textContent = `${aw.abbr} PASSING OFFENSE (#${aw.rank_off} NFL)`;
  document.getElementById("airRightTitle").textContent = `${hm.abbr} PASS DEFENSE (#${hm.rank_def} DVOA/EPA)`;

  const airHtml = [
    buildTacticalCompRow({
      leftTag: `${aw.abbr} Ataque Pase`,
      leftVal: aw.off_pass_epa_play,
      leftFmt: `${aw.off_pass_epa_play >= 0 ? "+" : ""}${aw.off_pass_epa_play.toFixed(2)}`,
      metricLabel: "EPA / Dropback",
      rightVal: hm.def_pass_epa_allowed,
      rightFmt: `${hm.def_pass_epa_allowed >= 0 ? "+" : ""}${hm.def_pass_epa_allowed.toFixed(2)}`,
      rightTag: `${hm.abbr} Def Pase (Cede)`,
      minVal: -0.25,
      maxVal: 0.35,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `RBSDM / NGS CPOE`,
      leftVal: aw.off_cpoe,
      leftFmt: `${aw.off_cpoe >= 0 ? "+" : ""}${aw.off_cpoe.toFixed(1)}%`,
      metricLabel: "CPOE (Precisión)",
      rightVal: hm.off_cpoe,
      rightFmt: `${hm.off_cpoe >= 0 ? "+" : ""}${hm.off_cpoe.toFixed(1)}%`,
      rightTag: `${hm.abbr} Ataque CPOE`,
      minVal: -6.0,
      maxVal: 8.0,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `Sharp Explosivos`,
      leftVal: aw.off_explosive_pass_pct,
      leftFmt: `${aw.off_explosive_pass_pct.toFixed(1)}%`,
      metricLabel: "Pases +20 Yds %",
      rightVal: hm.off_explosive_pass_pct,
      rightFmt: `${hm.off_explosive_pass_pct.toFixed(1)}%`,
      rightTag: `PFF / Savant`,
      minVal: 5.0,
      maxVal: 16.0,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `PFR Aéreo/Partido`,
      leftVal: aw.off_pass_ypg,
      leftFmt: `${aw.off_pass_ypg.toFixed(0)} yds`,
      metricLabel: "Yds Aéreas / Jgo",
      rightVal: hm.off_pass_ypg,
      rightFmt: `${hm.off_pass_ypg.toFixed(0)} yds`,
      rightTag: `PFR Aéreo/Partido`,
      minVal: 150,
      maxVal: 310,
      higherIsBetter: true,
    }),
  ].join("");
  document.getElementById("airVsSecBars").innerHTML = airHtml;

  // 3. Bloque 2: Juego Terrestre vs Front-7
  document.getElementById("groundLeftTitle").textContent = `${aw.abbr} RUSHING OFFENSE`;
  document.getElementById("groundRightTitle").textContent = `${hm.abbr} RUN DEFENSE & FRONT-7`;

  const groundHtml = [
    buildTacticalCompRow({
      leftTag: `${aw.abbr} Rush EPA`,
      leftVal: aw.off_rush_epa_play,
      leftFmt: `${aw.off_rush_epa_play >= 0 ? "+" : ""}${aw.off_rush_epa_play.toFixed(2)}`,
      metricLabel: "EPA / Acarreo",
      rightVal: hm.off_rush_epa_play,
      rightFmt: `${hm.off_rush_epa_play >= 0 ? "+" : ""}${hm.off_rush_epa_play.toFixed(2)}`,
      rightTag: `${hm.abbr} Rush EPA`,
      minVal: -0.22,
      maxVal: 0.18,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `Yds Tierra/Jgo`,
      leftVal: aw.off_rush_ypg,
      leftFmt: `${aw.off_rush_ypg.toFixed(1)}`,
      metricLabel: "Rush Yds / Partido",
      rightVal: hm.off_rush_ypg,
      rightFmt: `${hm.off_rush_ypg.toFixed(1)}`,
      rightTag: `Yds Tierra/Jgo`,
      minVal: 75,
      maxVal: 175,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `Acarreos +10 Yds`,
      leftVal: aw.off_explosive_rush_pct,
      leftFmt: `${aw.off_explosive_rush_pct.toFixed(1)}%`,
      metricLabel: "Explosive Rush %",
      rightVal: hm.off_explosive_rush_pct,
      rightFmt: `${hm.off_explosive_rush_pct.toFixed(1)}%`,
      rightTag: `NGS / Sumer`,
      minVal: 6.0,
      maxVal: 18.0,
      higherIsBetter: true,
    }),
    buildTacticalCompRow({
      leftTag: `${aw.abbr} Def Cede Tierra`,
      leftVal: aw.def_rush_ypg_allowed,
      leftFmt: `${aw.def_rush_ypg_allowed.toFixed(1)}`,
      metricLabel: "Rush Yds Permitidas",
      rightVal: hm.def_rush_ypg_allowed,
      rightFmt: `${hm.def_rush_ypg_allowed.toFixed(1)}`,
      rightTag: `${hm.abbr} Def Cede Tierra`,
      minVal: 75,
      maxVal: 170,
      higherIsBetter: false,
    }),
  ].join("");
  document.getElementById("groundVsFrontBars").innerHTML = groundHtml;

  // 4. Bloque 3: Zona Roja, 3er Down y Trincheras
  document.getElementById("sitLeftTitle").textContent = `${aw.abbr} RED ZONE & 3RD DOWN`;
  document.getElementById("sitRightTitle").textContent = `${hm.abbr} RED ZONE & 3RD DOWN`;

  document.getElementById("situationalGrid").innerHTML = `
    <div class="sit-heatmap-box">
      <div class="sit-Readout-col">
        <div>${aw.off_rz_td_pct.toFixed(0)}%<small>RZ TD Ataq</small></div>
        <div>${aw.off_3d_pct.toFixed(0)}%<small>3er Down</small></div>
      </div>
      <div class="field-heatmap-visual">
        <div class="field-heatmap-gridlines"></div>
        <span class="field-heatmap-tag">${aw.abbr} ZONA ROJA</span>
      </div>
      <div class="sit-Readout-col right">
        <div>${aw.def_rz_td_pct.toFixed(0)}%<small>RZ Def Cede</small></div>
        <div>${aw.def_3d_pct.toFixed(0)}%<small>3D Def Cede</small></div>
      </div>
    </div>

    <div class="sit-center-metrics">
      <div class="sit-center-row">
        <span class="txt-sig-pos">${aw.def_sack_rate.toFixed(1)}% (${aw.def_sacks})</span>
        <span>PASS RUSH SACK %</span>
        <span class="txt-sig-pos">${hm.def_sack_rate.toFixed(1)}% (${hm.def_sacks})</span>
      </div>
      <div class="sit-center-row">
        <span>${aw.off_sack_rate_allowed.toFixed(1)}%</span>
        <span>SACKS PERMITIDOS OL</span>
        <span>${hm.off_sack_rate_allowed.toFixed(1)}%</span>
      </div>
      <div class="sit-center-row">
        <span>${aw.turnover_margin >= 0 ? "+" : ""}${aw.turnover_margin}</span>
        <span>MARGEN ENTREGAS</span>
        <span>${hm.turnover_margin >= 0 ? "+" : ""}${hm.turnover_margin}</span>
      </div>
    </div>

    <div class="sit-heatmap-box">
      <div class="sit-Readout-col">
        <div>${hm.off_rz_td_pct.toFixed(0)}%<small>RZ TD Ataq</small></div>
        <div>${hm.off_3d_pct.toFixed(0)}%<small>3er Down</small></div>
      </div>
      <div class="field-heatmap-visual">
        <div class="field-heatmap-gridlines"></div>
        <span class="field-heatmap-tag">${hm.abbr} ZONA ROJA</span>
      </div>
      <div class="sit-Readout-col right">
        <div>${hm.def_rz_td_pct.toFixed(0)}%<small>RZ Def Cede</small></div>
        <div>${hm.def_3d_pct.toFixed(0)}%<small>3D Def Cede</small></div>
      </div>
    </div>
  `;

  // 5. Bloque 4: Equipos Especiales (Kicking, Punting, Returns)
  const buildStGauge = (label, leftText, rightText, markerPct) => `
    <div class="st-gauge-row">
      <span>${leftText}</span>
      <div class="st-spectrum-bar">
        <span class="st-marker" style="left: ${Math.max(6, Math.min(94, markerPct))}%"></span>
      </div>
      <span class="st-rank-badge">${rightText}</span>
    </div>
  `;

  document.getElementById("specialTeamsGauges").innerHTML = `
    <div class="st-col-box">
      <h5>KICKING (FG % &amp; +50 YDS)</h5>
      ${buildStGauge(aw.abbr, aw.abbr, `${aw.fg_pct.toFixed(0)}%`, 100 - aw.pct_st)}
      ${buildStGauge(hm.abbr, hm.abbr, `${hm.fg_pct.toFixed(0)}%`, 100 - hm.pct_st)}
      ${buildStGauge("50+ Yds", "+50y", `${aw.fg_50_plus} vs ${hm.fg_50_plus}`, 38)}
    </div>
    <div class="st-col-box">
      <h5>PUNTING (NET AVG &amp; IN-20)</h5>
      ${buildStGauge(aw.abbr, aw.abbr, `${aw.punt_net_avg.toFixed(1)}y`, Math.max(10, 100 - (aw.punt_net_avg - 36) * 8))}
      ${buildStGauge(hm.abbr, hm.abbr, `${hm.punt_net_avg.toFixed(1)}y`, Math.max(10, 100 - (hm.punt_net_avg - 36) * 8))}
      ${buildStGauge("In20", "In20", `${aw.punt_in20_pct.toFixed(0)}%/${hm.punt_in20_pct.toFixed(0)}%`, 42)}
    </div>
    <div class="st-col-box">
      <h5>RETURNS &amp; RANK ST (DVOA)</h5>
      ${buildStGauge(aw.abbr, `${aw.abbr} RK`, `#${aw.rank_st}`, (aw.rank_st / 32) * 100)}
      ${buildStGauge(hm.abbr, `${hm.abbr} RK`, `#${hm.rank_st}`, (hm.rank_st / 32) * 100)}
      ${buildStGauge("PR Avg", "PR Yd", `${aw.pr_avg.toFixed(1)}/${hm.pr_avg.toFixed(1)}`, 48)}
    </div>
  `;
}

/* ==========================================================================
   VISTA 2: TABLA DE LAS 32 FRANQUICIAS & SIMULADOR LIBRE
   ========================================================================== */
function populateSimulatorSelects() {
  if (!STATE.data) return;
  const teamsArr = Object.values(STATE.data.teams).sort((a, b) => a.name.localeCompare(b.name));
  const selA = document.getElementById("simTeamAway");
  const selH = document.getElementById("simTeamHome");
  if (!selA || !selH) return;

  const opts = teamsArr.map((t) => `<option value="${t.abbr}">${t.abbr} — ${t.name} (#${t.rank_total})</option>`).join("");
  selA.innerHTML = opts;
  selH.innerHTML = opts;
  if (teamsArr.length > 1) {
    selA.value = "KC";
    selH.value = "BUF";
  }
}

function getHeatColor(val, min, max, higherBetter = true) {
  let ratio = (val - min) / (max - min || 1);
  ratio = Math.max(0, Math.min(1, ratio));
  if (!higherBetter) ratio = 1 - ratio;
  if (ratio >= 0.72) return "background:#dcfce7; color:#14532d;";
  if (ratio >= 0.52) return "background:#ecfccb; color:#365314;";
  if (ratio >= 0.35) return "background:#fef9c3; color:#713f12;";
  return "background:#fee2e2; color:#7f1d1d;";
}

function renderTeamsTable() {
  const tbody = document.getElementById("teamsTableBody");
  if (!tbody || !STATE.data) return;

  const q = (document.getElementById("searchTeamInput")?.value || "").trim().toLowerCase();
  const conf = document.getElementById("filterConfSelect")?.value || "ALL";

  let list = Object.values(STATE.data.teams).filter((t) => {
    const matchQ = !q || t.name.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q);
    const matchConf = conf === "ALL" || t.conf === conf;
    return matchQ && matchConf;
  });

  const col = STATE.teamSortCol;
  const asc = STATE.teamSortAsc;
  list.sort((a, b) => {
    const va = a[col];
    const vb = b[col];
    if (typeof va === "string") return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? va - vb : vb - va;
  });

  tbody.innerHTML = list
    .map(
      (t) => `
      <tr>
        <td><strong>#${t.rank_total}</strong></td>
        <td class="team-cell">
          <img src="${t.logo}" alt="${t.abbr}" />
          <span>${t.name} <small style="color:#64748b">(${t.abbr})</small></span>
        </td>
        <td>${t.record}</td>
        <td><span class="heat-cell" style="${getHeatColor(t.total_dvoa_proxy, -25, 25, true)}">${t.total_dvoa_proxy >= 0 ? "+" : ""}${t.total_dvoa_proxy.toFixed(1)}%</span></td>
        <td><span class="heat-cell" style="${getHeatColor(t.off_epa_play, -0.18, 0.18, true)}">${t.off_epa_play >= 0 ? "+" : ""}${t.off_epa_play.toFixed(3)}</span></td>
        <td>${t.off_pass_epa_play >= 0 ? "+" : ""}${t.off_pass_epa_play.toFixed(2)}</td>
        <td>${t.off_rush_epa_play >= 0 ? "+" : ""}${t.off_rush_epa_play.toFixed(2)}</td>
        <td>${t.off_cpoe >= 0 ? "+" : ""}${t.off_cpoe.toFixed(1)}%</td>
        <td><span class="heat-cell" style="${getHeatColor(t.def_epa_allowed, -0.18, 0.18, false)}">${t.def_epa_allowed >= 0 ? "+" : ""}${t.def_epa_allowed.toFixed(3)}</span></td>
        <td>${t.def_sack_rate.toFixed(1)}% (${t.def_sacks})</td>
        <td>${t.off_rz_td_pct.toFixed(1)}%</td>
        <td>${t.off_3d_pct.toFixed(1)}%</td>
        <td>#${t.rank_st}</td>
        <td>
          <div style="display:flex; gap:4px; justify-content:center;">
            <a href="${t.links.pfr}" target="_blank" class="ext-source-chip" title="Pro Football Reference">PFR</a>
            <a href="${t.links.rbsdm}" target="_blank" class="ext-source-chip" title="RBSDM EPA">RBSDM</a>
            <a href="${t.links.ftn_dvoa}" target="_blank" class="ext-source-chip" title="FTN DVOA">DVOA</a>
            <button class="ext-source-chip btn-team-tip" data-team="${t.abbr}" style="border:none; cursor:pointer; background:#013369; color:#fff;">+Tip X</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll(".btn-team-tip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tm = STATE.data.teams[btn.dataset.team];
      if (tm) createCustomTeamTip(tm);
    });
  });
}

/* ==========================================================================
   VISTA 3: JUGADORES (SCOUTING HUB)
   ========================================================================== */
function renderPlayersGrid() {
  const grid = document.getElementById("playersCardsGrid");
  if (!grid || !STATE.data) return;

  const q = (document.getElementById("searchPlayerInput")?.value || "").trim().toLowerCase();
  const pos = STATE.selectedPos;

  const filtered = (STATE.data.players || []).filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
    const matchPos =
      pos === "ALL" ||
      p.pos === pos ||
      (pos === "DEF" && !["QB", "RB", "WR", "TE"].includes(p.pos));
    return matchQ && matchPos;
  });

  grid.innerHTML = filtered
    .slice(0, 48)
    .map((p) => {
      const badgeBg =
        p.percentile >= 80 ? "#15803d" : p.percentile >= 55 ? "#65a30d" : p.percentile >= 35 ? "#ca8a04" : "#dc2626";
      const metricsHtml = Object.entries(p.metrics || {})
        .map(([k, v]) => `<div class="psc-metric-item"><span>${k}</span><strong>${v}</strong></div>`)
        .join("");

      const linksHtml = Object.entries(p.links || {})
        .map(([k, u]) => `<a href="${u}" target="_blank" class="ext-source-chip">${k.toUpperCase()}</a>`)
        .join("");

      const fallbackAvatar = `https://a.espncdn.com/i/teamlogos/nfl/500/${p.team.toLowerCase()}.png`;

      return `
        <div class="player-scout-card">
          <div class="psc-top">
            <img src="${p.headshot || fallbackAvatar}" onerror="this.src='${fallbackAvatar}'" alt="${p.name}" class="psc-headshot" loading="lazy" />
            <div class="psc-title-box">
              <h4>${p.name}</h4>
              <div class="psc-meta">${p.pos} · ${p.team} · ${p.games} PJ</div>
            </div>
            <div class="psc-percentile-badge" style="background:${badgeBg}">
              Pctl ${p.percentile}
            </div>
          </div>
          <div class="psc-metrics-grid">
            ${metricsHtml}
          </div>
          <div class="psc-footer">
            <div class="psc-links">${linksHtml}</div>
            <button class="btn-primary-sm btn-player-tip" data-pid="${p.id}">✨ Crear Tip X</button>
          </div>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll(".btn-player-tip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pl = (STATE.data.players || []).find((x) => x.id === btn.dataset.pid);
      if (pl) createCustomPlayerTip(pl);
    });
  });
}

/* ==========================================================================
   VISTA 4: RADAR DE TOP NEWS (SOLO ALTO IMPACTO - 8 SITIOS)
   ========================================================================== */
function renderNewsGrid() {
  const grid = document.getElementById("newsCardsGrid");
  if (!grid || !STATE.data) return;

  const catFilter = document.getElementById("filterNewsCategory")?.value || "ALL";
  const srcFilter = document.getElementById("filterNewsSource")?.value || "ALL";

  const list = (STATE.data.news || []).filter((n) => {
    const matchCat = catFilter === "ALL" || (n.category || "").toLowerCase().includes(catFilter.toLowerCase());
    const matchSrc = srcFilter === "ALL" || n.source === srcFilter;
    return matchCat && matchSrc;
  });

  grid.innerHTML = list
    .map(
      (n) => `
      <article class="news-impact-card">
        <div>
          <div class="nic-header">
            <span class="nic-source">${n.source}</span>
            <span class="nic-cat">${n.category} · Impacto ${n.impact_score}</span>
          </div>
          <h4 style="margin-top:7px;">${n.title}</h4>
          <p style="margin-top:5px;">${n.summary}</p>
        </div>
        <div class="nic-footer">
          <a href="${n.url}" target="_blank" class="ext-source-chip">🔗 Leer nota original</a>
          <button class="btn-primary-sm btn-news-to-tip" data-newsid="${n.id}">📲 Armar Post para X</button>
        </div>
      </article>
    `
    )
    .join("");

  grid.querySelectorAll(".btn-news-to-tip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nw = (STATE.data.news || []).find((x) => x.id === btn.dataset.newsid);
      if (nw) createCustomNewsTip(nw);
    });
  });
}

/* ==========================================================================
   VISTA 5: DIRECTORIO DE LAS 18 FUENTES GRATUITAS
   ========================================================================== */
function renderSourcesDirectory() {
  const grid = document.getElementById("sourcesDirectoryGrid");
  if (!grid || !STATE.data) return;

  const statsCards = (STATE.data.sources_stats || []).map(
    (s) => `
    <div class="source-dir-card">
      <span class="nic-source" style="align-self:flex-start;">📊 MOTOR ESTADÍSTICO</span>
      <h4>${s.name}</h4>
      <a href="${s.url}" target="_blank" class="ext-source-chip" style="align-self:flex-start;">Abrir servicio oficial ↗</a>
    </div>
  `
  );

  const newsCards = (STATE.data.sources_news || []).map(
    (s) => `
    <div class="source-dir-card">
      <span class="nic-source" style="align-self:flex-start; background:#fee2e2; color:#991b1b;">📰 TOP NEWS ALTO IMPACTO</span>
      <h4>${s.name}</h4>
      <a href="${s.url}" target="_blank" class="ext-source-chip" style="align-self:flex-start;">Abrir portal de noticias ↗</a>
    </div>
  `
  );

  grid.innerHTML = [...statsCards, ...newsCards].join("");
}

/* ==========================================================================
   COLUMNA DERECHA: ÁNGULOS TÉCNICOS PARA HOY (TIPS PARA X + SELECTOR LINK + PUBLICACIÓN)
   ========================================================================== */
function renderXTipsFeed() {
  const feed = document.getElementById("xTipsFeed");
  if (!feed || !STATE.data) return;

  const allTips = STATE.data.tips_x || [];
  document.getElementById("countAllTips").textContent = String(allTips.length);

  const filtered = allTips.filter((t) => {
    if (STATE.tipGroupFilter === "ALL") return true;
    return t.day_group === STATE.tipGroupFilter;
  });

  updateBatchPublishBar();

  feed.innerHTML = filtered
    .map((tip) => {
      const st = initTipCardState(tip);
      const isChecked = STATE.selectedTipIds.has(tip.id);
      const charCount = estimateXCharLength(tip);
      const charClass = charCount <= 260 ? "" : charCount <= 280 ? "warn" : "over";
      const activeUrl = st.linkType === "page" ? tip.page_link : tip.source_link;

      const isGalleryPath = CLAY_GALLERY.some((c) => c.path === st.illustration);
      const customOptionHtml = !isGalleryPath
        ? `<option value="${st.illustration}" selected>✨ Imagen 16:9 Única Concordante (${(tip.matchup_label || st.title).slice(0, 32)})</option>`
        : "";
      const clayOptionsHtml =
        customOptionHtml +
        CLAY_GALLERY.map(
          (c) => `<option value="${c.path}" ${st.illustration === c.path ? "selected" : ""}>🎨 ${c.label}</option>`
        ).join("");

      return `
        <div class="x-tip-card ${isChecked ? "selected-for-batch" : ""}" data-tipid="${tip.id}">
          <div class="xtc-top-bar">
            <label class="xtc-check-label">
              <input type="checkbox" class="chk-select-tip" data-tipid="${tip.id}" ${isChecked ? "checked" : ""} />
              <span>${tip.badge}</span>
            </label>
            <span class="xtc-char-badge ${charClass}" id="charBadge-${tip.id}">${charCount} / 260 máx</span>
          </div>

          <!-- ILUSTRACIÓN DE PLASTILINA (16:9) -->
          <div class="xtc-clay-wrapper" data-tipid="${tip.id}">
            <img src="${st.illustration}" alt="${st.title}" loading="lazy" />
            <span class="xtc-clay-badge">🔍 Plastilina 16:9 · 100% Concordante · Clic para ampliar</span>
          </div>

          <div style="display:flex; gap:6px; align-items:center;">
            <select class="select-filter select-clay-scene" data-tipid="${tip.id}" style="font-size:11px; padding:4px 7px; flex:1;">
              ${clayOptionsHtml}
            </select>
            <button class="btn-secondary-sm btn-regen-unique-clay" data-tipid="${tip.id}" title="Generar una nueva imagen 16:9 única y concordante con el texto actual del tweet (sin repetir imágenes previas)" style="font-size:10.5px; padding:4px 8px; white-space:nowrap;">
              🎨 Nueva 16:9 Única
            </button>
          </div>

          <!-- TÍTULO DEL POST -->
          <input type="text" class="xtc-title-input" data-tipid="${tip.id}" value="${st.title.replace(/"/g, "&quot;")}" title="Título del ángulo técnico" />

          <!-- CONTENIDO TÉCNICO BASADO EN DATOS -->
          <textarea rows="4" class="xtc-body-textarea" data-tipid="${tip.id}">${st.body}</textarea>

          <!-- 1) SELECTOR PARA OPTAR POR AMBAS OPCIONES DE LINK -->
          <div class="xtc-link-selector-box">
            <div class="xtc-link-selector-header">
              <span>🔗 LINK INCLUIDO EN EL POST:</span>
              <span>Fuente: ${tip.source_name}</span>
            </div>
            <div class="xtc-link-toggle-btns">
              <button class="btn-link-choice ${st.linkType === "page" ? "active" : ""}" data-tipid="${tip.id}" data-ltype="page">
                🏠 Nuestra Página
              </button>
              <button class="btn-link-choice ${st.linkType === "source" ? "active" : ""}" data-tipid="${tip.id}" data-ltype="source">
                📊 Sitio Fuente (${tip.source_name.split("/")[0].trim()})
              </button>
            </div>
            <a href="${activeUrl}" target="_blank" class="xtc-active-link-preview" id="activeLinkPrev-${tip.id}">
              👉 ${activeUrl}
            </a>
          </div>

          <!-- 2) OPCIONES DE PUBLICACIÓN MANUAL (INMEDIATO O PROGRAMADO) -->
          <div class="xtc-publish-box">
            <div class="xtc-pub-mode-row">
              <button class="btn-pub-mode ${st.pubMode === "now" ? "active" : ""}" data-tipid="${tip.id}" data-pmode="now">
                ⚡ Post Inmediato
              </button>
              <button class="btn-pub-mode ${st.pubMode === "offset" ? "active" : ""}" data-tipid="${tip.id}" data-pmode="offset">
                ⏱️ En "X" min/hs
              </button>
              <button class="btn-pub-mode ${st.pubMode === "datetime" ? "active" : ""}" data-tipid="${tip.id}" data-pmode="datetime">
                📅 Fecha y Hora
              </button>
            </div>

            <!-- Subpanel cuando elige "En X minutos/horas" -->
            <div class="xtc-schedule-subpanel ${st.pubMode === "offset" ? "" : "hidden"}" id="subOffset-${tip.id}">
              <div class="quick-offset-chips">
                <button class="chip-offset" data-tipid="${tip.id}" data-val="15" data-unit="minutes">+15 min</button>
                <button class="chip-offset" data-tipid="${tip.id}" data-val="30" data-unit="minutes">+30 min</button>
                <button class="chip-offset" data-tipid="${tip.id}" data-val="1" data-unit="hours">+1 hora</button>
                <button class="chip-offset" data-tipid="${tip.id}" data-val="2" data-unit="hours">+2 horas</button>
                <button class="chip-offset" data-tipid="${tip.id}" data-val="4" data-unit="hours">+4 horas</button>
              </div>
              <div class="custom-offset-row">
                <span>Publicar dentro de:</span>
                <input type="number" class="input-offset-num card-offset-val" data-tipid="${tip.id}" value="${st.offsetVal}" min="1" max="1440" />
                <select class="select-offset-unit card-offset-unit" data-tipid="${tip.id}">
                  <option value="minutes" ${st.offsetUnit === "minutes" ? "selected" : ""}>minutos</option>
                  <option value="hours" ${st.offsetUnit === "hours" ? "selected" : ""}>horas</option>
                </select>
              </div>
            </div>

            <!-- Subpanel cuando elige "Fecha y Hora exacta" -->
            <div class="xtc-schedule-subpanel ${st.pubMode === "datetime" ? "" : "hidden"}" id="subDatetime-${tip.id}">
              <div class="custom-offset-row">
                <span>Fecha y Hora (ART):</span>
                <input type="datetime-local" class="input-datetime card-dt-val" data-tipid="${tip.id}" value="${st.dtVal}" style="flex:1;" />
              </div>
            </div>

            <div class="xtc-action-buttons">
              <button class="btn-send-publish" data-tipid="${tip.id}">
                ${
                  st.pubMode === "now"
                    ? "🚀 Enviar a Publicar Ahora"
                    : st.pubMode === "offset"
                    ? `⏱️ Programar en ${st.offsetVal} ${st.offsetUnit === "hours" ? "hs" : "min"}`
                    : "📅 Programar Fecha/Hora"
                }
              </button>
              <button class="btn-copy-post" data-tipid="${tip.id}" title="Copiar texto + link al portapapeles">
                📋 Copiar
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindXTipCardEvents();
}

function bindXTipCardEvents() {
  const feed = document.getElementById("xTipsFeed");
  if (!feed) return;

  // Checkbox de selección en lote
  feed.querySelectorAll(".chk-select-tip").forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.dataset.tipid;
      if (chk.checked) STATE.selectedTipIds.add(id);
      else STATE.selectedTipIds.delete(id);
      renderXTipsFeed();
    });
  });

  // Cambio de escena de plastilina
  feed.querySelectorAll(".select-clay-scene").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.dataset.tipid;
      STATE.cardState[id].illustration = sel.value;
      renderXTipsFeed();
    });
  });

  // Botón para generar una nueva imagen 16:9 única y concordante con el texto del tweet
  feed.querySelectorAll(".btn-regen-unique-clay").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.tipid;
      const tip = (STATE.data.tips_x || []).find((x) => x.id === id);
      const st = STATE.cardState[id];
      if (!tip || !st) return;
      tip.title = st.title;
      tip.body = st.body;
      const newPrompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: NFL scene depicting ${st.title} — ${st.body}. Authentic NFL helmets, exact player jersey numbers mentioned, ONE single brown leather football, natural two-arm anatomy, stadium floodlights.`;
      tip.clay_prompt = newPrompt;
      const dynUrl = buildUniqueDynamicClayUrl(newPrompt);
      tip.illustration = dynUrl;
      st.illustration = dynUrl;
      renderXTipsFeed();
      showToast("🎨 Generando nueva ilustración 16:9 única y concordante con el tweet...");
      await generateAndAssignUniqueTipImage(tip);
    });
  });

  // Ampliar ilustración de plastilina
  feed.querySelectorAll(".xtc-clay-wrapper").forEach((wrap) => {
    wrap.addEventListener("click", () => {
      const id = wrap.dataset.tipid;
      const tip = (STATE.data.tips_x || []).find((x) => x.id === id);
      const st = STATE.cardState[id];
      if (!tip || !st) return;
      document.getElementById("previewModalTitle").textContent = st.title;
      document.getElementById("previewModalImg").src = st.illustration;
      document.getElementById("previewModalPrompt").value = tip.clay_prompt || "";
      document.getElementById("imagePreviewModal").classList.remove("hidden");
    });
  });

  // Edición de título y cuerpo en vivo
  feed.querySelectorAll(".xtc-title-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      const id = inp.dataset.tipid;
      STATE.cardState[id].title = inp.value;
    });
  });

  feed.querySelectorAll(".xtc-body-textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      const id = ta.dataset.tipid;
      const tip = (STATE.data.tips_x || []).find((x) => x.id === id);
      STATE.cardState[id].body = ta.value;
      const count = estimateXCharLength(tip);
      const badge = document.getElementById(`charBadge-${id}`);
      if (badge) {
        badge.textContent = `${count} / 260 máx`;
        badge.className = `xtc-char-badge ${count <= 260 ? "" : count <= 280 ? "warn" : "over"}`;
      }
    });
  });

  // 1) Selector Dual de Link (Nuestra Página vs. Sitio Fuente)
  feed.querySelectorAll(".btn-link-choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tipid;
      STATE.cardState[id].linkType = btn.dataset.ltype;
      renderXTipsFeed();
    });
  });

  // 2) Selector de Modo de Publicación (Ahora | En X min/hs | Fecha y Hora)
  feed.querySelectorAll(".btn-pub-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tipid;
      STATE.cardState[id].pubMode = btn.dataset.pmode;
      renderXTipsFeed();
    });
  });

  // Chips rápidos (+15m, +30m, +1h, +2h, +4h)
  feed.querySelectorAll(".chip-offset").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.tipid;
      STATE.cardState[id].offsetVal = Number(chip.dataset.val);
      STATE.cardState[id].offsetUnit = chip.dataset.unit;
      renderXTipsFeed();
    });
  });

  feed.querySelectorAll(".card-offset-val").forEach((inp) => {
    inp.addEventListener("input", () => {
      const id = inp.dataset.tipid;
      STATE.cardState[id].offsetVal = Number(inp.value) || 15;
    });
  });

  feed.querySelectorAll(".card-offset-unit").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.dataset.tipid;
      STATE.cardState[id].offsetUnit = sel.value;
      renderXTipsFeed();
    });
  });

  feed.querySelectorAll(".card-dt-val").forEach((inp) => {
    inp.addEventListener("change", () => {
      const id = inp.dataset.tipid;
      STATE.cardState[id].dtVal = inp.value;
    });
  });

  // Copiar post al portapapeles
  feed.querySelectorAll(".btn-copy-post").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tipid;
      const tip = (STATE.data.tips_x || []).find((x) => x.id === id);
      if (!tip) return;
      const fullText = buildFinalPostText(tip);
      navigator.clipboard.writeText(fullText);
      showToast("✅ Post copiado al portapapeles con el link elegido");
    });
  });

  // Enviar a publicar individualmente
  feed.querySelectorAll(".btn-send-publish").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tipid;
      const tip = (STATE.data.tips_x || []).find((x) => x.id === id);
      if (!tip) return;
      const st = STATE.cardState[id];
      const offsetMins = st.offsetUnit === "hours" ? st.offsetVal * 60 : st.offsetVal;
      executePublishRequest([tip], st.pubMode, offsetMins, st.dtVal);
    });
  });
}

function updateBatchPublishBar() {
  const bar = document.getElementById("batchPublishBar");
  const countEl = document.getElementById("selectedTipsCount");
  if (!bar || !countEl) return;
  const n = STATE.selectedTipIds.size;
  countEl.textContent = String(n);
  if (n > 0) bar.classList.remove("hidden");
  else bar.classList.add("hidden");
}

/* ==========================================================================
   EJECUCIÓN DE PUBLICACIÓN (INMEDIATA O PROGRAMADA) VÍA SERVER_NFL.PY / X
   ========================================================================== */
async function executePublishRequest(tipsList, mode, offsetMinutes, scheduledDatetimeArt) {
  const payloadItems = tipsList.map((tip) => {
    const st = initTipCardState(tip);
    return {
      id: tip.id,
      title: st.title,
      full_text: buildFinalPostText(tip),
      illustration: st.illustration,
    };
  });

  showToast("⏳ Subiendo ilustración de plastilina al CDN y procesando envío...");

  try {
    const resp = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: payloadItems,
        mode,
        offset_minutes: offsetMinutes,
        scheduled_datetime_art: scheduledDatetimeArt,
      }),
    }),
      res = resp.ok ? await resp.json() : null;

    if (resp.ok && res) {
      const first = (res.results || [])[0] || {};
      if (first.Buffer) {
        showToast(`🚀 ¡Éxito en Buffer! (${first.entry?.mode || mode})`);
      } else {
        const txt = payloadItems[0].full_text;
        await navigator.clipboard.writeText(txt);
        if (mode === "now") {
          const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}`;
          window.open(intentUrl, "_blank");
          showToast("✅ Imagen subida a CDN + Texto copiado y abierto en X para publicar");
        } else {
          showToast(`📅 Programado en cola (${first.entry?.mode}) con imagen en CDN lista`);
        }
      }
      loadServerConfig();
    } else {
      throw new Error("Servidor estático sin endpoint /api/publish");
    }
  } catch (err) {
    const txt = payloadItems[0].full_text;
    await navigator.clipboard.writeText(txt);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}`;
    window.open(intentUrl, "_blank");
    showToast("✅ Post copiado y abierto en X (ejecutá server_nfl.py para agendamiento Buffer)");
  }
}

/* ==========================================================================
   CREADORES DINÁMICOS DE TIPS PARA X (100% CONCORDANTES + IMAGEN 16:9 ÚNICA)
   ========================================================================== */
function prependNewTipCard(newTip) {
  STATE.data.tips_x.unshift(newTip);
  initTipCardState(newTip);
  STATE.tipGroupFilter = "ALL";
  document.querySelectorAll(".x-tab").forEach((b) => b.classList.toggle("active", b.dataset.tipgroup === "ALL"));
  renderXTipsFeed();
  generateAndAssignUniqueTipImage(newTip);
  showToast("✨ Nuevo Tip creado con imagen 16:9 única y concordante (sin repetir imágenes)");
}

function createCustomTeamTip(tm) {
  const id = `tip-custom-team-${tm.abbr}-${Date.now()}`;
  const spec = TEAM_VISUAL_SPECS_JS[tm.abbr] || TEAM_VISUAL_SPECS_JS.KC;
  const [qbName, qbNum] = spec.qb;
  const [prName, prNum] = spec.pr;
  const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${spec.name} quarterback ${qbName} in ${spec.jersey} with number ${qbNum} and ${spec.helmet} throwing ONE single brown leather football alongside defensive star ${prName} (${prNum}) on the stadium turf. Handcrafted plasticine clay texture, natural anatomy.`;
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt);

  prependNewTipCard({
    id,
    day_group: "SUNDAY",
    category: "SUNDAY",
    matchup: tm.abbr,
    badge: `⚔️ EQUIPO · ${tm.abbr} (#${tm.rank_total} NFL)`,
    game_id: "ALL",
    matchup_label: `${tm.name} (${qbName} ${qbNum})`,
    title: `Radiografía Técnica de ${tm.name}: ${qbName} (${qbNum}) y ${prName} (${prNum})`,
    body: `📊 Radiografía 2026 de ${tm.name} (#${tm.rank_total} NFL): ${qbName} (${qbNum}) comanda un ataque de ${tm.off_epa_play >= 0 ? "+" : ""}${tm.off_epa_play.toFixed(2)} EPA/jugada (${tm.off_ppg} PPG), mientras ${prName} (${prNum}) lidera la defensa con ${tm.def_sacks} sacks (${tm.def_sack_rate}% pass rush).`,
    page_link: `${STATE.dashboardPublicUrl}#teams`,
    source_link: tm.links.pfr,
    source_name: "Pro Football Reference / RBSDM",
    illustration: uniqueImgUrl,
    clay_prompt: prompt,
  });
}

function createCustomPlayerTip(pl) {
  const id = `tip-custom-player-${pl.id}-${Date.now()}`;
  const spec = TEAM_VISUAL_SPECS_JS[pl.team] || TEAM_VISUAL_SPECS_JS.DET;
  let num = "#1";
  for (const unit of ["qb", "rb", "wr", "ol", "pr", "db"]) {
    if (spec[unit] && spec[unit][0].toLowerCase() === pl.name.toLowerCase()) {
      num = spec[unit][1];
      break;
    }
  }
  if (num === "#1" && spec[pl.pos.toLowerCase()]) {
    num = spec[pl.pos.toLowerCase()][1];
  }
  const mEntries = Object.entries(pl.metrics || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ");
  const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${spec.name} (${pl.team}) ${pl.pos} ${pl.name} in ${spec.jersey} with number ${num} and ${spec.helmet} in explosive NFL action with ONE single brown leather football. Handcrafted plasticine clay texture, natural two-arm anatomy.`;
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt);

  prependNewTipCard({
    id,
    day_group: "SUNDAY",
    category: "SUNDAY",
    matchup: pl.team,
    badge: `🏃 SCOUTING · ${pl.pos} (${pl.team} ${num})`,
    game_id: "ALL",
    matchup_label: `${pl.name} (${num}, ${pl.team})`,
    title: `Impacto Estadístico: ${pl.name} (${num}, ${pl.pos} · ${pl.team})`,
    body: `⭐ Scouting NFL 2026: ${pl.name} (${num}, ${pl.team}) se ubica en el percentil ${pl.percentile} de su posición con ${pl.primary_label}: ${pl.primary_val} (${pl.secondary_label}: ${pl.secondary_val} · ${mEntries}).`,
    page_link: `${STATE.dashboardPublicUrl}#players`,
    source_link: Object.values(pl.links || {})[0] || "https://www.pro-football-reference.com/",
    source_name: "Next Gen Stats / PlayerProfiler",
    illustration: uniqueImgUrl,
    clay_prompt: prompt,
  });
}

function createCustomNewsTip(nw) {
  const id = `tip-custom-news-${nw.id}-${Date.now()}`;
  const spec = TEAM_VISUAL_SPECS_JS[nw.team] || TEAM_VISUAL_SPECS_JS.PHI;
  const [starName, starNum] = spec.qb;
  const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${spec.name} player in ${spec.jersey} with number ${starNum} and ${spec.helmet} on the NFL stadium sideline representing breaking news: ${nw.title}. Handcrafted plasticine clay texture, natural anatomy.`;
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt);

  prependNewTipCard({
    id,
    day_group: "NEWS",
    category: "NEWS",
    matchup: nw.team || "NFL",
    badge: `${nw.category} · ${nw.source.toUpperCase()}`,
    game_id: "NEWS",
    matchup_label: `${nw.source}${nw.team ? " · " + nw.team : ""}`,
    title: nw.title,
    body: `🚨 [${nw.source}] ${nw.title}. ${nw.summary.slice(0, 105)}`,
    page_link: `${STATE.dashboardPublicUrl}#news`,
    source_link: nw.url,
    source_name: nw.source,
    illustration: uniqueImgUrl,
    clay_prompt: prompt,
  });
}

/* ==========================================================================
   ACTUALIZACIÓN EN VIVO DESDE EL NAVEGADOR + SERVIDOR / GITHUB PAGES
   (Cada 1h para Noticias y cada 30m cuando hay Partidos en Vivo, o Manual)
   ========================================================================== */
function normEspnTeamAbbr(abbr) {
  const m = { WAS: "WAS", WSH: "WAS", LAR: "LA", JAC: "JAX" };
  return m[abbr] || abbr;
}

async function refreshLiveFromBrowser(isManual = false) {
  if (isManual) {
    showToast("🔄 Actualizando marcadores en vivo, estado de MNF y Top News...");
  }

  let localRefreshed = false;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      if (r.ok) localRefreshed = true;
    } catch (_) {}
  }

  await loadDashboardData(true);

  let liveGameDetected = false;
  try {
    const sbResp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?t=${Date.now()}`);
    if (sbResp.ok && STATE.data) {
      const sb = await sbResp.json();
      const events = sb.events || [];
      for (const ev of events) {
        const comp = (ev.competitions || [{}])[0];
        const competitors = comp.competitors || [];
        if (competitors.length < 2) continue;
        const homeC = competitors.find((c) => c.homeAway === "home") || competitors[0];
        const awayC = competitors.find((c) => c.homeAway === "away") || competitors[1];
        const hAbbr = normEspnTeamAbbr(homeC?.team?.abbreviation || "");
        const aAbbr = normEspnTeamAbbr(awayC?.team?.abbreviation || "");
        const stObj = ev?.status?.type || {};
        const state = stObj.state || "pre";
        const detail = stObj.shortDetail || "";
        if (state === "in") liveGameDetected = true;

        const matchGame = (STATE.data.games || []).find((g) => g.away_team === aAbbr && g.home_team === hAbbr);
        if (matchGame) {
          matchGame.status_state = state;
          if (detail) matchGame.status_detail = detail;
          matchGame.away_score = Number(awayC?.score || 0);
          matchGame.home_score = Number(homeC?.score || 0);
        }
      }
    }
  } catch (e) {
    console.warn("Live ESPN scoreboard check:", e);
  }

  try {
    const nwResp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15&t=${Date.now()}`);
    if (nwResp.ok && STATE.data) {
      const nwJson = await nwResp.json();
      const existingTitles = new Set((STATE.data.news || []).map((n) => n.title.toLowerCase()));
      for (const art of nwJson.articles || []) {
        const headline = (art.headline || "").trim();
        if (!headline || existingTitles.has(headline.toLowerCase())) continue;
        const low = (headline + " " + (art.description || "")).toLowerCase();
        if (
          low.includes("injur") ||
          low.includes("out") ||
          low.includes("trade") ||
          low.includes("sign") ||
          low.includes("contract") ||
          low.includes("quarterback") ||
          low.includes("win") ||
          low.includes("monday night")
        ) {
          STATE.data.news.unshift({
            id: `news-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: headline,
            summary: art.description || headline,
            url: art?.links?.web?.href || "https://www.espn.com/nfl/",
            source: "ESPN NFL",
            source_home: "https://www.espn.com/nfl/",
            published: "Recién actualizado",
            impact_score: 68,
            category: low.includes("injur") || low.includes("surgery") ? "🚨 Lesión Clave / Parte Médico" : "📊 Impacto Táctico",
            team: "",
          });
          existingTitles.add(headline.toLowerCase());
        }
      }
      document.getElementById("newsCountBadge").textContent = String((STATE.data.news || []).length);
    }
  } catch (e) {
    console.warn("Live ESPN news check:", e);
  }

  const nowStamp = formatNowART();
  if (STATE.data) {
    STATE.data.updated_at = nowStamp;
    STATE.data.has_live_games = liveGameDetected || Boolean(STATE.data.has_live_games);
  }
  updateTimestampUI(nowStamp, liveGameDetected);
  renderAll();
  scheduleAutoRefresh(liveGameDetected);

  if (isManual) {
    showToast(`✅ Datos y marcadores actualizados (${nowStamp})${localRefreshed ? " · Motor completo ejecutado" : ""}`);
  }
}

function scheduleAutoRefresh(hasLiveGames = false) {
  if (STATE.autoRefreshTimer) {
    clearInterval(STATE.autoRefreshTimer);
  }
  const intervalMs = (hasLiveGames ? 30 : 60) * 60 * 1000;
  STATE.autoRefreshTimer = setInterval(() => {
    refreshLiveFromBrowser(false);
  }, intervalMs);
}

/* ==========================================================================
   NAVEGACIÓN Y EVENTOS GLOBALES
   ========================================================================== */
function switchView(viewName) {
  STATE.activeView = viewName;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === viewName));
  document.querySelectorAll(".stage-view").forEach((sec) => sec.classList.toggle("active", sec.id === `view-${viewName}`));
}

async function loadServerConfig() {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) return;
    const cfg = await r.json();
    if (cfg.dashboard_public_url) {
      STATE.dashboardPublicUrl = cfg.dashboard_public_url;
      document.getElementById("cfgDashboardUrl").value = cfg.dashboard_public_url;
    }
    if (cfg.buffer_channel_id) {
      document.getElementById("cfgBufferChannel").value = cfg.buffer_channel_id;
    }
    const histEl = document.getElementById("publishHistoryList");
    if (histEl && cfg.history && cfg.history.length > 0) {
      histEl.innerHTML = cfg.history
        .map(
          (h) => `
          <div class="history-item">
            <strong>${h.title}</strong> <span style="color:#15803d; font-weight:700;">[${h.mode}]</span>
            <div style="color:#475569; margin-top:3px;">${h.text}</div>
            ${h.cdn_url ? `<a href="${h.cdn_url}" target="_blank" style="font-size:10.5px; color:#013369;">🖼️ Ver Imagen en CDN</a>` : ""}
          </div>
        `
        )
        .join("");
    }
  } catch (_) {}
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("selectWeek")?.addEventListener("change", (e) => {
    STATE.selectedWeek = Number(e.target.value);
    STATE.customMatchup = null;
    STATE.selectedGameId = null;
    renderGameRibbon();
    renderMatchupBoard();
  });

  document.querySelectorAll("#daySlotFilterGroup .slot-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#daySlotFilterGroup .slot-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      STATE.selectedSlot = pill.dataset.slot;
      if (["TNF", "SUNDAY", "MNF", "ALL"].includes(STATE.selectedSlot)) {
        STATE.tipGroupFilter = STATE.selectedSlot;
        document.querySelectorAll(".x-tab").forEach((t) => t.classList.toggle("active", t.dataset.tipgroup === STATE.tipGroupFilter));
      }
      renderGameRibbon();
      renderMatchupBoard();
      renderXTipsFeed();
    });
  });

  document.getElementById("ribbonPrev")?.addEventListener("click", () => {
    document.getElementById("gameRibbonTrack")?.scrollBy({ left: -320, behavior: "smooth" });
  });
  document.getElementById("ribbonNext")?.addEventListener("click", () => {
    document.getElementById("gameRibbonTrack")?.scrollBy({ left: 320, behavior: "smooth" });
  });

  // Botón de crear tip del partido activo en la Pizarra Táctica (con números de jugadores y nueva imagen única 16:9)
  document.getElementById("btnCreateMatchupTip")?.addEventListener("click", () => {
    const m = getActiveMatchupTeams();
    if (!m) return;
    const { away: aw, home: hm, game: g } = m;
    const awSpec = TEAM_VISUAL_SPECS_JS[aw.abbr] || TEAM_VISUAL_SPECS_JS.DAL;
    const hmSpec = TEAM_VISUAL_SPECS_JS[hm.abbr] || TEAM_VISUAL_SPECS_JS.PHI;
    const [awQb, awQbNum] = awSpec.qb;
    const [hmPr, hmPrNum] = hmSpec.pr;
    const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${awSpec.name} quarterback ${awQb} in ${awSpec.jersey} with number ${awQbNum} and ${awSpec.helmet} facing pass pressure from ${hmSpec.name} defender ${hmPr} in ${hmSpec.jersey} with number ${hmPrNum} and ${hmSpec.helmet} at the line of scrimmage with ONE single football. Handcrafted plasticine clay texture, natural anatomy.`;
    const uniqueImg = buildUniqueDynamicClayUrl(prompt);

    prependNewTipCard({
      id: `tip-matchup-${g.id}-${Date.now()}`,
      day_group: g.day_slot === "TNF" || g.day_slot === "MNF" ? g.day_slot : "SUNDAY",
      category: g.day_slot === "TNF" || g.day_slot === "MNF" ? g.day_slot : "SUNDAY",
      matchup: `${aw.abbr} @ ${hm.abbr}`,
      badge: `🏈 DUELO TÁCTICO · ${aw.abbr} @ ${hm.abbr}`,
      game_id: g.id,
      matchup_label: `${aw.abbr} (${awQb} ${awQbNum}) @ ${hm.abbr} (${hmPr} ${hmPrNum})`,
      title: `Duelo Clave: ${awQb} (${awQbNum}, ${aw.abbr}) vs. ${hmPr} (${hmPrNum}, ${hm.abbr})`,
      body: `🏈 En ${aw.abbr} @ ${hm.abbr}: ${awQb} (${awQbNum}) lidera a ${aw.short} con ${aw.off_epa_play >= 0 ? "+" : ""}${aw.off_epa_play.toFixed(2)} EPA/jugada y ${aw.off_rz_td_pct.toFixed(0)}% en Zona Roja frente a ${hmPr} (${hmPrNum}) y ${hm.short} (#${hm.rank_total} NFL, ${hm.def_sack_rate.toFixed(1)}% sack rate).`,
      page_link: `${STATE.dashboardPublicUrl}#matchup-${g.id}`,
      source_link: "https://www.sharpfootballanalysis.com/stats-nfl/",
      source_name: "Sharp Football / FTN DVOA",
      illustration: uniqueImg,
      clay_prompt: prompt,
    });
  });

  // Simulador Libre de 2 equipos
  document.getElementById("btnLoadSimMatchup")?.addEventListener("click", () => {
    const aw = document.getElementById("simTeamAway")?.value;
    const hm = document.getElementById("simTeamHome")?.value;
    if (aw && hm) {
      STATE.customMatchup = { away_team: aw, home_team: hm };
      switchView("matchups");
      renderMatchupBoard();
      showToast(`⚔️ Pizarra Táctica abierta: ${aw} vs. ${hm}`);
    }
  });

  document.getElementById("searchTeamInput")?.addEventListener("input", renderTeamsTable);
  document.getElementById("filterConfSelect")?.addEventListener("change", renderTeamsTable);
  document.querySelectorAll("#teamsTable th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (STATE.teamSortCol === col) STATE.teamSortAsc = !STATE.teamSortAsc;
      else {
        STATE.teamSortCol = col;
        STATE.teamSortAsc = col === "rank_total" || col === "rank_st" || col === "def_epa_allowed";
      }
      renderTeamsTable();
    });
  });

  document.getElementById("searchPlayerInput")?.addEventListener("input", renderPlayersGrid);
  document.querySelectorAll("#posFilterPills .pos-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#posFilterPills .pos-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      STATE.selectedPos = pill.dataset.pos;
      renderPlayersGrid();
    });
  });

  document.getElementById("filterNewsCategory")?.addEventListener("change", renderNewsGrid);
  document.getElementById("filterNewsSource")?.addEventListener("change", renderNewsGrid);

  document.querySelectorAll("#xTipFilterTabs .x-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#xTipFilterTabs .x-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      STATE.tipGroupFilter = tab.dataset.tipgroup;
      renderXTipsFeed();
    });
  });

  // Nuevo post manual con imagen 16:9 única generada al instante
  document.getElementById("btnAddCustomTip")?.addEventListener("click", () => {
    const m = getActiveMatchupTeams();
    const awAbbr = m?.away?.abbr || "KC";
    const hmAbbr = m?.home?.abbr || "BUF";
    const awSpec = TEAM_VISUAL_SPECS_JS[awAbbr] || TEAM_VISUAL_SPECS_JS.KC;
    const hmSpec = TEAM_VISUAL_SPECS_JS[hmAbbr] || TEAM_VISUAL_SPECS_JS.BUF;
    const [awWr, awWrNum] = awSpec.wr;
    const [hmDb, hmDbNum] = hmSpec.db;
    const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${awSpec.name} wide receiver ${awWr} in ${awSpec.jersey} with number ${awWrNum} and ${awSpec.helmet} catching ONE single football against ${hmSpec.name} defensive back ${hmDb} in ${hmSpec.jersey} with number ${hmDbNum} and ${hmSpec.helmet}. Handcrafted plasticine texture.`;
    const uniqueImg = buildUniqueDynamicClayUrl(prompt);

    prependNewTipCard({
      id: `tip-manual-${Date.now()}`,
      day_group: "SUNDAY",
      category: "SUNDAY",
      matchup: `${awAbbr} @ ${hmAbbr}`,
      badge: `✍️ POST PERSONALIZADO · ${awAbbr} @ ${hmAbbr}`,
      game_id: "ALL",
      matchup_label: `${awWr} (${awWrNum}, ${awAbbr}) vs ${hmDb} (${hmDbNum}, ${hmAbbr})`,
      title: `Ángulo Táctico: ${awWr} (${awWrNum}, ${awAbbr}) vs. ${hmDb} (${hmDbNum}, ${hmAbbr})`,
      body: `🏈 Duelo individual clave (${awAbbr} @ ${hmAbbr}): el receptor ${awWr} (${awWrNum}) de ${awSpec.name} enfrenta en cobertura al esquinero ${hmDb} (${hmDbNum}) de ${hmSpec.name} según métricas de separación Next Gen Stats y EPA/target.`,
      page_link: STATE.dashboardPublicUrl,
      source_link: "https://nextgenstats.nfl.com/",
      source_name: "Next Gen Stats / RBSDM",
      illustration: uniqueImg,
      clay_prompt: prompt,
    });
  });

  // Controles de Publicación en Lote
  const batchModeSel = document.getElementById("batchPublishMode");
  const batchOffsetGrp = document.getElementById("batchOffsetGroup");
  const batchDtGrp = document.getElementById("batchDatetimeGroup");
  const batchDtInput = document.getElementById("batchDatetimeInput");
  if (batchDtInput) batchDtInput.value = getDefaultFutureDatetimeART(60);

  batchModeSel?.addEventListener("change", () => {
    const m = batchModeSel.value;
    batchOffsetGrp?.classList.toggle("hidden", m !== "offset");
    batchDtGrp?.classList.toggle("hidden", m !== "datetime");
  });

  document.getElementById("btnClearSelection")?.addEventListener("click", () => {
    STATE.selectedTipIds.clear();
    renderXTipsFeed();
  });

  document.getElementById("btnExecuteBatchPublish")?.addEventListener("click", () => {
    const selectedTips = (STATE.data.tips_x || []).filter((t) => STATE.selectedTipIds.has(t.id));
    if (selectedTips.length === 0) return;
    const mode = batchModeSel?.value || "offset";
    const val = Number(document.getElementById("batchOffsetValue")?.value || 30);
    const unit = document.getElementById("batchOffsetUnit")?.value || "minutes";
    const offsetMins = unit === "hours" ? val * 60 : val;
    const dtVal = batchDtInput?.value || getDefaultFutureDatetimeART(60);
    executePublishRequest(selectedTips, mode, offsetMins, dtVal);
  });

  // Botones de actualizar datos en vivo (Barra superior + Sidebar)
  document.getElementById("btnRefreshData")?.addEventListener("click", () => refreshLiveFromBrowser(true));
  document.getElementById("btnTopRefresh")?.addEventListener("click", () => refreshLiveFromBrowser(true));

  // Modales
  document.getElementById("btnOpenConfig")?.addEventListener("click", () => {
    loadServerConfig();
    document.getElementById("configModal")?.classList.remove("hidden");
  });
  document.getElementById("btnCloseConfig")?.addEventListener("click", () => {
    document.getElementById("configModal")?.classList.add("hidden");
  });
  document.getElementById("btnClosePreview")?.addEventListener("click", () => {
    document.getElementById("imagePreviewModal")?.classList.add("hidden");
  });

  document.getElementById("btnSaveConfig")?.addEventListener("click", async () => {
    const dashboard_public_url = document.getElementById("cfgDashboardUrl")?.value.trim();
    const buffer_access_token = document.getElementById("cfgBufferToken")?.value.trim();
    const buffer_channel_id = document.getElementById("cfgBufferChannel")?.value.trim();
    if (dashboard_public_url) STATE.dashboardPublicUrl = dashboard_public_url;
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_public_url, buffer_access_token, buffer_channel_id }),
      });
      showToast("💾 Configuración guardada correctamente");
      document.getElementById("configModal")?.classList.add("hidden");
    } catch (_) {
      showToast("💾 URL guardada en sesión local");
      document.getElementById("configModal")?.classList.add("hidden");
    }
  });
});

