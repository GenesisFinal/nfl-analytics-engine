#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor Generador de Tips Técnicos y Alertas de Alto Impacto para X (Twitter).
- Domingos (Sunday Slate): 5 tips técnicos de alto impacto sobre partidos, ataques, defensas, trincheras, jugadores y equipos especiales.
- Jueves (TNF) y Lunes (MNF): 2 tips técnicos clave para el partido único de la jornada.
- Top News de Alto Impacto: Posteos listos para X sobre las noticias críticas del día.
- Incluye: Título, Contenido Técnico (<= 260 chars con link), Selector Dual de Link (Nuestra Página vs. Fuente Original) e Ilustración de Plastilina (Claymation 16:9).
"""

import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DASHBOARD_PUBLIC_URL = "https://genesisfinal.github.io/nfl-analytics-engine/"

TEAM_PAIR_CLAY = {
    frozenset(["DAL", "PHI"]): "assets/clay/clay_dal_phi.jpg",
    frozenset(["NE", "CHI"]): "assets/clay/clay_ne_chi.jpg",
    frozenset(["SF", "ATL"]): "assets/clay/clay_sf_atl.jpg",
    frozenset(["IND", "MIN"]): "assets/clay/clay_ind_min.jpg",
    frozenset(["PIT", "NO"]): "assets/clay/clay_pit_no.jpg",
    frozenset(["LA", "LV"]): "assets/clay/clay_la_lv.jpg",
}

PLAYER_TEAM_CLAY = {
    ("DET", "QB"): "assets/clay/clay_det_goff.jpg",
    ("SEA", "WR"): "assets/clay/clay_sea_jsn.jpg",
}


def get_matchup_illustration(aw_abbr: str, hm_abbr: str, default_path: str) -> str:
    return TEAM_PAIR_CLAY.get(frozenset([aw_abbr, hm_abbr]), default_path)


def trim_post_body(body: str, max_body_len: int = 215) -> str:
    """Garantiza que el cuerpo + ' 👉 ' + link de X (23 chars t.co) quede <= 258 caracteres (margen >= 22 chars)."""
    b = body.strip()
    if len(b) <= max_body_len:
        return b
    return b[: max_body_len - 1].rsplit(" ", 1)[0] + "…"


def generate_tips_from_data(data: dict) -> list:
    teams = data.get("teams", {})
    players = data.get("players", [])
    games = data.get("games", [])
    news = data.get("news", [])
    current_week = data.get("current_week", 7)

    wk_games = [g for g in games if g.get("week") == current_week]
    if not wk_games:
        wk_games = games

    tnf_games = [g for g in wk_games if g.get("day_slot") == "TNF"]
    sun_games = [g for g in wk_games if g.get("day_slot") == "SUNDAY"]
    mnf_games = [g for g in wk_games if g.get("day_slot") == "MNF"]

    tips = []

    # =========================================================================
    # 1. JUEVES (TNF) — 2 Tips Técnicos Clave del Partido del Jueves
    # =========================================================================
    if tnf_games:
        g = tnf_games[0]
        aw = teams.get(g["away_team"], {})
        hm = teams.get(g["home_team"], {})
        if aw and hm:
            tnf_img = get_matchup_illustration(aw["abbr"], hm["abbr"], "assets/clay/clay_tnf_pass_duel.jpg")
            # Tip TNF #1: Ataque Aéreo vs Secundaria
            tips.append({
                "id": f"tip-tnf-1-{g['id']}",
                "day_group": "TNF",
                "badge": "🏈 JUEVES (TNF) · ATAQUE vs DEFENSA",
                "game_id": g["id"],
                "matchup_label": f"{aw['abbr']} ({g['away_record']}) @ {hm['abbr']} ({g['home_record']})",
                "title": f"Duelo Aéreo en TNF: {aw['short']} vs. Secundaria de {hm['short']}",
                "body": trim_post_body(
                    f"🏈 Clave técnica en TNF ({aw['abbr']} vs {hm['abbr']}): el ataque aéreo de {aw['short']} registra {aw['off_pass_epa_play']:+.2f} EPA/dropback y {aw['off_cpoe']:+.1f}% CPOE, frente a una defensa de {hm['short']} que permite {hm['def_pass_epa_allowed']:+.2f} EPA/pase (#{hm['rank_def']} NFL)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g['id']}",
                "source_link": "https://rbsdm.com/stats/stats/",
                "source_name": "RBSDM / SumerSports",
                "illustration": tnf_img,
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 studio illustration of an NFL night game between "
                    f"{aw['name']} ({aw['color']} jersey) quarterback throwing a deep pass and {hm['name']} ({hm['color']} jersey) "
                    f"defensive back leaping to defend under stadium floodlights. Handcrafted plasticine texture with subtle fingerprint details, "
                    f"single coherent stadium scene, anatomically natural figures with exactly one head and two arms each, no speech bubbles."
                ),
            })
            # Tip TNF #2: Trincheras y Zona Roja
            tips.append({
                "id": f"tip-tnf-2-{g['id']}",
                "day_group": "TNF",
                "badge": "🛡️ JUEVES (TNF) · TRINCHERAS & ZONA ROJA",
                "game_id": g["id"],
                "matchup_label": f"{aw['abbr']} ({g['away_record']}) @ {hm['abbr']} ({g['home_record']})",
                "title": f"Guerra de Trincheras y Zona Roja: {aw['short']} vs. {hm['short']}",
                "body": trim_post_body(
                    f"🛡️ En las trincheras de TNF: {hm['short']} genera {hm['def_sack_rate']:.1f}% de capturas ({hm['def_sacks']} sacks) y convierte {hm['off_rz_td_pct']:.1f}% de TDs en Zona Roja, mientras {aw['short']} concede presión en el {aw['off_sack_rate_allowed']:.1f}% de sus dropbacks."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g['id']}",
                "source_link": "https://www.teamrankings.com/nfl/stat/red-zone-scoring-pct",
                "source_name": "TeamRankings / PFR",
                "illustration": tnf_img,
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of {aw['name']} vs {hm['name']} "
                    f"clashing at the line of scrimmage in the red zone near the 10-yard line. Rich handcrafted clay textures, studio lighting, "
                    f"each player with a single head and natural anatomy, no dialogue bubbles."
                ),
            })

    # =========================================================================
    # 2. DOMINGO (SUNDAY SLATE) — 5 Tips Técnicos de Alto Impacto
    # =========================================================================
    if sun_games:
        # Evaluar desajustes tácticos en los partidos del domingo
        scored_sun = []
        for g in sun_games:
            aw = teams.get(g["away_team"], {})
            hm = teams.get(g["home_team"], {})
            if not aw or not hm:
                continue
            pass_mismatch = abs(aw["off_pass_epa_play"] - hm["def_pass_epa_allowed"]) + abs(hm["off_pass_epa_play"] - aw["def_pass_epa_allowed"])
            rush_mismatch = abs(aw["off_rush_epa_play"] - hm["def_rush_epa_allowed"]) + abs(hm["off_rush_epa_play"] - aw["def_rush_epa_allowed"])
            trench_mismatch = abs(hm["def_sack_rate"] - aw["off_sack_rate_allowed"]) + abs(aw["def_sack_rate"] - hm["off_sack_rate_allowed"])
            rz_mismatch = abs(hm["off_rz_td_pct"] - aw["def_rz_td_pct"])
            st_mismatch = abs(hm["st_index"] - aw["st_index"])
            scored_sun.append((pass_mismatch + rush_mismatch, pass_mismatch, rush_mismatch, trench_mismatch, rz_mismatch, st_mismatch, g, aw, hm))

        scored_sun.sort(key=lambda x: x[0], reverse=True)

        # Tip Domingo #1: Mayor desajuste aéreo (EPA/Dropback & Explosivos)
        if len(scored_sun) >= 1:
            _, _, _, _, _, _, g1, aw1, hm1 = scored_sun[0]
            best_off = aw1 if aw1["off_pass_epa_play"] >= hm1["off_pass_epa_play"] else hm1
            opp_def = hm1 if best_off == aw1 else aw1
            tips.append({
                "id": f"tip-sun-1-{g1['id']}",
                "day_group": "SUNDAY",
                "badge": "🔥 DOMINGO (#1/5) · ATAQUE AÉREO",
                "game_id": g1["id"],
                "matchup_label": f"{aw1['abbr']} @ {hm1['abbr']}",
                "title": f"Ventaja Aérea Explosiva: {best_off['short']} contra {opp_def['short']}",
                "body": trim_post_body(
                    f"🔥 Ventaja táctica del domingo ({aw1['abbr']} vs {hm1['abbr']}): {best_off['short']} promedia {best_off['off_pass_epa_play']:+.2f} EPA/pase (#{best_off['rank_off']} ataque NFL) y {best_off['off_explosive_pass_pct']:.1f}% de pases de +20 yds ante una defensa de {opp_def['short']} que cede {opp_def['def_pass_ypg_allowed']:.0f} yds aéreas/partido."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g1['id']}",
                "source_link": "https://www.sharpfootballanalysis.com/stats-nfl/",
                "source_name": "Sharp Football / RBSDM",
                "illustration": get_matchup_illustration(aw1["abbr"], hm1["abbr"], "assets/clay/clay_sunday_air_attack.jpg"),
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of a {best_off['name']} wide receiver making an acrobatic "
                    f"one-handed catch over a {opp_def['name']} defender on a sunny Sunday NFL field. Handcrafted clay texture, natural anatomy."
                ),
            })

        # Tip Domingo #2: Dominio Terrestre & Front-7
        by_rush = sorted(scored_sun, key=lambda x: x[2], reverse=True)
        if len(by_rush) >= 1:
            g2, aw2, hm2 = by_rush[0][6], by_rush[0][7], by_rush[0][8]
            rush_tm = aw2 if aw2["off_rush_ypg"] >= hm2["off_rush_ypg"] else hm2
            def_tm = hm2 if rush_tm == aw2 else aw2
            tips.append({
                "id": f"tip-sun-2-{g2['id']}",
                "day_group": "SUNDAY",
                "badge": "🏃 DOMINGO (#2/5) · JUEGO TERRESTRE",
                "game_id": g2["id"],
                "matchup_label": f"{aw2['abbr']} @ {hm2['abbr']}",
                "title": f"Choque Terrestre: {rush_tm['short']} ({rush_tm['off_rush_ypg']:.0f} YPG) vs. Front-7 de {def_tm['short']}",
                "body": trim_post_body(
                    f"🏃 El duelo terrestre del domingo ({aw2['abbr']} vs {hm2['abbr']}): {rush_tm['short']} corre para {rush_tm['off_rush_ypg']:.1f} yds/partido ({rush_tm['off_rush_epa_play']:+.2f} EPA/acarreo y {rush_tm['off_explosive_rush_pct']:.1f}% de acarreos +10 yds) frente al Front-7 de {def_tm['short']} ({def_tm['def_tfl']} TFLs)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g2['id']}",
                "source_link": "https://sumersports.com/teams/offensive/",
                "source_name": "SumerSports / Next Gen Stats",
                "illustration": get_matchup_illustration(aw2["abbr"], hm2["abbr"], "assets/clay/clay_sunday_ground_game.jpg"),
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 scene of a {rush_tm['name']} running back breaking through the line of scrimmage "
                    f"with stiff-arm energy against {def_tm['name']} linebackers. Vibrant plasticine texture, studio lighting, single coherent field."
                ),
            })

        # Tip Domingo #3: Presión al QB en Trincheras (Pass Rush vs Protección)
        by_trench = sorted(scored_sun, key=lambda x: x[3], reverse=True)
        if len(by_trench) >= 1:
            g3, aw3, hm3 = by_trench[0][6], by_trench[0][7], by_trench[0][8]
            rush_def = hm3 if hm3["def_sack_rate"] >= aw3["def_sack_rate"] else aw3
            prot_off = aw3 if rush_def == hm3 else hm3
            tips.append({
                "id": f"tip-sun-3-{g3['id']}",
                "day_group": "SUNDAY",
                "badge": "⚡ DOMINGO (#3/5) · PASS RUSH & BOLSILLO",
                "game_id": g3["id"],
                "matchup_label": f"{aw3['abbr']} @ {hm3['abbr']}",
                "title": f"Alerta en el Bolsillo: Pass Rush de {rush_def['short']} vs. OL de {prot_off['short']}",
                "body": trim_post_body(
                    f"⚡ Alerta de presión en {aw3['abbr']} vs {hm3['abbr']}: la defensa de {rush_def['short']} registra {rush_def['def_sacks']} capturas ({rush_def['def_sack_rate']:.1f}% sack rate y {rush_def['def_qb_hits']} golpes al QB) contra una línea ofensiva de {prot_off['short']} que permite capturas en el {prot_off['off_sack_rate_allowed']:.1f}%."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g3['id']}",
                "source_link": "https://www.pro-football-reference.com/years/2026/",
                "source_name": "Pro Football Reference / PFF",
                "illustration": get_matchup_illustration(aw3["abbr"], hm3["abbr"], "assets/clay/clay_trenches_clash.jpg"),
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of a {rush_def['name']} defensive end sacking the {prot_off['name']} "
                    f"quarterback in the pocket. Detailed plasticine sculpture texture, dramatic stadium lighting, natural single-head anatomy."
                ),
            })

        # Tip Domingo #4: Eficiencia Situacional (3er Down & Zona Roja)
        by_rz = sorted(scored_sun, key=lambda x: x[4], reverse=True)
        if len(by_rz) >= 1:
            g4, aw4, hm4 = by_rz[0][6], by_rz[0][7], by_rz[0][8]
            rz_team = hm4 if hm4["off_rz_td_pct"] >= aw4["off_rz_td_pct"] else aw4
            opp_rz = aw4 if rz_team == hm4 else hm4
            tips.append({
                "id": f"tip-sun-4-{g4['id']}",
                "day_group": "SUNDAY",
                "badge": "🎯 DOMINGO (#4/5) · ZONA ROJA & 3ER DOWN",
                "game_id": g4["id"],
                "matchup_label": f"{aw4['abbr']} @ {hm4['abbr']}",
                "title": f"Eficacia Quirúrgica en Zona Roja: {rz_team['short']} ({rz_team['off_rz_td_pct']:.1f}%)",
                "body": trim_post_body(
                    f"🎯 Dato situacional clave ({aw4['abbr']} vs {hm4['abbr']}): {rz_team['short']} convierte en TD el {rz_team['off_rz_td_pct']:.1f}% de sus visitas a Zona Roja y el {rz_team['off_3d_pct']:.1f}% en 3er down, enfrentando a {opp_rz['short']} que permite {opp_rz['def_rz_td_pct']:.1f}% en Red Zone."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g4['id']}",
                "source_link": "https://www.teamrankings.com/nfl/stat/red-zone-scoring-pct",
                "source_name": "TeamRankings / NFL Savant",
                "illustration": get_matchup_illustration(aw4["abbr"], hm4["abbr"], "assets/clay/clay_redzone_coach.jpg"),
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of {aw4['name']} vs {hm4['name']} in the red zone "
                    f"with players battling near the goal line. Warm handcrafted plasticine style."
                ),
            })

        # Tip Domingo #5: Equipos Especiales & Posición de Campo (FTN DVOA / Punting & FG)
        by_st = sorted(scored_sun, key=lambda x: x[5], reverse=True)
        if len(by_st) >= 1:
            g5, aw5, hm5 = by_st[0][6], by_st[0][7], by_st[0][8]
            st_team = hm5 if hm5["st_index"] >= aw5["st_index"] else aw5
            tips.append({
                "id": f"tip-sun-5-{g5['id']}",
                "day_group": "SUNDAY",
                "badge": "🦵 DOMINGO (#5/5) · EQUIPOS ESPECIALES",
                "game_id": g5["id"],
                "matchup_label": f"{aw5['abbr']} @ {hm5['abbr']}",
                "title": f"El Factor Oculto en Equipos Especiales: {st_team['short']} (#{st_team['rank_st']} NFL)",
                "body": trim_post_body(
                    f"🦵 Ventaja oculta en Equipos Especiales ({aw5['abbr']} vs {hm5['abbr']}): {st_team['short']} es #{st_team['rank_st']} de la NFL con {st_team['fg_pct']:.1f}% en goles de campo ({st_team['fg_50_plus']} de +50 yds) y {st_team['punt_net_avg']:.1f} yds netas por despeje ({st_team['punt_in20_pct']:.0f}% dentro de la 20)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g5['id']}",
                "source_link": "https://ftnfantasy.com/stats/nfl/team-total-dvoa",
                "source_name": "FTN Fantasy DVOA / PFR",
                "illustration": get_matchup_illustration(aw5["abbr"], hm5["abbr"], "assets/clay/clay_special_teams_kick.jpg"),
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of a {st_team['name']} kicker booting a long 55-yard field goal "
                    f"straight through the yellow uprights in a packed NFL stadium. Handcrafted plasticine texture, studio lighting."
                ),
            })

    # =========================================================================
    # 3. LUNES (MNF) — 2 Tips Técnicos Clave del Partido del Lunes
    # =========================================================================
    if mnf_games:
        gm = mnf_games[0]
        aw = teams.get(gm["away_team"], {})
        hm = teams.get(gm["home_team"], {})
        if aw and hm:
            mnf_img = get_matchup_illustration(aw["abbr"], hm["abbr"], "assets/clay/clay_dal_phi.jpg")
            tips.append({
                "id": f"tip-mnf-1-{gm['id']}",
                "day_group": "MNF",
                "badge": "🌙 LUNES (MNF) · TRINCHERAS & EFICIENCIA GLOBAL",
                "game_id": gm["id"],
                "matchup_label": f"{aw['abbr']} ({gm['away_record']}) @ {hm['abbr']} ({gm['home_record']})",
                "title": f"Monday Night Football en Trincheras: {aw['short']} (#{aw['rank_total']}) vs. {hm['short']} (#{hm['rank_total']})",
                "body": trim_post_body(
                    f"🌙 Choque de trincheras en MNF ({aw['abbr']} @ {hm['abbr']}): {hm['short']} promedia {hm['off_ppg']:.1f} pts/partido ({hm['off_epa_play']:+.2f} EPA/jugada y {hm['def_sack_rate']:.1f}% sack rate) frente a {aw['short']} ({aw['off_pass_ypg']:.0f} yds aéreas/partido y {aw['def_takeaways']} takeaways)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{gm['id']}",
                "source_link": "https://ftnfantasy.com/stats/nfl/team-total-dvoa",
                "source_name": "FTN DVOA / RBSDM",
                "illustration": mnf_img,
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of {aw['name']} vs {hm['name']} clashing at the line of scrimmage."
                ),
            })
            tips.append({
                "id": f"tip-mnf-2-{gm['id']}",
                "day_group": "MNF",
                "badge": "📊 LUNES (MNF) · TENDENCIA SITUACIONAL",
                "game_id": gm["id"],
                "matchup_label": f"{aw['abbr']} ({gm['away_record']}) @ {hm['abbr']} ({gm['home_record']})",
                "title": f"Ritmo y 3er Down en MNF: {aw['short']} vs. {hm['short']}",
                "body": trim_post_body(
                    f"📊 El filtro de 3er Down en MNF ({aw['abbr']} vs {hm['abbr']}): {hm['short']} convierte el {hm['off_3d_pct']:.1f}% de sus terceros intentos ({hm['off_ypp']:.2f} yds/jugada), mientras {aw['short']} registra {aw['off_3d_pct']:.1f}% en 3er down y {aw['off_rz_td_pct']:.1f}% de TD en Zona Roja."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{gm['id']}",
                "source_link": "https://nextgenstats.nfl.com/",
                "source_name": "NFL Next Gen Stats / TeamRankings",
                "illustration": mnf_img,
                "clay_prompt": (
                    f"3D claymation (caricatura de plastilina) 16:9 illustration of {aw['name']} vs {hm['name']} clashing at the line of scrimmage on 3rd down during Monday Night Football."
                ),
            })

    # =========================================================================
    # 4. SCOUTING DE JUGADORES ÉLITE (Líderes 2026 en NGS / PlayerProfiler / PFR)
    # =========================================================================
    top_qbs = [p for p in players if p["pos"] == "QB"]
    top_wrs = [p for p in players if p["pos"] == "WR"]
    if top_qbs:
        qb = top_qbs[0]
        qb_img = PLAYER_TEAM_CLAY.get((qb["team"], "QB"), "assets/clay/clay_det_goff.jpg")
        tips.append({
            "id": f"tip-player-qb-{qb['id']}",
            "day_group": "SUNDAY",
            "badge": "⭐ JUGADOR DESTACADO · QB ANALYTICS",
            "game_id": "ALL",
            "matchup_label": f"{qb['name']} ({qb['team']})",
            "title": f"Dominio en EPA y CPOE: {qb['name']} ({qb['team']})",
            "body": trim_post_body(
                f"⭐ Rendimiento élite en 2026: {qb['name']} ({qb['team']}) registra {qb['primary_val']:+.3f} EPA/dropback (percentil {qb['percentile']} NFL), {qb['secondary_val']} CPOE y {qb['metrics'].get('Yds Pase', 0)} yds aéreas ({qb['metrics'].get('TD / INT', '')} TD/INT)."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#players",
            "source_link": qb["links"].get("rbsdm", "https://rbsdm.com/stats/stats/"),
            "source_name": "RBSDM / Next Gen Stats",
            "illustration": qb_img,
            "clay_prompt": (
                f"3D claymation (caricatura de plastilina) 16:9 illustration of {qb['name']} ({qb['team']}) throwing a pinpoint pass from the pocket. "
                f"Handcrafted plasticine texture, authentic team colors, single figure with natural anatomy."
            ),
        })

    if top_wrs:
        wr = top_wrs[0]
        wr_img = PLAYER_TEAM_CLAY.get((wr["team"], "WR"), "assets/clay/clay_sea_jsn.jpg")
        tips.append({
            "id": f"tip-player-wr-{wr['id']}",
            "day_group": "SUNDAY",
            "badge": "🚀 JUGADOR DESTACADO · WR TARGET SHARE & NGS",
            "game_id": "ALL",
            "matchup_label": f"{wr['name']} ({wr['team']})",
            "title": f"Imán de Targets: {wr['name']} ({wr['team']}) lidera en producción",
            "body": trim_post_body(
                f"🚀 Máquina de producir yardas: {wr['name']} ({wr['team']}) acumula {wr['primary_val']} yds de recepción con {wr['secondary_val']} de Target Share, {wr['metrics'].get('WOPR (Opportunity)', 0)} WOPR y {wr['metrics'].get('NGS Separation', '2.9 yds')} de separación en Next Gen Stats."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#players",
            "source_link": wr["links"].get("playerprofiler", "https://www.playerprofiler.com/"),
            "source_name": "PlayerProfiler / NFL Savant",
            "illustration": wr_img,
            "clay_prompt": (
                f"3D claymation (caricatura de plastilina) 16:9 illustration of {wr['name']} ({wr['team']}) sprinting after catching a deep pass "
                f"on an NFL field. Vibrant plasticine texture, studio lighting."
            ),
        })

    # =========================================================================
    # 5. TOP NEWS DE ALTO IMPACTO — Posteos Sugeridos para Noticias Críticas
    # =========================================================================
    for idx, n in enumerate(news[:4]):
        tips.append({
            "id": f"tip-news-{idx+1}",
            "day_group": "NEWS",
            "badge": f"{n['category']} · {n['source'].upper()}",
            "game_id": "NEWS",
            "matchup_label": f"Fuente: {n['source']}" + (f" · {n['team']}" if n.get("team") else ""),
            "title": n["title"],
            "body": trim_post_body(f"🚨 [Alto Impacto NFL · {n['source']}] {n['title']}. {n['summary'][:110]}"),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#news",
            "source_link": n["url"],
            "source_name": n["source"],
            "illustration": "assets/clay/clay_breaking_newsdesk.jpg",
            "clay_prompt": (
                f"3D claymation (caricatura de plastilina) 16:9 illustration of an NFL breaking news broadcast desk and locker room clipboard "
                f"representing: {n['title']}. Handcrafted plasticine texture, dramatic studio lighting, no speech bubbles."
            ),
        })

    return tips


def main():
    in_path = os.path.join(DATA_DIR, "nfl_dashboard_data.json")
    if not os.path.exists(in_path):
        raise FileNotFoundError(f"No se encontró {in_path}. Ejecutá primero actualizar_datos_nfl.py")

    with open(in_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tips = generate_tips_from_data(data)
    data["tips_x"] = tips

    with open(in_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[OK] Generados {len(tips)} posteos sugeridos para X (TNF, Domingo, Lunes y Top News) en {in_path}")


if __name__ == "__main__":
    main()
