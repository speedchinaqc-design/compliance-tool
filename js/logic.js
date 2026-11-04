(function (root) {
  "use strict";

  function fill(template, map) {
    let out = template;
    Object.keys(map).forEach(function (key) {
      out = out.split("{" + key + "}").join(map[key]);
    });
    return out;
  }

  function applies(dimension, attrs) {
    const rule = dimension.applies_when || { always: true };
    if (rule.always) return { ok: true, reason: "" };
    const ok = attrs[rule.attribute] === rule.equals;
    return { ok: ok, reason: ok ? "" : rule.reason_if_not || "当前产品属性下不适用" };
  }

  function noteMatches(when, attrs) {
    if (!when) return true;
    return Object.keys(when).every(function (key) {
      return attrs[key] === when[key];
    });
  }

  function conditionalState(dimension, attrs, product) {
    const key = dimension.applies_when && dimension.applies_when.conditional_on;
    if (!key) return null;
    const spec = (product.attributes || []).find(function (item) {
      return item.id === key;
    });
    const on = Boolean(attrs[key]);
    const name = spec ? spec.label : key;
    return {
      attribute: key,
      on: on,
      label: on ? "视情况 · 已勾选「" + name + "」" : "视情况 · 未勾选「" + name + "」",
    };
  }

  var FOLDER_BY_CODE = {
    "01": "01CYBER_网络安全",
    "02": "02PACK_包装",
    "03": "03DATA_数据安全",
    "04": "04ELEC_电气安全",
    "05": "05EMC",
    "06": "06RADIO_无线",
    "07": "07BATT_电池",
    "08": "08METRO_法制计量",
  };
  var SHORT_BY_CODE = {
    "01": "01CYBER",
    "02": "02PACK",
    "03": "03DATA",
    "04": "04ELEC",
    "05": "05EMC",
    "06": "06RADIO",
    "07": "07BATT",
    "08": "08METRO",
  };

  function pathsFor(product, marketCode, dimension) {
    const kb = product.knowledge_base;
    const map = {
      model: kb.model,
      market: marketCode,
      dimension_code: FOLDER_BY_CODE[dimension.code] || dimension.dimension_code,
      dimension_short: SHORT_BY_CODE[dimension.code] || dimension.dimension_code,
      dimension_number: dimension.code,
    };
    return {
      folder: fill(kb.folder_template, map),
      filenamePattern: fill(kb.filename_template, map),
      matrixKey: fill(kb.matrix_key_template, map),
    };
  }

  function searchable(row) {
    const entry = row.entry;
    return [
      row.marketName,
      row.marketCode,
      row.dimension.name_zh,
      row.dimension.dimension_code,
      row.matrixKey,
      entry.regulation_name,
      (entry.standard_numbers || []).join(" "),
      entry.authority,
      entry.obligation,
      entry.certification_route,
      entry.label_requirements,
      entry.source_url,
      entry.status,
      (entry.modules || []).join(" "),
      (row.notes || []).join(" "),
    ]
      .join("\n")
      .toLowerCase();
  }

  function visibleRows(data, state) {
    const product = data.product;
    const byCode = {};
    data.markets.forEach(function (market) {
      byCode[market.market] = market;
    });
    const query = (state.query || "").trim().toLowerCase();
    const rows = [];
    product.market_order.forEach(function (code) {
      if (!state.markets[code]) return;
      const market = byCode[code];
      if (!market) return;
      market.dimensions.forEach(function (dimension) {
        if (state.view === "dimension" && dimension.code !== state.dimensionCode) return;
        const decision = applies(dimension, state.attrs);
        if (state.view === "checklist" && !decision.ok) return;
        dimension.entries.forEach(function (entry) {
          if (Array.isArray(state.modules)) {
            const mods = entry.modules || [];
            const hit = mods.some(function (mod) {
              return state.modules.indexOf(mod) !== -1;
            });
            if (!hit) return;
          }
          const paths = pathsFor(product, market.market, dimension);
          const row = {
            marketCode: market.market,
            marketName: market.market_name_zh,
            dimension: dimension,
            entry: entry,
            applies: decision.ok,
            applyReason: decision.reason,
            conditional: conditionalState(dimension, state.attrs, product),
            notes: (entry.attribute_notes || [])
              .filter(function (note) {
                return noteMatches(note.when, state.attrs);
              })
              .map(function (note) {
                return note.text;
              }),
            folder: paths.folder,
            filenamePattern: paths.filenamePattern,
            matrixKey: paths.matrixKey,
            evidence: (data.evidence.entries || []).filter(function (item) {
              return item.matrix_key === paths.matrixKey;
            }),
          };
          if (query && searchable(row).indexOf(query) === -1) return;
          rows.push(row);
        });
      });
    });
    return rows;
  }

  function displayLabel(entry) {
    return entry.label_requirements ? entry.label_requirements : "（规划书未单列）";
  }

  function displayStandards(entry) {
    return entry.standard_numbers && entry.standard_numbers.length
      ? entry.standard_numbers.join("；")
      : "（规划书未单列标准号）";
  }

  function displayVerified(entry) {
    return entry.verified_date ? entry.verified_date : "（规划书未标注）";
  }

  function exportTable(rows, state, product) {
    const headers = [
      "市场代码",
      "市场",
      "维度编号",
      "维度代码",
      "维度",
      "矩阵键",
      "模块",
      "进入适用清单",
      "不适用原因",
      "视情况",
      "法规名称",
      "标准号",
      "主管机构",
      "强制性（规划书原文）",
      "状态",
      "状态依据",
      "认证路径",
      "标签要求",
      "来源 URL",
      "核实日期",
      "属性提示",
      "Dropbox 文件夹",
      "文件名规则",
      "已登记证据路径",
    ];
    const body = rows.map(function (row) {
      const entry = row.entry;
      return [
        row.marketCode,
        row.marketName,
        row.dimension.code,
        row.dimension.dimension_code,
        row.dimension.name_zh,
        row.matrixKey,
        (entry.modules || []).join("、"),
        row.applies ? "是" : "否",
        row.applyReason || "",
        row.conditional ? row.conditional.label : "",
        entry.regulation_name,
        displayStandards(entry),
        entry.authority,
        entry.obligation,
        entry.status,
        entry.status_basis || "",
        entry.certification_route,
        displayLabel(entry),
        entry.source_url,
        displayVerified(entry),
        (row.notes || []).join("\n"),
        row.folder,
        row.filenamePattern,
        row.evidence
          .map(function (item) {
            return item.dropbox_path;
          })
          .join("\n"),
      ];
    });
    const filters = [["项目", "值"]];
    filters.push(["样板产品", product.sample_product.name_zh + " / " + product.sample_product.name_en]);
    const viewName = { checklist: "适用清单", market: "按市场", dimension: "按维度" }[state.view] || state.view;
    filters.push(["视图", viewName]);
    filters.push([
      "市场",
      product.market_order
        .filter(function (code) {
          return state.markets[code];
        })
        .join("、"),
    ]);
    product.attributes.forEach(function (attribute) {
      let value = state.attrs[attribute.id];
      if (attribute.type === "enum") {
        const option = (attribute.options || []).find(function (item) {
          return item.id === value;
        });
        value = option ? option.label : String(value);
      } else if (typeof value === "boolean") {
        value = value ? "是" : "否";
      }
      filters.push([attribute.label, String(value)]);
    });
    if (state.query) filters.push(["搜索", state.query]);
    filters.push(["条数", String(rows.length)]);
    filters.push(["核实日期说明", "「规划书未标注」表示规划书没有逐格核实日期，不是漏填。"]);
    filters.push(["导出范围", "与页面当前视图、市场和属性筛选一致。"]);
    return {
      sheets: [
        { name: "清单", rows: [headers].concat(body) },
        { name: "本次筛选", rows: filters },
      ],
    };
  }

  function defaultState(data) {
    const attrs = {};
    data.product.attributes.forEach(function (attribute) {
      attrs[attribute.id] = attribute.default;
    });
    const markets = {};
    data.product.market_order.forEach(function (code) {
      markets[code] = true;
    });
    return {
      markets: markets,
      attrs: attrs,
      view: "checklist",
      dimensionCode: "08",
      query: "",
    };
  }

  root.ComplianceLogic = {
    applies: applies,
    noteMatches: noteMatches,
    visibleRows: visibleRows,
    exportTable: exportTable,
    defaultState: defaultState,
    displayLabel: displayLabel,
    displayStandards: displayStandards,
    displayVerified: displayVerified,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
