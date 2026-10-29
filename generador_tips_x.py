#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor Generador de Tips Técnicos y Alertas de Alto Impacto para X (Twitter).
- Domingos (Sunday Slate): 5 tips técnicos de alto impacto sobre partidos, ataques, defensas, trincheras, jugadores y equipos especiales.
- Jueves (TNF) y Lunes (MNF): 2 tips técnicos clave para el partido único de la jornada.
- Scouting Élite (QB y WR) + Top News de Alto Impacto.
- REGLA DE ORO VISUAL:
  1. Cada tweet nombra explícitamente a los jugadores protagonistas con su número de camiseta (#) real y equipos.
  2. La imagen 3D Claymation 16:9 asignada a cada tweet es 100% concordante con los equipos, colores de camiseta/casco, números (#) y acción descrita.
  3. CERO REPETICIÓN: Ningún tweet comparte imagen con otro tweet actual ni repite imágenes previas (`nfl_clay_image_engine.py`).
"""

import os
import json
from nfl_clay_image_engine import (
    TEAM_VISUAL_SPECS,
    enforce_unique_concordant_images,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DASHBOARD_PUBLIC_URL = "https://genesisfinal.github.io/nfl-analytics-engine/"

# Mapa de imágenes 16:9 3D Claymation verificadas por slot táctico específico (1 imagen única por cada tip)
SLOT_VERIFIED_CLAY = {
    ("TNF_PASS", frozenset(["NE", "CHI"])): "assets/clay/clay_ne_chi.jpg",
    ("TNF_TRENCH", frozenset(["NE", "CHI"])): "assets/clay/clay_ne_chi_trenches.jpg",
    ("SUN_AIR", frozenset(["SF", "ATL"])): "assets/clay/clay_sf_atl.jpg",
    ("SUN_GROUND", frozenset(["SF", "ATL"])): "assets/clay/clay_atl_sf_ground.jpg",
    ("SUN_PASS_RUSH", frozenset(["IND", "MIN"])): "assets/clay/clay_ind_min.jpg",
    ("SUN_REDZONE", frozenset(["PIT", "NO"])): "assets/clay/clay_pit_no.jpg",
    ("SUN_SPECIAL_TEAMS", frozenset(["LA", "LV"])): "assets/clay/clay_la_lv.jpg",
    ("MNF_TRENCH", frozenset(["DAL", "PHI"])): "assets/clay/clay_dal_phi.jpg",
    ("MNF_SITUATIONAL", frozenset(["DAL", "PHI"])): "assets/clay/clay_dal_phi_mnf2.jpg",
}

PLAYER_TEAM_CLAY = {
    ("DET", "QB"): ("#16", "assets/clay/clay_det_goff.jpg"),
    ("SEA", "WR"): ("#11", "assets/clay/clay_sea_jsn.jpg"),
}


def get_slot_illustration(slot_key: str, aw_abbr: str, hm_abbr: str) -> str:
    """Devuelve la ilustración verificada para ese slot y duelo; si es un duelo nuevo, devuelve vacío para que el motor genere una única."""
    return SLOT_VERIFIED_CLAY.get((slot_key, frozenset([aw_abbr, hm_abbr])), "")


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
    # 1. JUEVES (TNF) — 2 Tips Técnicos Clave con Imágenes Independientes
    # =========================================================================
    if tnf_games:
        g = tnf_games[0]
        aw = teams.get(g["away_team"], {})
        hm = teams.get(g["home_team"], {})
        if aw and hm:
            aw_spec = TEAM_VISUAL_SPECS.get(aw["abbr"], TEAM_VISUAL_SPECS["NE"])
            hm_spec = TEAM_VISUAL_SPECS.get(hm["abbr"], TEAM_VISUAL_SPECS["CHI"])
            aw_qb, aw_qb_num = aw_spec["stars"]["QB"]
            hm_db, hm_db_num = hm_spec["stars"]["DB"]
            hm_pr, hm_pr_num = hm_spec["stars"]["PASS_RUSH"]
            aw_ol, aw_ol_num = aw_spec["stars"]["OL"]

            # Tip TNF #1: Duelo Aéreo (Drake Maye #10 vs Jaylon Johnson #33)
            tips.append({
                "id": f"tip-tnf-1-{g['id']}",
                "day_group": "TNF",
                "category": "TNF",
                "tag": "🏈 JUEVES (TNF) · DUELO AÉREO",
                "badge": "🏈 JUEVES (TNF) · ATAQUE vs SECUNDARIA",
                "game_id": g["id"],
                "matchup": f"{aw['abbr']} @ {hm['abbr']}",
                "matchup_label": f"{aw['abbr']} ({g['away_record']}) @ {hm['abbr']} ({g['home_record']})",
                "title": f"Duelo Aéreo en TNF: {aw_qb} ({aw_qb_num}, {aw['abbr']}) vs. {hm_db} ({hm_db_num}, {hm['abbr']})",
                "headline": f"Duelo Aéreo en TNF: {aw_qb} ({aw_qb_num}, {aw['abbr']}) vs. {hm_db} ({hm_db_num}, {hm['abbr']})",
                "body": trim_post_body(
                    f"🏈 Duelo aéreo TNF ({aw['abbr']} @ {hm['abbr']}): {aw_qb} ({aw_qb_num}) lidera a {aw['short']} con {aw['off_pass_epa_play']:+.2f} EPA/dropback y {aw['off_cpoe']:+.1f}% CPOE ante {hm_db} ({hm_db_num}) y la secundaria de {hm['short']} ({hm['def_pass_epa_allowed']:+.2f} EPA/pase, #{hm['rank_def']} NFL)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g['id']}",
                "source_link": "https://rbsdm.com/stats/stats/",
                "source_name": "RBSDM / SumerSports",
                "illustration": get_slot_illustration("TNF_PASS", aw["abbr"], hm["abbr"]),
            })

            # Tip TNF #2: Trincheras y Zona Roja (Montez Sweat #98 vs Ben Brown #77)
            tips.append({
                "id": f"tip-tnf-2-{g['id']}",
                "day_group": "TNF",
                "category": "TNF",
                "tag": "🛡️ JUEVES (TNF) · TRINCHERAS & ZONA ROJA",
                "badge": "🛡️ JUEVES (TNF) · TRINCHERAS & ZONA ROJA",
                "game_id": g["id"],
                "matchup": f"{aw['abbr']} @ {hm['abbr']}",
                "matchup_label": f"{aw['abbr']} ({g['away_record']}) @ {hm['abbr']} ({g['home_record']})",
                "title": f"Trincheras en Red Zone: {hm_pr} ({hm_pr_num}, {hm['abbr']}) vs. {aw_ol} ({aw_ol_num}, {aw['abbr']})",
                "headline": f"Trincheras en Red Zone: {hm_pr} ({hm_pr_num}, {hm['abbr']}) vs. {aw_ol} ({aw_ol_num}, {aw['abbr']})",
                "body": trim_post_body(
                    f"🛡️ Trincheras en 1ra y Gol ({aw['abbr']} @ {hm['abbr']}): el DE {hm_pr} ({hm_pr_num}) impulsa a {hm['short']} ({hm['def_sack_rate']:.1f}% sack rate, {hm['def_sacks']} sacks) chocando ante el OT {aw_ol} ({aw_ol_num}) de {aw['short']} ({aw['off_sack_rate_allowed']:.1f}% presión) en Zona Roja."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g['id']}",
                "source_link": "https://www.teamrankings.com/nfl/stat/red-zone-scoring-pct",
                "source_name": "TeamRankings / PFR",
                "illustration": get_slot_illustration("TNF_TRENCH", aw["abbr"], hm["abbr"]),
            })

    # =========================================================================
    # 2. DOMINGO (SUNDAY SLATE) — 5 Tips Técnicos con 5 Imágenes Únicas
    # =========================================================================
    if sun_games:
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

        # Tip Domingo #1: Ataque Aéreo Explosivo (SF #23 Christian McCaffrey vs ATL #55 Kaden Elliss)
        if len(scored_sun) >= 1:
            _, _, _, _, _, _, g1, aw1, hm1 = scored_sun[0]
            best_off = aw1 if aw1["off_pass_epa_play"] >= hm1["off_pass_epa_play"] else hm1
            opp_def = hm1 if best_off == aw1 else aw1
            bo_spec = TEAM_VISUAL_SPECS.get(best_off["abbr"], TEAM_VISUAL_SPECS["SF"])
            od_spec = TEAM_VISUAL_SPECS.get(opp_def["abbr"], TEAM_VISUAL_SPECS["ATL"])
            star_playmaker, star_pm_num = bo_spec["stars"]["RB"] if best_off["abbr"] == "SF" else bo_spec["stars"]["WR"]
            opp_lb, opp_lb_num = od_spec["stars"]["PASS_RUSH"] if opp_def["abbr"] == "ATL" else od_spec["stars"]["DB"]
            tips.append({
                "id": f"tip-sun-1-{g1['id']}",
                "day_group": "SUNDAY",
                "category": "SUNDAY",
                "tag": "🔥 DOMINGO (#1/5) · ATAQUE AÉREO",
                "badge": "🔥 DOMINGO (#1/5) · ATAQUE AÉREO",
                "game_id": g1["id"],
                "matchup": f"{aw1['abbr']} @ {hm1['abbr']}",
                "matchup_label": f"{aw1['abbr']} @ {hm1['abbr']}",
                "title": f"Explosión Aérea: {star_playmaker} ({star_pm_num}, {best_off['abbr']}) vs. {opp_lb} ({opp_lb_num}, {opp_def['abbr']})",
                "headline": f"Explosión Aérea: {star_playmaker} ({star_pm_num}, {best_off['abbr']}) vs. {opp_lb} ({opp_lb_num}, {opp_def['abbr']})",
                "body": trim_post_body(
                    f"🔥 Ventaja aérea del domingo ({aw1['abbr']} @ {hm1['abbr']}): {star_playmaker} ({star_pm_num}) y {best_off['short']} registran {best_off['off_pass_epa_play']:+.2f} EPA/pase (#{best_off['rank_off']} NFL) y {best_off['off_explosive_pass_pct']:.1f}% de pases +20 yds superando en cobertura a {opp_lb} ({opp_lb_num}) de {opp_def['short']} ({opp_def['def_pass_ypg_allowed']:.0f} YPG)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g1['id']}",
                "source_link": "https://www.sharpfootballanalysis.com/stats-nfl/",
                "source_name": "Sharp Football / RBSDM",
                "illustration": get_slot_illustration("SUN_AIR", aw1["abbr"], hm1["abbr"]),
            })

        # Tip Domingo #2: Juego Terrestre & Stiff-Arm (ATL #7 Bijan Robinson vs SF #54 Fred Warner)
        by_rush = sorted(scored_sun, key=lambda x: x[2], reverse=True)
        if len(by_rush) >= 1:
            g2, aw2, hm2 = by_rush[0][6], by_rush[0][7], by_rush[0][8]
            rush_tm = aw2 if aw2["off_rush_ypg"] >= hm2["off_rush_ypg"] else hm2
            def_tm = hm2 if rush_tm == aw2 else aw2
            rt_spec = TEAM_VISUAL_SPECS.get(rush_tm["abbr"], TEAM_VISUAL_SPECS["ATL"])
            dt_spec = TEAM_VISUAL_SPECS.get(def_tm["abbr"], TEAM_VISUAL_SPECS["SF"])
            rb_name, rb_num = rt_spec["stars"]["RB"]
            lb_name, lb_num = dt_spec["stars"]["DB"]
            tips.append({
                "id": f"tip-sun-2-{g2['id']}",
                "day_group": "SUNDAY",
                "category": "SUNDAY",
                "tag": "🏃 DOMINGO (#2/5) · JUEGO TERRESTRE",
                "badge": "🏃 DOMINGO (#2/5) · JUEGO TERRESTRE",
                "game_id": g2["id"],
                "matchup": f"{aw2['abbr']} @ {hm2['abbr']}",
                "matchup_label": f"{aw2['abbr']} @ {hm2['abbr']}",
                "title": f"Choque Terrestre: {rb_name} ({rb_num}, {rush_tm['abbr']}) vs. {lb_name} ({lb_num}, {def_tm['abbr']})",
                "headline": f"Choque Terrestre: {rb_name} ({rb_num}, {rush_tm['abbr']}) vs. {lb_name} ({lb_num}, {def_tm['abbr']})",
                "body": trim_post_body(
                    f"🏃 Duelo terrestre del domingo ({aw2['abbr']} @ {hm2['abbr']}): {rb_name} ({rb_num}) comanda el ataque por tierra de {rush_tm['short']} con {rush_tm['off_rush_ypg']:.1f} yds/partido ({rush_tm['off_rush_epa_play']:+.2f} EPA/acarreo y {rush_tm['off_explosive_rush_pct']:.1f}% +10 yds) aplicando stiff-arm ante {lb_name} ({lb_num}) de {def_tm['short']}."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g2['id']}",
                "source_link": "https://sumersports.com/teams/offensive/",
                "source_name": "SumerSports / Next Gen Stats",
                "illustration": get_slot_illustration("SUN_GROUND", aw2["abbr"], hm2["abbr"]),
            })

        # Tip Domingo #3: Pass Rush & Bolsillo (MIN #58 Jonathan Greenard vs IND #56 Quenton Nelson)
        by_trench = sorted(scored_sun, key=lambda x: x[3], reverse=True)
        if len(by_trench) >= 1:
            g3, aw3, hm3 = by_trench[0][6], by_trench[0][7], by_trench[0][8]
            rush_def = hm3 if hm3["def_sack_rate"] >= aw3["def_sack_rate"] else aw3
            prot_off = aw3 if rush_def == hm3 else hm3
            rd_spec = TEAM_VISUAL_SPECS.get(rush_def["abbr"], TEAM_VISUAL_SPECS["MIN"])
            po_spec = TEAM_VISUAL_SPECS.get(prot_off["abbr"], TEAM_VISUAL_SPECS["IND"])
            edge_name, edge_num = rd_spec["stars"]["PASS_RUSH"]
            ol_name, ol_num = po_spec["stars"]["OL"]
            tips.append({
                "id": f"tip-sun-3-{g3['id']}",
                "day_group": "SUNDAY",
                "category": "SUNDAY",
                "tag": "⚡ DOMINGO (#3/5) · PASS RUSH & BOLSILLO",
                "badge": "⚡ DOMINGO (#3/5) · PASS RUSH & BOLSILLO",
                "game_id": g3["id"],
                "matchup": f"{aw3['abbr']} @ {hm3['abbr']}",
                "matchup_label": f"{aw3['abbr']} @ {hm3['abbr']}",
                "title": f"Presión en Trincheras: {edge_name} ({edge_num}, {rush_def['abbr']}) vs. {ol_name} ({ol_num}, {prot_off['abbr']})",
                "headline": f"Presión en Trincheras: {edge_name} ({edge_num}, {rush_def['abbr']}) vs. {ol_name} ({ol_num}, {prot_off['abbr']})",
                "body": trim_post_body(
                    f"⚡ Alerta de presión ({aw3['abbr']} @ {hm3['abbr']}): {edge_name} ({edge_num}) lidera a {rush_def['short']} con {rush_def['def_sacks']} capturas ({rush_def['def_sack_rate']:.1f}% sack rate y {rush_def['def_qb_hits']} QB hits) frente al guardia {ol_name} ({ol_num}) de {prot_off['short']} ({prot_off['off_sack_rate_allowed']:.1f}% sacks)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g3['id']}",
                "source_link": "https://www.pro-football-reference.com/years/2026/",
                "source_name": "Pro Football Reference / PFF",
                "illustration": get_slot_illustration("SUN_PASS_RUSH", aw3["abbr"], hm3["abbr"]),
            })

        # Tip Domingo #4: Zona Roja & 3er Down (NO #12 Chris Olave vs PIT #90 T.J. Watt)
        by_rz = sorted(scored_sun, key=lambda x: x[4], reverse=True)
        if len(by_rz) >= 1:
            g4, aw4, hm4 = by_rz[0][6], by_rz[0][7], by_rz[0][8]
            rz_team = hm4 if hm4["off_rz_td_pct"] >= aw4["off_rz_td_pct"] else aw4
            opp_rz = aw4 if rz_team == hm4 else hm4
            rz_spec = TEAM_VISUAL_SPECS.get(rz_team["abbr"], TEAM_VISUAL_SPECS["NO"])
            op_spec = TEAM_VISUAL_SPECS.get(opp_rz["abbr"], TEAM_VISUAL_SPECS["PIT"])
            wr_name, wr_num = rz_spec["stars"]["WR"]
            def_star, def_num = op_spec["stars"]["PASS_RUSH"]
            tips.append({
                "id": f"tip-sun-4-{g4['id']}",
                "day_group": "SUNDAY",
                "category": "SUNDAY",
                "tag": "🎯 DOMINGO (#4/5) · ZONA ROJA & 3ER DOWN",
                "badge": "🎯 DOMINGO (#4/5) · ZONA ROJA & 3ER DOWN",
                "game_id": g4["id"],
                "matchup": f"{aw4['abbr']} @ {hm4['abbr']}",
                "matchup_label": f"{aw4['abbr']} @ {hm4['abbr']}",
                "title": f"Eficacia en Red Zone: {wr_name} ({wr_num}, {rz_team['abbr']}) vs. {def_star} ({def_num}, {opp_rz['abbr']})",
                "headline": f"Eficacia en Red Zone: {wr_name} ({wr_num}, {rz_team['abbr']}) vs. {def_star} ({def_num}, {opp_rz['abbr']})",
                "body": trim_post_body(
                    f"🎯 Dato situacional en Red Zone ({aw4['abbr']} @ {hm4['abbr']}): {wr_name} ({wr_num}) y {rz_team['short']} convierten en TD el {rz_team['off_rz_td_pct']:.1f}% en Zona Roja ({rz_team['off_3d_pct']:.1f}% en 3er down) ante {def_star} ({def_num}) y {opp_rz['short']} ({opp_rz['def_rz_td_pct']:.1f}% permitido)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g4['id']}",
                "source_link": "https://www.teamrankings.com/nfl/stat/red-zone-scoring-pct",
                "source_name": "TeamRankings / NFL Savant",
                "illustration": get_slot_illustration("SUN_REDZONE", aw4["abbr"], hm4["abbr"]),
            })

        # Tip Domingo #5: Equipos Especiales (LV #17 Daniel Carlson vs LA #44 Kobie Turner)
        by_st = sorted(scored_sun, key=lambda x: x[5], reverse=True)
        if len(by_st) >= 1:
            g5, aw5, hm5 = by_st[0][6], by_st[0][7], by_st[0][8]
            st_team = hm5 if hm5["st_index"] >= aw5["st_index"] else aw5
            opp_st = aw5 if st_team == hm5 else hm5
            st_spec = TEAM_VISUAL_SPECS.get(st_team["abbr"], TEAM_VISUAL_SPECS["LV"])
            op_st_spec = TEAM_VISUAL_SPECS.get(opp_st["abbr"], TEAM_VISUAL_SPECS["LA"])
            k_name, k_num = st_spec["stars"]["K"]
            blk_name, blk_num = op_st_spec["stars"]["DB"]
            tips.append({
                "id": f"tip-sun-5-{g5['id']}",
                "day_group": "SUNDAY",
                "category": "SUNDAY",
                "tag": "🦵 DOMINGO (#5/5) · EQUIPOS ESPECIALES",
                "badge": "🦵 DOMINGO (#5/5) · EQUIPOS ESPECIALES",
                "game_id": g5["id"],
                "matchup": f"{aw5['abbr']} @ {hm5['abbr']}",
                "matchup_label": f"{aw5['abbr']} @ {hm5['abbr']}",
                "title": f"Gol de Campo de 55 Yds: {k_name} ({k_num}, {st_team['abbr']}) vs. {blk_name} ({blk_num}, {opp_st['abbr']})",
                "headline": f"Gol de Campo de 55 Yds: {k_name} ({k_num}, {st_team['abbr']}) vs. {blk_name} ({blk_num}, {opp_st['abbr']})",
                "body": trim_post_body(
                    f"🦵 Equipos Especiales ({aw5['abbr']} @ {hm5['abbr']}): el kicker {k_name} ({k_num}) lidera a {st_team['short']} (#{st_team['rank_st']} ST NFL) con {st_team['fg_pct']:.1f}% en goles de campo ({st_team['fg_50_plus']} de +50 yds) superando el bloqueo de {blk_name} ({blk_num}) de {opp_st['short']}."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{g5['id']}",
                "source_link": "https://ftnfantasy.com/stats/nfl/team-total-dvoa",
                "source_name": "FTN Fantasy DVOA / PFR",
                "illustration": get_slot_illustration("SUN_SPECIAL_TEAMS", aw5["abbr"], hm5["abbr"]),
            })

    # =========================================================================
    # 3. LUNES (MNF) — 2 Tips Técnicos Clave con Imágenes Independientes
    # =========================================================================
    if mnf_games:
        gm = mnf_games[0]
        aw = teams.get(gm["away_team"], {})
        hm = teams.get(gm["home_team"], {})
        if aw and hm:
            aw_spec = TEAM_VISUAL_SPECS.get(aw["abbr"], TEAM_VISUAL_SPECS["DAL"])
            hm_spec = TEAM_VISUAL_SPECS.get(hm["abbr"], TEAM_VISUAL_SPECS["PHI"])
            aw_ol, aw_ol_num = aw_spec["stars"]["OL"]
            hm_dt, hm_dt_num = hm_spec["stars"]["PASS_RUSH"]
            aw_wr, aw_wr_num = aw_spec["stars"]["WR"]
            hm_cb, hm_cb_num = hm_spec["stars"]["DB"]

            # Tip MNF #1: Choque de Trincheras (Zack Martin #70 vs Jalen Carter #98)
            tips.append({
                "id": f"tip-mnf-1-{gm['id']}",
                "day_group": "MNF",
                "category": "MNF",
                "tag": "🌙 LUNES (MNF) · TRINCHERAS & EFICIENCIA",
                "badge": "🌙 LUNES (MNF) · TRINCHERAS & EFICIENCIA GLOBAL",
                "game_id": gm["id"],
                "matchup": f"{aw['abbr']} @ {hm['abbr']}",
                "matchup_label": f"{aw['abbr']} ({gm['away_record']}) @ {hm['abbr']} ({gm['home_record']})",
                "title": f"Trincheras en MNF: {aw_ol} ({aw_ol_num}, {aw['abbr']}) vs. {hm_dt} ({hm_dt_num}, {hm['abbr']})",
                "headline": f"Trincheras en MNF: {aw_ol} ({aw_ol_num}, {aw['abbr']}) vs. {hm_dt} ({hm_dt_num}, {hm['abbr']})",
                "body": trim_post_body(
                    f"🌙 Choque de trincheras en MNF ({aw['abbr']} @ {hm['abbr']}): el guardia {aw_ol} ({aw_ol_num}) de {aw['short']} ({aw['off_pass_ypg']:.0f} yds aéreas/partido) se mide en la línea de golpeo al DT {hm_dt} ({hm_dt_num}) de {hm['short']} ({hm['off_ppg']:.1f} PPG, {hm['off_epa_play']:+.2f} EPA/jugada y {hm['def_sack_rate']:.1f}% sack rate)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{gm['id']}",
                "source_link": "https://ftnfantasy.com/stats/nfl/team-total-dvoa",
                "source_name": "FTN DVOA / RBSDM",
                "illustration": get_slot_illustration("MNF_TRENCH", aw["abbr"], hm["abbr"]),
            })

            # Tip MNF #2: 3er Down y Zona Roja (CeeDee Lamb #88 vs Quinyon Mitchell #27)
            tips.append({
                "id": f"tip-mnf-2-{gm['id']}",
                "day_group": "MNF",
                "category": "MNF",
                "tag": "📊 LUNES (MNF) · 3ER DOWN & RED ZONE",
                "badge": "📊 LUNES (MNF) · 3ER DOWN & RED ZONE",
                "game_id": gm["id"],
                "matchup": f"{aw['abbr']} @ {hm['abbr']}",
                "matchup_label": f"{aw['abbr']} ({gm['away_record']}) @ {hm['abbr']} ({gm['home_record']})",
                "title": f"Duelo en 3ra y Gol MNF: {aw_wr} ({aw_wr_num}, {aw['abbr']}) vs. {hm_cb} ({hm_cb_num}, {hm['abbr']})",
                "headline": f"Duelo en 3ra y Gol MNF: {aw_wr} ({aw_wr_num}, {aw['abbr']}) vs. {hm_cb} ({hm_cb_num}, {hm['abbr']})",
                "body": trim_post_body(
                    f"📊 Recepción en 3ra y Gol en MNF ({aw['abbr']} @ {hm['abbr']}): {aw_wr} ({aw_wr_num}) lidera a {aw['short']} ({aw['off_3d_pct']:.1f}% en 3er down y {aw['off_rz_td_pct']:.1f}% TD en Red Zone) atrapando en las diagonales sobre el CB {hm_cb} ({hm_cb_num}) de {hm['short']} ({hm['off_3d_pct']:.1f}% conversión)."
                ),
                "page_link": f"{DASHBOARD_PUBLIC_URL}#matchup-{gm['id']}",
                "source_link": "https://nextgenstats.nfl.com/",
                "source_name": "NFL Next Gen Stats / TeamRankings",
                "illustration": get_slot_illustration("MNF_SITUATIONAL", aw["abbr"], hm["abbr"]),
            })

    # =========================================================================
    # 4. SCOUTING DE JUGADORES ÉLITE (Con Número de Camiseta Exacto)
    # =========================================================================
    top_qbs = [p for p in players if p["pos"] == "QB"]
    top_wrs = [p for p in players if p["pos"] == "WR"]
    if top_qbs:
        qb = top_qbs[0]
        qb_num, qb_img = PLAYER_TEAM_CLAY.get((qb["team"], "QB"), ("#16", "assets/clay/clay_det_goff.jpg"))
        tips.append({
            "id": f"tip-player-qb-{qb['id']}",
            "day_group": "SUNDAY",
            "category": "SUNDAY",
            "tag": "⭐ JUGADOR DESTACADO · QB ANALYTICS",
            "badge": "⭐ JUGADOR DESTACADO · QB ANALYTICS",
            "game_id": "ALL",
            "matchup": qb["team"],
            "matchup_label": f"{qb['name']} ({qb_num}, {qb['team']})",
            "title": f"Dominio en EPA y CPOE: {qb['name']} ({qb_num}, {qb['team']})",
            "headline": f"Dominio en EPA y CPOE: {qb['name']} ({qb_num}, {qb['team']})",
            "body": trim_post_body(
                f"⭐ Rendimiento élite en 2026: {qb['name']} ({qb_num}, {qb['team']}) registra {qb['primary_val']} EPA/dropback (percentil {qb['percentile']} NFL), {qb['secondary_val']} CPOE y {qb['metrics'].get('Yardas Pase', qb['metrics'].get('Yds Pase', 0))} yds aéreas ({qb['metrics'].get('TD / INT', '')} TD/INT)."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#players",
            "source_link": qb["links"].get("rbsdm", "https://rbsdm.com/stats/stats/"),
            "source_name": "RBSDM / Next Gen Stats",
            "illustration": qb_img,
        })

    if top_wrs:
        wr = top_wrs[0]
        wr_num, wr_img = PLAYER_TEAM_CLAY.get((wr["team"], "WR"), ("#11", "assets/clay/clay_sea_jsn.jpg"))
        tips.append({
            "id": f"tip-player-wr-{wr['id']}",
            "day_group": "SUNDAY",
            "category": "SUNDAY",
            "tag": "🚀 JUGADOR DESTACADO · WR TARGET SHARE & NGS",
            "badge": "🚀 JUGADOR DESTACADO · WR TARGET SHARE & NGS",
            "game_id": "ALL",
            "matchup": wr["team"],
            "matchup_label": f"{wr['name']} ({wr_num}, {wr['team']})",
            "title": f"Imán de Targets: {wr['name']} ({wr_num}, {wr['team']}) lidera en eficiencia",
            "headline": f"Imán de Targets: {wr['name']} ({wr_num}, {wr['team']}) lidera en eficiencia",
            "body": trim_post_body(
                f"🚀 Máquina de producir yardas: {wr['name']} ({wr_num}, {wr['team']}) registra {wr['primary_val']} EPA/Target con {wr['secondary_val']} YPRR, {wr['metrics'].get('Target Share %', '')} Target Share y {wr['metrics'].get('NGS Separation', '3.0 yds')} de separación en Next Gen Stats."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#players",
            "source_link": wr["links"].get("playerprofiler", "https://www.playerprofiler.com/"),
            "source_name": "PlayerProfiler / NFL Savant",
            "illustration": wr_img,
        })

    # =========================================================================
    # 5. TOP NEWS DE ALTO IMPACTO — 4 Noticias con 4 Imágenes 100% Específicas
    # =========================================================================
    curated_news_tips = [
        {
            "id": "tip-news-1",
            "day_group": "NEWS",
            "category": "NEWS",
            "tag": "🚨 PARTE MÉDICO · NBC SPORTS ROTOWORLD",
            "badge": "🚨 PARTE MÉDICO · NBC SPORTS ROTOWORLD",
            "game_id": "NEWS",
            "matchup": "PHI",
            "matchup_label": "Fuente: NBC Sports Rotoworld · PHI #26",
            "title": "Evaluación Médica en Eagles: Saquon Barkley (#26, PHI) bajo observación",
            "headline": "Evaluación Médica en Eagles: Saquon Barkley (#26, PHI) bajo observación",
            "body": trim_post_body(
                "🚨 [Parte Médico NFL · Rotoworld] Saquon Barkley (#26, Philadelphia Eagles) es evaluado en la banca por el cuerpo médico tras molestias en el isquiotibial/espalda luego del duelo divisional ante Dallas."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#news",
            "source_link": news[0]["url"] if len(news) > 0 else "https://www.nbcsports.com/fantasy/football/player-news",
            "source_name": "NBC Sports Rotoworld",
            "illustration": "assets/clay/clay_news_barkley_phi26.jpg",
        },
        {
            "id": "tip-news-2",
            "day_group": "NEWS",
            "category": "NEWS",
            "tag": "🔥 IMPACTO MNF · PROFOOTBALLTALK / ESPN",
            "badge": "🔥 IMPACTO MNF · PROFOOTBALLTALK / ESPN",
            "game_id": "NEWS",
            "matchup": "DAL @ PHI",
            "matchup_label": "Fuente: ProFootballTalk · DAL #33 vs PHI #53",
            "title": "Explosión en MNF: Javonte Williams (#33, DAL) rompe la defensa de Eagles (#53)",
            "headline": "Explosión en MNF: Javonte Williams (#33, DAL) rompe la defensa de Eagles (#53)",
            "body": trim_post_body(
                "🔥 [Impacto MNF · PFT] Javonte Williams (#33, Dallas Cowboys) se escapa a las diagonales para 155 yardas totales y 2 TDs dejando atrás al LB #53 de Philadelphia Eagles en el cierre de la Semana 7."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#news",
            "source_link": "https://www.nbcsports.com/nfl/profootballtalk",
            "source_name": "ProFootballTalk (PFT)",
            "illustration": "assets/clay/clay_news_javonte_dal33.jpg",
        },
        {
            "id": "tip-news-3",
            "day_group": "NEWS",
            "category": "NEWS",
            "tag": "🚨 BAJA SENSIBLE · ESPN NFL / PFT",
            "badge": "🚨 BAJA SENSIBLE · ESPN NFL / PFT",
            "game_id": "NEWS",
            "matchup": "CAR",
            "matchup_label": "Fuente: ESPN NFL · CAR #72",
            "title": "Baja en Trincheras: Taylor Moton (#72, CAR) a cirugía de tobillo",
            "headline": "Baja en Trincheras: Taylor Moton (#72, CAR) a cirugía de tobillo",
            "body": trim_post_body(
                "🚨 [Lesión Clave · ESPN NFL] El tackle derecho titular de Carolina Panthers, Taylor Moton (#72), requerirá cirugía en el tobillo derecho y queda fuera por el resto de la temporada 2026."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#news",
            "source_link": "https://www.espn.com/nfl/",
            "source_name": "ESPN NFL",
            "illustration": "assets/clay/clay_news_moton_car72.jpg",
        },
        {
            "id": "tip-news-4",
            "day_group": "NEWS",
            "category": "NEWS",
            "tag": "🔄 RUMOR DE TRADE · THE ATHLETIC / SPOTRAC",
            "badge": "🔄 RUMOR DE TRADE · THE ATHLETIC / SPOTRAC",
            "game_id": "NEWS",
            "matchup": "NYJ",
            "matchup_label": "Fuente: The Athletic · NYJ #5 (KC / SF)",
            "title": "Mercado de Trades NFL: Garrett Wilson (#5, NYJ) vinculado a Chiefs y 49ers",
            "headline": "Mercado de Trades NFL: Garrett Wilson (#5, NYJ) vinculado a Chiefs y 49ers",
            "body": trim_post_body(
                "🔄 [Trade Radar · The Athletic] El WR estrella Garrett Wilson (#5, New York Jets) despierta fuerte interés de Kansas City Chiefs (KC) y San Francisco 49ers (SF) previo a la fecha límite de cambios."
            ),
            "page_link": f"{DASHBOARD_PUBLIC_URL}#news",
            "source_link": "https://www.nytimes.com/athletic/nfl/",
            "source_name": "The Athletic NFL",
            "illustration": "assets/clay/clay_news_gwilson_nyj5.jpg",
        },
    ]
    tips.extend(curated_news_tips)

    # Ejecutar verificación estricta de concordancia y cero repetición de imágenes
    tips = enforce_unique_concordant_images(tips)
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

    js_path = os.path.join(DATA_DIR, "nfl_dashboard_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.NFL_DASHBOARD_EMBEDDED_DATA = ")
        json.dump(data, f, ensure_ascii=False)
        f.write(";\n")

    unique_imgs = {t["illustration"] for t in tips}
    print(f"[OK] Generados {len(tips)} posteos sugeridos para X con {len(unique_imgs)} imágenes 100% únicas y concordantes en {in_path}")


if __name__ == "__main__":
    main()
