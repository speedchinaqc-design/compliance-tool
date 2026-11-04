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

## 证据对比清单

同一个文件可以再带 `comparisons`。导入后按 `requirement` 写入该产品的对比清单，可再手改。

| 字段 | 说明 |
| --- | --- |
| requirement | 清单条目编号 |
| market | `EU`、`CA` 或 `US` |
| module | 五个模块之一 |
| status | `符合`、`差距`、`缺失`。也可写成 `✅符合`、`⚠️差距`、`❌缺失` |
| reason | 理由。不能确定时写 `待确认` |
| source | 依据从哪来 |
| dropbox_path | 证据文件的 Dropbox 路径。不要把文件放进仓库 |
| page | 页码。结论应能追溯到这一页 |

示例不是真实差距结论。报告号不要编造，没有就写 `待确认`。

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

## 关键件 JSON（选项 A）

本机从报告抽出的表，或手工整理的表，可以按下面的格式导入「关键件与材料管控」。工具只保存这些字段，不保存报告正文。

```json
{
  "components": [
    {
      "name": "保险丝",
      "manufacturer": "待确认",
      "model": "待确认",
      "parameters": "250V",
      "standard": "IEC 60127",
      "certMark": "E00000",
      "partNo": "待确认",
      "source": "UL",
      "reportNo": "待确认",
      "page": "1"
    }
  ]
}
```

`source` 用 `CB` 或 `UL`。证书号没有就写 `待确认`，不要编造。Excel 模板的列与这些字段相同，页面上可以下载 `.xlsx`，仓库里另有 `docs/关键件导入模板.csv`。
