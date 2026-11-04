"""在本机从 PDF 或 Word 抽出字段。不上传文件，也不把原文写进仓库。"""
from __future__ import annotations

import re
from pathlib import Path

COMPONENT_HEADERS = (
    "critical components information",
    "list of critical components",
    "关键元器件",
    "关键件",
)
MATERIAL_LABELS = (
    ("molder", ("成型廠名稱", "成型厂名称", "MOLDER NAME")),
    ("purchaser", ("購買者", "购买者", "PURCHASER NAME")),
    ("partNo", ("料號", "料号", "PART NUMBER")),
    ("description", ("品名", "PART DESCRIPTION")),
    ("quantity", ("數量/採購單號碼", "数量/采购单号码", "QUANTITY/P.O. NO.", "QUANTITY/P.O. NO")),
    ("specNo", ("規格書號碼", "规格书号码", "SPECIFICATION NO.", "SPECIFICATION NO")),
    ("moldingDate", ("成型日期", "MOLDING DATE")),
    ("shippingDate", ("出貨日期", "出货日期", "SHIPPING DATE")),
    ("manufacturer", ("原料製造商", "原料制造商", "MATERIAL MANUFACTURER")),
    ("designation", ("原料型號", "原料型号", "MATERIAL DESIGNATION")),
    ("ulFile", ("原料 UL 號碼", "原料 UL 号码", "MATERIAL UL FILE NUMBER")),
    ("flammability", ("原料防火等級", "原料防火等级", "MATERIAL FLAMMABILITY CLASS")),
    ("additives", ("色料或添加劑", "色料或添加剂", "COLOR CONCENTRATES OR ADDITIVES")),
    ("regrind", ("二次料", "REGRIND")),
    ("rev", ("Rev", "REV")),
)


def normalize_flammability(text: str) -> str:
    raw = re.sub(r"\s+", "", str(text or "")).upper().replace("－", "-")
    if raw in {"VO", "V0", "V-0"}:
        return "V-0"
    if raw in {"V1", "V-1"}:
        return "V-1"
    if raw in {"V2", "V-2"}:
        return "V-2"
    return str(text or "").strip()


def _split_ul_and_class(text: str) -> tuple[str, str]:
    match = re.search(r"\b(E\d{4,})\b\s*([Vv][-\s]?[0O012]|HB)?", text or "")
    if not match:
        return "", ""
    ul = match.group(1).upper()
    flame = normalize_flammability(match.group(2) or "")
    return ul, flame


def parse_component_text(text: str) -> dict:
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    start = -1
    for index, line in enumerate(lines):
        lowered = line.lower()
        if any(title in lowered or title in line for title in COMPONENT_HEADERS):
            start = index
            break
    if start < 0:
        return {"rows": [], "incomplete": True, "message": "没有找到关键件表的标题。"}
    rows = []
    for line in lines[start + 1 :]:
        if re.match(r"^(page|第\s*\d+\s*页)", line, re.I):
            continue
        if any(title in line.lower() or title in line for title in COMPONENT_HEADERS):
            continue
        parts = re.split(r"\s{2,}|\t|\|", line)
        parts = [part.strip() for part in parts if part.strip()]
        if len(parts) < 3:
            parts = [part.strip() for part in re.split(r"\s+", line) if part.strip()]
        if len(parts) < 3:
            continue
        if parts[0].lower() in {"component", "name", "部件名称", "部件"}:
            continue
        rows.append(
            {
                "name": parts[0],
                "manufacturer": parts[1] if len(parts) > 1 else "",
                "model": parts[2] if len(parts) > 2 else "",
                "parameters": parts[3] if len(parts) > 3 else "",
                "standard": parts[4] if len(parts) > 4 else "",
                "certMark": parts[5] if len(parts) > 5 else "",
                "partNo": parts[6] if len(parts) > 6 else "",
                "page": "",
            }
        )
    incomplete = len(rows) == 0
    return {"rows": rows, "incomplete": incomplete, "message": "提取不完整" if incomplete else ""}


def parse_material_text(text: str) -> dict:
    lines = [line.strip() for line in (text or "").splitlines()]
    found = {key: "" for key, _labels in MATERIAL_LABELS}
    for index, line in enumerate(lines):
        compact = re.sub(r"\s+", " ", line).strip()
        if not compact:
            continue
        for key, labels in MATERIAL_LABELS:
            for label in labels:
                if label.lower() not in compact.lower() and label not in compact:
                    continue
                remainder = re.split(re.escape(label), compact, flags=re.I, maxsplit=1)[-1]
                remainder = remainder.strip(" :：")
                if key == "ulFile":
                    ul_hit, _flame_hit = _split_ul_and_class(remainder)
                    if not ul_hit and index + 1 < len(lines):
                        remainder = lines[index + 1].strip()
                if (not remainder or remainder.isupper()) and index + 1 < len(lines) and key != "rev":
                    nxt = lines[index + 1].strip()
                    if nxt and not any(other in nxt for _key, labels in MATERIAL_LABELS for other in labels):
                        remainder = nxt
                if not remainder and index + 1 < len(lines):
                    remainder = lines[index + 1].strip()
                if remainder and not found[key]:
                    found[key] = remainder
                break
    ul, flame = _split_ul_and_class(found["ulFile"] or text)
    if ul:
        found["ulFile"] = ul
    if flame and (not found["flammability"] or normalize_flammability(found["flammability"]) in {"", found["flammability"]}):
        found["flammability"] = flame
    found["flammability"] = normalize_flammability(found["flammability"])
    regrind = re.search(r"(\d+(?:\.\d+)?)\s*%?", found["regrind"])
    found["regrind"] = regrind.group(1) if regrind else ""
    missing = [key for key in ("partNo", "manufacturer", "designation", "ulFile") if not found[key]]
    return {"fields": found, "incomplete": bool(missing), "missing": missing}


def _pdf_text(path: Path) -> tuple[str, str]:
    try:
        import pdfplumber
    except ImportError:
        return "", "未安装 pdfplumber。请在本机执行 pip install pdfplumber。"
    try:
        chunks = []
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        return "\n".join(chunks), ""
    except Exception as exc:
        return "", f"没能读取 PDF：{exc}"


def _docx_text(path: Path) -> tuple[str, str]:
    try:
        import docx
    except ImportError:
        return "", "未安装 python-docx。请在本机执行 pip install python-docx。"
    try:
        document = docx.Document(str(path))
        lines = [paragraph.text for paragraph in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                lines.append("\t".join(cell.text.strip() for cell in row.cells))
        return "\n".join(lines), ""
    except Exception as exc:
        return "", f"没能读取 Word：{exc}"


def _ocr_text(path: Path) -> tuple[str, str]:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        pytesseract = None
    else:
        try:
            if path.suffix.lower() == ".pdf":
                import pdfplumber

                chunks = []
                with pdfplumber.open(str(path)) as pdf:
                    for page in pdf.pages:
                        image = page.to_image(resolution=150).original
                        chunks.append(pytesseract.image_to_string(image, lang="chi_sim+eng"))
                text = "\n".join(chunks).strip()
                if text:
                    return text, ""
            else:
                text = pytesseract.image_to_string(Image.open(path), lang="chi_sim+eng").strip()
                if text:
                    return text, ""
        except Exception as exc:
            return "", f"Tesseract 没能识别：{exc}。请安装 Tesseract，并带上 chi_sim 和 eng。"
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        return "", "需要识别。本机还没有 Tesseract（chi_sim+eng）或 rapidocr-onnxruntime。安装步骤见 desktop/install.ps1。"
    try:
        engine = RapidOCR()
        result, _ = engine(str(path))
        lines = [item[1] for item in (result or []) if len(item) > 1]
        text = "\n".join(lines).strip()
        if text:
            return text, ""
    except Exception as exc:
        return "", f"RapidOCR 没能识别：{exc}"
    return "", "需要识别。本机还没有可用的离线 OCR。"


def extract_file(path: Path, kind: str) -> dict:
    """kind 是 components 或 material。只返回字段，不复制文件。"""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        text, error = _pdf_text(path)
    elif suffix in {".docx", ".doc"}:
        text, error = _docx_text(path)
    else:
        text, error = "", "只支持 PDF 或 Word。"
    needs_ocr = False
    if suffix == ".pdf" and not error and len(re.sub(r"\s+", "", text)) < 20:
        needs_ocr = True
        ocr, ocr_error = _ocr_text(path)
        if ocr:
            text = ocr
            needs_ocr = False
        elif ocr_error:
            error = ocr_error
    if kind == "components":
        parsed = parse_component_text(text) if text else {"rows": [], "incomplete": True, "message": error or "没有文字。"}
    else:
        parsed = parse_material_text(text) if text else {"fields": {}, "incomplete": True, "missing": ["partNo"], "message": error or "没有文字。"}
    parsed["needsOcr"] = needs_ocr or (not text and "需要识别" in (error or parsed.get("message") or ""))
    if error and not text:
        parsed["message"] = error
        parsed["needsOcr"] = "需要识别" in error or parsed.get("needsOcr")
    return parsed
