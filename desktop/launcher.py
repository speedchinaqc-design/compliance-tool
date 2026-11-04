"""桌面入口：只在本机启动页面服务，并用系统网页组件打开登录页。"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path


def bundle_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parents[1]


def data_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / "data_local"
    override = os.environ.get("COMPLIANCE_DATA_DIR")
    if override:
        return Path(override)
    return bundle_root() / "data_local"


def main() -> None:
    root = bundle_root()
    os.environ["COMPLIANCE_ROOT"] = str(root)
    os.environ["COMPLIANCE_DATA_DIR"] = str(data_dir())
    sys.path.insert(0, str(root / "tools"))
    import serve

    port = 8765
    server = serve.create_server("127.0.0.1", port)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/login.html?v={serve.app_version()}"
    try:
        import webview

        webview.create_window("合规查询工具", url, width=1280, height=860)
        webview.start()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
