# 法规更新导入格式

每周来源检查或 Dan Bot 发现官方页面有变化时，把下面这种 JSON 或 YAML 导入首页。工具会给相关产品的对应行标上「需要复核」，并给出「标记已复核」。

不会自动改法规原文，也不会把文件内容写进仓库。

```json
{
  "format": "compliance-tool-regulation-update-v1",
  "updates": [
    {
      "requirement": "EU-07",
      "source_url": "https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en",
      "detected_at": "2026-11-04",
      "summary": "来源页内容有变化，需要复核"
    }
  ]
}
```

`requirement` 用清单编号，例如 `EU-07`、`CA-07`。只影响已经选择了该市场的产品。
