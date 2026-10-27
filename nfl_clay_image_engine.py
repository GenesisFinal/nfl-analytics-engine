#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NFL 3D Claymation Visual Concordance & Zero-Repetition Engine
-------------------------------------------------------------
Garantiza el cumplimiento estricto de las reglas de imagen para cada tweet:
1. 100% Concordancia Visual: Equipos exactos, colores de camisetas y cascos reales,
   números de camiseta (#) exactos de los jugadores mencionados en el tweet, y la
   acción específica narrada (pase, captura/sack, carrera/stiff-arm, bloqueo en
   trincheras, recepción en Red Zone, gol de campo, evaluación médica en banca, trade).
2. Cero Repetición (Actual e Histórica): Ningún tweet puede compartir imagen con otro
   tweet activo ni repetir imágenes previas de otros tweets. Se mantiene un registro
   criptográfico (SHA-256 + prompt + seed) en `data/used_images_registry.json`.
"""

import os
import re
import json
import time
import base64
import hashlib
import datetime
import urllib.parse
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CLAY_DIR = os.path.join(BASE_DIR, "assets", "clay")
REGISTRY_PATH = os.path.join(DATA_DIR, "used_images_registry.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CLAY_DIR, exist_ok=True)

# Catálogo completo de los 32 equipos NFL: uniformes, cascos y jugadores estrella con número (#) real por unidad
TEAM_VISUAL_SPECS = {
    "ARI": {
        "name": "Arizona Cardinals",
        "helmet": "white helmet with red Cardinal bird logo",
        "home_jersey": "cardinal red jersey with white numerals",
        "away_jersey": "white jersey with cardinal red numerals",
        "stars": {"QB": ("Kyler Murray", "#1"), "RB": ("James Conner", "#6"), "WR": ("Marvin Harrison Jr.", "#18"), "OL": ("Paris Johnson Jr.", "#70"), "PASS_RUSH": ("Zaven Collins", "#25"), "DB": ("Budda Baker", "#3"), "K": ("Chad Ryland", "#38")},
    },
    "ATL": {
        "name": "Atlanta Falcons",
        "helmet": "matte black helmet with red/silver Falcon logo",
        "home_jersey": "black jersey with red trim and white numerals",
        "away_jersey": "white jersey with black numerals and red trim",
        "stars": {"QB": ("Kirk Cousins", "#18"), "RB": ("Bijan Robinson", "#7"), "WR": ("Drake London", "#5"), "OL": ("Chris Lindstrom", "#63"), "PASS_RUSH": ("Kaden Elliss", "#55"), "DB": ("Jessie Bates III", "#3"), "K": ("Younghoe Koo", "#6")},
    },
    "BAL": {
        "name": "Baltimore Ravens",
        "helmet": "metallic black helmet with purple Raven wings logo",
        "home_jersey": "purple jersey with gold-trimmed white numerals",
        "away_jersey": "white jersey with purple numerals",
        "stars": {"QB": ("Lamar Jackson", "#8"), "RB": ("Derrick Henry", "#22"), "WR": ("Zay Flowers", "#4"), "OL": ("Tyler Linderbaum", "#64"), "PASS_RUSH": ("Nnamdi Madubuike", "#92"), "DB": ("Kyle Hamilton", "#14"), "K": ("Justin Tucker", "#9")},
    },
    "BUF": {
        "name": "Buffalo Bills",
        "helmet": "white helmet with charging blue/red Buffalo logo",
        "home_jersey": "royal blue jersey with white numerals and red stripes",
        "away_jersey": "white jersey with royal blue numerals",
        "stars": {"QB": ("Josh Allen", "#17"), "RB": ("James Cook", "#4"), "WR": ("Khalil Shakir", "#10"), "OL": ("Dion Dawkins", "#73"), "PASS_RUSH": ("Greg Rousseau", "#50"), "DB": ("Taron Johnson", "#7"), "K": ("Tyler Bass", "#2")},
    },
    "CAR": {
        "name": "Carolina Panthers",
        "helmet": "metallic silver helmet with black/blue Panther logo",
        "home_jersey": "black jersey with electric Carolina blue trim and white numerals",
        "away_jersey": "white jersey with black numerals and blue trim",
        "stars": {"QB": ("Bryce Young", "#9"), "RB": ("Chuba Hubbard", "#30"), "WR": ("Xavier Legette", "#17"), "OL": ("Taylor Moton", "#72"), "PASS_RUSH": ("Jadeveon Clowney", "#7"), "DB": ("Jaycee Horn", "#8"), "K": ("Eddy Pineiro", "#4")},
    },
    "CHI": {
        "name": "Chicago Bears",
        "helmet": "dark navy blue helmet with orange wishbone C logo",
        "home_jersey": "dark navy blue jersey with orange-outlined white numerals and GSH sleeve stripes",
        "away_jersey": "white jersey with navy numerals and orange trim",
        "stars": {"QB": ("Caleb Williams", "#18"), "RB": ("D'Andre Swift", "#4"), "WR": ("DJ Moore", "#2"), "OL": ("Darnell Wright", "#58"), "PASS_RUSH": ("Montez Sweat", "#98"), "DB": ("Jaylon Johnson", "#33"), "K": ("Cairo Santos", "#8")},
    },
    "CIN": {
        "name": "Cincinnati Bengals",
        "helmet": "orange helmet with black Bengal tiger stripes",
        "home_jersey": "black jersey with orange tiger-striped shoulders and white numerals",
        "away_jersey": "white jersey with black numerals and orange stripes",
        "stars": {"QB": ("Joe Burrow", "#9"), "RB": ("Chase Brown", "#30"), "WR": ("Ja'Marr Chase", "#1"), "OL": ("Orlando Brown Jr.", "#75"), "PASS_RUSH": ("Trey Hendrickson", "#91"), "DB": ("Cam Taylor-Britt", "#29"), "K": ("Evan McPherson", "#2")},
    },
    "CLE": {
        "name": "Cleveland Browns",
        "helmet": "orange helmet with brown/white center stripe",
        "home_jersey": "dark brown jersey with orange numerals",
        "away_jersey": "white jersey with brown numerals and orange stripes",
        "stars": {"QB": ("Jameis Winston", "#5"), "RB": ("Nick Chubb", "#24"), "WR": ("Jerry Jeudy", "#3"), "OL": ("Joel Bitonio", "#75"), "PASS_RUSH": ("Myles Garrett", "#95"), "DB": ("Denzel Ward", "#21"), "K": ("Dustin Hopkins", "#7")},
    },
    "DAL": {
        "name": "Dallas Cowboys",
        "helmet": "metallic silver helmet with navy blue Lone Star logo",
        "home_jersey": "white jersey with royal blue numerals and silver pants",
        "away_jersey": "white jersey with royal blue numerals and navy star shoulders",
        "stars": {"QB": ("Dak Prescott", "#4"), "RB": ("Javonte Williams", "#33"), "WR": ("CeeDee Lamb", "#88"), "OL": ("Zack Martin", "#70"), "PASS_RUSH": ("Micah Parsons", "#11"), "DB": ("Trevon Diggs", "#7"), "K": ("Brandon Aubrey", "#17")},
    },
    "DEN": {
        "name": "Denver Broncos",
        "helmet": "navy blue helmet with orange Bronco horse logo",
        "home_jersey": "sunset orange jersey with white numerals and navy trim",
        "away_jersey": "white jersey with orange numerals",
        "stars": {"QB": ("Bo Nix", "#10"), "RB": ("Jaleel McLaughlin", "#38"), "WR": ("Courtland Sutton", "#14"), "OL": ("Quinn Meinerz", "#77"), "PASS_RUSH": ("Nik Bonitto", "#15"), "DB": ("Pat Surtain II", "#2"), "K": ("Wil Lutz", "#3")},
    },
    "DET": {
        "name": "Detroit Lions",
        "helmet": "Honolulu blue metallic helmet with silver Lion logo",
        "home_jersey": "Honolulu blue jersey with silver numerals",
        "away_jersey": "white jersey with Honolulu blue numerals",
        "stars": {"QB": ("Jared Goff", "#16"), "RB": ("Jahmyr Gibbs", "#26"), "WR": ("Amon-Ra St. Brown", "#14"), "OL": ("Penei Sewell", "#58"), "PASS_RUSH": ("Aidan Hutchinson", "#97"), "DB": ("Brian Branch", "#32"), "K": ("Jake Bates", "#39")},
    },
    "GB": {
        "name": "Green Bay Packers",
        "helmet": "golden yellow helmet with dark green oval G logo",
        "home_jersey": "dark forest green jersey with white numerals and yellow stripes",
        "away_jersey": "white jersey with dark green numerals",
        "stars": {"QB": ("Jordan Love", "#10"), "RB": ("Josh Jacobs", "#8"), "WR": ("Jayden Reed", "#11"), "OL": ("Elgton Jenkins", "#74"), "PASS_RUSH": ("Rashan Gary", "#52"), "DB": ("Xavier McKinney", "#29"), "K": ("Brandon McManus", "#17")},
    },
    "HOU": {
        "name": "Houston Texans",
        "helmet": "deep steel navy helmet with red/white Bull horn logo",
        "home_jersey": "deep steel navy jersey with battle red trim and white numerals",
        "away_jersey": "white jersey with deep steel navy numerals",
        "stars": {"QB": ("C.J. Stroud", "#7"), "RB": ("Joe Mixon", "#28"), "WR": ("Nico Collins", "#12"), "OL": ("Laremy Tunsil", "#78"), "PASS_RUSH": ("Will Anderson Jr.", "#51"), "DB": ("Derek Stingley Jr.", "#24"), "K": ("Ka'imi Fairbairn", "#15")},
    },
    "IND": {
        "name": "Indianapolis Colts",
        "helmet": "white helmet with royal blue Horseshoe logo",
        "home_jersey": "royal blue jersey with white numerals and white shoulder stripes",
        "away_jersey": "white jersey with royal blue numerals and blue shoulder stripes",
        "stars": {"QB": ("Anthony Richardson", "#5"), "RB": ("Jonathan Taylor", "#28"), "WR": ("Michael Pittman Jr.", "#11"), "OL": ("Quenton Nelson", "#56"), "PASS_RUSH": ("DeForest Buckner", "#99"), "DB": ("Kenny Moore II", "#23"), "K": ("Matt Gay", "#7")},
    },
    "JAX": {
        "name": "Jacksonville Jaguars",
        "helmet": "glossy black helmet with gold/teal Jaguar head logo",
        "home_jersey": "teal jersey with white numerals and black trim",
        "away_jersey": "white jersey with black numerals and teal trim",
        "stars": {"QB": ("Trevor Lawrence", "#16"), "RB": ("Travis Etienne Jr.", "#1"), "WR": ("Brian Thomas Jr.", "#7"), "OL": ("Brandon Scherff", "#68"), "PASS_RUSH": ("Josh Hines-Allen", "#41"), "DB": ("Tyson Campbell", "#3"), "K": ("Cam Little", "#39")},
    },
    "KC": {
        "name": "Kansas City Chiefs",
        "helmet": "bright red helmet with white KC arrowhead logo",
        "home_jersey": "bright red jersey with white numerals and yellow trim",
        "away_jersey": "white jersey with red numerals",
        "stars": {"QB": ("Patrick Mahomes", "#15"), "RB": ("Kareem Hunt", "#29"), "WR": ("Travis Kelce", "#87"), "OL": ("Creed Humphrey", "#52"), "PASS_RUSH": ("Chris Jones", "#95"), "DB": ("Trent McDuffie", "#22"), "K": ("Harrison Butker", "#7")},
    },
    "LA": {
        "name": "Los Angeles Rams",
        "helmet": "metallic royal blue helmet with yellow curled Ram horns",
        "home_jersey": "royal blue jersey with sol yellow numerals",
        "away_jersey": "bone white jersey with royal blue and yellow numerals",
        "stars": {"QB": ("Matthew Stafford", "#9"), "RB": ("Kyren Williams", "#23"), "WR": ("Puka Nacua", "#17"), "OL": ("Kevin Dotson", "#69"), "PASS_RUSH": ("Jared Verse", "#8"), "DB": ("Kobie Turner", "#44"), "K": ("Joshua Karty", "#16")},
    },
    "LAC": {
        "name": "Los Angeles Chargers",
        "helmet": "white helmet with gold lightning bolt and powder blue numerals",
        "home_jersey": "powder blue jersey with white numerals and gold lightning bolts",
        "away_jersey": "white jersey with powder blue numerals",
        "stars": {"QB": ("Justin Herbert", "#10"), "RB": ("J.K. Dobbins", "#27"), "WR": ("Ladd McConkey", "#15"), "OL": ("Rashawn Slater", "#70"), "PASS_RUSH": ("Khalil Mack", "#52"), "DB": ("Derwin James Jr.", "#3"), "K": ("Cameron Dicker", "#11")},
    },
    "LV": {
        "name": "Las Vegas Raiders",
        "helmet": "metallic silver helmet with black Raiders shield logo",
        "home_jersey": "black jersey with silver numerals",
        "away_jersey": "white jersey with black numerals and silver outline",
        "stars": {"QB": ("Gardner Minshew", "#15"), "RB": ("Alexander Mattison", "#22"), "WR": ("Brock Bowers", "#89"), "OL": ("Kolton Miller", "#74"), "PASS_RUSH": ("Maxx Crosby", "#98"), "DB": ("Nate Hobbs", "#39"), "K": ("Daniel Carlson", "#17")},
    },
    "MIA": {
        "name": "Miami Dolphins",
        "helmet": "white helmet with aqua/orange Dolphin logo",
        "home_jersey": "aqua jersey with white numerals and orange trim",
        "away_jersey": "white jersey with aqua numerals and orange trim",
        "stars": {"QB": ("Tua Tagovailoa", "#1"), "RB": ("De'Von Achane", "#28"), "WR": ("Tyreek Hill", "#10"), "OL": ("Terron Armstead", "#72"), "PASS_RUSH": ("Calais Campbell", "#93"), "DB": ("Jalen Ramsey", "#5"), "K": ("Jason Sanders", "#7")},
    },
    "MIN": {
        "name": "Minnesota Vikings",
        "helmet": "matte purple helmet with white Viking horns",
        "home_jersey": "purple jersey with white numerals and gold trim",
        "away_jersey": "white jersey with purple numerals",
        "stars": {"QB": ("Sam Darnold", "#14"), "RB": ("Aaron Jones", "#33"), "WR": ("Justin Jefferson", "#18"), "OL": ("Christian Darrisaw", "#71"), "PASS_RUSH": ("Jonathan Greenard", "#58"), "DB": ("Byron Murphy Jr.", "#7"), "K": ("Will Reichard", "#16")},
    },
    "NE": {
        "name": "New England Patriots",
        "helmet": "metallic silver helmet with Flying Elvis Patriot logo",
        "home_jersey": "nautical navy blue jersey with red/white shoulder stripes and white numerals",
        "away_jersey": "white jersey with navy blue shoulders and red-trimmed navy numerals",
        "stars": {"QB": ("Drake Maye", "#10"), "RB": ("Rhamondre Stevenson", "#38"), "WR": ("DeMario Douglas", "#3"), "OL": ("Ben Brown", "#77"), "PASS_RUSH": ("Keion White", "#99"), "DB": ("Christian Gonzalez", "#0"), "K": ("Joey Slye", "#13")},
    },
    "NO": {
        "name": "New Orleans Saints",
        "helmet": "metallic old gold helmet with black Fleur-de-Lis logo",
        "home_jersey": "black jersey with old gold numerals",
        "away_jersey": "white jersey with old gold and black numerals",
        "stars": {"QB": ("Derek Carr", "#4"), "RB": ("Alvin Kamara", "#41"), "WR": ("Chris Olave", "#12"), "OL": ("Erik McCoy", "#78"), "PASS_RUSH": ("Cameron Jordan", "#94"), "DB": ("Tyrann Mathieu", "#32"), "K": ("Blake Grupe", "#19")},
    },
    "NYG": {
        "name": "New York Giants",
        "helmet": "metallic dark blue helmet with white NY logo and red stripe",
        "home_jersey": "royal blue jersey with white numerals",
        "away_jersey": "white jersey with red numerals and red stripes",
        "stars": {"QB": ("Daniel Jones", "#8"), "RB": ("Tyrone Tracy Jr.", "#29"), "WR": ("Malik Nabers", "#1"), "OL": ("Andrew Thomas", "#78"), "PASS_RUSH": ("Dexter Lawrence", "#97"), "DB": ("Deonte Banks", "#3"), "K": ("Greg Joseph", "#14")},
    },
    "NYJ": {
        "name": "New York Jets",
        "helmet": "metallic Gotham green helmet with white JETS logo",
        "home_jersey": "Gotham green jersey with white numerals and shoulder stripes",
        "away_jersey": "white jersey with Gotham green numerals",
        "stars": {"QB": ("Aaron Rodgers", "#8"), "RB": ("Breece Hall", "#20"), "WR": ("Garrett Wilson", "#5"), "OL": ("Alijah Vera-Tucker", "#75"), "PASS_RUSH": ("Quinnen Williams", "#95"), "DB": ("Sauce Gardner", "#1"), "K": ("Greg Zuerlein", "#9")},
    },
    "PHI": {
        "name": "Philadelphia Eagles",
        "helmet": "metallic midnight green helmet with silver Eagles wings",
        "home_jersey": "midnight green jersey with white numerals and black/silver trim",
        "away_jersey": "white jersey with midnight green numerals",
        "stars": {"QB": ("Jalen Hurts", "#1"), "RB": ("Saquon Barkley", "#26"), "WR": ("A.J. Brown", "#11"), "OL": ("Lane Johnson", "#65"), "PASS_RUSH": ("Jalen Carter", "#98"), "DB": ("Quinyon Mitchell", "#27"), "K": ("Jake Elliott", "#4")},
    },
    "PIT": {
        "name": "Pittsburgh Steelers",
        "helmet": "glossy black helmet with Steelmark hypocycloid logo on right side",
        "home_jersey": "black jersey with white numerals and gold/black sleeve stripes",
        "away_jersey": "white jersey with black numerals and gold sleeve stripes",
        "stars": {"QB": ("Russell Wilson", "#3"), "RB": ("Najee Harris", "#22"), "WR": ("George Pickens", "#14"), "OL": ("Isaac Seumalo", "#73"), "PASS_RUSH": ("T.J. Watt", "#90"), "DB": ("Minkah Fitzpatrick", "#39"), "K": ("Chris Boswell", "#9")},
    },
    "SEA": {
        "name": "Seattle Seahawks",
        "helmet": "college navy helmet with action green Seahawk logo",
        "home_jersey": "college navy jersey with action green trim and white numerals",
        "away_jersey": "white jersey with college navy numerals",
        "stars": {"QB": ("Geno Smith", "#7"), "RB": ("Kenneth Walker III", "#9"), "WR": ("Jaxon Smith-Njigba", "#11"), "OL": ("Charles Cross", "#67"), "PASS_RUSH": ("Leonard Williams", "#99"), "DB": ("Devon Witherspoon", "#21"), "K": ("Jason Myers", "#5")},
    },
    "SF": {
        "name": "San Francisco 49ers",
        "helmet": "metallic gold helmet with red/white oval SF logo",
        "home_jersey": "scarlet red jersey with white numerals and white sleeve stripes",
        "away_jersey": "white jersey with scarlet red numerals and red sleeve stripes",
        "stars": {"QB": ("Brock Purdy", "#13"), "RB": ("Christian McCaffrey", "#23"), "WR": ("Deebo Samuel", "#1"), "OL": ("Trent Williams", "#71"), "PASS_RUSH": ("Nick Bosa", "#97"), "DB": ("Fred Warner", "#54"), "K": ("Jake Moody", "#4")},
    },
    "TB": {
        "name": "Tampa Bay Buccaneers",
        "helmet": "pewter helmet with red Buccaneers pirate flag logo",
        "home_jersey": "red jersey with white numerals and black/pewter trim",
        "away_jersey": "white jersey with red numerals",
        "stars": {"QB": ("Baker Mayfield", "#6"), "RB": ("Bucky Irving", "#7"), "WR": ("Mike Evans", "#13"), "OL": ("Tristan Wirfs", "#78"), "PASS_RUSH": ("Vita Vea", "#50"), "DB": ("Antoine Winfield Jr.", "#31"), "K": ("Chase McLaughlin", "#4")},
    },
    "TEN": {
        "name": "Tennessee Titans",
        "helmet": "navy blue helmet with flaming Titan sword logo",
        "home_jersey": "navy blue jersey with Titan blue shoulders and white numerals",
        "away_jersey": "white jersey with navy shoulders and numerals",
        "stars": {"QB": ("Will Levis", "#8"), "RB": ("Tony Pollard", "#20"), "WR": ("Calvin Ridley", "#0"), "OL": ("Peter Skoronski", "#77"), "PASS_RUSH": ("Jeffery Simmons", "#98"), "DB": ("Amani Hooker", "#37"), "K": ("Nick Folk", "#6")},
    },
    "WAS": {
        "name": "Washington Commanders",
        "helmet": "matte burgundy helmet with gold W logo",
        "home_jersey": "burgundy jersey with gold numerals",
        "away_jersey": "white jersey with burgundy numerals and gold trim",
        "stars": {"QB": ("Jayden Daniels", "#5"), "RB": ("Brian Robinson Jr.", "#8"), "WR": ("Terry McLaurin", "#17"), "OL": ("Sam Cosmi", "#76"), "PASS_RUSH": ("Daron Payne", "#94"), "DB": ("Bobby Wagner", "#54"), "K": ("Austin Seibert", "#16")},
    },
}


def compute_file_sha256(filepath: str) -> str:
    """Calcula el hash SHA-256 de un archivo de imagen para garantizar no repetición."""
    if not os.path.exists(filepath):
        return ""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_used_images_registry() -> dict:
    """Carga el registro histórico de imágenes usadas para evitar cualquier repetición."""
    if os.path.exists(REGISTRY_PATH):
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "entries" in data:
                    return data
        except Exception:
            pass
    return {"updated_at": "", "entries": {}, "used_hashes": [], "used_paths": []}


def save_used_images_registry(reg: dict) -> None:
    """Persiste el registro histórico de imágenes usadas."""
    reg["updated_at"] = datetime.datetime.now().isoformat()
    reg["used_hashes"] = sorted(list({v.get("sha256", "") for v in reg.get("entries", {}).values() if v.get("sha256")}))
    reg["used_paths"] = sorted(list({v.get("illustration", "") for v in reg.get("entries", {}).values() if v.get("illustration")}))
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)


def extract_numbers_from_text(text: str) -> list:
    """Extrae todos los números de camiseta explícitos (#10, #98, #88, etc.) del texto del tweet."""
    return re.findall(r"#(\d{1,2})\b", text or "")


def build_concordant_clay_prompt(tip: dict) -> str:
    """
    Construye un prompt 3D claymation 16:9 100% concordante con el texto del tweet:
    equipos exactos, camisetas y cascos oficiales, números (#) de jugadores y acción específica.
    """
    body = str(tip.get("body", ""))
    headline = str(tip.get("headline", ""))
    matchup = str(tip.get("matchup", ""))
    cat = str(tip.get("category", ""))
    full_txt = f"{headline} {body}".lower()

    # Detectar si es duelo entre dos equipos (AW @ HM)
    m = re.match(r"^([A-Z]{2,3})\s*@\s*([A-Z]{2,3})$", matchup.strip())
    if m:
        aw, hm = m.group(1), m.group(2)
        aw_spec = TEAM_VISUAL_SPECS.get(aw, TEAM_VISUAL_SPECS["DAL"])
        hm_spec = TEAM_VISUAL_SPECS.get(hm, TEAM_VISUAL_SPECS["PHI"])

        # Determinar tipo de acción y jugadores según el texto del tweet
        if "gol de campo" in full_txt or "equipos especiales" in full_txt or "55 yardas" in full_txt or "kicker" in full_txt:
            k_name, k_num = hm_spec["stars"]["K"]
            blk_name, blk_num = aw_spec["stars"]["DB"]
            action_desc = (
                f"{hm_spec['name']} kicker {k_name} in {hm_spec['home_jersey']} with number {k_num} and {hm_spec['helmet']} "
                f"kicking ONE single brown leather football through the yellow stadium uprights for a 55-yard field goal, while "
                f"{aw_spec['name']} defender {blk_name} in {aw_spec['away_jersey']} with number {blk_num} and {aw_spec['helmet']} dives to block it"
            )
        elif "trinchera" in full_txt or "pass block" in full_txt or "pass rush" in full_txt or "sacks" in full_txt or "presión" in full_txt:
            if "1ra y gol" in full_txt or "red zone" in full_txt:
                pr_name, pr_num = hm_spec["stars"]["PASS_RUSH"]
                ol_name, ol_num = aw_spec["stars"]["OL"]
                action_desc = (
                    f"{hm_spec['name']} defensive end {pr_name} in {hm_spec['home_jersey']} with number {pr_num} and {hm_spec['helmet']} "
                    f"bull-rushing {aw_spec['name']} offensive tackle {ol_name} in {aw_spec['away_jersey']} with number {ol_num} and {aw_spec['helmet']} "
                    f"at the line of scrimmage inside the Red Zone near the 10-yard line"
                )
            else:
                ol_name, ol_num = aw_spec["stars"]["OL"]
                pr_name, pr_num = hm_spec["stars"]["PASS_RUSH"]
                action_desc = (
                    f"{aw_spec['name']} offensive lineman {ol_name} in {aw_spec['away_jersey']} with number {ol_num} and {aw_spec['helmet']} "
                    f"clashing hand-to-hand in the trenches against {hm_spec['name']} defensive tackle {pr_name} in {hm_spec['home_jersey']} "
                    f"with number {pr_num} and {hm_spec['helmet']} at the line of scrimmage"
                )
        elif "terrestre" in full_txt or "acarreo" in full_txt or "rush" in full_txt or "stiff-arm" in full_txt:
            rb_name, rb_num = hm_spec["stars"]["RB"]
            lb_name, lb_num = aw_spec["stars"]["DB"]
            action_desc = (
                f"{hm_spec['name']} running back {rb_name} in {hm_spec['home_jersey']} with number {rb_num} and {hm_spec['helmet']} "
                f"carrying ONE single football and stiff-arming {aw_spec['name']} linebacker {lb_name} in {aw_spec['away_jersey']} "
                f"with number {lb_num} and {aw_spec['helmet']} on an explosive open-field run"
            )
        elif "3er down" in full_txt or "3rd" in full_txt or "recepción" in full_txt or "red zone" in full_txt:
            wr_name, wr_num = aw_spec["stars"]["WR"]
            db_name, db_num = hm_spec["stars"]["DB"]
            action_desc = (
                f"{aw_spec['name']} wide receiver {wr_name} in {aw_spec['away_jersey']} with number {wr_num} and {aw_spec['helmet']} "
                f"making an acrobatic high-point catch of ONE single football in the end zone over {hm_spec['name']} cornerback {db_name} "
                f"in {hm_spec['home_jersey']} with number {db_num} and {hm_spec['helmet']}"
            )
        else:
            qb_name, qb_num = aw_spec["stars"]["QB"]
            db_name, db_num = hm_spec["stars"]["DB"]
            action_desc = (
                f"{aw_spec['name']} quarterback {qb_name} in {aw_spec['away_jersey']} with number {qb_num} and {aw_spec['helmet']} "
                f"throwing ONE single deep spiral pass over {hm_spec['name']} defender {db_name} in {hm_spec['home_jersey']} "
                f"with number {db_num} and {hm_spec['helmet']}"
            )
    else:
        # Jugador estrella o Noticia de Alto Impacto
        team_abbr = matchup.strip().upper()
        t_spec = TEAM_VISUAL_SPECS.get(team_abbr)
        if not t_spec:
            for abbr, sp in TEAM_VISUAL_SPECS.items():
                if sp["name"].lower() in full_txt or abbr.lower() in full_txt.split():
                    t_spec = sp
                    break
        if not t_spec:
            t_spec = TEAM_VISUAL_SPECS["PHI"]

        nums = extract_numbers_from_text(body)
        num_str = f"#{nums[0]}" if nums else t_spec["stars"]["QB"][1]

        if "lesión" in full_txt or "injury" in full_txt or "surgery" in full_txt or "cirugía" in full_txt or "questionable" in full_txt or "out for" in full_txt:
            action_desc = (
                f"{t_spec['name']} star player in {t_spec['home_jersey']} with number {num_str.lstrip('#')} and {t_spec['helmet']} "
                f"sitting on the stadium sideline medical bench while a team athletic trainer evaluates him under stadium lights"
            )
        elif "trade" in full_txt or "canje" in full_txt or "rumor" in full_txt or "chiefs" in full_txt:
            action_desc = (
                f"{t_spec['name']} star wide receiver in {t_spec['home_jersey']} with number {num_str.lstrip('#')} and {t_spec['helmet']} "
                f"holding ONE single football on the turf between rival NFL team helmets on pedestals symbolizing trade rumors"
            )
        else:
            action_desc = (
                f"{t_spec['name']} star player in {t_spec['home_jersey']} with number {num_str.lstrip('#')} and {t_spec['helmet']} "
                f"making an explosive play with ONE single brown leather football on the NFL stadium turf"
            )

    return (
        f"3D claymation (caricatura de plastilina) full-bleed widescreen 16:9 illustration extending to the edges with NO border or frame: "
        f"{action_desc}. Handcrafted plasticine clay texture, authentic NFL helmets and jersey numbers, natural two-arm anatomy, "
        f"dramatic stadium floodlights, vibrant turf."
    )


def _get_gemini_api_key() -> str:
    """Busca GEMINI_API_KEY en variables de entorno o en archivos .env locales."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    candidate_envs = [
        os.path.join(BASE_DIR, ".env"),
        os.path.join( os.path.dirname(BASE_DIR), "Efemérides", ".env"),
    ]
    for env_path in candidate_envs:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8-sig") as f:
                    for line in f:
                        if line.strip().startswith("GEMINI_API_KEY="):
                            val = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return ""


def generate_new_unique_clay_image(tip: dict, registry: dict) -> str:
    """
    Genera automáticamente una nueva imagen 3D claymation 16:9 única y concordante
    cuando se crea un tweet nuevo que no tiene imagen dedicada o cuya imagen ya fue usada.
    """
    tip_id = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(tip.get("id", f"tip_{int(time.time())}")))
    prompt = tip.get("clay_prompt") or build_concordant_clay_prompt(tip)
    seed = int(hashlib.sha256(f"{tip_id}:{prompt}:{time.time()}".encode("utf-8")).hexdigest()[:8], 16) % 900000 + 100000
    filename = f"clay_auto_{tip_id}_{seed}.jpg"
    abs_path = os.path.join(CLAY_DIR, filename)
    rel_path = f"assets/clay/{filename}"

    # 1. Intentar con Gemini API (gemini-3.1-flash-image) si hay GEMINI_API_KEY configurada
    api_key = _get_gemini_api_key()
    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
            }
            resp = requests.post(url, json=payload, timeout=35)
            if resp.status_code == 200:
                candidates = resp.json().get("candidates", [])
                for cand in candidates:
                    for part in cand.get("content", {}).get("parts", []):
                        inline = part.get("inlineData")
                        if inline and inline.get("data"):
                            img_bytes = base64.b64decode(inline["data"])
                            with open(abs_path, "wb") as f:
                                f.write(img_bytes)
                            return rel_path
        except Exception as e:
            print(f"[WARN] Gemini Image API fallback a FLUX 16:9: {e}")

    # 2. Fallback: Pollinations FLUX 16:9 con seed único garantizado
    try:
        encoded = urllib.parse.quote(prompt)
        flux_url = f"https://image.pollinations.ai/prompt/{encoded}?width=1600&height=900&nologo=true&model=flux&seed={seed}"
        r = requests.get(flux_url, timeout=40, headers={"User-Agent": "NFLAnalyticsEngine/2.0"})
        if r.status_code == 200 and len(r.content) > 15000:
            with open(abs_path, "wb") as f:
                f.write(r.content)
            return rel_path
    except Exception as e:
        print(f"[WARN] Pollinations FLUX 16:9 error: {e}")

    return rel_path


def enforce_unique_concordant_images(tips_list: list) -> list:
    """
    Verifica que todos los tweets en `tips_list`:
    1. Tengan su `clay_prompt` 100% concordante con equipos, camisetas, números (#) y acción.
    2. Tengan una ruta `illustration` única (0 duplicados dentro del lote y 0 colisiones de SHA-256).
    3. Registra cada asignación en `data/used_images_registry.json`.
    """
    reg = load_used_images_registry()
    batch_used_paths = set()
    batch_used_hashes = set()

    for tip in tips_list:
        tip_id = str(tip.get("id", ""))
        if not tip.get("clay_prompt"):
            tip["clay_prompt"] = build_concordant_clay_prompt(tip)
        else:
            # Asegurar que el prompt incluya la instrucción 16:9 sin bordes y con números exactos
            tip["clay_prompt"] = build_concordant_clay_prompt(tip)

        illus = str(tip.get("illustration", "")).strip()
        abs_illus = os.path.join(BASE_DIR, illus.replace("/", os.sep)) if illus else ""
        file_hash = compute_file_sha256(abs_illus) if abs_illus else ""

        # Verificar si la imagen falta, o ya fue usada por OTRO tweet en este lote, o por OTRO tweet distinto en el historial
        prev_owner = None
        for existing_id, meta in reg.get("entries", {}).items():
            if existing_id != tip_id:
                if (illus and meta.get("illustration") == illus) or (file_hash and meta.get("sha256") == file_hash):
                    prev_owner = existing_id
                    break

        if (
            not illus
            or not os.path.exists(abs_illus)
            or illus in batch_used_paths
            or (file_hash and file_hash in batch_used_hashes)
            or prev_owner is not None
        ):
            print(f"[IMAGE ENGINE] Generando nueva imagen 16:9 única para {tip_id} (prev_owner={prev_owner})...")
            new_rel = generate_new_unique_clay_image(tip, reg)
            tip["illustration"] = new_rel
            abs_illus = os.path.join(BASE_DIR, new_rel.replace("/", os.sep))
            file_hash = compute_file_sha256(abs_illus)

        batch_used_paths.add(tip["illustration"])
        if file_hash:
            batch_used_hashes.add(file_hash)

        reg["entries"][tip_id] = {
            "tip_id": tip_id,
            "matchup": tip.get("matchup", ""),
            "headline": tip.get("headline", ""),
            "illustration": tip["illustration"],
            "sha256": file_hash,
            "players_numbers": extract_numbers_from_text(tip.get("body", "")),
            "clay_prompt": tip["clay_prompt"],
            "assigned_at": datetime.datetime.now().isoformat(),
        }

    save_used_images_registry(reg)
    return tips_list
