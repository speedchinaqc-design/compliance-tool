#!/usr/bin/env python3
"""在本机打开合规查询页。只监听 127.0.0.1，不对局域网或公网提供服务。"""
from __future__ import annotations

import argparse
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEXT_TYPES = (
    "text/",
    "application/javascript",
    "text/javascript",
    "application/json",
    "application/xml",
    "application/yaml",
    "image/svg+xml",
)


class LocalHandler(SimpleHTTPRequestHandler):
    """本机静态文件。文本一律标明 UTF-8，并禁止缓存，避免 Windows 中文环境把脚本当成 GBK。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def guess_type(self, path):
        ctype = super().guess_type(path)
        if ctype.startswith(TEXT_TYPES) or any(ctype.startswith(item) for item in TEXT_TYPES):
            if "charset=" not in ctype.lower():
                return ctype + "; charset=utf-8"
        return ctype

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="本地打开合规查询页")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), LocalHandler)
    login_url = f"http://127.0.0.1:{args.port}/login.html"
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
