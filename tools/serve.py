#!/usr/bin/env python3
"""在本机打开合规查询页。只监听 127.0.0.1，不对局域网或公网提供服务。"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import threading
import urllib.request
import webbrowser
import zipfile
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from library import (
    create_product_folders,
    default_dropbox_root,
    ensure_backup_dir,
    library_map,
    local_preview,
    open_folder,
    resolve_root,
    scan_model,
)

ROOT = Path(os.environ.get("COMPLIANCE_ROOT", Path(__file__).resolve().parents[1]))
DATA_DIR = Path(os.environ.get("COMPLIANCE_DATA_DIR", ROOT / "data_local"))
STORE_PATH = DATA_DIR / "store.json"
LOCK = threading.Lock()
REPO = "speedchinaqc-design/compliance-tool"
MAX_STORE_BYTES = 8_000_000
MAX_UPDATE_BYTES = 40_000_000

TEXT_TYPES = (
    "text/",
    "application/javascript",
    "text/javascript",
    "application/json",
    "application/xml",
    "application/yaml",
    "image/svg+xml",
)


def app_version() -> str:
    path = ROOT / "VERSION"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    return "0"


def empty_store() -> dict:
    return {
        "format": "compliance-tool-local-v1",
        "account": None,
        "projects": [],
        "settings": {
            "dropboxRoot": "",
            "backupKeep": 20,
            "lastBackupAt": None,
            "lastBackupPath": "",
            "lastBackupError": "",
        },
    }


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_store() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not STORE_PATH.is_file():
        store = empty_store()
        STORE_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return store
    data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    base = empty_store()
    if not isinstance(data, dict):
        return base
    base["account"] = data.get("account")
    projects = data.get("projects")
    base["projects"] = projects if isinstance(projects, list) else []
    settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
    base["settings"].update({key: settings.get(key, base["settings"][key]) for key in base["settings"]})
    return base


def write_store(store: dict, backup: bool) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if backup:
        _backup(store)
    STORE_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return store


def _backup(store: dict) -> None:
    settings = store["settings"]
    root = resolve_root(settings.get("dropboxRoot"))
    dest = ensure_backup_dir(root)
    if dest is None:
        settings["lastBackupError"] = "Dropbox 根目录不存在，没有写入备份"
        return
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = dest / f"合规工具备份_{stamp}.json"
    path.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    keep = int(settings.get("backupKeep") or 20)
    files = sorted(dest.glob("合规工具备份_*.json"), key=lambda item: item.name, reverse=True)
    for old in files[keep:]:
        old.unlink(missing_ok=True)
    settings["lastBackupAt"] = _now()
    settings["lastBackupPath"] = str(path)
    settings["lastBackupError"] = ""


def normalize_incoming(payload: dict, previous: dict) -> dict:
    store = empty_store()
    account = payload.get("account")
    store["account"] = account if isinstance(account, dict) else None
    projects = payload.get("projects")
    store["projects"] = projects if isinstance(projects, list) else []
    incoming = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    if "dropboxRoot" in incoming:
        store["settings"]["dropboxRoot"] = str(incoming.get("dropboxRoot") or "")
    if "backupKeep" in incoming:
        try:
            store["settings"]["backupKeep"] = max(1, min(100, int(incoming.get("backupKeep") or 20)))
        except (TypeError, ValueError):
            store["settings"]["backupKeep"] = 20
    # 备份时间只由服务器写，避免客户端把刚做的备份时间抹掉。
    store["settings"]["lastBackupAt"] = previous["settings"].get("lastBackupAt")
    store["settings"]["lastBackupPath"] = previous["settings"].get("lastBackupPath") or ""
    store["settings"]["lastBackupError"] = previous["settings"].get("lastBackupError") or ""
    return store


def _github_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "compliance-tool", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def version_tuple(text: str) -> tuple:
    parts = []
    for piece in text.replace("v", "").split("."):
        digits = "".join(ch for ch in piece if ch.isdigit())
        parts.append(int(digits or 0))
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def update_info() -> dict:
    local = app_version()
    try:
        latest = _github_json(f"https://api.github.com/repos/{REPO}/releases/latest")
    except Exception as exc:
        return {"ok": False, "local": local, "error": str(exc)}
    tag = str(latest.get("tag_name") or "")
    return {
        "ok": True,
        "local": local,
        "latest": tag,
        "newer": bool(tag) and version_tuple(tag) > version_tuple(local),
        "htmlUrl": latest.get("html_url") or "",
        "notes": latest.get("body") or "",
        "zipball": latest.get("zipball_url") or "",
    }


def apply_source_update() -> dict:
    info = update_info()
    if not info.get("ok"):
        return info
    if not info.get("newer"):
        return {"ok": False, "error": "已经是最新版本"}
    url = info.get("zipball")
    if not url:
        return {"ok": False, "error": "发布页没有源码包"}
    request = urllib.request.Request(url, headers={"User-Agent": "compliance-tool"})
    with urllib.request.urlopen(request, timeout=60) as response:
        blob = response.read(MAX_UPDATE_BYTES + 1)
    if len(blob) > MAX_UPDATE_BYTES:
        return {"ok": False, "error": "更新包太大"}
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "update.zip"
        archive.write_bytes(blob)
        with zipfile.ZipFile(archive) as package:
            package.extractall(tmp)
        extracted = [path for path in Path(tmp).iterdir() if path.is_dir()]
        if not extracted:
            return {"ok": False, "error": "更新包是空的"}
        source = extracted[0]
        for item in source.rglob("*"):
            if not item.is_file():
                continue
            relative = item.relative_to(source)
            if relative.parts and relative.parts[0] in {"data_local", ".git"}:
                continue
            target = ROOT / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)
    return {"ok": True, "latest": info.get("latest"), "message": "文件已更新。请关掉窗口后重新打开。data_local 没有被覆盖。"}


class LocalHandler(SimpleHTTPRequestHandler):
    """本机静态文件和 JSON 接口。文本标明 UTF-8，并禁止缓存。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def guess_type(self, path):
        ctype = super().guess_type(path) or "application/octet-stream"
        if ctype.startswith(TEXT_TYPES) or any(ctype.startswith(item) for item in TEXT_TYPES):
            if "charset=" not in ctype.lower():
                return ctype + "; charset=utf-8"
        return ctype

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def _local(self) -> bool:
        host = self.client_address[0]
        return host in {"127.0.0.1", "::1"}

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_STORE_BYTES:
            raise ValueError("请求体大小不合法")
        raw = self.rfile.read(length)
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("需要 JSON 对象")
        return data

    def do_GET(self):
        if not self._local():
            self.send_error(403)
            return
        path = self.path.split("?", 1)[0]
        if path == "/api/store":
            with LOCK:
                self._send_json(read_store())
            return
        if path == "/api/library":
            with LOCK:
                store = read_store()
            root = resolve_root(store["settings"].get("dropboxRoot"))
            self._send_json(
                {
                    "root": str(root),
                    "defaultRoot": str(default_dropbox_root()),
                    "rootExists": root.is_dir(),
                    "templateExists": (root / "02_产品" / "_新产品模板").is_dir(),
                    "backupDir": str(root / "00_工具备份"),
                    "map": library_map(),
                    "lastBackupAt": store["settings"].get("lastBackupAt"),
                    "lastBackupError": store["settings"].get("lastBackupError") or "",
                    "backupKeep": store["settings"].get("backupKeep") or 20,
                    "version": app_version(),
                }
            )
            return
        if path == "/api/preview":
            from urllib.parse import parse_qs, urlparse

            query = parse_qs(urlparse(self.path).query)
            target = (query.get("path") or [""])[0]
            with LOCK:
                store = read_store()
            root = resolve_root(store["settings"].get("dropboxRoot"))
            try:
                file_path, mime = local_preview(root, target)
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, 404)
                return
            body = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/api/files":
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            model = ""
            for part in query.split("&"):
                if part.startswith("model="):
                    from urllib.parse import unquote
                    model = unquote(part.split("=", 1)[1])
            with LOCK:
                store = read_store()
            root = resolve_root(store["settings"].get("dropboxRoot"))
            try:
                self._send_json(scan_model(root, model))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, 400)
            return
        if path == "/api/update":
            self._send_json(update_info())
            return
        if path.startswith("/api/"):
            self._send_json({"ok": False, "error": "没有这个接口"}, 404)
            return
        super().do_GET()

    def do_PUT(self):
        if not self._local():
            self.send_error(403)
            return
        if self.path.split("?", 1)[0] != "/api/store":
            self._send_json({"ok": False, "error": "没有这个接口"}, 404)
            return
        try:
            incoming = self._read_json()
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json({"ok": False, "error": str(exc)}, 400)
            return
        with LOCK:
            previous = read_store()
            store = normalize_incoming(incoming, previous)
            saved = write_store(store, backup=True)
        self._send_json(saved)

    def do_POST(self):
        if not self._local():
            self.send_error(403)
            return
        path = self.path.split("?", 1)[0]
        if path == "/api/product-folders":
            try:
                incoming = self._read_json()
                model = str(incoming.get("model") or "")
            except (ValueError, json.JSONDecodeError) as exc:
                self._send_json({"ok": False, "error": str(exc)}, 400)
                return
            with LOCK:
                store = read_store()
            root = resolve_root(store["settings"].get("dropboxRoot"))
            try:
                self._send_json(create_product_folders(root, model))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, 400)
            return
        if path == "/api/open-folder":
            try:
                incoming = self._read_json()
            except (ValueError, json.JSONDecodeError) as exc:
                self._send_json({"ok": False, "error": str(exc)}, 400)
                return
            with LOCK:
                store = read_store()
            root = resolve_root(store["settings"].get("dropboxRoot"))
            try:
                self._send_json(open_folder(root, str(incoming.get("path") or ""), bool(incoming.get("create"))))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, 400)
            return
        if path == "/api/update/apply":
            self._send_json(apply_source_update())
            return
        self._send_json({"ok": False, "error": "没有这个接口"}, 404)


def create_server(host: str = "127.0.0.1", port: int = 8765) -> ThreadingHTTPServer:
    if host not in {"127.0.0.1", "localhost"}:
        raise ValueError("只允许监听本机")
    return ThreadingHTTPServer(("127.0.0.1", port), LocalHandler)


def main() -> None:
    parser = argparse.ArgumentParser(description="本地打开合规查询页")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = create_server("127.0.0.1", args.port)
    login_url = f"http://127.0.0.1:{args.port}/login.html?v={app_version()}"
    print(f"登录页： {login_url}", flush=True)
    print("只在这台电脑上可访问。按 Ctrl+C 停止。", flush=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        opened = webbrowser.open(login_url)
    except Exception as exc:
        opened = False
        print(f"没能自动打开浏览器（{exc}）。")
    if not opened:
        print("请手动打开上面的登录地址。")
    try:
        thread.join()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.shutdown()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
