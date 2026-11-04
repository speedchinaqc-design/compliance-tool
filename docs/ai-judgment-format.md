# AI 判断结果文件格式

本工具**不调用 AI，也不自动下结论**。请把说明书发给 Dan Bot，让 Dan Bot 做判断，再把结果文件导入对应产品工作区的「AI判断结果导入」。

支持 JSON 或缩进 YAML。导入后按 `requirement`（如 `EU-07`）并入该产品；同一编号再次导入会覆盖上一条导入结果。矩阵里的法规原文不会被改写。

## 字段

| 字段 | 说明 |
| --- | --- |
| requirement | 清单条目编号，如 `EU-07`、`CA-07`、`US-05` |
| market | `EU`、`CA` 或 `US` |
| module | `电子产品`、`电池`、`CRA`、`FCC/ISED`、`计量` |
| layer1.regulation | 第一层：法规名称 |
| layer1.official_link | 第一层：官方链接 |
| layer2.standard | 第二层：标准号 |
| layer2.dropbox_path | 第二层：Dropbox 路径。没有就留空 |
| layer2.link | 第二层：链接。没有就留空 |
| conclusion | 判断结论。不能确定时写 `待确认` |
| source | 这条判断从哪来，例如 Dan Bot 的哪一次输出 |
| status | `已核实`、`待核实`、`N/A`、`待确认` |

`docs/ai-judgment.sample.json` 只是格式示例，不是判断结果。

## JSON 示例

```json
{
  "note": "格式示例，不是判断结果。",
  "judgments": [
    {
      "requirement": "EU-07",
      "market": "EU",
      "module": "电池",
      "layer1": {
        "regulation": "待确认：法规名称",
        "official_link": "https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en"
      },
      "layer2": {
        "standard": "待确认：标准号",
        "dropbox_path": "/合规知识库/02_产品/UNI-8/EU/07BATT/",
        "link": ""
      },
      "conclusion": "待确认",
      "source": "待确认：Dan Bot 输出",
      "status": "待核实"
    }
  ]
}
```

付费标准原文不要写进这个文件，也不要提交到仓库。标准只记标准号和 Dropbox 路径。
