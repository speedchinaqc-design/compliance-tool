#!/usr/bin/env python3
"""确认文本文件是干净的 UTF-8，没有替换字符或常见乱码。"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {".js", ".html", ".css", ".yaml", ".yml", ".py", ".md", ".json"}
# UTF-8 被当成 Latin-1/GBK 再存回去时会出现的片段。
MOJIBAKE = ("\u00c3", "\u00c2", "\u00e6\u0153", "\u00e5\u00b8", "\u00e4\u00b8", "\u951f\u65a4\u62f7", "\u70eb\u70eb", "\u5c6f\u5c6f")
REQUIRED = {
    "js/app.js": ("产品项目", "未选", "模块", "打开工作区"),
    "js/login.js": ("登录", "index.html?v=1.4.1"),
    "index.html": ("js/app.js?v=1.4.1", "js/home.js?v=1.4.1"),
    "js/paths.js": ("打开本地文件夹", "在网页版 Dropbox 打开"),
    "js/archive.js": ("档案首页", "对比清单"),
    "js/store.js": ("26-005366-600", "非真实编号"),
}


def main() -> None:
    errors: list[str] = []
    checked = 0
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if path.suffix.lower() not in EXTENSIONS:
            continue
        checked += 1
        data = path.read_bytes()
        if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
            errors.append(f"{rel} 是 UTF-16，应改为 UTF-8")
            continue
        if b"\x00" in data:
            errors.append(f"{rel} 含有空字节")
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            errors.append(f"{rel} 不是合法 UTF-8：{exc}")
            continue
        if "\ufffd" in text:
            errors.append(f"{rel} 含有替换字符 U+FFFD")
        for marker in MOJIBAKE:
            if marker in text:
                errors.append(f"{rel} 含有疑似乱码片段 {marker!r}")
                break
    for rel, needles in REQUIRED.items():
        text = (ROOT / rel).read_text(encoding="utf-8")
        for needle in needles:
            if needle not in text:
                errors.append(f"{rel} 缺少预期中文或版本标记：{needle}")
    if errors:
        print("编码检查未通过：", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        sys.exit(1)
    print(f"编码检查通过，{checked} 个文本文件均为 UTF-8。")


if __name__ == "__main__":
    main()
