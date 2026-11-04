#!/usr/bin/env python3
"""校验 data/*.yaml，并据此生成 js/data.js。页面双击打开时读的是 js/data.js。"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCHEMA = ROOT / "schema"
JS_DATA = ROOT / "js" / "data.js"

MARKET_FILES = {
    "EU": DATA / "EU.yaml",
    "CA": DATA / "CA.yaml",
    "US": DATA / "US.yaml",
}
EXPECTED_CODES = [
    ("01", "01CYBER", "网络安全"),
    ("02", "02PACK", "包装/EPR"),
    ("03", "03DATA", "数据保护"),
    ("04", "04SAFETY", "电气安全"),
    ("05", "05EMC", "EMC"),
    ("06", "06RADIO", "无线 2.4/5 GHz"),
    ("07", "07BATT", "电池（纽扣）"),
    ("08", "08METRO", "法制计量"),
]
FORBIDDEN_SUFFIXES = {
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsm",
    ".xlsx",
}


def load_yaml(path: Path):
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_schema(name: str) -> Draft202012Validator:
    schema = json.loads((SCHEMA / name).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def fail(messages: list[str]) -> None:
    print("校验未通过：", file=sys.stderr)
    for message in messages:
        print(f"- {message}", file=sys.stderr)
    sys.exit(1)


def check_schema(validator: Draft202012Validator, instance, label: str, errors: list[str]) -> None:
    found = sorted(validator.iter_errors(instance), key=lambda err: list(err.path))
    for err in found:
        path = "/".join(str(part) for part in err.path) or "(根)"
        errors.append(f"{label} {path}: {err.message}")


def render_data_js(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return (
        "/* 由 tools/validate.py 根据 data/*.yaml 生成。请改 YAML，不要手改本文件。 */\n"
        "(function (root) {\n"
        '"use strict";\n'
        f"  root.COMPLIANCE_DATA = {body};\n"
        '})(typeof globalThis !== "undefined" ? globalThis : this);\n'
    )


def collect_attribute_ids(product: dict) -> dict:
    attrs = {}
    for attr in product["attributes"]:
        attrs[attr["id"]] = attr
    return attrs


def check_markets(markets: dict[str, dict], product: dict, errors: list[str]) -> None:
    attrs = collect_attribute_ids(product)
    seen_ids = set()
    catalog = product["knowledge_base"]["dimension_codes"]
    if [(item["code"], item["id"], item["name_zh"]) for item in catalog] != EXPECTED_CODES:
        errors.append("product.yaml 的维度代码表与 8 个统一维度不一致。")
    for code, document in markets.items():
        if document.get("market") != code:
            errors.append(f"{code}.yaml 的 market 字段不是 {code}。")
        dims = document["dimensions"]
        pairs = [(dim["code"], dim["dimension_code"], dim["name_zh"]) for dim in dims]
        if pairs != EXPECTED_CODES:
            errors.append(f"{code}.yaml 的 8 个维度顺序或名称与统一维度表不一致。")
        for dim in dims:
            rule = dim["applies_when"]
            for key in ("attribute", "conditional_on"):
                if key in rule and rule[key] not in attrs:
                    errors.append(f"{code} 维度 {dim['code']} 引用了不存在的属性 {rule[key]}。")
            for entry in dim["entries"]:
                if entry["id"] in seen_ids:
                    errors.append(f"条目 id 重复：{entry['id']}")
                seen_ids.add(entry["id"])
                if not entry["id"].startswith(code + "-"):
                    errors.append(f"{entry['id']} 与市场 {code} 不一致。")
                blob = entry["regulation_name"] + "\n" + entry["certification_route"]
                for standard in entry["standard_numbers"]:
                    if standard not in entry["regulation_name"]:
                        errors.append(f"{entry['id']} 的标准号「{standard}」不在法规名称原文中。")
                label = entry["label_requirements"]
                if label and label not in blob:
                    errors.append(f"{entry['id']} 的标签要求不是法规名称或认证路径中的原文片段。")
                if dim["code"] == "06" and "band_limits" not in entry:
                    errors.append(f"{entry['id']} 缺少第四节 5 GHz 频段表。")
                if dim["code"] != "06" and "band_limits" in entry:
                    errors.append(f"{entry['id']} 不应带有 5 GHz 频段表。")
                for note in entry.get("attribute_notes") or []:
                    when = note.get("when") or {}
                    for attr_id, expected in when.items():
                        if attr_id not in attrs:
                            errors.append(f"{entry['id']} 的提示引用了不存在的属性 {attr_id}。")
                            continue
                        spec = attrs[attr_id]
                        if spec["type"] == "boolean" and not isinstance(expected, bool):
                            errors.append(f"{entry['id']} 的属性 {attr_id} 应为是/否。")
                        if spec["type"] == "enum":
                            allowed = {option["id"] for option in spec.get("options") or []}
                            if expected not in allowed:
                                errors.append(f"{entry['id']} 的属性 {attr_id} 取值不在选项中。")
                for source in entry.get("additional_sources") or []:
                    if source["url"] == entry["source_url"]:
                        errors.append(f"{entry['id']} 的补充来源与矩阵来源 URL 重复。")
    if not any(
        entry.get("health_canada_reply")
        for dim in markets["CA"]["dimensions"]
        if dim["code"] == "07"
        for entry in dim["entries"]
    ):
        errors.append("加拿大电池条目缺少 Health Canada 复函要点。")
    for code, document in markets.items():
        if code == "CA":
            continue
        for dim in document["dimensions"]:
            for entry in dim["entries"]:
                if "health_canada_reply" in entry:
                    errors.append(f"{entry['id']} 不应包含加拿大复函。")


EXPECTED_MODULES = {
    "EU-01": ["CRA"],
    "EU-02": ["电子产品"],
    "EU-03": ["CRA"],
    "EU-04": ["电子产品"],
    "EU-05": ["电子产品"],
    "EU-06": ["电子产品"],
    "EU-07": ["电池"],
    "EU-08": ["计量"],
    "US-01": ["CRA"],
    "US-02": ["电子产品"],
    "US-03": ["CRA"],
    "US-04": ["电子产品"],
    "US-05": ["电子产品", "FCC/ISED"],
    "US-06": ["FCC/ISED"],
    "US-07": ["电池"],
    "US-08": ["计量"],
    "CA-01": ["CRA"],
    "CA-02": ["电子产品"],
    "CA-03": ["CRA"],
    "CA-04": ["电子产品"],
    "CA-05": ["电子产品", "FCC/ISED"],
    "CA-06": ["FCC/ISED"],
    "CA-07": ["电池"],
    "CA-08": ["计量"],
}

EXPECTED_EVIDENCE = {
    "EU-01": ["DoC", "技术文件"],
    "EU-02": ["注册文件", "标签照片"],
    "EU-03": ["合规文档"],
    "EU-04": ["DoC", "技术文件"],
    "EU-05": ["DoC", "测试报告"],
    "EU-06": ["DoC", "测试报告"],
    "EU-07": ["注册文件", "标签照片"],
    "EU-08": ["证书", "标签照片"],
    "US-01": ["合规文档"],
    "US-02": ["注册文件"],
    "US-03": ["合规文档"],
    "US-04": ["证书", "测试报告"],
    "US-05": ["DoC", "测试报告"],
    "US-06": ["证书", "测试报告"],
    "US-07": ["测试报告", "标签照片"],
    "US-08": ["证书"],
    "CA-01": ["无"],
    "CA-02": ["注册文件"],
    "CA-03": ["合规文档"],
    "CA-04": ["证书", "标签照片"],
    "CA-05": ["DoC", "标签照片"],
    "CA-06": ["证书", "测试报告"],
    "CA-07": ["测试报告", "标签照片", "说明书"],
    "CA-08": ["证书"],
}


def known_urls(markets: dict[str, dict]) -> set[str]:
    found = set()
    for document in markets.values():
        for dimension in document["dimensions"]:
            for entry in dimension["entries"]:
                found.add(entry["source_url"])
                for source in entry.get("additional_sources") or []:
                    found.add(source["url"])
    return found


def check_modules(markets: dict[str, dict], catalog: dict, questions: dict, errors: list[str]) -> None:
    ids = [item["id"] for item in catalog["modules"]]
    if ids != ["电子产品", "电池", "CRA", "FCC/ISED", "计量"]:
        errors.append("模块顺序应为：电子产品、电池、CRA、FCC/ISED、计量。")
    if catalog.get("phase_markets") != ["EU", "CA", "US"]:
        errors.append("第一期市场只能是 EU、CA、US。")
    seen = {}
    for document in markets.values():
        for dimension in document["dimensions"]:
            for entry in dimension["entries"]:
                seen[entry["id"]] = entry.get("modules")
    if seen != EXPECTED_MODULES:
        errors.append("条目上的模块标记与第一期归类表不一致。")
    evidence_seen = {
        entry["id"]: entry.get("evidence_types")
        for document in markets.values()
        for dimension in document["dimensions"]
        for entry in dimension["entries"]
    }
    if evidence_seen != EXPECTED_EVIDENCE:
        errors.append("条目上的证据类型与认证路径归类不一致。")
    urls = known_urls(markets)
    qids = set()
    for question in questions["questions"]:
        if question["id"] in qids:
            errors.append(f"向导问题 id 重复：{question['id']}")
        qids.add(question["id"])
        if question["type"] == "enum" and not question.get("options"):
            errors.append(f"向导问题 {question['id']} 缺少选项。")
        for source in question["sources"]:
            url = source.get("url")
            if url and url not in urls:
                errors.append(f"向导问题 {question['id']} 的来源不在市场 YAML 中：{url}")


def check_evidence(evidence: dict, markets: dict[str, dict], errors: list[str]) -> None:
    known = {
        entry["id"]
        for document in markets.values()
        for dim in document["dimensions"]
        for entry in dim["entries"]
    }
    for index, item in enumerate(evidence["entries"]):
        if item["matrix_key"] not in known:
            errors.append(f"evidence.yaml 第 {index + 1} 条的矩阵键 {item['matrix_key']} 没有对应条目。")
        path = item["dropbox_path"]
        if "http://" in path or "https://" in path:
            errors.append(f"evidence.yaml 第 {index + 1} 条应是 Dropbox 路径，不是网址。")


def check_forbidden_files(errors: list[str]) -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue
        if path.suffix.lower() in FORBIDDEN_SUFFIXES:
            errors.append(f"仓库中有不允许提交的文件：{path.relative_to(ROOT)}")


def build_payload(product: dict, evidence: dict, markets: dict[str, dict], catalog: dict, questions: dict) -> dict:
    return {
        "product": product,
        "evidence": evidence,
        "modules": catalog["modules"],
        "questions": questions["questions"],
        "markets": [markets[code] for code in product["market_order"]],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="校验 YAML 并更新 js/data.js")
    parser.add_argument(
        "--check",
        action="store_true",
        help="只检查 js/data.js 是否与 YAML 一致，不写文件",
    )
    args = parser.parse_args()
    errors: list[str] = []

    try:
        market_validator = load_schema("market.schema.json")
        product_validator = load_schema("product.schema.json")
        evidence_validator = load_schema("evidence.schema.json")
        catalog_validator = load_schema("catalog.schema.json")
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        fail([f"无法读取 JSON Schema：{exc}"])

    try:
        product = load_yaml(DATA / "product.yaml")
        evidence = load_yaml(DATA / "evidence.yaml")
        catalog = load_yaml(DATA / "modules.yaml")
        questions = load_yaml(DATA / "questions.yaml")
        markets = {code: load_yaml(path) for code, path in MARKET_FILES.items()}
    except (OSError, yaml.YAMLError) as exc:
        fail([f"无法读取 YAML：{exc}"])

    check_schema(product_validator, product, "product.yaml", errors)
    check_schema(evidence_validator, evidence, "evidence.yaml", errors)
    check_schema(catalog_validator, {"modules": catalog, "questions": questions}, "modules.yaml / questions.yaml", errors)
    for code, document in markets.items():
        check_schema(market_validator, document, f"{code}.yaml", errors)
    if not errors:
        check_markets(markets, product, errors)
        check_evidence(evidence, markets, errors)
        check_modules(markets, catalog, questions, errors)
    check_forbidden_files(errors)
    if errors:
        fail(errors)

    payload = build_payload(product, evidence, markets, catalog, questions)
    rendered = render_data_js(payload)
    JS_DATA.parent.mkdir(parents=True, exist_ok=True)
    current = JS_DATA.read_text(encoding="utf-8") if JS_DATA.exists() else ""
    if args.check:
        if current != rendered:
            fail(["js/data.js 与 YAML 不一致。请运行 python3 tools/validate.py 后一并提交。"])
        print("校验通过，js/data.js 已与 YAML 一致。")
        return
    JS_DATA.write_text(rendered, encoding="utf-8")
    action = "已更新" if current != rendered else "无变化"
    print(f"校验通过，js/data.js {action}。")


if __name__ == "__main__":
    main()
