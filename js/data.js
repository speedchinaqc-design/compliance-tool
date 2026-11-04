/* 由 tools/validate.py 根据 data/*.yaml 生成。请改 YAML，不要手改本文件。 */
(function (root) {
"use strict";
  root.COMPLIANCE_DATA = {
  "product": {
    "schema_version": 1,
    "sample_product": {
      "id": "UNI-8",
      "name_zh": "石田 UNI-8",
      "name_en": "ISHIDA UNI-8",
      "kind": "非自动衡器，计价贴标",
      "plan_wording": "石田 UNI-8：非自动衡器，计价贴标，15/30 kg 双分度，推断 III 级；100–240 V AC；纽扣电池；Wi-Fi 2.4/5 GHz、以太网、USB；嵌入式联网软件；热敏打印",
      "capacity": "15/30 kg 双分度",
      "accuracy_class": "推断 III 级",
      "accuracy_class_note": "规划书原文是「推断 III 级」，不是已经确认的型式批准等级。",
      "power": "100–240 V AC",
      "battery": "纽扣电池",
      "radio": "Wi-Fi 2.4/5 GHz",
      "interfaces": [
        "以太网",
        "USB"
      ],
      "software": "嵌入式联网软件",
      "printer": "热敏打印",
      "fcc_wording": "已确认 Part 15B Class A；另声明 IC RSS-102"
    },
    "market_order": [
      "EU",
      "CA",
      "US"
    ],
    "attributes": [
      {
        "id": "has_wifi",
        "label": "具有 Wi-Fi（2.4 GHz 与 5 GHz）",
        "type": "boolean",
        "default": true,
        "help": "样板产品有 Wi-Fi。去掉勾选后，无线和网络安全不进入适用清单。"
      },
      {
        "id": "has_battery",
        "label": "具有纽扣电池",
        "type": "boolean",
        "default": true,
        "help": "样板产品有纽扣电池。去掉勾选后，电池行不进入适用清单。"
      },
      {
        "id": "battery_mount",
        "label": "电池安装方式",
        "type": "enum",
        "default": "unknown",
        "options": [
          {
            "id": "unknown",
            "label": "未知（计划书未确认）"
          },
          {
            "id": "soldered",
            "label": "焊接固定"
          },
          {
            "id": "removable",
            "label": "可拆卸"
          }
        ],
        "help": "规划书没有确认 UNI-8 的纽扣电池是否焊接。此选项只改提示，不把任何市场改成豁免。",
        "enabled_when": {
          "attribute": "has_battery",
          "equals": true
        }
      },
      {
        "id": "legal_for_trade",
        "label": "用于贸易结算（法制计量）",
        "type": "boolean",
        "default": true,
        "help": "样板是计价贴标秤。去掉勾选后，法制计量不进入适用清单。准确度等级在规划书中是「推断 III 级」。"
      },
      {
        "id": "b2b_login_only",
        "label": "仅通过需 B2B 账号登录的渠道销售",
        "type": "boolean",
        "default": false,
        "help": "用来对照加拿大电池复函和美国包装「B2B 适用性待核实」。不自动把要求标成不适用。"
      },
      {
        "id": "processes_personal_data",
        "label": "处理个人数据",
        "type": "boolean",
        "default": false,
        "help": "数据保护在规划书里是「视情况」。不勾选时仍然列出，并标明当前未声明会处理个人数据。"
      }
    ],
    "knowledge_base": {
      "root": "/合规知识库",
      "folder_template": "/合规知识库/02_产品/{model}/{market}/{dimension_code}/",
      "filename_template": "{model}_{market}_{dimension_code}_{type}_{number}_{issue_date}_{version}.pdf",
      "filename_example": "UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf",
      "filename_example_note": "规划书里的命名举例，不是真实证书。",
      "matrix_key_template": "{market}-{dimension_number}",
      "matrix_key_example": "CA-08",
      "model": "UNI-8",
      "type_codes": [
        {
          "code": "STD",
          "meaning": "标准"
        },
        {
          "code": "RPT",
          "meaning": "测试报告"
        },
        {
          "code": "CERT",
          "meaning": "型式批准/认证证书"
        },
        {
          "code": "DOC",
          "meaning": "符合性声明"
        },
        {
          "code": "LBL",
          "meaning": "标签"
        },
        {
          "code": "CORR",
          "meaning": "往来函件"
        }
      ],
      "dimension_codes": [
        {
          "code": "01",
          "id": "01CYBER",
          "name_zh": "网络安全"
        },
        {
          "code": "02",
          "id": "02PACK",
          "name_zh": "包装/EPR"
        },
        {
          "code": "03",
          "id": "03DATA",
          "name_zh": "数据保护"
        },
        {
          "code": "04",
          "id": "04SAFETY",
          "name_zh": "电气安全"
        },
        {
          "code": "05",
          "id": "05EMC",
          "name_zh": "EMC"
        },
        {
          "code": "06",
          "id": "06RADIO",
          "name_zh": "无线 2.4/5 GHz"
        },
        {
          "code": "07",
          "id": "07BATT",
          "name_zh": "电池（纽扣）"
        },
        {
          "code": "08",
          "id": "08METRO",
          "name_zh": "法制计量"
        }
      ],
      "index_columns": [
        "产品 / 型号",
        "市场",
        "维度",
        "标准号 / 版本",
        "报告号 / 证书号",
        "实验室 / 机构",
        "签发日期 / 到期日期",
        "状态",
        "Dropbox 路径",
        "矩阵键"
      ],
      "privacy_note": "付费标准原文（EN、IEC、UL、CSA 等）只放在 Dropbox 私有文件夹，不建共享链接，不提交到本仓库。测试报告和证书同样不入库。页面只显示路径和命名规则。"
    }
  },
  "evidence": {
    "schema_version": 1,
    "notice": "entries 只保存 Dropbox 路径和编号。当前没有登记真实文件。规划书命名举例 UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf 不是真实证书，因此不列入 entries。",
    "entries": []
  },
  "modules": [
    {
      "id": "电子产品",
      "summary": "电气安全、EMC、包装等已写在矩阵里的产品要求。第一期没有单独的 RoHS 或 WEEE 格子，这里不补写。"
    },
    {
      "id": "电池",
      "summary": "纽扣电池。加拿大按 Health Canada 复函 26-005366-600，商用不自动豁免。"
    },
    {
      "id": "CRA",
      "summary": "网络安全与数据安全这一组。欧盟格子里同时写了 RED 授权法规和 CRA。美国、加拿大的对应格子不是 CRA 法规本身，只是归入这一组方便筛选。"
    },
    {
      "id": "FCC/ISED",
      "summary": "美国 FCC 与加拿大 ISED 的无线和 EMC 授权。欧盟的无线与 EMC 仍放在「电子产品」。"
    },
    {
      "id": "计量",
      "summary": "贸易结算用法制计量。欧盟 NAWI、加拿大 Measurement Canada、美国 NIST/NTEP，均来自现有矩阵。"
    }
  ],
  "questions": [
    {
      "id": "product_function",
      "prompt": "产品功能是什么？",
      "type": "text",
      "placeholder": "例如：非自动衡器，计价贴标",
      "modules": [],
      "basis": "样板产品在规划书里是非自动衡器、计价贴标，准确度等级写的是「推断 III 级」。功能若不同，不能直接套用这 24 格。这里只记录你的说明，不新增法规。",
      "sources": [
        {
          "label": "样板产品原文（data/product.yaml，不是法规链接）"
        }
      ]
    },
    {
      "id": "materials",
      "prompt": "主要材料和部件有哪些？",
      "type": "text",
      "placeholder": "待确认。规划书没有列出材料清单",
      "modules": [],
      "basis": "包装、电气安全和电池都和实物构成有关。规划书没有给出 UNI-8 的材料或部件清单，所以默认留空，标为待确认。",
      "sources": [
        {
          "label": "欧盟包装",
          "url": "https://eur-lex.europa.eu/eli/reg/2025/40/oj"
        },
        {
          "label": "欧盟电气安全（RED）",
          "url": "https://eur-lex.europa.eu/eli/dir/2014/53/oj"
        }
      ]
    },
    {
      "id": "voltage",
      "prompt": "供电电压是多少？",
      "type": "text",
      "placeholder": "100–240 V AC",
      "modules": [
        "电子产品"
      ],
      "basis": "样板产品写的是 100–240 V AC。电气安全三格按带电产品编写。若电压不同，请自行确认是否仍落在同一格，工具不改法规名称。",
      "sources": [
        {
          "label": "欧盟 RED 安全",
          "url": "https://eur-lex.europa.eu/eli/dir/2014/53/oj"
        },
        {
          "label": "美国 OSHA / NRTL",
          "url": "https://www.osha.gov/nationally-recognized-testing-laboratory-program"
        },
        {
          "label": "加拿大 SCC",
          "url": "https://www.scc-ccn.ca/"
        }
      ]
    },
    {
      "id": "has_wifi",
      "prompt": "是否有 Wi-Fi（2.4 GHz 与 5 GHz）？",
      "type": "boolean",
      "modules": [
        "电子产品",
        "FCC/ISED"
      ],
      "basis": "未勾选时，无线维度不进入适用清单。欧盟 EMC 和电气安全格子按 RED 编写，关掉 Wi-Fi 后应改用哪一项指令，规划书没有写。5 GHz 限制以各市场矩阵原文和第四节表为准，两处不合并成新结论。",
      "sources": [
        {
          "label": "欧盟无线",
          "url": "https://www.etsi.org/"
        },
        {
          "label": "美国 Part 15",
          "url": "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15"
        },
        {
          "label": "加拿大 ISED",
          "url": "https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en"
        }
      ]
    },
    {
      "id": "has_battery",
      "prompt": "是否有纽扣电池？",
      "type": "boolean",
      "modules": [
        "电池"
      ],
      "basis": "未勾选时，电池维度不进入适用清单。样板产品写的是纽扣电池。",
      "sources": [
        {
          "label": "欧盟电池法规页面",
          "url": "https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en"
        },
        {
          "label": "加拿大纽扣电池咨询页（矩阵来源）",
          "url": "https://www.canada.ca/en/services/health/consultations/consultation-comment-period-danger-human-health-safety-assessment-products-containing-button-coin-batteries-packaging/document.html"
        },
        {
          "label": "美国 Reese's Law 页面",
          "url": "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Reeses-Law"
        }
      ]
    },
    {
      "id": "battery_mount",
      "prompt": "纽扣电池是焊接固定、可拆卸，还是尚未确认？",
      "type": "enum",
      "modules": [
        "电池"
      ],
      "show_when": {
        "has_battery": true
      },
      "options": [
        {
          "id": "unknown",
          "label": "未知（计划书未确认）"
        },
        {
          "id": "soldered",
          "label": "焊接固定"
        },
        {
          "id": "removable",
          "label": "可拆卸"
        }
      ],
      "basis": "复函编号 26-005366-600。加拿大这一格和复函要点没有把焊接写成豁免，不要把规划书里澳洲的焊接豁免套到加拿大。欧盟法规名写有可拆卸（第 11 条，2027-02-18），没有写焊接固定就可以不适用。美国电池格的状态仍是待核实，安装方式不改变该状态。本项只改变提示。",
      "sources": [
        {
          "label": "加拿大矩阵来源",
          "url": "https://www.canada.ca/en/services/health/consultations/consultation-comment-period-danger-human-health-safety-assessment-products-containing-button-coin-batteries-packaging/document.html"
        },
        {
          "label": "复函引用的执法指南（复函本身非公开）",
          "url": "https://www.canada.ca/en/health-canada/services/consumer-product-safety/legislation-guidelines/guidelines-policies/information-regulated-parties-enforcement-approach-general-prohibitions.html"
        },
        {
          "label": "欧盟电池法规页面",
          "url": "https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en"
        }
      ]
    },
    {
      "id": "commercial_form_note",
      "prompt": "是否已留存书面分析：产品形态和功能是否明显属于商用？",
      "type": "enum",
      "modules": [
        "电池"
      ],
      "markets": [
        "CA"
      ],
      "show_when": {
        "has_battery": true
      },
      "options": [
        {
          "id": "尚未分析",
          "label": "尚未分析"
        },
        {
          "id": "已留存书面分析",
          "label": "已留存书面分析"
        }
      ],
      "basis": "复函编号 26-005366-600：商用不自动排除；须在形态和功能上明显属商用才可能在 CCPSA 之外；“仅限商用”标签本身不豁免；是否适用由 Health Canada 逐案判断。本项只记录你有没有留下分析，不把状态改成不适用。",
      "sources": [
        {
          "label": "加拿大矩阵来源",
          "url": "https://www.canada.ca/en/services/health/consultations/consultation-comment-period-danger-human-health-safety-assessment-products-containing-button-coin-batteries-packaging/document.html"
        }
      ]
    },
    {
      "id": "legal_for_trade",
      "prompt": "是否用于贸易结算（法制计量）？",
      "type": "boolean",
      "modules": [
        "计量"
      ],
      "basis": "未勾选时，法制计量不进入适用清单。样板是计价贴标秤。准确度等级在规划书中是「推断 III 级」，不是已确认的型式批准等级。",
      "sources": [
        {
          "label": "欧盟 NAWI",
          "url": "https://eur-lex.europa.eu/eli/dir/2014/31/oj"
        },
        {
          "label": "美国 NTEP",
          "url": "https://www.ncwm.com/ntep"
        },
        {
          "label": "加拿大型式批准",
          "url": "https://ised-isde.canada.ca/site/measurement-canada/en/type-approval/apply-type-approval-scales-or-scale-components"
        }
      ]
    },
    {
      "id": "b2b_login_only",
      "prompt": "是否只通过需要 B2B 账号登录的渠道销售？",
      "type": "boolean",
      "modules": [
        "电池",
        "电子产品"
      ],
      "basis": "复函编号 26-005366-600：只通过需 B2B 账号登录的渠道销售、不上架公开零售或无登录网店，是规划书里的建议。商用不自动排除；在对公众开放的商店或无需 B2B 登录的网店销售，即可合理预期个人可获得；“仅限商用”标签本身不豁免。美国包装格写明 B2B 适用性待核实，不因本题答案改成已核实。",
      "sources": [
        {
          "label": "加拿大矩阵来源",
          "url": "https://www.canada.ca/en/services/health/consultations/consultation-comment-period-danger-human-health-safety-assessment-products-containing-button-coin-batteries-packaging/document.html"
        },
        {
          "label": "美国州包装 EPR",
          "url": "https://calrecycle.ca.gov/packaging/packaging-epr/"
        }
      ]
    },
    {
      "id": "processes_personal_data",
      "prompt": "是否处理个人数据？",
      "type": "boolean",
      "modules": [
        "CRA"
      ],
      "basis": "数据保护在规划书里是「视情况」。不勾选时条目仍列出，并标明当前未声明会处理个人数据。这不把美国或加拿大的隐私法写成欧盟 CRA。",
      "sources": [
        {
          "label": "GDPR",
          "url": "https://eur-lex.europa.eu/eli/reg/2016/679/oj"
        },
        {
          "label": "CCPA",
          "url": "https://oag.ca.gov/privacy/ccpa"
        },
        {
          "label": "PIPEDA 入口",
          "url": "https://www.priv.gc.ca/"
        }
      ]
    }
  ],
  "markets": [
    {
      "schema_version": 1,
      "market": "EU",
      "market_name_zh": "欧盟",
      "dimensions": [
        {
          "code": "01",
          "dimension_code": "01CYBER",
          "name_zh": "网络安全",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi。本格按联网/无线产品编写；格子里若同时写了多项法规，规划书没有拆开，因此整格不进入适用清单。"
          },
          "entries": [
            {
              "id": "EU-01",
              "modules": [
                "CRA"
              ],
              "regulation_name": "RED 授权法规 (EU) 2022/30（2025-08-01 起，EN 18031-1）；CRA (EU) 2024/2847（报告义务 2026-09-11，全面 2027-12-11）",
              "standard_numbers": [
                "EN 18031-1"
              ],
              "authority": "欧委会 / 公告机构",
              "obligation": "强制 ✓",
              "certification_route": "自我声明 DoC；EN 18031 带限制条款时须 NB",
              "label_requirements": "",
              "source_url": "https://eur-lex.europa.eu/eli/reg_del/2022/30/oj",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。"
            }
          ]
        },
        {
          "code": "02",
          "dimension_code": "02PACK",
          "name_zh": "包装/EPR",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "EU-02",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "PPWR (EU) 2025/40（2026-08-12 起适用）+ 各成员国包装 EPR 注册",
              "standard_numbers": [],
              "authority": "欧委会 / 成员国",
              "obligation": "强制 ✓",
              "certification_route": "成员国 EPR 注册、标识、可回收设计",
              "label_requirements": "标识、可回收设计",
              "source_url": "https://eur-lex.europa.eu/eli/reg/2025/40/oj",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。"
            }
          ]
        },
        {
          "code": "03",
          "dimension_code": "03DATA",
          "name_zh": "数据保护",
          "applies_when": {
            "always": true,
            "conditional_on": "processes_personal_data"
          },
          "entries": [
            {
              "id": "EU-03",
              "modules": [
                "CRA"
              ],
              "regulation_name": "GDPR (EU) 2016/679",
              "standard_numbers": [],
              "authority": "各国数据保护机构",
              "obligation": "视情况（处理个人数据时）",
              "certification_route": "无认证；合规文档",
              "label_requirements": "",
              "source_url": "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "04",
          "dimension_code": "04SAFETY",
          "name_zh": "电气安全",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "EU-04",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "RED 3.1(a)（引用 LVD 安全目标）；EN IEC 62368-1",
              "standard_numbers": [
                "EN IEC 62368-1"
              ],
              "authority": "市场监管机构",
              "obligation": "强制 ✓",
              "certification_route": "DoC + 技术文件",
              "label_requirements": "",
              "source_url": "https://eur-lex.europa.eu/eli/dir/2014/53/oj",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "attribute_notes": [
                {
                  "text": "这一格按 RED 编写。规划书没有写去掉 Wi-Fi 之后应改用哪一项欧盟安全指令。",
                  "when": {
                    "has_wifi": false
                  }
                }
              ]
            }
          ]
        },
        {
          "code": "05",
          "dimension_code": "05EMC",
          "name_zh": "EMC",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "EU-05",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "RED 3.1(b)；EN 301 489-1/-17、EN 55032/55035",
              "standard_numbers": [
                "EN 301 489-1/-17",
                "EN 55032/55035"
              ],
              "authority": "市场监管机构",
              "obligation": "强制 ✓",
              "certification_route": "DoC",
              "label_requirements": "",
              "source_url": "https://eur-lex.europa.eu/eli/dir/2014/53/oj",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "attribute_notes": [
                {
                  "text": "这一格按 RED 编写。规划书没有写去掉 Wi-Fi 之后应改用哪一项欧盟 EMC 指令。",
                  "when": {
                    "has_wifi": false
                  }
                }
              ]
            }
          ]
        },
        {
          "code": "06",
          "dimension_code": "06RADIO",
          "name_zh": "无线 2.4/5 GHz",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi，无线要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "EU-06",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "RED 3.2；EN 300 328、EN 301 893。5150–5350 仅室内，5250–5350/5470–5725 须 DFS/TPC",
              "standard_numbers": [
                "EN 300 328",
                "EN 301 893"
              ],
              "authority": "市场监管机构",
              "obligation": "强制 ✓",
              "certification_route": "DoC",
              "label_requirements": "",
              "source_url": "https://www.etsi.org/",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "band_limits": {
                "heading": "5 GHz 频段限制速览（规划书第四节）",
                "columns": [
                  "5150–5250",
                  "5250–5350",
                  "5470–5725",
                  "5725–5850"
                ],
                "values": [
                  "仅室内",
                  "仅室内 + DFS",
                  "DFS/TPC",
                  "不用于 WLAN"
                ],
                "note": "第四节与矩阵格都原样保留，没有合并成一条新的频段结论。矩阵格里的频段文字见法规名称。"
              }
            }
          ]
        },
        {
          "code": "07",
          "dimension_code": "07BATT",
          "name_zh": "电池（纽扣）",
          "applies_when": {
            "attribute": "has_battery",
            "equals": true,
            "reason_if_not": "未勾选纽扣电池，电池要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "EU-07",
              "modules": [
                "电池"
              ],
              "regulation_name": "电池法规 (EU) 2023/1542：标识、可拆卸（第 11 条，2027-02-18）、生产者 EPR",
              "standard_numbers": [],
              "authority": "欧委会 / 成员国",
              "obligation": "强制 ✓",
              "certification_route": "EPR 注册 + 标识",
              "label_requirements": "标识",
              "source_url": "https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "attribute_notes": [
                {
                  "text": "法规名写有可拆卸（第 11 条，2027-02-18）。规划书没有写焊接固定就可以不适用该条。",
                  "when": {
                    "battery_mount": "soldered"
                  }
                },
                {
                  "text": "法规名写有可拆卸（第 11 条，2027-02-18）。",
                  "when": {
                    "battery_mount": "removable"
                  }
                },
                {
                  "text": "法规名写有可拆卸（第 11 条，2027-02-18）。UNI-8 的纽扣电池是否可拆，规划书未确认。",
                  "when": {
                    "battery_mount": "unknown"
                  }
                }
              ]
            }
          ]
        },
        {
          "code": "08",
          "dimension_code": "08METRO",
          "name_zh": "法制计量",
          "applies_when": {
            "attribute": "legal_for_trade",
            "equals": true,
            "reason_if_not": "未勾选贸易结算，法制计量不进入适用清单。"
          },
          "entries": [
            {
              "id": "EU-08",
              "modules": [
                "计量"
              ],
              "regulation_name": "NAWI 2014/31/EU；EN 45501 / OIML R76；WELMEC 2、7.2",
              "standard_numbers": [
                "EN 45501",
                "OIML R76",
                "WELMEC 2、7.2"
              ],
              "authority": "公告机构",
              "obligation": "强制 ✓",
              "certification_route": "模块 B（EU-TEC）+ D/F；CE + M + NB 号",
              "label_requirements": "CE + M + NB 号",
              "source_url": "https://eur-lex.europa.eu/eli/dir/2014/31/oj",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。"
            }
          ]
        }
      ]
    },
    {
      "schema_version": 1,
      "market": "CA",
      "market_name_zh": "加拿大",
      "dimensions": [
        {
          "code": "01",
          "dimension_code": "01CYBER",
          "name_zh": "网络安全",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi。本格按联网/无线产品编写；格子里若同时写了多项法规，规划书没有拆开，因此整格不进入适用清单。"
          },
          "entries": [
            {
              "id": "CA-01",
              "modules": [
                "CRA"
              ],
              "regulation_name": "无针对联网产品的强制网络安全法",
              "standard_numbers": [],
              "authority": "—",
              "obligation": "N/A（未发现）",
              "certification_route": "—",
              "label_requirements": "",
              "source_url": "https://ised-isde.canada.ca/",
              "verified_date": null,
              "status": "N/A",
              "status_basis": "强制性栏原文含「N/A」。规划书把 N/A 定义为核实后无针对性法规。"
            }
          ]
        },
        {
          "code": "02",
          "dimension_code": "02PACK",
          "name_zh": "包装/EPR",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "CA-02",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "省级包装 EPR（安大略 O. Reg. 391/21、BC Recycling Regulation、魁北克）",
              "standard_numbers": [
                "O. Reg. 391/21"
              ],
              "authority": "各省",
              "obligation": "按省强制",
              "certification_route": "向省级 PRO 注册",
              "label_requirements": "",
              "source_url": "https://rpra.ca/",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "03",
          "dimension_code": "03DATA",
          "name_zh": "数据保护",
          "applies_when": {
            "always": true,
            "conditional_on": "processes_personal_data"
          },
          "entries": [
            {
              "id": "CA-03",
              "modules": [
                "CRA"
              ],
              "regulation_name": "PIPEDA",
              "standard_numbers": [],
              "authority": "加拿大隐私专员公署",
              "obligation": "视情况",
              "certification_route": "无认证",
              "label_requirements": "",
              "source_url": "https://www.priv.gc.ca/",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "04",
          "dimension_code": "04SAFETY",
          "name_zh": "电气安全",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "CA-04",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "各省电气法规（CSA C22.1）要求认证标志；CSA C22.2 No. 62368-1",
              "standard_numbers": [
                "CSA C22.1",
                "CSA C22.2 No. 62368-1"
              ],
              "authority": "各省电气安全局",
              "obligation": "强制",
              "certification_route": "SCC 认可机构认证（cCSAus/cULus）",
              "label_requirements": "认证标志",
              "source_url": "https://www.scc-ccn.ca/",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "05",
          "dimension_code": "05EMC",
          "name_zh": "EMC",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "CA-05",
              "modules": [
                "电子产品",
                "FCC/ISED"
              ],
              "regulation_name": "ICES-003",
              "standard_numbers": [
                "ICES-003"
              ],
              "authority": "ISED",
              "obligation": "强制",
              "certification_route": "SDoC + 标签声明",
              "label_requirements": "标签声明",
              "source_url": "https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "06",
          "dimension_code": "06RADIO",
          "name_zh": "无线 2.4/5 GHz",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi，无线要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "CA-06",
              "modules": [
                "FCC/ISED"
              ],
              "regulation_name": "RSS-Gen、RSS-247（2.4 与 5 GHz LE-LAN）、RSS-102；5150–5250 仅室内，5600–5650 受限，DFS",
              "standard_numbers": [
                "RSS-Gen",
                "RSS-247",
                "RSS-102"
              ],
              "authority": "ISED",
              "obligation": "强制",
              "certification_route": "ISED 认证（IC ID）",
              "label_requirements": "",
              "source_url": "https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。",
              "attribute_notes": [
                {
                  "text": "规划书第一节写明样板产品另声明 IC RSS-102。RSS-102 已写在本格法规名中。"
                }
              ],
              "band_limits": {
                "heading": "5 GHz 频段限制速览（规划书第四节）",
                "columns": [
                  "5150–5250",
                  "5250–5350",
                  "5470–5725",
                  "5725–5850"
                ],
                "values": [
                  "仅室内",
                  "DFS",
                  "DFS（5600–5650 受限）",
                  "可用"
                ],
                "note": "第四节与矩阵格都原样保留，没有合并成一条新的频段结论。矩阵格里的频段文字见法规名称。"
              }
            }
          ]
        },
        {
          "code": "07",
          "dimension_code": "07BATT",
          "name_zh": "电池（纽扣）",
          "applies_when": {
            "attribute": "has_battery",
            "equals": true,
            "reason_if_not": "未勾选纽扣电池，电池要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "CA-07",
              "modules": [
                "电池"
              ],
              "regulation_name": "CCPSA 附表 3（2026-09-17 起纳入含纽扣电池的非玩具消费品）；危害公告引用 ANSI/UL 4200A-2023；产品、包装、说明书须有英法双语警示；另有省级电池 EPR",
              "standard_numbers": [
                "ANSI/UL 4200A-2023"
              ],
              "authority": "Health Canada（消费品安全）；各省",
              "obligation": "强制风险 ✓（以 Health Canada 复函为准）",
              "certification_route": "无预先认证；企业自负合规，备好 UL 4200A 报告与双语标签/说明书，供 HC 索取",
              "label_requirements": "产品、包装、说明书须有英法双语警示",
              "source_url": "https://www.canada.ca/en/services/health/consultations/consultation-comment-period-danger-human-health-safety-assessment-products-containing-button-coin-batteries-packaging/document.html",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "attribute_notes": [
                {
                  "text": "当前选择是只通过需 B2B 账号登录的渠道销售。规划书建议不上架公开零售或无登录网店。复函同时写明：商用不自动排除；“仅限商用”标签本身不豁免；是否在 CCPSA 外由 Health Canada 逐案判断。",
                  "when": {
                    "b2b_login_only": true
                  }
                },
                {
                  "text": "当前未选择“仅 B2B 登录渠道”。复函写明：在对公众开放的商店或无需 B2B 账号登录的网店销售，即可合理预期个人可获得。",
                  "when": {
                    "b2b_login_only": false
                  }
                },
                {
                  "text": "当前选择电池焊接固定。加拿大这一格和复函要点没有把焊接写成豁免。规划书里讨论焊接豁免的是澳洲，不能套用到加拿大。",
                  "when": {
                    "battery_mount": "soldered"
                  }
                },
                {
                  "text": "当前选择电池可拆卸。规划书建议备好 ANSI/UL 4200A-2023 测试报告，以及产品、包装、说明书的英法双语警示。",
                  "when": {
                    "battery_mount": "removable"
                  }
                },
                {
                  "text": "电池安装方式仍是未知。规划书没有确认 UNI-8 的纽扣电池是否焊接；加拿大复函要点也没有按安装方式区分。",
                  "when": {
                    "battery_mount": "unknown"
                  }
                }
              ],
              "additional_sources": [
                {
                  "role": "参考文件，不是矩阵格「官方来源」栏。复函本身非公开，不在仓库中。",
                  "title": "Information for regulated parties on Health Canada's enforcement approach to the general prohibitions",
                  "publisher": "Health Canada",
                  "url": "https://www.canada.ca/en/health-canada/services/consumer-product-safety/legislation-guidelines/guidelines-policies/information-regulated-parties-enforcement-approach-general-prohibitions.html"
                }
              ],
              "health_canada_reply": {
                "heading": "加拿大纽扣电池：Health Canada 复函要点",
                "letter": "Health Canada 致 Dan 的复函（编号 26-005366-600，2026-10-16 收文，非公开）。本仓库不存放该函。",
                "conclusion": "UNI-8 在加拿大按“强制风险”处理：商用不自动豁免，是否属 CCPSA 由 Health Canada 逐案判断。",
                "points": [
                  {
                    "topic": "法律依据",
                    "text": "2026-09-17 将含纽扣电池的非玩具消费品加入 CCPSA 附表 3，危害公告引用 ANSI/UL 4200A-2023；通过 CCPSA 第 7(a)、8(a) 段一般禁止条款执行"
                  },
                  {
                    "topic": "过渡期",
                    "text": "无法定过渡期或旧货豁免；HC 先做合规宣传，但可随时按风险采取查封、命令、召回、起诉"
                  },
                  {
                    "topic": "存货与在途",
                    "text": "同样适用于零售现有库存、运输中及海关处的货物"
                  },
                  {
                    "topic": "企业责任",
                    "text": "企业自行确保产品解决评估中的危害；HC 可索取测试报告、标签、说明书"
                  },
                  {
                    "topic": "适用范围",
                    "text": "商用不自动排除；在对公众开放的商店或无需 B2B 账号登录的网店销售，即可合理预期个人可获得；须在形态和功能上明显属商用才在 CCPSA 外；“仅限商用”标签本身不豁免；逐案判断"
                  },
                  {
                    "topic": "未直接回答",
                    "text": "硬件不变时无需重测、仅做报告修订/加拿大差异页是否被接受；以提单（B/L）日期还是到港清关日期为准；英文版库存加贴双语标签后能否继续销售"
                  }
                ],
                "actions": [
                  "只通过需要 B2B 账号登录的渠道销售，不上架公开零售或无登录网店。",
                  "备好 ANSI/UL 4200A-2023 测试报告，以及产品、包装、说明书的英法双语警示，归档到 Dropbox `02_产品/UNI-8/CA/07BATT/`。",
                  "评估 UNI-8 的形态与功能是否“明显属商用”（贸易结算计价贴标秤，须 Measurement Canada 型式批准），留存书面分析；结论仍由 HC 逐案决定。",
                  "未回答的问题可向原测试实验室和 HC（cps-spc@hc-sc.gc.ca）追问。"
                ]
              }
            }
          ]
        },
        {
          "code": "08",
          "dimension_code": "08METRO",
          "name_zh": "法制计量",
          "applies_when": {
            "attribute": "legal_for_trade",
            "equals": true,
            "reason_if_not": "未勾选贸易结算，法制计量不进入适用清单。"
          },
          "entries": [
            {
              "id": "CA-08",
              "modules": [
                "计量"
              ],
              "regulation_name": "Weights and Measures Act；Specifications Relating to Non-automatic Weighing Devices；评价程序见《Laboratory manual for the evaluation of non-automatic weighing devices》（NAWDS_Lab Manual-eng_V1.2，Measurement Canada 发布 ✓）",
              "standard_numbers": [
                "NAWDS_Lab Manual-eng_V1.2"
              ],
              "authority": "Measurement Canada",
              "obligation": "强制 ✓",
              "certification_route": "申请型式批准取得 NOA + 检定",
              "label_requirements": "",
              "source_url": "https://ised-isde.canada.ca/site/measurement-canada/en/type-approval/apply-type-approval-scales-or-scale-components",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "additional_sources": [
                {
                  "role": "参考文件，不是矩阵格「官方来源」栏",
                  "title": "Laboratory manual for the evaluation of non-automatic weighing devices（NAWDS_Lab Manual-eng_V1.2）",
                  "publisher": "Measurement Canada（ISED）",
                  "url": "https://ised-isde.canada.ca/site/measurement-canada/en/laws-and-requirements/laboratory-manual-evaluation-non-automatic-weighing-devices/laboratory-manual-evaluation-non-automatic-weighing-devices"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "schema_version": 1,
      "market": "US",
      "market_name_zh": "美国",
      "dimensions": [
        {
          "code": "01",
          "dimension_code": "01CYBER",
          "name_zh": "网络安全",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi。本格按联网/无线产品编写；格子里若同时写了多项法规，规划书没有拆开，因此整格不进入适用清单。"
          },
          "entries": [
            {
              "id": "US-01",
              "modules": [
                "CRA"
              ],
              "regulation_name": "联邦：无强制；U.S. Cyber Trust Mark 自愿，截至 2026-11 尚未开放申请。加州 SB-327 联网设备合理安全（唯一密码）",
              "standard_numbers": [],
              "authority": "FCC / 加州",
              "obligation": "联邦自愿 ✓；加州强制",
              "certification_route": "自我符合",
              "label_requirements": "",
              "source_url": "https://www.fcc.gov/CyberTrustMark",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。"
            }
          ]
        },
        {
          "code": "02",
          "dimension_code": "02PACK",
          "name_zh": "包装/EPR",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "US-02",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "无联邦法；州包装 EPR（CA SB 54、OR、CO、ME、MN、MD、WA）",
              "standard_numbers": [],
              "authority": "各州",
              "obligation": "按州强制（B2B 适用性待核实）",
              "certification_route": "向州 PRO 注册",
              "label_requirements": "",
              "source_url": "https://calrecycle.ca.gov/packaging/packaging-epr/",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏原文含「待核实」。",
              "attribute_notes": [
                {
                  "text": "强制性栏写明 B2B 适用性待核实。当前是否只通过 B2B 登录渠道销售，都不改变这条的待核实状态。"
                }
              ]
            }
          ]
        },
        {
          "code": "03",
          "dimension_code": "03DATA",
          "name_zh": "数据保护",
          "applies_when": {
            "always": true,
            "conditional_on": "processes_personal_data"
          },
          "entries": [
            {
              "id": "US-03",
              "modules": [
                "CRA"
              ],
              "regulation_name": "无联邦通用法；州隐私法（如 CCPA/CPRA）",
              "standard_numbers": [],
              "authority": "各州 AG",
              "obligation": "视情况",
              "certification_route": "无认证",
              "label_requirements": "",
              "source_url": "https://oag.ca.gov/privacy/ccpa",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏没有 ✓、没有「待核实」、也没有「N/A」。不把未标记的格子写成已核实。"
            }
          ]
        },
        {
          "code": "04",
          "dimension_code": "04SAFETY",
          "name_zh": "电气安全",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "US-04",
              "modules": [
                "电子产品"
              ],
              "regulation_name": "OSHA 29 CFR 1910.303 要求工作场所设备经 NRTL 认证；UL 62368-1",
              "standard_numbers": [
                "UL 62368-1"
              ],
              "authority": "OSHA",
              "obligation": "实际强制 ✓",
              "certification_route": "NRTL（UL/ETL/CSA）认证",
              "label_requirements": "",
              "source_url": "https://www.osha.gov/nationally-recognized-testing-laboratory-program",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。"
            }
          ]
        },
        {
          "code": "05",
          "dimension_code": "05EMC",
          "name_zh": "EMC",
          "applies_when": {
            "always": true
          },
          "entries": [
            {
              "id": "US-05",
              "modules": [
                "电子产品",
                "FCC/ISED"
              ],
              "regulation_name": "47 CFR Part 15B（A/B 类数字设备）",
              "standard_numbers": [
                "47 CFR Part 15B"
              ],
              "authority": "FCC",
              "obligation": "强制 ✓",
              "certification_route": "SDoC（或随无线一起认证）",
              "label_requirements": "",
              "source_url": "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "attribute_notes": [
                {
                  "text": "样板产品在规划书第一节写明已确认 Part 15B Class A。本格法规名仍是 A/B 类数字设备，没有另写一条只针对 Class A 的新要求。"
                }
              ]
            }
          ]
        },
        {
          "code": "06",
          "dimension_code": "06RADIO",
          "name_zh": "无线 2.4/5 GHz",
          "applies_when": {
            "attribute": "has_wifi",
            "equals": true,
            "reason_if_not": "未勾选 Wi-Fi，无线要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "US-06",
              "modules": [
                "FCC/ISED"
              ],
              "regulation_name": "Part 15.247（2.4 GHz）、15.407（U-NII）；U-NII-2A/2C 须 DFS；5850–5895 另有规定",
              "standard_numbers": [
                "Part 15.247",
                "15.407"
              ],
              "authority": "FCC / TCB",
              "obligation": "强制 ✓",
              "certification_route": "TCB 认证取得 FCC ID；2028-12-01 起禁用非互认国实验室",
              "label_requirements": "",
              "source_url": "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "band_limits": {
                "heading": "5 GHz 频段限制速览（规划书第四节）",
                "columns": [
                  "5150–5250",
                  "5250–5350",
                  "5470–5725",
                  "5725–5850"
                ],
                "values": [
                  "可用",
                  "DFS",
                  "DFS",
                  "可用"
                ],
                "note": "第四节与矩阵格都原样保留，没有合并成一条新的频段结论。矩阵格里的频段文字见法规名称。第四节该行写的是「美国 / 墨西哥」，这里只放到美国，本期数据没有墨西哥。",
                "row_label_in_plan": "美国 / 墨西哥"
              }
            }
          ]
        },
        {
          "code": "07",
          "dimension_code": "07BATT",
          "name_zh": "电池（纽扣）",
          "applies_when": {
            "attribute": "has_battery",
            "equals": true,
            "reason_if_not": "未勾选纽扣电池，电池要求不进入适用清单。"
          },
          "entries": [
            {
              "id": "US-07",
              "modules": [
                "电池"
              ],
              "regulation_name": "Reese's Law 16 CFR 1263（消费品，商用秤可能不适用）；加州高氯酸盐锂纽扣电池标识",
              "standard_numbers": [
                "16 CFR 1263"
              ],
              "authority": "CPSC / 加州 DTSC",
              "obligation": "待核实（适用范围）",
              "certification_route": "标识 + 测试",
              "label_requirements": "加州高氯酸盐锂纽扣电池标识",
              "source_url": "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Reeses-Law",
              "verified_date": null,
              "status": "待核实",
              "status_basis": "强制性栏原文含「待核实」。",
              "attribute_notes": [
                {
                  "text": "强制性栏原文是「待核实（适用范围）」。法规名写明 Reese's Law 针对消费品，商用秤可能不适用。安装方式不改变这条状态。"
                }
              ]
            }
          ]
        },
        {
          "code": "08",
          "dimension_code": "08METRO",
          "name_zh": "法制计量",
          "applies_when": {
            "attribute": "legal_for_trade",
            "equals": true,
            "reason_if_not": "未勾选贸易结算，法制计量不进入适用清单。"
          },
          "entries": [
            {
              "id": "US-08",
              "modules": [
                "计量"
              ],
              "regulation_name": "NIST HB44 §2.20；NCWM Publication 14；HB130；参考 Measurement Canada《Laboratory manual for the evaluation of non-automatic weighing devices》（NAWDS Lab Manual，美国 NTEP 实验室亦使用）",
              "standard_numbers": [
                "NIST HB44 §2.20",
                "NCWM Publication 14",
                "HB130",
                "NAWDS Lab Manual"
              ],
              "authority": "NCWM/NTEP；各州计量局",
              "obligation": "强制 ✓（各州采纳）",
              "certification_route": "NTEP 型式评价取得 CC 证书",
              "label_requirements": "",
              "source_url": "https://www.ncwm.com/ntep",
              "verified_date": null,
              "status": "已核实",
              "status_basis": "强制性栏原文含 ✓。规划书把 ✓ 定义为本轮在官方或可靠来源核实。",
              "additional_sources": [
                {
                  "role": "参考文件，不是矩阵格「官方来源」栏",
                  "title": "Laboratory manual for the evaluation of non-automatic weighing devices（NAWDS_Lab Manual-eng_V1.2）",
                  "publisher": "Measurement Canada（ISED）",
                  "url": "https://ised-isde.canada.ca/site/measurement-canada/en/laws-and-requirements/laboratory-manual-evaluation-non-automatic-weighing-devices/laboratory-manual-evaluation-non-automatic-weighing-devices"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
})(typeof globalThis !== "undefined" ? globalThis : this);
