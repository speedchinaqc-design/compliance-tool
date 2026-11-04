"""Dropbox 知识库的固定目录。只处理路径和文件名，不读取文件内容。"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

MARKETS = ("EU", "CA", "US")
OTHER_BUCKETS = ("通用", "待分类", "参考")

# 维度编号 -> 文件夹名。文件名里的维度代码用短码（08METRO），文件夹用下面的全名。
FOLDER_BY_CODE = {
    "01": "01CYBER_网络安全",
    "02": "02PACK_包装",
    "03": "03DATA_数据安全",
    "04": "04ELEC_电气安全",
    "05": "05EMC",
    "06": "06RADIO_无线",
    "07": "07BATT_电池",
    "08": "08METRO_法制计量",
}
SHORT_BY_CODE = {
    "01": "01CYBER",
    "02": "02PACK",
    "03": "03DATA",
    "04": "04ELEC",
    "05": "05EMC",
    "06": "06RADIO",
    "07": "07BATT",
    "08": "08METRO",
    "00": "00GEN",
}
CODE_BY_SHORT = {value: key for key, value in SHORT_BY_CODE.items()}
TYPE_TO_EVIDENCE = {
    "STD": "技术文件",
    "RPT": "测试报告",
    "CERT": "证书",
    "DOC": "DoC",
    "LBL": "标签照片",
    "CORR": "往来函件",
}
NAME_RE = re.compile(
    r"^(?P<model>.+)_(?P<market>EU|CA|US|GEN)_(?P<dimension>00GEN|0[1-8][A-Z]+)_(?P<type>STD|RPT|CERT|DOC|LBL|CORR)_(?P<number>[^_]+)_(?P<date>\d{8})_(?P<version>v[^._]+)$",
    re.IGNORECASE,
)


def default_dropbox_root() -> Path:
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    return Path(home) / "Dropbox" / "合规知识库"


def resolve_root(configured: str | None) -> Path:
    text = (configured or "").strip()
    if text:
        return Path(text).expanduser()
    return default_dropbox_root()


def safe_model(model: str) -> str:
    name = (model or "").strip()
    if not name or name in {".", ".."} or "/" in name or "\\" in name or ".." in name:
        raise ValueError("型号名不能包含斜杠")
    return name


def product_dir(root: Path, model: str) -> Path:
    return root / "02_产品" / safe_model(model)


def slot_dir(root: Path, model: str, market: str, dimension_code: str) -> Path:
    market = market.upper()
    if market not in MARKETS:
        raise ValueError("市场必须是 EU、CA 或 US")
    folder = FOLDER_BY_CODE.get(dimension_code)
    if not folder:
        raise ValueError("未知维度")
    return product_dir(root, model) / market / folder


def template_dir(root: Path) -> Path:
    return root / "02_产品" / "_新产品模板"


def ensure_backup_dir(root: Path) -> Path | None:
    if not root.is_dir():
        return None
    dest = root / "00_工具备份"
    dest.mkdir(exist_ok=True)
    return dest


def create_product_folders(root: Path, model: str) -> dict:
    """从 _新产品模板复制。模板不在时按同样结构建空目录。不复制文件内容进仓库。"""
    model = safe_model(model)
    dest = product_dir(root, model)
    if dest.exists():
        return {"ok": True, "created": False, "path": str(dest), "note": "文件夹已经存在"}
    if not root.is_dir():
        return {"ok": False, "created": False, "path": str(dest), "note": "Dropbox 根目录不存在"}
    source = template_dir(root)
    if source.is_dir():
        shutil.copytree(source, dest)
        ensure_other_folders(dest)
        return {"ok": True, "created": True, "path": str(dest), "note": "已从 _新产品模板复制"}
    for market in MARKETS:
        for folder in FOLDER_BY_CODE.values():
            (dest / market / folder).mkdir(parents=True, exist_ok=True)
    ensure_other_folders(dest)
    return {"ok": True, "created": True, "path": str(dest), "note": "没有找到 _新产品模板，已按同样结构新建空文件夹"}


def ensure_other_folders(dest: Path) -> None:
    for bucket in OTHER_BUCKETS:
        (dest / "09_其他资料" / bucket).mkdir(parents=True, exist_ok=True)


def _inside(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def list_slot(root: Path, model: str, market: str, dimension_code: str) -> dict:
    folder = slot_dir(root, model, market, dimension_code)
    payload = {
        "market": market.upper(),
        "dimension": dimension_code,
        "folder": str(folder),
        "files": [],
        "missing": True,
    }
    if not root.is_dir() or not folder.is_dir() or not _inside(root, folder):
        return payload
    payload["missing"] = False
    files = []
    for entry in folder.iterdir():
        if not entry.is_file() or entry.is_symlink():
            continue
        if not _inside(root, entry):
            continue
        stat = entry.stat()
        files.append(
            {
                "name": entry.name,
                "size": stat.st_size,
                "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "parsed": parse_filename(entry.name),
            }
        )
    files.sort(key=lambda item: item["name"])
    payload["files"] = files
    if not files:
        payload["missing"] = True
    return payload


def list_other(root: Path, model: str, bucket: str) -> dict:
    folder = product_dir(root, model) / "09_其他资料" / bucket
    payload = {
        "bucket": bucket,
        "folder": str(folder),
        "logical": f"/合规知识库/02_产品/{safe_model(model)}/09_其他资料/{bucket}",
        "formal": bucket == "通用",
        "files": [],
        "missing": True,
    }
    if bucket == "参考":
        payload["formal"] = False
    if bucket == "待分类":
        payload["formal"] = False
    if not root.is_dir() or not folder.is_dir() or not _inside(root, folder):
        return payload
    payload["missing"] = False
    files = []
    for entry in folder.iterdir():
        if not entry.is_file() or entry.is_symlink() or not _inside(root, entry):
            continue
        stat = entry.stat()
        parsed = parse_filename(entry.name)
        files.append(
            {
                "name": entry.name,
                "size": stat.st_size,
                "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "parsed": parsed,
                "formal": payload["formal"] and bool(parsed),
            }
        )
    files.sort(key=lambda item: item["name"])
    payload["files"] = files
    if not files:
        payload["missing"] = True
    return payload


def scan_model(root: Path, model: str) -> dict:
    slots = {}
    for market in MARKETS:
        for code in FOLDER_BY_CODE:
            if code == "00":
                continue
            slots[f"{market}-{code}"] = list_slot(root, model, market, code)
    other = {}
    for bucket in OTHER_BUCKETS:
        other[bucket] = list_other(root, model, bucket)
    return {
        "root": str(root),
        "rootExists": root.is_dir(),
        "templateExists": template_dir(root).is_dir(),
        "model": safe_model(model) if model else "",
        "slots": slots,
        "other": other,
    }


def parse_filename(name: str) -> dict | None:
    stem = Path(name).stem
    match = NAME_RE.match(stem)
    if not match:
        return None
    dimension = match.group("dimension").upper()
    if dimension not in CODE_BY_SHORT:
        return None
    kind = match.group("type").upper()
    date = match.group("date")
    return {
        "model": match.group("model"),
        "market": match.group("market").upper(),
        "dimension": dimension,
        "dimensionCode": CODE_BY_SHORT[dimension],
        "typeCode": kind,
        "evidenceType": TYPE_TO_EVIDENCE[kind],
        "number": match.group("number"),
        "issueDate": f"{date[0:4]}-{date[4:6]}-{date[6:8]}",
        "version": match.group("version"),
    }


def logical_to_local(root: Path, text: str) -> Path:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("路径是空的")
    normalized = raw.replace("\\", "/")
    marker = "合规知识库"
    if marker in normalized:
        suffix = normalized.split(marker, 1)[1].lstrip("/")
        return (root / suffix)
    candidate = Path(raw)
    if candidate.is_absolute():
        return candidate
    return root / normalized.lstrip("/")


def as_folder(path: Path) -> Path:
    if path.exists() and path.is_file():
        return path.parent
    if (not path.exists()) and path.suffix:
        return path.parent
    return path


def open_folder(root: Path, text: str, create: bool) -> dict:
    """打开 Dropbox 根目录内的文件夹。文件路径改为打开所在文件夹。"""
    if not root.is_dir():
        return {"ok": False, "error": "Dropbox 根目录不存在"}
    folder = as_folder(logical_to_local(root, text))
    if not _inside(root, folder):
        raise ValueError("路径超出 Dropbox 根目录")
    if not folder.exists():
        if not create:
            return {"ok": False, "needConfirm": True, "path": str(folder)}
        folder.mkdir(parents=True, exist_ok=True)
        if not _inside(root, folder):
            raise ValueError("路径超出 Dropbox 根目录")
    if os.environ.get("COMPLIANCE_OPEN") == "0":
        return {"ok": True, "opened": False, "path": str(folder)}
    if os.name == "nt":
        os.startfile(str(folder))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(folder)])
    else:
        subprocess.Popen(["xdg-open", str(folder)])
    return {"ok": True, "opened": True, "path": str(folder)}


IMAGE_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}


def local_preview(root: Path, text: str) -> tuple[Path, str]:
    """返回 Dropbox 根目录内的一张本地图片。不把文件复制进仓库。"""
    if not root.is_dir():
        raise ValueError("Dropbox 根目录不存在")
    path = logical_to_local(root, text)
    if not _inside(root, path):
        raise ValueError("路径超出 Dropbox 根目录")
    if not path.is_file():
        raise ValueError("不是本地文件")
    mime = IMAGE_TYPES.get(path.suffix.lower())
    if not mime:
        raise ValueError("不是图片")
    if path.stat().st_size > 12_000_000:
        raise ValueError("图片太大")
    return path, mime


def library_map() -> dict:
    return {
        "folders": FOLDER_BY_CODE,
        "short": SHORT_BY_CODE,
        "types": TYPE_TO_EVIDENCE,
        "naming": "型号_市场_维度_类型_编号_签发日期_版本",
        "example": "UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf",
        "exampleNote": "命名举例，不是真实证书。",
    }
