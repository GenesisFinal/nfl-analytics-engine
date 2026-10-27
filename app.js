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
  directionMode: "BOTH", // 'BOTH' (Ida y Vuelta), 'AWAY_OFF' (Sentido 1), 'HOME_OFF' (Sentido 2)
  showInlineGuides: true,
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
  { label: "CAR Analytics: Bryce Young #9 & Jadeveon Clowney #7 (Panthers)", path: "assets/clay/clay_car_young9.jpg" },
  { label: "CAR Scramble: Bryce Young #9 en Acción (Panthers)", path: "assets/clay/clay_car_young9_run.jpg" },
  { label: "KC vs BUF: Patrick Mahomes #15 (KC) vs Josh Allen #17 (BUF)", path: "assets/clay/clay_kc_buf.jpg" },
  { label: "BAL Terrestre: Lamar Jackson #8 & Derrick Henry #22 (Ravens)", path: "assets/clay/clay_bal_lamar8.jpg" },
  { label: "GB vs HOU: Jordan Love #10 (GB) vs C.J. Stroud #7 (HOU)", path: "assets/clay/clay_gb_hou.jpg" },
  { label: "CIN vs CLE: Joe Burrow #9 (CIN) vs Myles Garrett #95 (CLE)", path: "assets/clay/clay_cin_cle.jpg" },
  { label: "WAS Analytics: Jayden Daniels #5 & Terry McLaurin #17 (Commanders)", path: "assets/clay/clay_was_daniels5.jpg" },
  { label: "MIA vs TB: Tyreek Hill #10 (MIA) vs Baker Mayfield #6 (TB)", path: "assets/clay/clay_mia_tb.jpg" },
  { label: "LAC vs DEN: Justin Herbert #10 (LAC) vs Pat Surtain II #2 (DEN)", path: "assets/clay/clay_den_lac.jpg" },
  { label: "ARI vs JAX: Kyler Murray #1 (ARI) vs Trevor Lawrence #16 (JAX)", path: "assets/clay/clay_ari_jax.jpg" },
  { label: "NYG vs TEN: Malik Nabers #1 (NYG) vs Tony Pollard #20 (TEN)", path: "assets/clay/clay_nyg_ten.jpg" },
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

const TEAM_NANOBANANA_CLAY_MAP = {
  ARI: ["assets/clay/clay_ari_jax.jpg"],
  ATL: ["assets/clay/clay_atl_sf_ground.jpg", "assets/clay/clay_sf_atl.jpg"],
  BAL: ["assets/clay/clay_bal_lamar8.jpg"],
  BUF: ["assets/clay/clay_kc_buf.jpg"],
  CAR: ["assets/clay/clay_car_young9.jpg", "assets/clay/clay_car_young9_run.jpg", "assets/clay/clay_news_moton_car72.jpg"],
  CHI: ["assets/clay/clay_ne_chi_trenches.jpg", "assets/clay/clay_ne_chi.jpg"],
  CIN: ["assets/clay/clay_cin_cle.jpg"],
  CLE: ["assets/clay/clay_cin_cle.jpg"],
  DAL: ["assets/clay/clay_dal_phi.jpg", "assets/clay/clay_dal_phi_mnf2.jpg", "assets/clay/clay_news_javonte_dal33.jpg"],
  DEN: ["assets/clay/clay_den_lac.jpg"],
  DET: ["assets/clay/clay_det_goff.jpg"],
  GB: ["assets/clay/clay_gb_hou.jpg"],
  HOU: ["assets/clay/clay_gb_hou.jpg"],
  IND: ["assets/clay/clay_ind_min.jpg"],
  JAX: ["assets/clay/clay_ari_jax.jpg"],
  KC: ["assets/clay/clay_kc_buf.jpg", "assets/clay/clay_news_gwilson_nyj5.jpg"],
  LA: ["assets/clay/clay_la_lv.jpg"],
  LAC: ["assets/clay/clay_den_lac.jpg"],
  LV: ["assets/clay/clay_la_lv.jpg"],
  MIA: ["assets/clay/clay_mia_tb.jpg"],
  MIN: ["assets/clay/clay_ind_min.jpg"],
  NE: ["assets/clay/clay_ne_chi.jpg", "assets/clay/clay_ne_chi_trenches.jpg"],
  NO: ["assets/clay/clay_pit_no.jpg"],
  NYG: ["assets/clay/clay_nyg_ten.jpg"],
  NYJ: ["assets/clay/clay_news_gwilson_nyj5.jpg"],
  PHI: ["assets/clay/clay_news_barkley_phi26.jpg", "assets/clay/clay_dal_phi.jpg", "assets/clay/clay_dal_phi_mnf2.jpg"],
  PIT: ["assets/clay/clay_pit_no.jpg"],
  SEA: ["assets/clay/clay_sea_jsn.jpg"],
  SF: ["assets/clay/clay_sf_atl.jpg", "assets/clay/clay_atl_sf_ground.jpg"],
  TB: ["assets/clay/clay_mia_tb.jpg"],
  TEN: ["assets/clay/clay_nyg_ten.jpg"],
  WAS: ["assets/clay/clay_was_daniels5.jpg"],
};

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

function buildUniqueDynamicClayUrl(promptText, teamHint = "", currentIllustration = "") {
  // Selecciona una ilustración 3D claymation 16:9 auténtica generada con Google Gemini Nano Banana (0% Pollinations)
  const activeUsed = new Set(
    (STATE.data?.tips_x || []).map((t) => STATE.cardState[t.id]?.illustration || t.illustration).filter(Boolean)
  );
  STATE.usedIllustrations.forEach((u) => activeUsed.add(u));

  const candidateTeams = [];
  const cleanHint = String(teamHint || "").toUpperCase().trim();
  const m = cleanHint.match(/^([A-Z]{2,3})\s*@\s*([A-Z]{2,3})$/);
  if (m) {
    candidateTeams.push(m[1], m[2]);
  } else if (TEAM_NANOBANANA_CLAY_MAP[cleanHint]) {
    candidateTeams.push(cleanHint);
  }

  const lowPrompt = String(promptText || "").toLowerCase();
  for (const [abbr, spec] of Object.entries(TEAM_VISUAL_SPECS_JS)) {
    if (!candidateTeams.includes(abbr)) {
      if (lowPrompt.includes(spec.name.toLowerCase()) || lowPrompt.includes(`(${abbr.toLowerCase()})`)) {
        candidateTeams.push(abbr);
      }
    }
  }

  const teamAssets = [];
  for (const tm of candidateTeams) {
    for (const p of TEAM_NANOBANANA_CLAY_MAP[tm] || []) {
      if (!teamAssets.includes(p)) teamAssets.push(p);
    }
  }

  if (candidateTeams.includes("CAR") && (lowPrompt.includes("#9") || lowPrompt.includes("young") || lowPrompt.includes("clowney"))) {
    const idx = teamAssets.indexOf("assets/clay/clay_car_young9.jpg");
    if (idx > 0) {
      teamAssets.splice(idx, 1);
      teamAssets.unshift("assets/clay/clay_car_young9.jpg");
    }
  }

  for (const asset of teamAssets) {
    if (asset !== currentIllustration && !activeUsed.has(asset)) {
      STATE.usedIllustrations.add(asset);
      return asset;
    }
  }
  for (const asset of teamAssets) {
    if (asset !== currentIllustration) {
      STATE.usedIllustrations.add(asset);
      return asset;
    }
  }
  if (teamAssets.length > 0) {
    return teamAssets[0];
  }

  for (const item of CLAY_GALLERY) {
    if (item.path !== currentIllustration && !activeUsed.has(item.path)) {
      STATE.usedIllustrations.add(item.path);
      return item.path;
    }
  }
  return CLAY_GALLERY[0].path;
}

async function generateAndAssignUniqueTipImage(tip) {
  // 1. Si el usuario configuró GEMINI_API_KEY en el navegador, invoca directamente Gemini Nano Banana (gemini-nano-banana-2.1 / gemini-3.1-flash-image)
  const localGeminiKey = (localStorage.getItem("nfl_gemini_api_key") || "").trim();
  if (localGeminiKey && tip.clay_prompt) {
    for (const nbModel of ["gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3-pro-image"]) {
      try {
        const gResp = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: {
            "x-goog-api-key": localGeminiKey,
            "Content-Type": "application/json",
            "Api-Revision": "2026-05-20",
          },
          body: JSON.stringify({
            model: nbModel,
            input: [{ type: "text", text: tip.clay_prompt }],
          }),
        });
        if (gResp.ok) {
          const gData = await gResp.json();
          const outImg = gData.output_image || gData.interaction?.output_image;
          if (outImg && outImg.data) {
            const mime = outImg.mime_type || "image/jpeg";
            const dataUrl = `data:${mime};base64,${outImg.data}`;
            tip.illustration = dataUrl;
            if (STATE.cardState[tip.id]) STATE.cardState[tip.id].illustration = dataUrl;
            STATE.usedIllustrations.add(dataUrl);
            renderXTipsFeed();
            return;
          }
        }
      } catch (_) {}
    }
  }

  // 2. Si el servidor local server_nfl.py está corriendo, genera/selecciona con el motor Gemini Nano Banana
  if (window.location.protocol !== "file:") {
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
  const allGames = data.games || [];

  // Ordenar semanas de más reciente/próxima a anterior o en orden numérico claro
  weekSel.innerHTML = avail
    .map((wk) => {
      const wkGames = allGames.filter((g) => Number(g.week) === Number(wk));
      const anyLive = wkGames.some((g) => g.status_state === "in");
      const preCount = wkGames.filter((g) => g.status_state === "pre").length;
      let suffix = "";
      if (anyLive) suffix = ` (🔴 EN VIVO · ${wkGames.length} partidos)`;
      else if (preCount > 0) suffix = ` (Próximos · ${preCount} partidos por jugar)`;
      else suffix = ` (Finalizada · ${wkGames.length} resultados + MNF)`;
      return `<option value="${wk}" ${Number(wk) === Number(STATE.selectedWeek) ? "selected" : ""}>Semana ${wk}${suffix}</option>`;
    })
    .join("");
}

function populateGameDropdownSelectors() {
  if (!STATE.data) return;
  const allGames = STATE.data.games || [];
  const availWeeks = STATE.data.available_weeks && STATE.data.available_weeks.length ? STATE.data.available_weeks : [6, 7, 8];

  // Ordenamos para que la semana activa aparezca primero en el desplegable y luego el resto de semanas
  const orderedWeeks = [
    STATE.selectedWeek,
    ...availWeeks.filter((w) => Number(w) !== Number(STATE.selectedWeek)).sort((a, b) => b - a),
  ];

  const groupsHtml = orderedWeeks
    .map((wk) => {
      const wkGames = allGames.filter((g) => Number(g.week) === Number(wk));
      if (!wkGames.length) return "";
      const preCount = wkGames.filter((g) => g.status_state === "pre").length;
      const groupTitle =
        preCount > 0
          ? `📅 SEMANA ${wk} — PRÓXIMOS PARTIDOS (${preCount} por jugar)`
          : `🏁 SEMANA ${wk} — RESULTADOS FINALES (${wkGames.length} partidos)`;

      const optionsHtml = wkGames
        .map((g) => {
          const aw = STATE.data.teams[g.away_team] || { name: g.away_team, short: g.away_team };
          const hm = STATE.data.teams[g.home_team] || { name: g.home_team, short: g.home_team };
          const slotTag = g.day_slot === "TNF" ? "JUE (TNF)" : g.day_slot === "MNF" ? "LUN (MNF)" : "DOM";
          const statusTxt =
            g.status_state === "in"
              ? `🔴 VIVO ${g.away_score ?? 0}-${g.home_score ?? 0}`
              : g.status_state === "post"
              ? `FINAL ${g.away_score ?? 0}-${g.home_score ?? 0}`
              : g.display_time;
          const isSel = !STATE.customMatchup && g.id === STATE.selectedGameId;
          return `<option value="${g.id}" ${isSel ? "selected" : ""}>[Sem ${wk} · ${slotTag}] ${g.away_team} (${aw.short}) @ ${g.home_team} (${hm.short}) — ${statusTxt}</option>`;
        })
        .join("");

      return `<optgroup label="${groupTitle}">${optionsHtml}</optgroup>`;
    })
    .join("");

  const customSimOpt = STATE.customMatchup
    ? `<option value="CUSTOM_SIM" selected>⚔️ Duelo Simulado: ${STATE.customMatchup.away_team} vs. ${STATE.customMatchup.home_team}</option>`
    : "";

  ["selectMatchupGame", "quickSelectGame"].forEach((id) => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = customSimOpt + groupsHtml;
  });
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
    let data = null;
    if (window.location.protocol !== "file:") {
      try {
        const resp = await fetch(`data/nfl_dashboard_data.json?t=${Date.now()}`);
        if (resp.ok) {
          data = await resp.json();
        }
      } catch (_) {}
    }
    if (!data && window.NFL_DASHBOARD_EMBEDDED_DATA) {
      data = JSON.parse(JSON.stringify(window.NFL_DASHBOARD_EMBEDDED_DATA));
    }
    if (!data) {
      throw new Error("No se encontró data/nfl_dashboard_data.json ni NFL_DASHBOARD_EMBEDDED_DATA");
    }

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
    const wkGames = (data.games || []).filter((g) => Number(g.week) === Number(STATE.selectedWeek));
    if (wkGames.length > 0 && !STATE.selectedGameId) {
      const liveOrMnf = wkGames.find((g) => g.status_state === "in") || wkGames.find((g) => g.day_slot === "MNF") || wkGames[0];
      STATE.selectedGameId = liveOrMnf.id;
    }

    populateSimulatorSelects();
    renderAll();
    if (window.location.protocol !== "file:") {
      loadServerConfig();
    }
    scheduleAutoRefresh(Boolean(data.has_live_games));
  } catch (err) {
    console.error("Error cargando datos del tablero:", err);
    showToast("⚠️ Error al cargar datos del tablero");
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
  renderGlossaryView();
  renderXTipsFeed();
}

/* ==========================================================================
   CINTA SUPERIOR DE PARTIDOS (GAME RIBBON) + SELECTORES DESPLEGABLES
   ========================================================================== */
function renderGameRibbon() {
  const track = document.getElementById("gameRibbonTrack");
  if (!track || !STATE.data) return;

  let games = (STATE.data.games || []).filter((g) => {
    const matchWeek = Number(g.week) === Number(STATE.selectedWeek);
    const matchSlot = STATE.selectedSlot === "ALL" || g.day_slot === STATE.selectedSlot;
    return matchWeek && matchSlot;
  });

  // Si el filtro de día (TNF/MNF) no tiene partidos en esa semana, mostrar todos los de la semana
  if (games.length === 0) {
    games = (STATE.data.games || []).filter((g) => Number(g.week) === Number(STATE.selectedWeek));
  }

  if (games.length > 0 && !games.some((g) => g.id === STATE.selectedGameId) && !STATE.customMatchup) {
    const mnfOrFirst = games.find((g) => g.status_state === "in") || games.find((g) => g.day_slot === "MNF") || games[0];
    STATE.selectedGameId = mnfOrFirst.id;
  }

  populateWeekSelector(STATE.data);
  populateGameDropdownSelectors();

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
   HELPERS DE BARRAS TÁCTICAS EN AMBOS SENTIDOS (ATAQUE VS. DEFENSA)
   ========================================================================== */
function computeUnitStrengthPct(val, minVal, maxVal, higherIsBetter = true) {
  const rawRatio = ((val - minVal) / (maxVal - minVal || 1)) * 100;
  const clamped = Math.max(12, Math.min(98, rawRatio));
  return higherIsBetter ? clamped : Math.max(12, Math.min(98, 110 - clamped));
}

function getStrengthComparisonClasses(scoreA, scoreB) {
  const diff = scoreA - scoreB;
  if (diff >= 18) return { bg: "bg-sig-pos", txt: "txt-sig-pos" };
  if (diff >= 6) return { bg: "bg-mod-pos", txt: "txt-mod-pos" };
  if (diff > -6) return { bg: "bg-neutral", txt: "txt-neutral" };
  if (diff > -18) return { bg: "bg-mod-neg", txt: "txt-mod-neg" };
  return { bg: "bg-sig-neg", txt: "txt-sig-neg" };
}

function buildTacticalCompRow({
  leftTag,
  leftVal,
  leftFmt,
  metricLabel,
  metricSub = "",
  metricTooltip = "",
  rightVal,
  rightFmt,
  rightTag,
  minVal,
  maxVal,
  leftHigherIsBetter = true,
  rightHigherIsBetter = false,
  rightMinVal = null,
  rightMaxVal = null,
}) {
  const rMin = rightMinVal !== null ? rightMinVal : minVal;
  const rMax = rightMaxVal !== null ? rightMaxVal : maxVal;

  // Convertimos cada lado a un puntaje de Fortaleza Táctica (12..98), donde más barra = unidad más dominante
  const scoreLeft = computeUnitStrengthPct(leftVal, minVal, maxVal, leftHigherIsBetter);
  const scoreRight = computeUnitStrengthPct(rightVal, rMin, rMax, rightHigherIsBetter);

  const clsL = getStrengthComparisonClasses(scoreLeft, scoreRight);
  const clsR = getStrengthComparisonClasses(scoreRight, scoreLeft);

  return `
    <div class="tactical-comp-row" title="${metricTooltip || metricLabel}">
      <div class="tc-source-tag" title="${leftTag}">${leftTag}</div>
      <div class="tc-bar-track left-track">
        <div class="tc-bar-fill ${clsL.bg}" style="width: ${scoreLeft}%"></div>
      </div>
      <div class="tc-val left-val ${clsL.txt}">
        <span>→</span> <span>${leftFmt}</span>
      </div>
      <div class="tc-metric-center-col">
        <div class="tc-metric-label">${metricLabel}</div>
        ${metricSub ? `<div class="tc-metric-sub">${metricSub}</div>` : ""}
      </div>
      <div class="tc-val right-val ${clsR.txt}">
        <span>${rightFmt}</span> <span>←</span>
      </div>
      <div class="tc-bar-track right-track">
        <div class="tc-bar-fill ${clsR.bg}" style="width: ${scoreRight}%"></div>
      </div>
      <div class="tc-source-tag right" title="${rightTag}">${rightTag}</div>
    </div>
  `;
}

function buildDirectionVerdictBadge(offTeam, defTeam, rowsConfig) {
  let totalLeft = 0;
  let totalRight = 0;
  rowsConfig.forEach((r) => {
    const rMin = r.rightMinVal !== undefined && r.rightMinVal !== null ? r.rightMinVal : r.minVal;
    const rMax = r.rightMaxVal !== undefined && r.rightMaxVal !== null ? r.rightMaxVal : r.maxVal;
    const sL = computeUnitStrengthPct(r.leftVal, r.minVal, r.maxVal, r.leftHigherIsBetter ?? true);
    const sR = computeUnitStrengthPct(r.rightVal, rMin, rMax, r.rightHigherIsBetter ?? false);
    totalLeft += sL;
    totalRight += sR;
  });
  const count = rowsConfig.length || 1;
  const avgLeft = Math.round(totalLeft / count);
  const avgRight = Math.round(totalRight / count);
  const avgDiff = (totalLeft - totalRight) / count;
  const tooltipText = `Índice de Fortaleza Táctica (escala 0% a 100% del largo de las 4 barras): Ataque ${offTeam.abbr} promedia ${avgLeft}% vs. Defensa ${defTeam.abbr} promedia ${avgRight}%. NO son puntos del marcador del partido.`;

  if (avgDiff >= 7) {
    return `<span class="dsh-verdict-badge edge-off" title="${tooltipText}">🟢 Ventaja Ataque ${offTeam.abbr} (+${Math.round(avgDiff)}% ventaja táctica)</span>`;
  }
  if (avgDiff <= -7) {
    return `<span class="dsh-verdict-badge edge-def" title="${tooltipText}">🔴 Domina Defensa ${defTeam.abbr} (+${Math.round(Math.abs(avgDiff))}% ventaja táctica)</span>`;
  }
  return `<span class="dsh-verdict-badge edge-even" title="${tooltipText}">🟡 Duelo Parejo (${avgLeft}% vs ${avgRight}%)</span>`;
}

/* ==========================================================================
   VISTA 1: PIZARRA TÁCTICA CARA A CARA EN AMBOS SENTIDOS (IDA Y VUELTA)
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

  // Actualizar textos de los botones de sentido con los nombres reales de los equipos
  const dirBtnAway = document.getElementById("dirBtnAwayOff");
  const dirBtnHome = document.getElementById("dirBtnHomeOff");
  if (dirBtnAway) dirBtnAway.textContent = `✈️ Sentido 1: Ataca ${aw.short} vs. Defiende ${hm.short}`;
  if (dirBtnHome) dirBtnHome.textContent = `🏠 Sentido 2: Ataca ${hm.short} vs. Defiende ${aw.short}`;

  // Mostrar u ocultar los cuadros explicativos inline según preferencia del usuario
  ["guideAirBlock", "guideGroundBlock", "guideSitBlock", "guideStBlock"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", !STATE.showInlineGuides);
  });

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
        <div class="mb-team-sub">VISITANTE (AWAY) · Récord (${g.away_record || aw.record}) · ${aw.div}</div>
        <div class="mb-pills-row">
          <span class="stat-mini-pill" title="Ranking general combinando ataque, defensa y equipos especiales">Rank Total #${aw.rank_total}</span>
          <span class="stat-mini-pill" title="Puntos anotados por partido">${aw.off_ppg} PPG</span>
          <span class="stat-mini-pill" title="Puntos Esperados Agregados por jugada ofensiva">EPA/jug ${aw.off_epa_play >= 0 ? "+" : ""}${aw.off_epa_play}</span>
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
        <div class="mb-team-sub">LOCAL (HOME) · Récord (${g.home_record || hm.record}) · ${hm.div}</div>
        <div class="mb-pills-row">
          <span class="stat-mini-pill" title="Ranking general combinando ataque, defensa y equipos especiales">Rank Total #${hm.rank_total}</span>
          <span class="stat-mini-pill" title="Puntos anotados por partido">${hm.off_ppg} PPG</span>
          <span class="stat-mini-pill" title="Puntos Esperados Agregados por jugada ofensiva">EPA/jug ${hm.off_epa_play >= 0 ? "+" : ""}${hm.off_epa_play}</span>
        </div>
      </div>
    </div>
  `;

  // =========================================================================
  // 2. BLOQUE 1: ATAQUE AÉREO vs. SECUNDARIA (EN AMBOS SENTIDOS)
  // =========================================================================
  document.getElementById("airLeftTitle").textContent = `✈️ SENTIDO 1: ATACA ${aw.abbr} (#${aw.rank_off} OFF) vs. DEFIENDE ${hm.abbr} (#${hm.rank_def} DEF)`;
  document.getElementById("airRightTitle").textContent = `🏠 SENTIDO 2: ATACA ${hm.abbr} (#${hm.rank_off} OFF) vs. DEFIENDE ${aw.abbr} (#${aw.rank_def} DEF)`;

  const buildAirDirectionCard = (offTeam, defTeam, dirClass, dirIcon, dirLabel) => {
    const rows = [
      {
        leftTag: `${offTeam.abbr} Ataque Pase`,
        leftVal: offTeam.off_pass_epa_play,
        leftFmt: `Genera ${offTeam.off_pass_epa_play >= 0 ? "+" : ""}${offTeam.off_pass_epa_play.toFixed(2)}`,
        metricLabel: "EPA / Dropback",
        metricSub: "👈 Pts que suma Ataque | Pts que permite Def. 👉",
        metricTooltip: "EPA por jugada de pase (RBSDM): Izquierda = puntos esperados que SUMA el ataque por pase. Derecha = puntos esperados que PERMITE (cede) la defensa rival por pase. En defensa, permitir menos es mejor.",
        rightVal: defTeam.def_pass_epa_allowed,
        rightFmt: `Cede ${defTeam.def_pass_epa_allowed >= 0 ? "+" : ""}${defTeam.def_pass_epa_allowed.toFixed(2)}`,
        rightTag: `${defTeam.abbr} Def. Pase`,
        minVal: -0.25,
        maxVal: 0.32,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false, // Para la defensa, permitir menos EPA (-0.15) es mejor que permitir +0.15
      },
      {
        leftTag: `${offTeam.abbr} Precisión QB`,
        leftVal: offTeam.off_cpoe,
        leftFmt: `Genera ${offTeam.off_cpoe >= 0 ? "+" : ""}${offTeam.off_cpoe.toFixed(1)}%`,
        metricLabel: "CPOE (Precisión)",
        metricSub: "👈 Precisión QB | Cobertura rival permite 👉",
        metricTooltip: "CPOE (Next Gen Stats): Izquierda = % de pases completos sobre lo esperado del QB atacante. Derecha = % sobre lo esperado que permite la secundaria (negativo en defensa = obliga al rival a fallar).",
        rightVal: defTeam.def_cpoe_allowed,
        rightFmt: `Cede ${defTeam.def_cpoe_allowed >= 0 ? "+" : ""}${defTeam.def_cpoe_allowed.toFixed(1)}%`,
        rightTag: `${defTeam.abbr} Cobertura`,
        minVal: -6.0,
        maxVal: 7.5,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
      {
        leftTag: `${offTeam.abbr} Bombas +20y`,
        leftVal: offTeam.off_explosive_pass_pct,
        leftFmt: `Genera ${offTeam.off_explosive_pass_pct.toFixed(1)}%`,
        metricLabel: "Pases Explosivos",
        metricSub: "👈 % bombas que logra | % bombas que permite 👉",
        metricTooltip: "Tasa de Pases Explosivos (+20 yds): Izquierda = % de pases profundos que conecta el ataque. Derecha = % de pases de +20 yds que permite la defensa (menos % = mejor secundaria).",
        rightVal: defTeam.def_explosive_pass_allowed_pct,
        rightFmt: `Cede ${defTeam.def_explosive_pass_allowed_pct.toFixed(1)}%`,
        rightTag: `${defTeam.abbr} Profundo`,
        minVal: 5.5,
        maxVal: 15.5,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
      {
        leftTag: `${offTeam.abbr} Volumen Aire`,
        leftVal: offTeam.off_pass_ypg,
        leftFmt: `Genera ${offTeam.off_pass_ypg.toFixed(0)}y`,
        metricLabel: "Yardas Aéreas / Jgo",
        metricSub: "👈 Yds ganadas/partido | Yds permitidas/partido 👉",
        metricTooltip: "Yardas de pase por partido: Izquierda = yardas por aire que produce el ataque. Derecha = yardas por aire que permite la defensa rival.",
        rightVal: defTeam.def_pass_ypg_allowed,
        rightFmt: `Cede ${defTeam.def_pass_ypg_allowed.toFixed(0)}y`,
        rightTag: `${defTeam.abbr} Yds Cedidas`,
        minVal: 155,
        maxVal: 295,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
    ];

    const verdictBadge = buildDirectionVerdictBadge(offTeam, defTeam, rows);

    return `
      <div class="direction-subcard ${dirClass}">
        <div class="direction-subcard-header">
          <div>
            <div class="dsh-title">
              <img src="${offTeam.logo}" alt="${offTeam.abbr}" />
              <span>${dirIcon} ${dirLabel}: Ataca ${offTeam.short} vs. Secundaria ${defTeam.short}</span>
              <img src="${defTeam.logo}" alt="${defTeam.abbr}" />
            </div>
            <div class="dsh-sub">Compara la potencia aérea de <strong>${offTeam.abbr} (#${offTeam.rank_off} OFF)</strong> contra lo que permite por aire <strong>${defTeam.abbr} (#${defTeam.rank_def} DEF)</strong></div>
          </div>
          ${verdictBadge}
        </div>
        <div class="direction-unit-headers">
          <span>👈 ATAQUE AÉREO ${offTeam.abbr} (Lo que produce)</span>
          <span>DUELO DIRECTO (Largo de barra = Fortaleza 0-100%)</span>
          <span>SECUNDARIA ${defTeam.abbr} (Lo que permite) 👉</span>
        </div>
        <div class="tactical-bars-list">
          ${rows.map((r) => buildTacticalCompRow(r)).join("")}
        </div>
      </div>
    `;
  };

  const airContainer = document.getElementById("airVsSecBars");
  airContainer.classList.toggle("single-dir", STATE.directionMode !== "BOTH");
  const airCards = [];
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "AWAY_OFF") {
    airCards.push(buildAirDirectionCard(aw, hm, "away-attacks", "✈️", "SENTIDO 1"));
  }
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "HOME_OFF") {
    airCards.push(buildAirDirectionCard(hm, aw, "home-attacks", "🏠", "SENTIDO 2"));
  }
  airContainer.innerHTML = airCards.join("");

  // =========================================================================
  // 3. BLOQUE 2: JUEGO TERRESTRE vs. FRONT-7 (EN AMBOS SENTIDOS)
  // =========================================================================
  document.getElementById("groundLeftTitle").textContent = `✈️ SENTIDO 1: CORRE ${aw.abbr} vs. FRONT-7 DE ${hm.abbr}`;
  document.getElementById("groundRightTitle").textContent = `🏠 SENTIDO 2: CORRE ${hm.abbr} vs. FRONT-7 DE ${aw.abbr}`;

  const buildGroundDirectionCard = (offTeam, defTeam, dirClass, dirIcon, dirLabel) => {
    const rows = [
      {
        leftTag: `${offTeam.abbr} Rush EPA`,
        leftVal: offTeam.off_rush_epa_play,
        leftFmt: `Genera ${offTeam.off_rush_epa_play >= 0 ? "+" : ""}${offTeam.off_rush_epa_play.toFixed(2)}`,
        metricLabel: "EPA / Acarreo",
        metricSub: "👈 Pts que suma Carrera | Pts que permite Caja 👉",
        metricTooltip: "EPA por acarreo terrestre: Izquierda = puntos esperados que SUMA el ataque por corrida. Derecha = puntos esperados que PERMITE el Front-7 rival por corrida.",
        rightVal: defTeam.def_rush_epa_allowed,
        rightFmt: `Cede ${defTeam.def_rush_epa_allowed >= 0 ? "+" : ""}${defTeam.def_rush_epa_allowed.toFixed(2)}`,
        rightTag: `${defTeam.abbr} Def. Tierra`,
        minVal: -0.22,
        maxVal: 0.16,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
      {
        leftTag: `${offTeam.abbr} Yds Tierra`,
        leftVal: offTeam.off_rush_ypg,
        leftFmt: `Genera ${offTeam.off_rush_ypg.toFixed(1)}y`,
        metricLabel: "Rush Yds / Partido",
        metricSub: "👈 Yds ganadas/partido | Yds permitidas/partido 👉",
        metricTooltip: "Yardas terrestres por partido: Izquierda = yardas por tierra que genera el ataque. Derecha = yardas por tierra que permite el Front-7 rival.",
        rightVal: defTeam.def_rush_ypg_allowed,
        rightFmt: `Cede ${defTeam.def_rush_ypg_allowed.toFixed(1)}y`,
        rightTag: `${defTeam.abbr} Muro Front-7`,
        minVal: 75,
        maxVal: 170,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
      {
        leftTag: `${offTeam.abbr} +10 Yds %`,
        leftVal: offTeam.off_explosive_rush_pct,
        leftFmt: `Genera ${offTeam.off_explosive_rush_pct.toFixed(1)}%`,
        metricLabel: "Acarreos Explosivos",
        metricSub: "👈 % corridas +10y | % corridas +10y permitidas 👉",
        metricTooltip: "Porcentaje de acarreos que ganan 10 o más yardas: Izquierda = lo que genera el ataque terrestre. Derecha = lo que permite la defensa.",
        rightVal: defTeam.def_explosive_rush_allowed_pct,
        rightFmt: `Cede ${defTeam.def_explosive_rush_allowed_pct.toFixed(1)}%`,
        rightTag: `${defTeam.abbr} Contención`,
        minVal: 6.0,
        maxVal: 16.5,
        leftHigherIsBetter: true,
        rightHigherIsBetter: false,
      },
      {
        leftTag: `${offTeam.abbr} Avance/Jug`,
        leftVal: offTeam.off_ypp,
        leftFmt: `Genera ${offTeam.off_ypp.toFixed(1)} YPP`,
        metricLabel: "Trincheras & TFL",
        metricSub: "👈 Yardas/Jugada OFF | Tackles para pérdida DEF 👉",
        metricTooltip: "Compara el avance promedio por jugada ofensiva (YPP) contra la capacidad del Front-7 rival para penetrar y derribar detrás de la línea (TFL = Tackles for Loss).",
        rightVal: defTeam.def_tfl,
        rightFmt: `Logra ${defTeam.def_tfl} TFL`,
        rightTag: `${defTeam.abbr} Penetración`,
        minVal: 4.3,
        maxVal: 6.6,
        leftHigherIsBetter: true,
        rightHigherIsBetter: true,
        rightMinVal: 18,
        rightMaxVal: 52,
      },
    ];

    const verdictBadge = buildDirectionVerdictBadge(offTeam, defTeam, rows);

    return `
      <div class="direction-subcard ${dirClass}">
        <div class="direction-subcard-header">
          <div>
            <div class="dsh-title">
              <img src="${offTeam.logo}" alt="${offTeam.abbr}" />
              <span>${dirIcon} ${dirLabel}: Corre ${offTeam.short} vs. Front-7 ${defTeam.short}</span>
              <img src="${defTeam.logo}" alt="${defTeam.abbr}" />
            </div>
            <div class="dsh-sub">Compara el ataque terrestre de <strong>${offTeam.abbr}</strong> contra la línea defensiva y linebackers de <strong>${defTeam.abbr}</strong></div>
          </div>
          ${verdictBadge}
        </div>
        <div class="direction-unit-headers">
          <span>👈 ATAQUE TERRESTRE ${offTeam.abbr} (Lo que produce)</span>
          <span>DUELO DIRECTO (Largo de barra = Fortaleza 0-100%)</span>
          <span>FRONT-7 ${defTeam.abbr} (Lo que permite / TFL) 👉</span>
        </div>
        <div class="tactical-bars-list">
          ${rows.map((r) => buildTacticalCompRow(r)).join("")}
        </div>
      </div>
    `;
  };

  const groundContainer = document.getElementById("groundVsFrontBars");
  groundContainer.classList.toggle("single-dir", STATE.directionMode !== "BOTH");
  const groundCards = [];
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "AWAY_OFF") {
    groundCards.push(buildGroundDirectionCard(aw, hm, "away-attacks", "✈️", "SENTIDO 1"));
  }
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "HOME_OFF") {
    groundCards.push(buildGroundDirectionCard(hm, aw, "home-attacks", "🏠", "SENTIDO 2"));
  }
  groundContainer.innerHTML = groundCards.join("");

  // =========================================================================
  // 4. BLOQUE 3: MAPA DE 3 ZONAS DEL CAMPO EN AMBOS SENTIDOS (BOLSILLO, 3ER DOWN, ZONA ROJA) + ENTREGAS
  // =========================================================================
  document.getElementById("sitLeftTitle").textContent = `✈️ SENTIDO 1: ${aw.abbr} CON EL BALÓN vs. DEFENSA ${hm.abbr}`;
  document.getElementById("sitRightTitle").textContent = `🏠 SENTIDO 2: ${hm.abbr} CON EL BALÓN vs. DEFENSA ${aw.abbr}`;

  const buildSituationalFieldCard = (offTeam, defTeam, dirClass, dirIcon, dirLabel) => {
    // ZONA 1: Bolsillo y Protección del QB (menor % de sacks permitidos por OL es mejor para el ataque; mayor % de sacks generados por Pass Rush es mejor para la defensa)
    const sackRiskAvg = (offTeam.off_sack_rate_allowed + defTeam.def_sack_rate) / 2;
    const pocketZoneClass = sackRiskAvg <= 6.2 ? "zone-green" : sackRiskAvg <= 7.8 ? "zone-yellow" : "zone-red";
    const pocketVerdict =
      sackRiskAvg <= 6.2
        ? `🟢 BOLSILLO LIMPIO: Ventaja OL de ${offTeam.abbr}`
        : sackRiskAvg <= 7.8
        ? `🟡 PRESIÓN MEDIA: Duelo parejo en trincheras`
        : `🔴 PELIGRO DE CAPTURA: Pass Rush de ${defTeam.abbr} domina`;

    // ZONA 2: Mediocampo y 3er Down (mayor % de conversión ofensiva y mayor % cedido por la defensa rival favorece al ataque)
    const thirdDownEdge = (offTeam.off_3d_pct + defTeam.def_3d_pct) / 2;
    const thirdZoneClass = thirdDownEdge >= 42.5 ? "zone-green" : thirdDownEdge >= 37.5 ? "zone-yellow" : "zone-red";
    const thirdVerdict =
      thirdDownEdge >= 42.5
        ? `🟢 ATAQUE MUEVE CADENAS (${offTeam.abbr} convierte 3er Down)`
        : thirdDownEdge >= 37.5
        ? `🟡 3ER DOWN DISPUTADO (Promedio NFL: 39%)`
        : `🔴 DEFENSA FRENA SERIES (${defTeam.abbr} fuerza despeje)`;

    // ZONA 3: Zona Roja (Últimas 20 yardas: % de visitas que terminan en Touchdown de 7 puntos en vez de Gol de Campo de 3 puntos)
    const rzEdge = (offTeam.off_rz_td_pct + defTeam.def_rz_td_pct) / 2;
    const rzZoneClass = rzEdge >= 58.0 ? "zone-green" : rzEdge >= 50.0 ? "zone-yellow" : "zone-red";
    const rzVerdict =
      rzEdge >= 58.0
        ? `🟢 ALTA LETALIDAD DE TD (${offTeam.abbr} define con 7 pts)`
        : rzEdge >= 50.0
        ? `🟡 ZONA ROJA PAREJA (Promedio NFL: 55%)`
        : `🔴 MURALLA ROJA (${defTeam.abbr} obliga a patear FG de 3 pts)`;

    return `
      <div class="direction-subcard ${dirClass}">
        <div class="direction-subcard-header">
          <div>
            <div class="dsh-title">
              <img src="${offTeam.logo}" alt="${offTeam.abbr}" />
              <span>${dirIcon} ${dirLabel}: Mapa del Campo cuando Ataca ${offTeam.short} vs. Defensa ${defTeam.short}</span>
              <img src="${defTeam.logo}" alt="${defTeam.abbr}" />
            </div>
            <div class="dsh-sub">Recorrido de la ofensiva de <strong>${offTeam.abbr}</strong> avanzando de izquierda a derecha ➡️ a través de las <strong>3 Zonas Clave</strong> frente a la defensa de <strong>${defTeam.abbr}</strong></div>
          </div>
        </div>

        <div class="field-zones-diagram">
          <!-- ZONA 1: BOLSILLO Y PASS RUSH -->
          <div class="fz-zone-box ${pocketZoneClass}">
            <div>
              <div class="fz-zone-header">
                <span class="fz-zone-name">1️⃣ ZONA DE BOLSILLO (PASS RUSH)</span>
                <span class="fz-zone-yardline">Trincheras</span>
              </div>
              <div class="fz-zone-desc" style="margin-top:4px;">
                ¿La Línea Ofensiva (OL) de <strong>${offTeam.abbr}</strong> protege a su QB o el Pass Rush de <strong>${defTeam.abbr}</strong> lo captura?
              </div>
            </div>
            <div class="fz-zone-stats-row">
              <div class="fz-stat-col">
                <span>${offTeam.off_sack_rate_allowed.toFixed(1)}%</span>
                <small>OL ${offTeam.abbr} permite Sacks</small>
              </div>
              <div style="font-size:10px; color:#64748b;">VS</div>
              <div class="fz-stat-col right">
                <span>${defTeam.def_sack_rate.toFixed(1)}% (${defTeam.def_sacks})</span>
                <small>Pass Rush ${defTeam.abbr} (${defTeam.def_qb_hits} Hits)</small>
              </div>
            </div>
            <div class="fz-zone-verdict">${pocketVerdict}</div>
          </div>

          <!-- ZONA 2: MEDIOCAMPO Y 3ER DOWN -->
          <div class="fz-zone-box ${thirdZoneClass}">
            <div>
              <div class="fz-zone-header">
                <span class="fz-zone-name">2️⃣ MEDIOCAMPO (3ER DOWN)</span>
                <span class="fz-zone-yardline">Yarda 20 a 20</span>
              </div>
              <div class="fz-zone-desc" style="margin-top:4px;">
                En 3ra oportunidad, ¿<strong>${offTeam.abbr}</strong> logra el 1er Down para seguir avanzando o <strong>${defTeam.abbr}</strong> lo detiene?
              </div>
            </div>
            <div class="fz-zone-stats-row">
              <div class="fz-stat-col">
                <span>${offTeam.off_3d_pct.toFixed(1)}%</span>
                <small>Éxito 3er Down ${offTeam.abbr}</small>
              </div>
              <div style="font-size:10px; color:#64748b;">VS</div>
              <div class="fz-stat-col right">
                <span>${defTeam.def_3d_pct.toFixed(1)}%</span>
                <small>3er Down que cede ${defTeam.abbr}</small>
              </div>
            </div>
            <div class="fz-zone-verdict">${thirdVerdict}</div>
          </div>

          <!-- ZONA 3: ZONA ROJA (ÚLTIMAS 20 YARDAS) -->
          <div class="fz-zone-box ${rzZoneClass}">
            <div>
              <div class="fz-zone-header">
                <span class="fz-zone-name">3️⃣ ZONA ROJA (TOUCHDOWN %)</span>
                <span class="fz-zone-yardline">Yarda 20 a Gol</span>
              </div>
              <div class="fz-zone-desc" style="margin-top:4px;">
                Al pisar la yarda 20 rival, ¿qué % de veces <strong>${offTeam.abbr}</strong> anota <strong>Touchdown (7 pts)</strong> en vez de Gol de Campo (3 pts)?
              </div>
            </div>
            <div class="fz-zone-stats-row">
              <div class="fz-stat-col">
                <span>${offTeam.off_rz_td_pct.toFixed(1)}%</span>
                <small>TD % en Zona Roja ${offTeam.abbr}</small>
              </div>
              <div style="font-size:10px; color:#64748b;">VS</div>
              <div class="fz-stat-col right">
                <span>${defTeam.def_rz_td_pct.toFixed(1)}%</span>
                <small>TD % que permite ${defTeam.abbr}</small>
              </div>
            </div>
            <div class="fz-zone-verdict">${rzVerdict}</div>
          </div>
        </div>
      </div>
    `;
  };

  const sitCards = [];
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "AWAY_OFF") {
    sitCards.push(buildSituationalFieldCard(aw, hm, "away-attacks", "✈️", "SENTIDO 1"));
  }
  if (STATE.directionMode === "BOTH" || STATE.directionMode === "HOME_OFF") {
    sitCards.push(buildSituationalFieldCard(hm, aw, "home-attacks", "🏠", "SENTIDO 2"));
  }

  const awTurnCls = aw.turnover_margin > 0 ? "txt-sig-pos" : aw.turnover_margin < 0 ? "txt-sig-neg" : "txt-neutral";
  const hmTurnCls = hm.turnover_margin > 0 ? "txt-sig-pos" : hm.turnover_margin < 0 ? "txt-sig-neg" : "txt-neutral";

  document.getElementById("situationalGrid").innerHTML = `
    <div class="situational-two-way-wrapper">
      <div class="two-way-matchup-grid ${STATE.directionMode !== "BOTH" ? "single-dir" : ""}">
        ${sitCards.join("")}
      </div>

      <div class="turnover-summary-strip">
        <div class="tss-side">
          <img src="${aw.logo}" alt="${aw.abbr}" style="width:28px; height:28px;" />
          <div>
            <div style="font-size:12px; font-weight:900;">
              ${aw.abbr} Margen de Entregas: <span class="${awTurnCls}">${aw.turnover_margin >= 0 ? "+" : ""}${aw.turnover_margin}</span>
            </div>
            <div style="font-size:10.5px; color:#475569;">
              Robos de balón (Takeaways): <strong>${aw.def_takeaways}</strong> (${aw.def_int} Intercepciones) · Pérdidas (Giveaways): <strong>${aw.off_giveaways}</strong>
            </div>
          </div>
        </div>

        <div class="tss-center">
          <strong>🏈 SEGURIDAD DEL BALÓN (TURNOVER MARGIN)</strong>
          <span>Balance entre balones robados por la defensa y balones perdidos por el ataque</span>
        </div>

        <div class="tss-side right">
          <div>
            <div style="font-size:12px; font-weight:900;">
              ${hm.abbr} Margen de Entregas: <span class="${hmTurnCls}">${hm.turnover_margin >= 0 ? "+" : ""}${hm.turnover_margin}</span>
            </div>
            <div style="font-size:10.5px; color:#475569;">
              Robos de balón (Takeaways): <strong>${hm.def_takeaways}</strong> (${hm.def_int} Intercepciones) · Pérdidas (Giveaways): <strong>${hm.off_giveaways}</strong>
            </div>
          </div>
          <img src="${hm.logo}" alt="${hm.abbr}" style="width:28px; height:28px;" />
        </div>
      </div>
    </div>
  `;

  // =========================================================================
  // 5. BLOQUE 4: EQUIPOS ESPECIALES DETALLADOS (KICKING, PUNTING, RETURNS & DVOA RANK)
  // =========================================================================
  const stLeftEl = document.getElementById("stLeftTitle");
  const stRightEl = document.getElementById("stRightTitle");
  if (stLeftEl) stLeftEl.textContent = `✈️ ${aw.abbr} EQUIPOS ESPECIALES (RANK #${aw.rank_st} DE 32 EN NFL)`;
  if (stRightEl) stRightEl.textContent = `🏠 ${hm.abbr} EQUIPOS ESPECIALES (RANK #${hm.rank_st} DE 32 EN NFL)`;

  const kickingRows = [
    {
      leftTag: `${aw.abbr} Acierto FG`,
      leftVal: aw.fg_pct,
      leftFmt: `${aw.fg_pct.toFixed(1)}% (${aw.fg_made}/${aw.fg_att})`,
      metricLabel: "Efectividad FG %",
      metricSub: "% Goles de Campo (3 pts) acertados",
      metricTooltip: "Porcentaje de Goles de Campo convertidos sobre el total de intentos (entre paréntesis: anotados/intentados). Promedio NFL: ~85%.",
      rightVal: hm.fg_pct,
      rightFmt: `${hm.fg_pct.toFixed(1)}% (${hm.fg_made}/${hm.fg_att})`,
      rightTag: `${hm.abbr} Acierto FG`,
      minVal: 68,
      maxVal: 100,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
    {
      leftTag: `${aw.abbr} Larga Dist.`,
      leftVal: aw.fg_50_plus,
      leftFmt: `${aw.fg_50_plus} de +50 yds`,
      metricLabel: "Goles de +50 Yardas",
      metricSub: "Patadas de larga distancia anotadas",
      metricTooltip: "Cantidad de Goles de Campo convertidos desde 50 o más yardas de distancia en la temporada (muestra potencia y alcance de pierna del pateador).",
      rightVal: hm.fg_50_plus,
      rightFmt: `${hm.fg_50_plus} de +50 yds`,
      rightTag: `${hm.abbr} Larga Dist.`,
      minVal: 0,
      maxVal: 7,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
  ];

  const puntingRows = [
    {
      leftTag: `${aw.abbr} Despeje Neto`,
      leftVal: aw.punt_net_avg,
      leftFmt: `${aw.punt_net_avg.toFixed(1)} yds`,
      metricLabel: "Promedio Neto (Net Avg)",
      metricSub: "Yardas de despeje menos devolución",
      metricTooltip: "Yardas netas que gana el equipo en cada despeje de 4to down (distancia del despeje menos las yardas que regresa el rival). Élite NFL: +43.5 yardas.",
      rightVal: hm.punt_net_avg,
      rightFmt: `${hm.punt_net_avg.toFixed(1)} yds`,
      rightTag: `${hm.abbr} Despeje Neto`,
      minVal: 37.5,
      maxVal: 46.5,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
    {
      leftTag: `${aw.abbr} Encierros`,
      leftVal: aw.punt_in20_pct,
      leftFmt: `${aw.punt_in20_pct.toFixed(1)}%`,
      metricLabel: "Encierro Dentro de la 20",
      metricSub: "% despejes que dejan al rival < yd 20",
      metricTooltip: "In-20 %: Porcentaje de patadas de despeje que caen y se detienen antes de la yarda 20 del rival, obligándolo a recorrer más de 80 yardas para anotar.",
      rightVal: hm.punt_in20_pct,
      rightFmt: `${hm.punt_in20_pct.toFixed(1)}%`,
      rightTag: `${hm.abbr} Encierros`,
      minVal: 22,
      maxVal: 55,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
  ];

  const returnsAndRankRows = [
    {
      leftTag: `${aw.abbr} Regreso Punt`,
      leftVal: aw.pr_avg,
      leftFmt: `${aw.pr_avg.toFixed(1)} yds/dev`,
      metricLabel: "Devolución de Despeje (PR Avg)",
      metricSub: "Yardas ganadas al devolver un Punt",
      metricTooltip: "Punt Return Average (PFR): Yardas promedio que gana el regresador cada vez que atrapa y devuelve una patada de despeje del rival. Promedio NFL: ~9.5 yardas.",
      rightVal: hm.pr_avg,
      rightFmt: `${hm.pr_avg.toFixed(1)} yds/dev`,
      rightTag: `${hm.abbr} Regreso Punt`,
      minVal: 5.0,
      maxVal: 16.5,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
    {
      leftTag: `${aw.abbr} Regreso Salida`,
      leftVal: aw.kr_avg,
      leftFmt: `${aw.kr_avg.toFixed(1)} yds/dev`,
      metricLabel: "Devolución de Salida (KR Avg)",
      metricSub: "Yardas ganadas en patada inicial (Kickoff)",
      metricTooltip: "Kickoff Return Average (PFR): Yardas promedio ganadas al devolver la patada inicial después de recibir puntos. Promedio NFL con el nuevo Dynamic Kickoff: ~26 yardas.",
      rightVal: hm.kr_avg,
      rightFmt: `${hm.kr_avg.toFixed(1)} yds/dev`,
      rightTag: `${hm.abbr} Regreso Salida`,
      minVal: 20.0,
      maxVal: 33.0,
      leftHigherIsBetter: true,
      rightHigherIsBetter: true,
    },
    {
      leftTag: `${aw.abbr} Ranking NFL`,
      leftVal: aw.rank_st,
      leftFmt: `#${aw.rank_st} NFL (${aw.st_index >= 0 ? "+" : ""}${aw.st_index})`,
      metricLabel: "Ranking Global ST (DVOA)",
      metricSub: "Puesto #1 (mejor) a #32 (peor) en la NFL",
      metricTooltip: "Posición entre las 32 franquicias de la NFL combinando pateo, despejes, devoluciones y cobertura (estilo FTN DVOA). El puesto #1 es el mejor equipo especial de la liga.",
      rightVal: hm.rank_st,
      rightFmt: `#${hm.rank_st} NFL (${hm.st_index >= 0 ? "+" : ""}${hm.st_index})`,
      rightTag: `${hm.abbr} Ranking NFL`,
      minVal: 1,
      maxVal: 32,
      leftHigherIsBetter: false,
      rightHigherIsBetter: false,
    },
  ];

  const buildStVerdict = (rowsConfig, phaseLabel) => {
    let totalDiff = 0;
    rowsConfig.forEach((r) => {
      const sL = computeUnitStrengthPct(r.leftVal, r.minVal, r.maxVal, r.leftHigherIsBetter ?? true);
      const sR = computeUnitStrengthPct(r.rightVal, r.minVal, r.maxVal, r.rightHigherIsBetter ?? true);
      totalDiff += sL - sR;
    });
    const avgDiff = totalDiff / (rowsConfig.length || 1);
    if (avgDiff >= 6) {
      return `<span class="dsh-verdict-badge edge-off">🟢 Ventaja ${phaseLabel}: ${aw.abbr} (+${Math.round(avgDiff)} pts)</span>`;
    }
    if (avgDiff <= -6) {
      return `<span class="dsh-verdict-badge edge-off">🟢 Ventaja ${phaseLabel}: ${hm.abbr} (+${Math.round(Math.abs(avgDiff))} pts)</span>`;
    }
    return `<span class="dsh-verdict-badge edge-even">🟡 ${phaseLabel} Parejos</span>`;
  };

  const kickVerdict = buildStVerdict(kickingRows, "Pateador");
  const puntVerdict = buildStVerdict(puntingRows, "Despejes");
  const retVerdict = buildStVerdict(returnsAndRankRows, "Retornos y Ranking ST");

  document.getElementById("specialTeamsGauges").innerHTML = `
    <div class="st-phase-grid">
      <!-- TARJETA 1: KICKING (PATEO A LOS POSTES) -->
      <div class="st-phase-card">
        <div class="st-phase-header">
          <div>
            <div class="st-phase-title">🎯 1. KICKING: PATEO A LOS POSTES (GOLES DE CAMPO — 3 PUNTOS)</div>
            <div class="st-phase-desc">
              Compara la puntería de cada pateador (<strong>FG %</strong>) y cuántos goles de campo metieron desde <strong>más de 50 yardas</strong> (datos de <em>Pro Football Reference</em>).
            </div>
          </div>
          ${kickVerdict}
        </div>
        <div class="direction-unit-headers">
          <span>👈 PATEADOR ${aw.abbr}</span>
          <span>ESTADÍSTICA Y QUÉ MIDE</span>
          <span>PATEADOR ${hm.abbr} 👉</span>
        </div>
        <div class="tactical-bars-list">
          ${kickingRows.map((r) => buildTacticalCompRow(r)).join("")}
        </div>
      </div>

      <!-- TARJETA 2: PUNTING (DESPEJES Y POSICIÓN DE CAMPO) -->
      <div class="st-phase-card">
        <div class="st-phase-header">
          <div>
            <div class="st-phase-title">🦵 2. PUNTING: DESPEJES EN 4TO DOWN Y ENCIERRO RIVAL</div>
            <div class="st-phase-desc">
              Cuando el ataque no logra avanzar y despeja con el pie en 4to down: ¿quién patea más lejos (<strong>Net Avg</strong>) y encierra más veces al rival antes de su yarda 20 (<strong>In-20 %</strong>)?
            </div>
          </div>
          ${puntVerdict}
        </div>
        <div class="direction-unit-headers">
          <span>👈 DESPEJADOR ${aw.abbr}</span>
          <span>ESTADÍSTICA Y QUÉ MIDE</span>
          <span>DESPEJADOR ${hm.abbr} 👉</span>
        </div>
        <div class="tactical-bars-list">
          ${puntingRows.map((r) => buildTacticalCompRow(r)).join("")}
        </div>
      </div>

      <!-- TARJETA 3: DEVOLUCIONES (RETURNS) Y RANKING GLOBAL DVOA (#1 A #32) -->
      <div class="st-phase-card full-span">
        <div class="st-phase-header">
          <div>
            <div class="st-phase-title">⚡ 3. RETURNS (DEVOLUCIONES DE PATADA) Y RANKING GLOBAL DVOA (#1 A #32 NFL)</div>
            <div class="st-phase-desc">
              Compara las yardas ganadas al devolver despejes (<strong>PR Avg</strong>), al devolver la patada inicial (<strong>KR Avg</strong>) y la posición general <strong>#1 a #32 en toda la NFL</strong> (según índice compuesto <em>DVOA / TeamRankings</em>, donde <strong>#1 es el mejor</strong> de los 32 equipos).
            </div>
          </div>
          ${retVerdict}
        </div>
        <div class="direction-unit-headers">
          <span>👈 UNIDAD ESPECIAL ${aw.abbr} (TDs de retorno: ${aw.st_tds})</span>
          <span>ESTADÍSTICA Y QUÉ MIDE</span>
          <span>UNIDAD ESPECIAL ${hm.abbr} (TDs de retorno: ${hm.st_tds}) 👉</span>
        </div>
        <div class="tactical-bars-list">
          ${returnsAndRankRows.map((r) => buildTacticalCompRow(r)).join("")}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   VISTA 2: TABLA DE LAS 32 FRANQUICIAS & SIMULADOR LIBRE
   ========================================================================== */
function populateSimulatorSelects() {
  if (!STATE.data) return;
  const teamsArr = Object.values(STATE.data.teams).sort((a, b) => a.name.localeCompare(b.name));
  const opts = teamsArr.map((t) => `<option value="${t.abbr}">${t.abbr} — ${t.name} (#${t.rank_total})</option>`).join("");

  [
    ["simTeamAway", "simTeamHome"],
    ["quickSimAway", "quickSimHome"],
  ].forEach(([awayId, homeId]) => {
    const selA = document.getElementById(awayId);
    const selH = document.getElementById(homeId);
    if (selA && selH) {
      selA.innerHTML = opts;
      selH.innerHTML = opts;
      if (teamsArr.length > 1) {
        selA.value = "KC";
        selH.value = "BUF";
      }
    }
  });
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
   VISTA 3: JUGADORES (SCOUTING HUB — EXPLICACIONES Y FÓRMULAS POR MÉTRICA)
   ========================================================================== */
const PLAYER_METRIC_EXPLAINERS = {
  // Quarterbacks (QB)
  "Yds Pase": {
    sub: "Yardas totales por aire",
    tip: "Suma total de yardas ganadas en todos los pases completados por el Quarterback en la temporada.",
  },
  "TD / INT": {
    sub: "Pases de TD vs Intercepciones",
    tip: "Relación entre pases de Touchdown anotados y pases interceptados por la defensa rival. Ideal: al menos 3 TDs por cada 1 INT.",
  },
  "EPA/Dropback": {
    sub: "Puntos esperados por pase",
    tip: "Fórmula: EPA Total de Pase ÷ (Intentos de Pase + Capturas sufridas). Mide cuántos puntos reales suma el QB cada vez que retrocede a lanzar.",
  },
  "CPOE": {
    sub: "% completos sobre lo esperado",
    tip: "Fórmula: % Real de Pases Completos − % Esperado según sensores NGS (distancia del tiro, separación del receptor y presión al QB).",
  },
  "NGS Time to Throw": {
    sub: "Segundos en soltar el balón",
    tip: "Tiempo promedio en segundos (medido con chips RFID de Next Gen Stats) desde el snap hasta que el QB lanza el balón. Promedio NFL: ~2.75s.",
  },
  "PFR On-Target %": {
    sub: "% tiros precisos a las manos",
    tip: "Fórmula (Pro Football Reference): Pases precisos al blanco ÷ Total de pases lanzados (sin contar balones tirados afuera deliberadamente). Promedio NFL: ~75%.",
  },
  "PFR Pressure %": {
    sub: "% jugadas bajo acoso defensivo",
    tip: "Fórmula (PFR): (Apresuramientos + Golpes al QB + Capturas) ÷ Total de Dropbacks. Mide en qué % de jugadas el QB lanzó presionado.",
  },
  "Yds Tierra": {
    sub: "Yardas ganadas corriendo",
    tip: "Total de yardas avanzadas por vía terrestre en acarreos.",
  },

  // Running Backs (RB)
  "Acarreos": {
    sub: "Corridas totales con el balón",
    tip: "Cantidad total de veces que el jugador recibió el balón en mano para correr por tierra.",
  },
  "Yds/Acarreo": {
    sub: "Yardas ÷ Acarreos (YPC)",
    tip: "Fórmula: Yardas Terrestres Totales ÷ Total de Acarreos. Promedio NFL: ~4.3 yardas por corrida.",
  },
  "TDs Tierra": {
    sub: "Touchdowns por carrera",
    tip: "Cantidad de veces que el corredor ingresó a la zona de anotación acarreando el balón.",
  },
  "EPA/Acarreo": {
    sub: "Puntos esperados por corrida",
    tip: "Fórmula: EPA Terrestre Total ÷ Acarreos. Mide si las corridas del jugador aumentan la probabilidad de anotar según down y distancia.",
  },
  "NGS RYOE/Att": {
    sub: "Yardas extra sobre el bloqueo",
    tip: "Rush Yards Over Expected per Attempt (Next Gen Stats): (Yardas Reales − Yardas Esperadas según ubicación/velocidad de bloqueadores y defensores) ÷ Acarreos. Mide cuántas yardas extra crea el RB por sí solo.",
  },
  "NGS Caja 8+ Def": {
    sub: "% corridas vs 8+ defensores",
    tip: "Porcentaje de acarreos en los que la defensa rival puso 8 o más jugadores dentro de la 'caja' (frente a la línea) para frenar la carrera.",
  },
  "Target Share": {
    sub: "% de pases del equipo hacia él",
    tip: "Fórmula: (Pases lanzados a este jugador ÷ Total de pases lanzados por su equipo) × 100. Mide qué tan seguido el QB lo busca.",
  },

  // Wide Receivers & Tight Ends (WR / TE)
  "Recepciones / Tgts": {
    sub: "Atrapados ÷ Pases buscados",
    tip: "Cantidad de pases atrapados (Recepciones) sobre el total de veces que el QB lanzó hacia él (Targets).",
  },
  "Yds Recepción": {
    sub: "Yardas totales tras atrapar",
    tip: "Total de yardas ganadas en pases atrapados (incluye yardas en el aire + yardas corridas después de la recepción).",
  },
  "TDs": {
    sub: "Touchdowns de recepción",
    tip: "Pases atrapados que terminaron en Touchdown.",
  },
  "Air Yards Share": {
    sub: "% yardas aéreas del equipo",
    tip: "Fórmula: (Yardas que viajó el balón por el aire hacia este jugador ÷ Total de yardas aéreas lanzadas por el equipo) × 100. Indica quién es la amenaza profunda.",
  },
  "WOPR (Opportunity)": {
    sub: "1.5×Target% + 0.7×AirYds%",
    tip: "Weighted Opportunity Rating (PlayerProfiler): Se calcula como (1.5 × Target Share) + (0.7 × Air Yards Share). Es la métrica reina para medir el rol ofensivo de un receptor (> 0.60 es estrella #1).",
  },
  "EPA/Target": {
    sub: "Puntos esperados por pase buscado",
    tip: "Fórmula: EPA de Recepción Total ÷ Targets. Mide cuántos puntos esperados genera cada vez que el QB decide lanzarle a este receptor.",
  },
  "NGS Separation": {
    sub: "Distancia al defensor al atrapar",
    tip: "Separación promedio en yardas (medida con sensores RFID de Next Gen Stats) entre el receptor y el defensor más cercano cuando llega el pase. Promedio NFL: ~2.8 yds.",
  },

  // Defensores (DEF)
  "Sacks": {
    sub: "Capturas al QB atrás de la línea",
    tip: "Veces que el defensor derriba al Quarterback rival detrás de la línea de golpeo antes de que pueda lanzar.",
  },
  "QB Hits": {
    sub: "Golpes al QB al lanzar",
    tip: "Veces que el defensor derriba o impacta legalmente al QB rival justo después de soltar el pase.",
  },
  "Tackles For Loss": {
    sub: "Derribos para pérdida de yardas",
    tip: "TFL: Tacleadas realizadas detrás de la línea de golpeo que hacen retroceder al corredor o receptor rival.",
  },
  "Tackles Solo": {
    sub: "Tacleadas individuales sin ayuda",
    tip: "Derribos defensivos completados íntegramente por este jugador sin asistencia de otro compañero.",
  },
  "Intercepciones": {
    sub: "Pases rivales robados en el aire",
    tip: "Pases del QB rival atrapados por el defensor que cambian inmediatamente la posesión del balón.",
  },
  "Pases Defendidos": {
    sub: "Pases desviados en cobertura",
    tip: "Pases rivales que el defensor logra manotear, desviar o romper en el aire para evitar la recepción.",
  },
  "PFR Pressures": {
    sub: "Sacks + Golpes + Apresuramientos",
    tip: "Fórmula (Pro Football Reference): Sacks + QB Hits + Hurries (veces que obligó al QB a lanzar antes de tiempo o huir del bolsillo).",
  },
  "PFR Rating Permitido": {
    sub: "Rating QB rival al lanzarle (↓ mejor)",
    tip: "Índice de pasador (0 a 158.3) que consiguen los QBs rivales cuando lanzan hacia el receptor cubierto por este defensor. ¡Cuanto MÁS BAJO mejor! (< 75.0 es cobertura élite).",
  },
};

function getPosPercentileExplanation(pos, pctl) {
  if (pos === "QB") return `Percentil ${pctl} entre los QBs NFL (calculado por EPA/Dropback: supera al ${pctl}% de los mariscales).`;
  if (pos === "RB") return `Percentil ${pctl} entre los RBs NFL (calculado por producción terrestre y eficiencia: supera al ${pctl}% de los corredores).`;
  if (pos === "WR" || pos === "TE") return `Percentil ${pctl} entre los ${pos}s NFL (calculado por yardas y volumen de recepción: supera al ${pctl}% de su posición).`;
  return `Percentil ${pctl} entre los Defensores NFL (calculado por Puntaje de Impacto: Sacks×3 + Hits×1.2 + TFL×1.5 + INT×3.5 + PD×1 + Tackles×0.25).`;
}

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
      const pctlTip = getPosPercentileExplanation(p.pos, p.percentile);

      const metricsHtml = Object.entries(p.metrics || {})
        .map(([k, v]) => {
          const exp = PLAYER_METRIC_EXPLAINERS[k] || { sub: "Métrica oficial 2026", tip: k };
          return `
            <div class="psc-metric-item" title="${exp.tip}">
              <div class="psc-metric-label-wrap">
                <span>${k} ℹ️</span>
                <small class="psc-metric-sub">${exp.sub}</small>
              </div>
              <strong>${v}</strong>
            </div>
          `;
        })
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
              <div class="psc-meta">${p.pos} · ${p.team} · ${p.games} partidos jugados</div>
            </div>
            <div class="psc-percentile-badge" style="background:${badgeBg}; cursor:help;" title="${pctlTip}">
              Pctl ${p.percentile} ℹ️
              <small style="display:block; font-size:9px; font-weight:600; opacity:0.92;">Top ${Math.max(1, 100 - p.percentile)}% ${p.pos}</small>
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
function parseNewsEpochMs(pubStr) {
  if (!pubStr) return 0;
  if (pubStr === "Recién actualizado") return Date.now();
  const parsed = Date.parse(pubStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatNewsPublishedLabel(pubStr) {
  if (!pubStr) return "Hoy";
  if (pubStr === "Recién actualizado") return "Recién actualizado";
  const ms = Date.parse(pubStr);
  if (Number.isNaN(ms)) return String(pubStr).slice(0, 22);
  try {
    const dt = new Date(ms);
    return dt.toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " ART";
  } catch (_) {
    return String(pubStr).slice(0, 22);
  }
}

function getImpactTierMeta(score) {
  const s = Number(score || 50);
  if (s >= 90) {
    return {
      cls: "critical",
      cardCls: "tier-critical",
      label: `🔥 Impacto Crítico · ${s}/99 pts`,
      tooltip: "Impacto Crítico (90 a 99 pts): Lesión grave/IR de titular, cambio de QB o traspaso confirmado con efecto inmediato en la línea del partido.",
    };
  }
  if (s >= 75) {
    return {
      cls: "high",
      cardCls: "tier-high",
      label: `⚡ Impacto Alto · ${s}/99 pts`,
      tooltip: "Impacto Alto (75 a 89 pts): Reporte médico relevante, movimiento de roster titular o ajuste salarial importante.",
    };
  }
  return {
    cls: "relevant",
    cardCls: "tier-relevant",
    label: `📊 Impacto Relevante · ${s}/99 pts`,
    tooltip: "Impacto Relevante (25 a 74 pts): Tendencia táctica, actualización de plantilla o análisis salarial que superó el filtro mínimo de 25 pts.",
  };
}

function renderNewsGrid() {
  const grid = document.getElementById("newsCardsGrid");
  if (!grid || !STATE.data) return;

  const catFilter = document.getElementById("filterNewsCategory")?.value || "ALL";
  const srcFilter = document.getElementById("filterNewsSource")?.value || "ALL";
  const sortOrder = document.getElementById("sortNewsOrder")?.value || "impact_desc";

  const list = (STATE.data.news || [])
    .filter((n) => {
      const matchCat = catFilter === "ALL" || (n.category || "").toLowerCase().includes(catFilter.toLowerCase());
      const matchSrc = srcFilter === "ALL" || n.source === srcFilter;
      return matchCat && matchSrc;
    })
    .slice();

  list.sort((a, b) => {
    if (sortOrder === "recent_desc") {
      const diffTime = parseNewsEpochMs(b.published) - parseNewsEpochMs(a.published);
      if (diffTime !== 0) return diffTime;
      return Number(b.impact_score || 0) - Number(a.impact_score || 0);
    }
    if (sortOrder === "team_asc") {
      const tA = (a.team || "ZZZ").toUpperCase();
      const tB = (b.team || "ZZZ").toUpperCase();
      if (tA !== tB) return tA.localeCompare(tB);
      return Number(b.impact_score || 0) - Number(a.impact_score || 0);
    }
    if (sortOrder === "source_asc") {
      const sA = (a.source || "").toLowerCase();
      const sB = (b.source || "").toLowerCase();
      if (sA !== sB) return sA.localeCompare(sB);
      return Number(b.impact_score || 0) - Number(a.impact_score || 0);
    }
    // Por defecto: impact_desc (Mayor Puntaje de Impacto 99 -> 25 pts, desempate por más reciente)
    const diffScore = Number(b.impact_score || 0) - Number(a.impact_score || 0);
    if (diffScore !== 0) return diffScore;
    return parseNewsEpochMs(b.published) - parseNewsEpochMs(a.published);
  });

  grid.innerHTML = list
    .map((n, idx) => {
      const tier = getImpactTierMeta(n.impact_score);
      const teamLabel = n.team ? `🏈 Equipo: ${n.team}` : "🏈 NFL General";
      const timeLabel = formatNewsPublishedLabel(n.published);
      return `
      <article class="news-impact-card ${tier.cardCls}">
        <div>
          <div class="nic-header">
            <div class="nic-left-badges">
              <span class="nic-rank-badge" title="Posición #${idx + 1} según el orden seleccionado">#${idx + 1}</span>
              <span class="nic-source">${n.source}</span>
            </div>
            <span class="nic-impact-pill ${tier.cls}" title="${tier.tooltip}">${tier.label}</span>
          </div>
          <div class="nic-meta-row">
            <span class="nic-team-chip">${teamLabel} · ${n.category}</span>
            <span class="nic-time-chip" title="Fecha/hora original: ${n.published || ""}">🕒 ${timeLabel}</span>
          </div>
          <h4 style="margin-top:8px;">${n.title}</h4>
          <p style="margin-top:5px;">${n.summary}</p>
        </div>
        <div class="nic-footer">
          <a href="${n.url}" target="_blank" class="ext-source-chip">🔗 Leer nota original</a>
          <button class="btn-primary-sm btn-news-to-tip" data-newsid="${n.id}">📲 Armar Post para X</button>
        </div>
      </article>
    `;
    })
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
   VISTA 6: GUÍA DETALLADA Y DICCIONARIO DE ESTADÍSTICAS NFL (22 MÉTRICAS)
   ========================================================================== */
const NFL_STATS_GLOSSARY = [
  {
    term: "EPA / Jugada y EPA / Dropback (Puntos Esperados Agregados)",
    category: "ATAQUE AÉREO & GENERAL",
    source: "RBSDM / nflfastR",
    what_is_it:
      "Mide cuántos puntos reales le suma (o le resta) cada jugada a la probabilidad de anotar de un equipo según el down, la distancia y la yarda del campo. Un pase de 8 yardas en 3ra y 7 vale mucho más (+EPA) que un pase de 8 yardas en 3ra y 18 (-EPA).",
    how_to_read:
      "En Ataque: cuanto MÁS ALTO y POSITIVO mejor (+0.15 es élite). En Defensa ('EPA Permitido / Cede'): cuanto MÁS BAJO y NEGATIVO mejor (-0.12 significa que la defensa le quita puntos esperados al ataque rival en cada jugada).",
    scale_elite: "🟢 Élite: +0.12 a +0.25 (Ataque) | -0.08 a -0.20 (Defensa)",
    scale_avg: "🟡 Promedio NFL: -0.02 a +0.05",
    scale_poor: "🔴 Débil: Menor a -0.08 (Ataque) | Mayor a +0.08 (Defensa)",
    tactical_example: "Ejemplo: Si el ataque aéreo visitante tiene +0.16 EPA/Dropback y la secundaria local cede +0.10 EPA, el QB visitante tiene ventaja significativa.",
  },
  {
    term: "CPOE (Completion Percentage Over Expected — Precisión Real)",
    category: "ATAQUE AÉREO vs. SECUNDARIA",
    source: "NFL Next Gen Stats / RBSDM",
    what_is_it:
      "Calcula qué porcentaje de pases completa un Quarterback por encima (o por debajo) de lo esperado según la dificultad real del pase (distancia aérea, separación del receptor, presión al QB y cercanía a las bandas).",
    how_to_read:
      "Un CPOE de +4.5% significa que si por la dificultad de los tiros se esperaba que completara el 63%, en realidad completó el 67.5%. En defensa, un CPOE permitido negativo (-3.0%) indica una secundaria que fuerza pases incómodos e incompletos.",
    scale_elite: "🟢 Élite: +3.5% a +7.5% (QB) | Menor a -2.5% (Defensa)",
    scale_avg: "🟡 Promedio NFL: -0.5% a +2.0%",
    scale_poor: "🔴 Impreciso / Vulnerable: Menor a -2.0% (QB) | Mayor a +2.5% (Defensa)",
    tactical_example: "Ejemplo: No es lo mismo completar pases cortos de 2 yardas que pases de 25 yardas en ventana cerrada; el CPOE premia la precisión difícil.",
  },
  {
    term: "Pases Explosivos (+20 Yardas %)",
    category: "ATAQUE AÉREO vs. SECUNDARIA",
    source: "Sharp Football Analysis / NFL Savant",
    what_is_it:
      "Porcentaje de jugadas aéreas que consiguen una ganancia de 20 o más yardas en un solo tiro. Es el indicador número uno de capacidad de anotar rápido (Big Plays).",
    how_to_read:
      "En ataque, superar el 11% indica un ataque vertical letal. En defensa ('Cede %'), permitir más de 11% significa que los safeties y esquineros sufren desconexiones en cobertura profunda.",
    scale_elite: "🟢 Élite: 11.5% o más (Ataque) | 7.5% o menos (Defensa)",
    scale_avg: "🟡 Promedio NFL: 8.5% a 10.5%",
    scale_poor: "🔴 Débil: Menos de 7.5% (Ataque) | Más de 11.5% (Defensa)",
    tactical_example: "Ejemplo: Cuando un equipo con 13% de pases explosivos enfrenta a una secundaria que cede 12%, hay altísimo riesgo de Touchdown largo.",
  },
  {
    term: "EPA / Acarreo (Rushing EPA)",
    category: "JUEGO TERRESTRE vs. FRONT-7",
    source: "RBSDM / SumerSports",
    what_is_it:
      "Mide la eficiencia en puntos esperados de cada corrida por tierra. En la NFL moderna, correr suele ser menos eficiente que pasar, por lo que el promedio de la liga en acarreos ronda -0.05 EPA/jugada.",
    how_to_read:
      "Cualquier ataque terrestre con EPA/Acarreo cercano a 0.00 o positivo (+0.04 a +0.12) es dominante y controla el reloj. Una defensa Front-7 élite mantiene al rival en -0.12 o menos.",
    scale_elite: "🟢 Élite: +0.02 a +0.14 (Ataque) | -0.12 o mejor (Defensa)",
    scale_avg: "🟡 Promedio NFL: -0.08 a +0.01",
    scale_poor: "🔴 Débil: Menor a -0.11 (Ataque) | Mayor a 0.00 (Defensa)",
    tactical_example: "Ejemplo: Un ataque con +0.06 EPA/Acarreo obliga a la defensa a bajar un safety a la caja, abriendo el pase profundo.",
  },
  {
    term: "RYOE y Acarreos Explosivos (+10 Yardas %)",
    category: "JUEGO TERRESTRE vs. FRONT-7",
    source: "Next Gen Stats / PlayerProfiler",
    what_is_it:
      "RYOE (Rush Yards Over Expected) mide cuántas yardas extra gana el corredor por su cuenta después de lo que le bloqueó su línea ofensiva. Los Acarreos Explosivos (+10 Yds %) miden qué porcentaje de corridas superan las 10 yardas.",
    how_to_read:
      "Separa el mérito de la línea ofensiva del talento del Running Back para romper tacleadas. Más de 12% de acarreos de +10 yardas indica un ataque terrestre capaz de romper el partido.",
    scale_elite: "🟢 Élite: 12.5% o más (+10 Yds) | RYOE +0.8 yds/acarreo",
    scale_avg: "🟡 Promedio NFL: 9.5% a 11.5%",
    scale_poor: "🔴 Débil: Menos de 8.0% (Ataque) | Cede más de 12.5% (Defensa)",
    tactical_example: "Ejemplo: Corredores como Saquon Barkley o Bijan Robinson generan yardas extra incluso cuando el Front-7 cierra el hueco inicial.",
  },
  {
    term: "Trincheras: YPP (Yardas por Jugada) vs. TFL (Tackles Para Pérdida)",
    category: "JUEGO TERRESTRE & TRINCHERAS",
    source: "Pro Football Reference / PFF",
    what_is_it:
      "YPP mide el avance promedio del ataque en cada jugada. TFL (Tackles For Loss) cuenta cuántas veces la línea defensiva y los linebackers penetran la línea de golpeo y derriban al corredor o receptor detrás de la línea (pérdida de yardas).",
    how_to_read:
      "Si una ofensiva promedia 6.0+ YPP domina el ritmo; pero si enfrenta a un Front-7 con más de 38 TFL acumulados, corre riesgo de quedar en 2da y 13 o 3ra y largo.",
    scale_elite: "🟢 Élite: 5.8+ YPP (Ataque) | 38+ TFL (Defensa)",
    scale_avg: "🟡 Promedio NFL: 5.1 a 5.6 YPP | 28 a 35 TFL",
    scale_poor: "🔴 Débil: Menos de 4.8 YPP | Menos de 24 TFL",
    tactical_example: "Ejemplo: Un TFL en 1er Down reduce a menos de la mitad la probabilidad de que esa serie ofensiva consiga un 1er Down.",
  },
  {
    term: "Zona 1 del Mapa: Bolsillo — Sacks Permitidos OL % vs. Pass Rush Sack %",
    category: "ZONA ROJA, 3ER DOWN & BOLSILLO",
    source: "Next Gen Stats / PFF / PFR",
    what_is_it:
      "Evalúa el duelo en la trinchera de pase: 'OL Sacks Permitidos %' es el porcentaje de intentos de pase en los que la Línea Ofensiva deja que capturen a su QB. 'Pass Rush Sack %' es el porcentaje de jugadas en que la defensa rival logra capturar al QB.",
    how_to_read:
      "Para la Línea Ofensiva (OL), MENOS porcentaje es mejor (menos de 5.5% es un bolsillo limpio 🟢). Para el Pass Rush defensivo, MÁS porcentaje es mejor (más de 8.0% es presión devastadora 🔴 para el ataque).",
    scale_elite: "🟢 Bolsillo Limpio: OL permite < 5.5% | Pass Rush élite: genera > 8.0%",
    scale_avg: "🟡 Promedio NFL: 6.0% a 7.5% de capturas",
    scale_poor: "🔴 Peligro de Captura: OL permite > 8.5% de Sacks",
    tactical_example: "Ejemplo: Si una OL cede 9.5% de sacks y enfrenta a un Pass Rush de 9.0%, el mapa marca Zona 1 en ROJO (Alerta de Captura).",
  },
  {
    term: "Zona 2 del Mapa: Mediocampo — Conversión de 3er Down %",
    category: "ZONA ROJA, 3ER DOWN & BOLSILLO",
    source: "TeamRankings / Sharp Football",
    what_is_it:
      "Porcentaje de veces que el ataque logra las yardas necesarias en 3ra oportunidad para conseguir un nuevo 1er Down ('mover las cadenas') y mantener la posesión de la pelota.",
    how_to_read:
      "En Ataque: más de 43% es élite (series largas que agotan al rival 🟢). En Defensa ('3er Down que cede'): permitir menos de 35% indica una defensa que obliga a despejar rápido (🔴 frena al ataque).",
    scale_elite: "🟢 Élite: 43% o más (Ataque) | Cede 35% o menos (Defensa)",
    scale_avg: "🟡 Promedio NFL: 38% a 41%",
    scale_poor: "🔴 Débil: Menos de 35% (Ataque) | Cede más de 44% (Defensa)",
    tactical_example: "Ejemplo: Ganar la Zona 2 (Mediocampo) permite dominar el tiempo de posesión y llegar descansado al último cuarto.",
  },
  {
    term: "Zona 3 del Mapa: Zona Roja — Eficiencia de Touchdown (RZ TD %)",
    category: "ZONA ROJA, 3ER DOWN & BOLSILLO",
    source: "TeamRankings / Pro Football Reference",
    what_is_it:
      "La Zona Roja comprende las últimas 20 yardas antes de la zona de anotación rival (Yarda 20 hasta la línea de gol). Esta estadística mide qué porcentaje de visitas a la Zona Roja terminan en TOUCHDOWN (6-7 puntos) en lugar de conformarse con un Gol de Campo (3 puntos) o perder el balón.",
    how_to_read:
      "No mide goles de campo: mide exclusivamente letalidad de Touchdown. Si el ataque tiene 64% RZ TD y la defensa rival permite 62%, la Zona 3 se pinta de VERDE (Alta letalidad de 7 puntos). Si la defensa permite menos de 48%, se pinta de ROJO (Muralla que fuerza goles de campo).",
    scale_elite: "🟢 Élite: 60% o más de TD (Ataque) | Permite menos de 48% (Defensa)",
    scale_avg: "🟡 Promedio NFL: 52% a 58% de visitas terminan en TD",
    scale_poor: "🔴 Baja definición: Menos de 48% (Ataque) | Permite más de 62% (Defensa)",
    tactical_example: "Ejemplo: En partidos cerrados, cambiar dos goles de campo (6 pts) por dos touchdowns (14 pts) en Zona Roja define el ganador.",
  },
  {
    term: "Seguridad del Balón: Margen de Entregas (Turnover Margin)",
    category: "ZONA ROJA, 3ER DOWN & BOLSILLO",
    source: "Pro Football Reference / ESPN",
    what_is_it:
      "Es la resta exacta entre los balones robados por la defensa (Takeaways = Intercepciones + Fumbles recuperados) y los balones regalados por el propio ataque (Giveaways = Intercepciones lanzadas + Fumbles perdidos).",
    how_to_read:
      "Un margen positivo (+5 o más) significa que el equipo roba muchos más balones de los que pierde y suele ganar el campo corto. Un margen negativo (-4 o peor) indica alto riesgo de entregas fatales.",
    scale_elite: "🟢 Élite: +5 a +12 en la temporada",
    scale_avg: "🟡 Neutral: -2 a +3",
    scale_poor: "🔴 Peligroso: -4 o peor",
    tactical_example: "Ejemplo: En la NFL, el equipo que gana el duelo de entregas de balón en un partido tiene un 77% de probabilidad histórica de victoria.",
  },
  {
    term: "DVOA Total (Defense-Adjusted Value Over Average)",
    category: "TABLA 32 EQUIPOS & RANKINGS",
    source: "FTN Fantasy (creado por Aaron Schatz)",
    what_is_it:
      "Compara el éxito de un equipo en cada jugada de la temporada contra el promedio de la NFL, ajustando por la dificultad del calendario (qué tan fuertes fueron las defensas o ataques rivales que enfrentó) y la situación del partido.",
    how_to_read:
      "Se expresa en porcentaje donde 0.0% es un equipo promedio de la NFL. En DVOA Total y Ofensivo, cuanto más positivo mejor (+20% es candidato al Super Bowl).",
    scale_elite: "🟢 Candidato Élite: +15.0% a +30.0%",
    scale_avg: "🟡 Promedio NFL: -5.0% a +8.0%",
    scale_poor: "🔴 Reconstrucción: Menor a -12.0%",
    tactical_example: "Ejemplo: Un equipo con récord 4-2 pero DVOA de +22% es estadísticamente mucho más peligroso que un 5-1 con DVOA de -4%.",
  },
  {
    term: "Equipos Especiales: FG %, +50 Yds, Net Punt Avg e In-20 %",
    category: "EQUIPOS ESPECIALES (KICKING & PUNTING)",
    source: "FTN DVOA / TeamRankings / PFR",
    what_is_it:
      "Evalúa la tercera fase del juego: 'FG %' es el porcentaje de acierto en goles de campo; '+50 Yds' cuenta goles de campo anotados desde 50+ yardas; 'Net Punt Avg' son las yardas netas de despeje descontando la devolución; 'In-20 %' es el porcentaje de despejes que dejan al rival encerrado antes de su yarda 20.",
    how_to_read:
      "En el termómetro visual de cada barra, cuanto más a la IZQUIERDA (zona verde) se ubica el marcador negro, mejor posicionado está ese equipo en la NFL.",
    scale_elite: "🟢 Élite: FG > 90% | Net Punt > 43.5 yds | In-20 > 42%",
    scale_avg: "🟡 Promedio NFL: FG 84%-88% | Net Punt 40.5-42.5 yds",
    scale_poor: "🔴 Débil: FG < 80% | Net Punt < 39.5 yds",
    tactical_example: "Ejemplo: Ganar 8 yardas netas en cada despeje equivale a casi un 1er Down oculto gratis en cada intercambio de posesión.",
  },
  {
    term: "Scouting Jugadores: Percentil (Pctl 1 a 99) y Puntaje de Impacto",
    category: "SCOUTING DE JUGADORES (2026)",
    source: "nflverse / Next Gen Stats / PFR",
    what_is_it:
      "Ubica a cada jugador en una escala de 1 a 99 comparándolo exclusivamente contra los demás jugadores de su misma posición en la NFL. Un Pctl 94 significa que supera al 94% de la liga en su puesto.",
    how_to_read:
      "¿Cómo se calcula?: En QBs se ordena por EPA/Dropback; en RBs por Yardas Terrestres; en WRs y TEs por Yardas de Recepción; y en Defensores (DEF) por el Puntaje de Impacto Defensivo = (Sacks × 3.0) + (QB Hits × 1.2) + (TFL × 1.5) + (Intercepciones × 3.5) + (Pases Defendidos × 1.0) + (Tackles Solo × 0.25).",
    scale_elite: "🟢 Estrella Élite: Pctl 80 a 99 (Top 20% NFL)",
    scale_avg: "🟡 Titular Sólido: Pctl 50 a 79",
    scale_poor: "🔴 Rotación / Bajo: Menor a Pctl 40",
    tactical_example: "Ejemplo: Un receptor con Pctl 96 es un arma ofensiva Top-5 de toda la NFL.",
  },
  {
    term: "Scouting QB: Time to Throw, On-Target % y Pressure %",
    category: "SCOUTING DE JUGADORES (QB)",
    source: "Next Gen Stats (RFID) / Pro Football Reference",
    what_is_it:
      "Tres métricas avanzadas de mariscales: 1) 'NGS Time to Throw' mide con chips RFID los segundos promedio desde el snap hasta soltar el pase; 2) 'PFR On-Target %' calcula (Pases precisos a las manos ÷ Pases lanzados descartando spikes); 3) 'PFR Pressure %' calcula ((Apresuramientos + Golpes + Sacks) ÷ Total de Dropbacks).",
    how_to_read:
      "Un QB con On-Target > 78% y buen EPA pese a sufrir un Pressure % alto (> 25%) demuestra temple élite bajo presión.",
    scale_elite: "🟢 Élite: On-Target > 78% | Pressure sufrida < 18%",
    scale_avg: "🟡 Promedio NFL: Time to Throw ~2.75s | On-Target ~75%",
    scale_poor: "🔴 En problemas: On-Target < 71% | Pressure sufrida > 27%",
    tactical_example: "Ejemplo: Si un QB suelta el balón en 2.55s neutraliza incluso al mejor Pass Rush rival.",
  },
  {
    term: "Scouting RB: NGS RYOE/Att y Caja con 8+ Defensores %",
    category: "SCOUTING DE JUGADORES (RB)",
    source: "NFL Next Gen Stats",
    what_is_it:
      "'RYOE/Att' (Rush Yards Over Expected per Attempt) se calcula como: (Yardas Reales − Yardas Esperadas según velocidad y ubicación de los 11 bloqueadores y 11 defensores) ÷ Acarreos. 'Caja 8+ Def %' mide en qué porcentaje de corridas había 8 o más defensores cerca de la línea.",
    how_to_read:
      "Un RYOE/Att positivo (+0.60 o más) prueba que el corredor gana yardas extra por su propio talento rompiendo tacleadas, sin depender solo de su línea ofensiva.",
    scale_elite: "🟢 Élite: RYOE/Att +0.50 a +1.50 yds extra por corrida",
    scale_avg: "🟡 Promedio NFL: -0.10 a +0.35 yds/acarreo",
    scale_poor: "🔴 Bajo: Menor a -0.30 yds/acarreo",
    tactical_example: "Ejemplo: Un RB con RYOE +0.90 frente a 30% de cajas de 8+ hombres es imparable.",
  },
  {
    term: "Scouting WR/TE: Target Share, Air Yards Share, WOPR y NGS Separation",
    category: "SCOUTING DE JUGADORES (WR & TE)",
    source: "PlayerProfiler / Next Gen Stats",
    what_is_it:
      "• Target Share = Pases hacia el jugador ÷ Pases totales del equipo.\n• Air Yards Share = Yardas aéreas voladas hacia él ÷ Yardas aéreas totales del equipo.\n• WOPR (Weighted Opportunity Rating) = (1.5 × Target Share) + (0.7 × Air Yards Share).\n• NGS Separation = Yardas promedio de distancia al defensor más cercano al llegar el balón.",
    how_to_read:
      "WOPR combina volumen y profundidad en un solo número: cualquier receptor con WOPR > 0.60 y Separation > 3.0 yds es el motor aéreo indiscutido de su franquicia.",
    scale_elite: "🟢 Élite: WOPR > 0.60 | Target Share > 25% | Separation > 3.1 yds",
    scale_avg: "🟡 Promedio NFL: WOPR 0.38-0.52 | Separation ~2.8 yds",
    scale_poor: "🔴 Secundario: WOPR < 0.30 | Separation < 2.3 yds",
    tactical_example: "Ejemplo: Jaxon Smith-Njigba o CeeDee Lamb destacan cuando combinan alto WOPR con más de 3 yardas de separación.",
  },
  {
    term: "Scouting DEF: PFR Pressures y Passer Rating Permitido",
    category: "SCOUTING DE JUGADORES (DEF)",
    source: "Pro Football Reference AdvStats / PFF",
    what_is_it:
      "• PFR Pressures = Sacks (Capturas) + QB Hits (Golpes al QB) + Hurries (Apresuramientos que obligan al QB a lanzar antes o escapar).\n• PFR Rating Permitido = Índice de pasador (0 a 158.3) de los QBs rivales cuando lanzan contra la cobertura de este defensor.",
    how_to_read:
      "En Pressures, cuanto MÁS ALTO mejor (mide disrupción constante aunque no llegue al sack). En Rating Permitido, cuanto MÁS BAJO mejor (menos de 70.0 es un esquinero o safety cerrojo).",
    scale_elite: "🟢 Élite: 25+ Pressures | Rating Permitido < 72.0",
    scale_avg: "🟡 Promedio NFL: 14-20 Pressures | Rating Permitido 82.0-92.0",
    scale_poor: "🔴 Vulnerable: Rating Permitido > 102.0",
    tactical_example: "Ejemplo: Un Pass Rusher con 30+ Pressures obliga al ataque rival a dejar un ala cerrada extra bloqueando.",
  },
  {
    term: "Radar de Top News: Puntaje de Impacto (25 a 99 pts) y Ordenamiento",
    category: "RADAR DE TOP NEWS (8 PORTALES)",
    source: "Rotoworld / OTC / Spotrac / ESPN / PFT / The Athletic",
    what_is_it:
      "• Puntaje de Impacto (0 a 99 pts): Algoritmo que evalúa la gravedad táctica de cada noticia sumando puntos por términos clave: +32 pts por Trade/Titularidad (trade, waived, starter, benched), +30 pts por Parte Médico/Lesión (IR, ACL, concussion, surgery, out), +28 pts por Impacto Salarial (cap, restructure, extension), +18 a +25 pts de prioridad de fuente y +18 pts al detectar la franquicia NFL afectada.\n• Filtro Anti-Ruido: Toda nota menor a 25 pts se descarta.",
    how_to_read:
      "Por defecto las noticias se ordenan de Mayor a Menor Impacto (#1 a #N, de 99 a 25 pts) para que una nota menor recién subida nunca tape una baja crítica de último momento. Podés cambiar el orden con el selector superior a: Más Recientes Primero (Hora), Equipo NFL (A-Z) o Portal (A-Z).",
    scale_elite: "🔥 Impacto Crítico: 90 a 99 pts (Baja en IR, ACL, Trade o cambio de QB titular)",
    scale_avg: "⚡ Impacto Alto: 75 a 89 pts (Parte médico importante o movimiento de roster)",
    scale_poor: "📊 Impacto Relevante: 25 a 74 pts (Nota táctica o salarial que superó el umbral)",
    tactical_example: "Ejemplo: Una lesión de tobillo/IR de un titular reportada en Rotoworld alcanza 99/99 pts y se ubica #1 en el Radar.",
  },
];

function renderGlossaryView() {
  const grid = document.getElementById("glossaryCardsGrid");
  if (!grid) return;

  const q = (document.getElementById("searchGlossaryInput")?.value || "").trim().toLowerCase();
  const list = NFL_STATS_GLOSSARY.filter((item) => {
    if (!q) return true;
    return (
      item.term.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.what_is_it.toLowerCase().includes(q) ||
      item.how_to_read.toLowerCase().includes(q)
    );
  });

  grid.innerHTML = list
    .map(
      (item) => `
      <article class="glossary-card">
        <div class="gc-header">
          <span class="gc-cat">${item.category}</span>
          <span class="gc-source">Fuente: ${item.source}</span>
        </div>
        <h3 class="gc-title">${item.term}</h3>
        <p class="gc-what"><strong>¿Qué mide?:</strong> ${item.what_is_it}</p>
        <div class="gc-how"><strong>¿Cómo se lee en el tablero?:</strong> ${item.how_to_read}</div>
        <div class="gc-scales">
          <div class="gc-scale-pill elite">${item.scale_elite}</div>
          <div class="gc-scale-pill avg">${item.scale_avg}</div>
          <div class="gc-scale-pill poor">${item.scale_poor}</div>
        </div>
        <div class="gc-example">💡 ${item.tactical_example}</div>
      </article>
    `
    )
    .join("");
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

  // Botón para generar una nueva imagen 16:9 única y concordante con el texto del tweet (Google Gemini Nano Banana)
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
      const dynUrl = buildUniqueDynamicClayUrl(newPrompt, tip.matchup || "", st.illustration || "");
      tip.illustration = dynUrl;
      st.illustration = dynUrl;
      renderXTipsFeed();
      showToast("🎨 Asignando ilustración 3D de plastilina (Nano Banana 16:9) concordante...");
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
  showToast("✨ Nuevo Tip creado con caricatura de plastilina 16:9 (Nano Banana) concordante");
}

function createCustomTeamTip(tm) {
  const id = `tip-custom-team-${tm.abbr}-${Date.now()}`;
  const spec = TEAM_VISUAL_SPECS_JS[tm.abbr] || TEAM_VISUAL_SPECS_JS.KC;
  const [qbName, qbNum] = spec.qb;
  const [prName, prNum] = spec.pr;
  const prompt = `3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: ${spec.name} quarterback ${qbName} in ${spec.jersey} with number ${qbNum} and ${spec.helmet} throwing ONE single brown leather football alongside defensive star ${prName} (${prNum}) on the stadium turf. Handcrafted plasticine clay texture, natural anatomy.`;
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt, tm.abbr);

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
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt, pl.team);

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
  const uniqueImgUrl = buildUniqueDynamicClayUrl(prompt, nw.team || "PHI");

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

  // Selector de sentido de comparación (Ambos Sentidos / Sentido 1 / Sentido 2)
  document.querySelectorAll("#directionModePills .dir-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#directionModePills .dir-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      STATE.directionMode = pill.dataset.dir || pill.dataset.dirmode || "BOTH";
      renderMatchupBoard();
    });
  });

  // Botón para mostrar/ocultar los explicativos estadísticos inline dentro de cada bloque
  document.getElementById("btnToggleInlineGuides")?.addEventListener("click", (e) => {
    STATE.showInlineGuides = !STATE.showInlineGuides;
    const btn = e.currentTarget;
    btn.classList.toggle("off", !STATE.showInlineGuides);
    btn.textContent = STATE.showInlineGuides ? "📘 Ocultar / Ver Explicación de Estadísticas" : "📘 Explicaciones Ocultas (Clic para mostrar)";
    renderMatchupBoard();
  });

  // Botón para abrir la vista completa del Diccionario de Estadísticas
  document.getElementById("btnOpenFullGlossary")?.addEventListener("click", () => {
    switchView("glossary");
    renderGlossaryView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Buscador dentro del Diccionario de Estadísticas
  document.getElementById("searchGlossaryInput")?.addEventListener("input", renderGlossaryView);

  document.getElementById("selectWeek")?.addEventListener("change", (e) => {
    STATE.selectedWeek = Number(e.target.value);
    STATE.customMatchup = null;
    STATE.selectedGameId = null;
    renderGameRibbon();
    renderMatchupBoard();
  });

  // Selectores desplegables directos de Partido (tanto en la barra superior como dentro del Panel de Control)
  const handleGameDropdownChange = (e) => {
    const val = e.target.value;
    if (!val || val === "CUSTOM_SIM") return;
    const chosenGame = (STATE.data?.games || []).find((g) => g.id === val);
    if (chosenGame) {
      STATE.customMatchup = null;
      STATE.selectedGameId = chosenGame.id;
      if (Number(chosenGame.week) !== Number(STATE.selectedWeek)) {
        STATE.selectedWeek = Number(chosenGame.week);
        STATE.selectedSlot = "ALL";
        document.querySelectorAll("#daySlotFilterGroup .slot-pill").forEach((p) => p.classList.toggle("active", p.dataset.slot === "ALL"));
      }
      switchView("matchups");
      renderGameRibbon();
      renderMatchupBoard();
    }
  };

  document.getElementById("selectMatchupGame")?.addEventListener("change", handleGameDropdownChange);
  document.getElementById("quickSelectGame")?.addEventListener("change", handleGameDropdownChange);

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
    const uniqueImg = buildUniqueDynamicClayUrl(prompt, `${aw.abbr} @ ${hm.abbr}`);

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

  // Simulador Libre de 2 equipos (desde vista Equipos o desde la barra rápida en Panel de Control)
  document.getElementById("btnLoadSimMatchup")?.addEventListener("click", () => {
    const aw = document.getElementById("simTeamAway")?.value;
    const hm = document.getElementById("simTeamHome")?.value;
    if (aw && hm) {
      STATE.customMatchup = { away_team: aw, home_team: hm };
      switchView("matchups");
      renderGameRibbon();
      renderMatchupBoard();
      showToast(`⚔️ Pizarra Táctica abierta: ${aw} vs. ${hm}`);
    }
  });

  document.getElementById("btnQuickLoadSim")?.addEventListener("click", () => {
    const aw = document.getElementById("quickSimAway")?.value;
    const hm = document.getElementById("quickSimHome")?.value;
    if (aw && hm) {
      STATE.customMatchup = { away_team: aw, home_team: hm };
      switchView("matchups");
      renderGameRibbon();
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

  document.getElementById("btnTogglePlayerGuide")?.addEventListener("click", (e) => {
    const guideEl = document.getElementById("playerScoutingGuide");
    if (!guideEl) return;
    const isHidden = guideEl.classList.toggle("hidden");
    const btn = e.currentTarget;
    btn.classList.toggle("off", isHidden);
    btn.textContent = isHidden ? "📘 Guía de Métricas y Fórmulas: OCULTA" : "📘 Guía de Métricas y Fórmulas: VISIBLE";
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

  document.getElementById("btnToggleNewsGuide")?.addEventListener("click", (e) => {
    const guideEl = document.getElementById("newsOrderGuide");
    if (!guideEl) return;
    const isHidden = guideEl.classList.toggle("hidden");
    const btn = e.currentTarget;
    btn.classList.toggle("off", isHidden);
    btn.textContent = isHidden ? "📘 Cómo se ordenan las noticias: OCULTO" : "📘 Cómo se ordenan las noticias: VISIBLE";
  });

  document.getElementById("sortNewsOrder")?.addEventListener("change", renderNewsGrid);
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
    const uniqueImg = buildUniqueDynamicClayUrl(prompt, `${awAbbr} @ ${hmAbbr}`);

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
    const savedGeminiKey = localStorage.getItem("nfl_gemini_api_key") || "";
    const geminiInp = document.getElementById("cfgGeminiKey");
    if (geminiInp && savedGeminiKey && !geminiInp.value) geminiInp.value = savedGeminiKey;
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
    const gemini_api_key = document.getElementById("cfgGeminiKey")?.value.trim();
    if (dashboard_public_url) STATE.dashboardPublicUrl = dashboard_public_url;
    if (gemini_api_key) {
      try {
        localStorage.setItem("nfl_gemini_api_key", gemini_api_key);
      } catch (_) {}
    }
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_public_url, buffer_access_token, buffer_channel_id, gemini_api_key }),
      });
      showToast("💾 Configuración (Buffer + Gemini Nano Banana) guardada correctamente");
      document.getElementById("configModal")?.classList.add("hidden");
    } catch (_) {
      showToast("💾 Configuración guardada en sesión local");
      document.getElementById("configModal")?.classList.add("hidden");
    }
  });
});

