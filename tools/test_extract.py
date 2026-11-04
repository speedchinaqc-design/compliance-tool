#!/usr/bin/env python3
"""用合成文本、Word 和一份只有示例栏位的 PDF 检查本地提取。不包含真实报告。"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

from extract_local import normalize_flammability, parse_component_text, parse_material_text


COMPONENT_TEXT = """
TABLE: Critical components information
Component  Manufacturer  Model  Technical  Standard  Marks
Fuse  Littelfuse  0215  250V  IEC 60127  E10480
"""

MATERIAL_TEXT = """
成型廠名稱 MOLDER NAME
示例成型厂
原料 UL 號碼 MATERIAL UL FILE NUMBER
E201164 VO
料號 PART NUMBER
PN-1
原料製造商 MATERIAL MANUFACTURER
示例原料厂
原料型號 MATERIAL DESIGNATION
PC-100
"""


def test_text() -> None:
    assert normalize_flammability("VO") == "V-0"
    assert normalize_flammability("V0") == "V-0"
    parsed = parse_component_text(COMPONENT_TEXT)
    assert parsed["rows"] and parsed["rows"][0]["name"] == "Fuse"
    assert parsed["rows"][0]["certMark"] == "E10480"
    assert parsed["incomplete"] is False
    material = parse_material_text(MATERIAL_TEXT)
    assert material["fields"]["ulFile"] == "E201164"
    assert material["fields"]["flammability"] == "V-0"
    assert material["fields"]["partNo"] == "PN-1"
    assert material["fields"]["molder"] == "示例成型厂"


def _minimal_pdf(path: Path) -> None:
    lines = [
        "TABLE: Critical components information",
        "Fuse  ExampleCo  0215  250V  IEC60127  E10480",
    ]
    commands = ["BT", "/F1 12 Tf"]
    y = 720
    for line in lines:
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        commands.append(f"1 0 0 1 72 {y} Tm ({safe}) Tj")
        y -= 18
    commands.append("ET")
    stream = "\n".join(commands).encode("ascii")
    objects = []
    objects.append(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    objects.append(b"2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n")
    objects.append(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    )
    objects.append(b"4 0 obj<< /Length " + str(len(stream)).encode("ascii") + b" >>stream\n" + stream + b"\nendstream\nendobj\n")
    objects.append(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj)
    xref = out.tell()
    out.write(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    out.write(f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii"))
    path.write_bytes(out.getvalue())


def _minimal_docx(path: Path) -> None:
    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>List of critical components</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>Relay</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Example</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>RY1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>5V</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>UL 62368-1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>E12345</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
  </w:body>
</w:document>
"""
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""
    rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)


def test_files(tmp: Path) -> None:
    pdf = tmp / "sample-components.pdf"
    docx = tmp / "sample-components.docx"
    _minimal_pdf(pdf)
    _minimal_docx(docx)
    from extract_local import extract_file

    pdf_result = extract_file(pdf, "components")
    if pdf_result.get("message", "").startswith("未安装"):
        raise SystemExit(pdf_result["message"])
    assert any(row["name"] == "Fuse" for row in pdf_result["rows"]), pdf_result
    docx_result = extract_file(docx, "components")
    if docx_result.get("message", "").startswith("未安装"):
        raise SystemExit(docx_result["message"])
    assert any(row["name"] == "Relay" for row in docx_result["rows"]), docx_result


def main() -> None:
    test_text()
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        test_files(Path(tmp))
    print("extract tests passed")


if __name__ == "__main__":
    main()
