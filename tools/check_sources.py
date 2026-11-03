#!/usr/bin/env python3
"""抓取各条目 source_url，与 data/source-watch.json 里的哈希比较。

只报告变化。不修改法规 YAML，也不把网页正文存进仓库。
在 GitHub Actions 里加 --create-issue 时，用自带的 GITHUB_TOKEN 开或更新一条议题，不需要额外密钥。
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zlib
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASELINE = DATA / "source-watch.json"
MAX_BYTES = 4_000_000
# 部分官网对脚本 UA 直接 403。这里用常见浏览器 UA 读取公开页面，不带登录态。
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ALGORITHM = "sha256-normalized-visible-text-v1"
MIN_TEXT = 80


def load_source_urls() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for code in ("EU", "CA", "US"):
        document = yaml.safe_load((DATA / f"{code}.yaml").read_text(encoding="utf-8"))
        for dimension in document["dimensions"]:
            for entry in dimension["entries"]:
                url = entry["source_url"]
                found.setdefault(url, []).append(entry["id"])
    return dict(sorted(found.items()))


def normalize(html: str) -> str:
    text = re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", html)
    text = re.sub(r"(?is)<style\b[^>]*>.*?</style>", " ", text)
    text = re.sub(r"(?is)<noscript\b[^>]*>.*?</noscript>", " ", text)
    text = re.sub(r"(?is)<!--.*?-->", " ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def content_hash(html: str) -> str:
    return hashlib.sha256(normalize(html).encode("utf-8")).hexdigest()


def decode_body(raw: bytes, encoding: str) -> str:
    lowered = encoding.lower()
    if "gzip" in lowered or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    elif "deflate" in lowered:
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
    return raw.decode("utf-8", errors="replace")


def failure(error: str, status=None, final_url=None, reject_baseline: bool = False) -> dict:
    return {
        "ok": False,
        "status": status,
        "final_url": final_url,
        "hash": None,
        "bytes": None,
        "truncated": False,
        "error": error,
        "reject_baseline": reject_baseline,
    }


def fetch(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en,zh-CN;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read(MAX_BYTES + 1)
            truncated = len(raw) > MAX_BYTES
            if truncated:
                raw = raw[:MAX_BYTES]
            encoding = response.headers.get("Content-Encoding") or ""
            text = decode_body(raw, encoding)
            status = getattr(response, "status", 200)
            final_url = response.geturl()
            if "awsWafCookieDomainList" in text or ("awswaf" in text.lower() and "challenge.js" in text):
                return failure("站点返回了浏览器校验页，脚本读不到法规正文", status, final_url, True)
            if status != 200:
                return failure(f"HTTP {status}，没有当成内容变化", status, final_url, True)
            visible = normalize(text)
            if len(visible) < MIN_TEXT:
                return failure(f"可见文字只有 {len(visible)} 个字符，不写入基线", status, final_url, True)
            return {
                "ok": True,
                "status": status,
                "final_url": final_url,
                "hash": content_hash(text),
                "bytes": len(visible),
                "truncated": truncated,
                "error": None,
                "reject_baseline": False,
            }
    except urllib.error.HTTPError as exc:
        reject = exc.code in (403, 404, 410)
        return failure(f"HTTP Error {exc.code}: {exc.reason}", exc.code, url, reject)
    except (urllib.error.URLError, TimeoutError, OSError, zlib.error, gzip.BadGzipFile, UnicodeError) as exc:
        return failure(str(exc), None, None, False)


def empty_baseline(urls: dict[str, list[str]]) -> dict:
    return {
        "algorithm": ALGORITHM,
        "normalize": "去掉 script/style/noscript 和 HTML 注释，去掉标签，合并空白后做 UTF-8 SHA-256。超过 4000000 字节的响应在解码前截断。",
        "sources": {
            url: {"hash": None, "entries": entries, "fetched_at": None, "error": "尚无基线"}
            for url, entries in urls.items()
        },
    }


def load_baseline(urls: dict[str, list[str]]) -> dict:
    if not BASELINE.exists():
        return empty_baseline(urls)
    data = json.loads(BASELINE.read_text(encoding="utf-8"))
    data.setdefault("sources", {})
    for url, entries in urls.items():
        slot = data["sources"].setdefault(url, {"hash": None, "fetched_at": None, "error": "尚无基线"})
        slot["entries"] = entries
    stale = [url for url in list(data["sources"]) if url not in urls]
    for url in stale:
        del data["sources"][url]
    data["algorithm"] = ALGORITHM
    return data


def write_baseline(baseline: dict) -> None:
    BASELINE.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def classify(baseline: dict, results: dict[str, dict]) -> dict[str, list]:
    changed = []
    unchanged = []
    fetch_errors = []
    missing_baseline = []
    became_unreadable = []
    for url, result in results.items():
        previous = baseline["sources"].get(url, {})
        old_hash = previous.get("hash")
        record = {"url": url, "entries": previous.get("entries") or [], "old_hash": old_hash, "new": result}
        if not result["ok"]:
            if old_hash:
                became_unreadable.append(record)
            else:
                fetch_errors.append(record)
        elif not old_hash:
            missing_baseline.append(record)
        elif old_hash != result["hash"]:
            changed.append(record)
        else:
            unchanged.append(record)
    return {
        "changed": changed,
        "unchanged": unchanged,
        "fetch_errors": fetch_errors,
        "missing_baseline": missing_baseline,
        "became_unreadable": became_unreadable,
    }


def fingerprint(items: list) -> str:
    lines = []
    for item in items:
        new_hash = item["new"]["hash"] or item["new"]["error"]
        lines.append(f"{item['url']} {new_hash}")
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()[:16]


def render_report(groups: dict[str, list]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"检查时间：{now}",
        f"算法：{ALGORITHM}。动态网页可能误报，请打开链接人工确认，不要只凭哈希改 YAML。",
        "",
    ]
    if groups["changed"]:
        lines.append(f"## 有变化（{len(groups['changed'])}）")
        for item in groups["changed"]:
            lines.append(f"- {item['url']}")
            lines.append(f"  - 条目：{', '.join(item['entries'])}")
            lines.append(f"  - 基线：`{item['old_hash']}`")
            lines.append(f"  - 本次：`{item['new']['hash']}`")
        lines.append("")
    if groups["became_unreadable"]:
        lines.append(f"## 原先能读到，这次失败（{len(groups['became_unreadable'])}）")
        for item in groups["became_unreadable"]:
            lines.append(f"- {item['url']}")
            lines.append(f"  - 条目：{', '.join(item['entries'])}")
            lines.append(f"  - 原因：{item['new']['error']}")
        lines.append("")
    if groups["missing_baseline"]:
        lines.append(f"## 尚无基线（{len(groups['missing_baseline'])}，不算作页面变化）")
        for item in groups["missing_baseline"]:
            lines.append(f"- {item['url']}（{', '.join(item['entries'])}）本次 `{item['new']['hash']}`")
        lines.append("")
    if groups["fetch_errors"]:
        lines.append(f"## 本次没抓到（{len(groups['fetch_errors'])}，不算作页面变化）")
        for item in groups["fetch_errors"]:
            lines.append(f"- {item['url']}（{', '.join(item['entries'])}）：{item['new']['error']}")
        lines.append("")
    lines.append(f"未变化：{len(groups['unchanged'])} 个来源。")
    lines.append("")
    lines.append("审阅之后，在自己的电脑上更新基线并提交 `data/source-watch.json`：")
    lines.append("")
    lines.append("```bash")
    lines.append("python3 tools/check_sources.py --write-baseline")
    lines.append("```")
    lines.append("")
    lines.append("本检查不改法规内容，也不会自动关闭议题。")
    watched = groups["changed"] + groups["became_unreadable"]
    if watched:
        lines.append("")
        lines.append(f"<!-- source-watch-fingerprint: {fingerprint(watched)} -->")
    return "\n".join(lines) + "\n"


def gh_json(args: list[str]) -> list | dict:
    completed = subprocess.run(
        ["gh", *args],
        check=False,
        text=True,
        capture_output=True,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or "gh 调用失败")
    if not completed.stdout.strip():
        return []
    return json.loads(completed.stdout)


def upsert_issue(body: str, token_fp: str) -> None:
    if not os.environ.get("GH_TOKEN") and not os.environ.get("GITHUB_TOKEN"):
        raise RuntimeError("没有 GITHUB_TOKEN，不能创建议题。")
    env_repo = os.environ.get("GITHUB_REPOSITORY")
    repo_args = ["--repo", env_repo] if env_repo else []
    subprocess.run(
        ["gh", "label", "create", "source-watch", "--color", "0E4F4A", "--description", "法规来源页自动检查", "--force", *repo_args],
        check=False,
        text=True,
        capture_output=True,
    )
    existing = gh_json(["issue", "list", "--state", "open", "--limit", "50", "--json", "number,title,body", *repo_args])
    current = None
    for issue in existing:
        title = issue.get("title") or ""
        if title.startswith("法规来源页有变化"):
            current = issue
            break
    if current and token_fp and f"source-watch-fingerprint: {token_fp}" in (current.get("body") or ""):
        print(f"已有相同的未关闭议题 #{current['number']}，不重复开。")
        return
    if current:
        number = str(current["number"])
        edited = subprocess.run(
            ["gh", "issue", "edit", number, "--body-file", "-", *repo_args],
            input=body,
            text=True,
            capture_output=True,
            check=False,
        )
        commented = subprocess.run(
            ["gh", "issue", "comment", number, "--body", "本周复查：变化列表已更新到议题正文。", *repo_args],
            text=True,
            capture_output=True,
            check=False,
        )
        if edited.returncode != 0 or commented.returncode != 0:
            raise RuntimeError((edited.stderr or commented.stderr or "更新议题失败").strip())
        print(f"已更新议题 #{number}。")
        return
    created = subprocess.run(
        [
            "gh",
            "issue",
            "create",
            "--title",
            "法规来源页有变化（自动检查）",
            "--label",
            "source-watch",
            "--body-file",
            "-",
            *repo_args,
        ],
        input=body,
        text=True,
        capture_output=True,
        check=False,
    )
    if created.returncode != 0:
        created = subprocess.run(
            ["gh", "issue", "create", "--title", "法规来源页有变化（自动检查）", "--body-file", "-", *repo_args],
            input=body,
            text=True,
            capture_output=True,
            check=False,
        )
    if created.returncode != 0:
        raise RuntimeError(created.stderr.strip() or "创建议题失败")
    print(created.stdout.strip())


def apply_results(baseline: dict, results: dict[str, dict], write_missing: bool) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for url, result in results.items():
        slot = baseline["sources"].setdefault(url, {})
        slot["fetched_at"] = now
        slot["last_status"] = result["status"]
        slot["last_error"] = result["error"]
        slot["final_url"] = result["final_url"]
        if result["ok"] and (write_missing or not slot.get("hash")) and write_missing:
            slot["hash"] = result["hash"]
            slot["error"] = None
        elif result["ok"] and not slot.get("hash"):
            slot["error"] = "尚无基线"
        elif not result["ok"]:
            slot["error"] = result["error"]


def main() -> None:
    parser = argparse.ArgumentParser(description="检查法规来源页是否变化")
    parser.add_argument("--write-baseline", action="store_true", help="用本次抓取结果重写哈希基线")
    parser.add_argument("--create-issue", action="store_true", help="有变化时用 gh 开或更新议题")
    args = parser.parse_args()

    urls = load_source_urls()
    if not urls:
        print("没有 source_url。", file=sys.stderr)
        sys.exit(1)
    baseline = load_baseline(urls)
    results = {}
    for index, url in enumerate(urls, start=1):
        print(f"[{index}/{len(urls)}] {url}", flush=True)
        results[url] = fetch(url)
        if results[url]["ok"]:
            print(f"    {results[url]['status']} {results[url]['hash'][:12]}", flush=True)
        else:
            print(f"    失败 {results[url]['error']}", flush=True)

    if args.write_baseline:
        apply_results(baseline, results, write_missing=True)
        for url, result in results.items():
            if result["ok"]:
                baseline["sources"][url]["hash"] = result["hash"]
                baseline["sources"][url]["error"] = None
            elif result.get("reject_baseline"):
                # 偶发 403 不抹掉上一次已经读到的正文哈希。校验页和过短正文不能留作基线。
                keep = result.get("status") in (403, 404, 410) and baseline["sources"][url].get("hash")
                if not keep:
                    baseline["sources"][url]["hash"] = None
                baseline["sources"][url]["error"] = None if keep else result["error"]
        write_baseline(baseline)
        ok = sum(1 for result in results.values() if result["ok"])
        print(f"已写入基线 {BASELINE}（成功 {ok} / {len(results)}）。读不到正文的来源不写哈希。")
        return

    groups = classify(baseline, results)
    report = render_report(groups)
    print(report)
    watched = groups["changed"] + groups["became_unreadable"]
    if not watched:
        print("没有相对基线的内容变化。")
        return
    if not args.create_issue:
        print("未开议题（本地运行默认只打印；Actions 会加 --create-issue）。")
        return
    upsert_issue(report, fingerprint(watched))


if __name__ == "__main__":
    main()
