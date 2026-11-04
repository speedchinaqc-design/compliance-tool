#!/usr/bin/env python3
"""在本机打开合规查询页。只监听 127.0.0.1，不对局域网或公网提供服务。"""
from __future__ import annotations

import argparse
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="本地打开合规查询页")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
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
