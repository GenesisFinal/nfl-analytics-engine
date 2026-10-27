#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor Web & API de Publicación Controlada para NFL Analytics & X Tips Engine.
- Sirve la aplicación web en http://localhost:8085
- Endpoint POST /api/publish:
    Envía a publicar (SOLO bajo orden explícita del usuario) en 3 modos:
      1) 'now'      -> Publicación Inmediata
      2) 'offset'   -> Programado dentro de X minutos / horas
      3) 'datetime' -> Programado en fecha y hora exacta (ART UTC-3 -> UTC)
    Sube automáticamente la ilustración de plastilina a Uploadcare (con fallback CDN directo a pomf2.lain.la)
    y ejecuta la mutación GraphQL `createPost` de Buffer respetando el esquema estricto
    (`PostActionSuccess` | `InvalidInputError`) y separación mínima de 10 minutos entre lotes.
- Endpoint POST /api/refresh:
    Re-ejecuta en vivo actualizar_datos_nfl.py y generador_tips_x.py.
"""

import os
import json
import time
import datetime
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "data", "publisher_config.json")
HISTORY_PATH = os.path.join(BASE_DIR, "data", "publish_history.json")

UPLOADCARE_PUB_KEY = "7d6b9baa89bfe29d27c2"
BUFFER_GRAPHQL_URL = "https://api.buffer.com/graphql"


def load_config() -> dict:
    cfg = {
        "buffer_access_token": os.environ.get("BUFFER_ACCESS_TOKEN", ""),
        "buffer_channel_id": os.environ.get("BUFFER_CHANNEL_ID", ""),
        "dashboard_public_url": "https://genesisfinal.github.io/nfl-analytics-engine/",
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                cfg.update({k: v for k, v in saved.items() if v})
        except Exception:
            pass
    return cfg


def save_config(new_cfg: dict) -> dict:
    cfg = load_config()
    cfg.update(new_cfg)
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def append_publish_history(entry: dict):
    os.makedirs(os.path.dirname(HISTORY_PATH), exist_ok=True)
    hist = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                hist = json.load(f)
        except Exception:
            hist = []
    hist.insert(0, entry)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(hist[:100], f, ensure_ascii=False, indent=2)


def upload_image_to_cdn(local_rel_path: str) -> str:
    """
    Sube la ilustración de plastilina a Uploadcare (`7d6b9baa89bfe29d27c2`)
    y usa automáticamente `https://pomf2.lain.la/upload.php` como respaldo permanente
    si Uploadcare devuelve 403 / límite de cuota.
    """
    clean_rel = local_rel_path.lstrip("/").replace("/", os.sep)
    abs_path = os.path.join(BASE_DIR, clean_rel)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"No se encontró la ilustración en: {abs_path}")

    filename = os.path.basename(abs_path)

    # 1. Intento primario: Uploadcare
    try:
        with open(abs_path, "rb") as f:
            resp = requests.post(
                "https://upload.uploadcare.com/base/",
                data={"UPLOADCARE_PUB_KEY": UPLOADCARE_PUB_KEY, "UPLOADCARE_STORE": "1"},
                files={"file": (filename, f, "image/jpeg")},
                timeout=20,
            )
        if resp.status_code == 200 and "file" in resp.json():
            file_uuid = resp.json()["file"]
            return f"https://ucarecdn.com/{file_uuid}/{filename}"
    except Exception as e:
        print(f"[WARN] Uploadcare falló ({e}), activando fallback pomf2.lain.la...")

    # 2. Fallback permanente directo: pomf2.lain.la
    for attempt in range(3):
        try:
            with open(abs_path, "rb") as f:
                resp2 = requests.post(
                    "https://pomf2.lain.la/upload.php",
                    files={"files[]": (filename, f, "image/jpeg")},
                    timeout=25,
                )
            if resp2.status_code == 200:
                j = resp2.json()
                if j.get("success") and j.get("files"):
                    return j["files"][0]["url"]
            elif resp2.status_code == 429:
                time.sleep(4.0 * (attempt + 1))
        except Exception as e:
            print(f"[WARN] Fallback CDN intento {attempt+1}: {e}")
            time.sleep(3.5)

    raise RuntimeError("No se pudo subir la imagen a Uploadcare ni al CDN de respaldo.")


def schedule_or_publish_buffer(token: str, channel_id: str, text: str, image_cdn_url: str, mode: str, due_at_iso: str = None) -> dict:
    """
    Ejecuta la mutación GraphQL `createPost` de Buffer siguiendo la regla estricta:
    Únicamente consultar `PostActionSuccess` e `InvalidInputError` (sin `UserError`).
    """
    mutation = """
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
          }
        }
        ... on InvalidInputError {
          message
        }
      }
    }
    """
    post_input = {
        "channelId": channel_id,
        "text": text,
        "schedulingType": "automatic",
        "mode": "shareNow" if mode == "now" else "customScheduled",
        "assets": {
            "images": [
                {
                    "url": image_cdn_url,
                }
            ]
        },
    }
    if mode != "now" and due_at_iso:
        post_input["dueAt"] = due_at_iso

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    resp = requests.post(
        BUFFER_GRAPHQL_URL,
        headers=headers,
        json={"query": mutation, "variables": {"input": post_input}},
        timeout=20,
    )
    return resp.json()


class NFLAnalyticsRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/config":
            cfg = load_config()
            hist = []
            if os.path.exists(HISTORY_PATH):
                try:
                    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                        hist = json.load(f)[:20]
                except Exception:
                    pass
            self._send_json(200, {
                "has_buffer_credentials": bool(cfg.get("buffer_access_token") and cfg.get("buffer_channel_id")),
                "buffer_channel_id": cfg.get("buffer_channel_id", ""),
                "dashboard_public_url": cfg.get("dashboard_public_url", "https://amoll.github.io/nfl-analytics-engine/"),
                "history": hist,
            })
            return
        super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            body = json.loads(raw_body)
        except Exception:
            body = {}

        if self.path == "/api/config":
            updated = save_config(body)
            self._send_json(200, {
                "ok": True,
                "has_buffer_credentials": bool(updated.get("buffer_access_token") and updated.get("buffer_channel_id")),
                "buffer_channel_id": updated.get("buffer_channel_id", ""),
                "dashboard_public_url": updated.get("dashboard_public_url", ""),
            })
            return

        if self.path == "/api/refresh":
            try:
                subprocess.run(["python", "actualizar_datos_nfl.py"], cwd=BASE_DIR, check=True)
                subprocess.run(["python", "generador_tips_x.py"], cwd=BASE_DIR, check=True)
                self._send_json(200, {"ok": True, "message": "Datos y Top News actualizados en vivo."})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        if self.path == "/api/publish":
            # Procesa 1 o varios posts seleccionados bajo orden manual del usuario
            items = body.get("items", [])
            publish_mode = body.get("mode", "now")  # 'now' | 'offset' | 'datetime'
            offset_minutes = int(body.get("offset_minutes", 30))
            scheduled_datetime_art = body.get("scheduled_datetime_art", "")  # 'YYYY-MM-DDTHH:MM'

            if not items:
                self._send_json(400, {"ok": False, "error": "No se recibieron posteos para publicar."})
                return

            cfg = load_config()
            token = body.get("buffer_access_token") or cfg.get("buffer_access_token", "")
            channel_id = body.get("buffer_channel_id") or cfg.get("buffer_channel_id", "")

            # Calcular timestamp base UTC si es programado
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            base_due_utc = now_utc

            if publish_mode == "offset":
                base_due_utc = now_utc + datetime.timedelta(minutes=max(1, offset_minutes))
            elif publish_mode == "datetime" and scheduled_datetime_art:
                try:
                    # El input datetime-local viene en hora de Argentina (UTC-3)
                    dt_naive = datetime.datetime.strptime(scheduled_datetime_art[:16], "%Y-%m-%dT%H:%M")
                    tz_art = datetime.timezone(datetime.timedelta(hours=-3))
                    dt_art = dt_naive.replace(tzinfo=tz_art)
                    base_due_utc = dt_art.astimezone(datetime.timezone.utc)
                except Exception as e:
                    self._send_json(400, {"ok": False, "error": f"Formato de fecha/hora inválido: {e}"})
                    return

            results = []
            for idx, item in enumerate(items):
                text = item.get("full_text", "").strip()
                illustration = item.get("illustration", "assets/clay/clay_tnf_pass_duel.jpg")
                title = item.get("title", "Post NFL")

                # Respetar separación mínima de 10 minutos entre posteos de un mismo lote
                item_due_utc = base_due_utc + datetime.timedelta(minutes=10 * idx)
                due_iso = item_due_utc.strftime("%Y-%m-%dT%H:%M:00.000Z")
                art_display = (item_due_utc - datetime.timedelta(hours=3)).strftime("%d/%m/%Y %H:%M ART")

                try:
                    cdn_url = upload_image_to_cdn(illustration)
                except Exception as e:
                    cdn_url = ""
                    print(f"[WARN] Subida CDN: {e}")

                if token and channel_id and cdn_url:
                    effective_mode = "now" if (publish_mode == "now" and idx == 0) else "scheduled"
                    buf_res = schedule_or_publish_buffer(token, channel_id, text, cdn_url, effective_mode, due_iso)
                    create_data = buf_res.get("data", {}).get("createPost", {})
                    typename = create_data.get("__typename", "")
                    if typename == "PostActionSuccess":
                        post_obj = create_data.get("post", {})
                        entry = {
                            "id": post_obj.get("id", f"buf-{int(time.time())}"),
                            "title": title,
                            "text": text,
                            "cdn_url": cdn_url,
                            "mode": "Inmediato (Ahora)" if effective_mode == "now" else f"Programado ({art_display})",
                            "due_at": due_iso if effective_mode != "now" else "Ahora",
                            "status": "Publicado / Agendado en Buffer",
                            "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        }
                        append_publish_history(entry)
                        results.append({"ok": True, "Buffer": True, "entry": entry})
                    else:
                        err_msg = create_data.get("message") or json.dumps(buf_res)
                        results.append({"ok": False, "error": err_msg, "cdn_url": cdn_url})
                else:
                    # Si no hay credenciales de Buffer activas, registra en la cola local con CDN URL lista y devuelve link de X Intent
                    entry = {
                        "id": f"local-{int(time.time())}-{idx}",
                        "title": title,
                        "text": text,
                        "cdn_url": cdn_url,
                        "mode": "Inmediato (Ahora)" if publish_mode == "now" else f"Programado ({art_display})",
                        "due_at": due_iso if publish_mode != "now" else "Ahora",
                        "status": "Listo con CDN URL (Modo X Directo / Cola Local)",
                        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    }
                    append_publish_history(entry)
                    results.append({"ok": True, "Buffer": False, "entry": entry})

                if idx < len(items) - 1:
                    time.sleep(3.5)

            self._send_json(200, {"ok": True, "results": results})
            return

        self._send_json(404, {"ok": False, "error": "Ruta no encontrada"})


def run_server(port: int = 8085):
    server = ThreadingHTTPServer(("0.0.0.0", port), NFLAnalyticsRequestHandler)
    print("==================================================================")
    print(f"[NFL STUDIO] Servidor activo en: http://localhost:{port}")
    print("==================================================================")
    server.serve_forever()


if __name__ == "__main__":
    run_server()

