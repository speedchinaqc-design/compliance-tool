#!/usr/bin/env python3
import os
import tempfile
from pathlib import Path

from library import create_product_folders, local_preview, open_folder, parse_filename, scan_model, to_library_path

os.environ["COMPLIANCE_OPEN"] = "0"


def main() -> None:
    general = parse_filename("UNI-8_GEN_00GEN_RPT_CB12345_20260301_v1.pdf")
    assert general and general["market"] == "GEN" and general["dimension"] == "00GEN"
    assert general["evidenceType"] == "测试报告" and general["number"] == "CB12345"
    parsed = parse_filename("UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf")
    assert parsed and parsed["market"] == "EU" and parsed["dimension"] == "08METRO"
    assert parsed["evidenceType"] == "证书" and parsed["issueDate"] == "2026-01-15"
    assert parse_filename("notes.txt") is None
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "02_产品" / "_新产品模板" / "EU" / "08METRO_法制计量").mkdir(parents=True)
        marker = root / "02_产品" / "_新产品模板" / "EU" / "08METRO_法制计量" / "readme.txt"
        marker.write_text("template", encoding="utf-8")
        made = create_product_folders(root, "UNI-8")
        assert made["created"] and (root / "02_产品" / "UNI-8" / "EU" / "08METRO_法制计量" / "readme.txt").is_file()
        assert (root / "02_产品" / "UNI-8" / "09_其他资料" / "待分类").is_dir()
        assert (root / "02_产品" / "UNI-8" / "GEN" / "04ELEC_电气安全").is_dir()
        assert (root / "02_产品" / "UNI-8" / "GEN" / "10MAT_材料保证书").is_dir()
        material_name = parse_filename("UNI-8_GEN_10MAT_COC_PN1_20260301_V1.pdf")
        assert material_name and material_name["formal"] is False and material_name["evidenceType"] == "材料保证书"
        unsorted = root / "02_产品" / "UNI-8" / "09_其他资料" / "待分类" / "loose.pdf"
        unsorted.write_bytes(b"x")
        reference = root / "02_产品" / "UNI-8" / "09_其他资料" / "参考" / "UNI-8_GEN_00GEN_RPT_CB12345_20260301_v1.pdf"
        reference.write_bytes(b"ref")
        sample = root / "02_产品" / "UNI-8" / "EU" / "08METRO_法制计量" / "UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf"
        sample.write_bytes(b"not-the-real-file")
        scanned = scan_model(root, "UNI-8")
        assert scanned["other"]["待分类"]["files"][0]["name"] == "loose.pdf"
        assert scanned["other"]["参考"]["files"][0]["formal"] is False
        assert scanned["other"]["参考"]["formal"] is False
        slot = scanned["slots"]["EU-08"]
        assert slot["files"] and slot["files"][0]["name"].startswith("UNI-8_EU_08METRO")
        assert "size" in slot["files"][0] and "mtime" in slot["files"][0]
        opened = open_folder(root, "/合规知识库/02_产品/UNI-8/EU/08METRO_法制计量/UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf", False)
        assert opened["ok"] and opened["path"].endswith("08METRO_法制计量")
        missing = open_folder(root, "/合规知识库/02_产品/UNI-8/CA/07BATT_电池", False)
        assert missing["needConfirm"] is True
        try:
            open_folder(root, "/合规知识库/../outside", True)
            raise SystemExit("应当拒绝跑出根目录")
        except ValueError:
            pass
        shot = root / "02_产品" / "UNI-8" / "shot.png"
        assert to_library_path(root, shot) == "/合规知识库/02_产品/UNI-8/shot.png"
        assert to_library_path(root, root.parent / "secret.png") is None
        shot.write_bytes(b"\x89PNG\r\n\x1a\n")
        preview, mime = local_preview(root, "/合规知识库/02_产品/UNI-8/shot.png")
        assert preview == shot and mime == "image/png"
        try:
            local_preview(root, "/合规知识库/../secret.png")
            raise SystemExit("缩略图应当拒绝跑出根目录")
        except ValueError:
            pass
        try:
            local_preview(root, "/合规知识库/02_产品/UNI-8/EU/08METRO_法制计量/readme.txt")
            raise SystemExit("非图片不能当缩略图")
        except ValueError:
            pass
    print("library tests passed")


if __name__ == "__main__":
    main()
