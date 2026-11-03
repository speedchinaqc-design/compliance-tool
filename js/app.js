(function () {
  "use strict";

  const data = window.COMPLIANCE_DATA;
  const logic = window.ComplianceLogic;
  const CHECK_KEY = "compliance-tool-uni8-checked-v1";

  const state = logic.defaultState(data);
  let checked = loadChecked();

  const app = document.getElementById("app");
  const productHost = document.getElementById("product-facts");

  function loadChecked() {
    try {
      return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {};
    } catch (err) {
      return {};
    }
  }

  function saveChecked() {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(checked));
    } catch (err) {
      /* 本机隐私模式可能拒绝写入，标记只留在这一页。 */
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "htmlFor") node.htmlFor = value;
      else node.setAttribute(key, value === true ? "" : value);
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function copyText(text, button) {
    const done = function () {
      const previous = button.textContent;
      button.textContent = "已复制";
      setTimeout(function () {
        button.textContent = previous;
      }, 1200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text);
        done();
      });
      return;
    }
    fallbackCopy(text);
    done();
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function attributeEnabled(attribute) {
    if (!attribute.enabled_when) return true;
    return state.attrs[attribute.enabled_when.attribute] === attribute.enabled_when.equals;
  }

  function renderProduct() {
    const sample = data.product.sample_product;
    productHost.replaceChildren(
      el("p", { class: "product-name" }, [sample.name_zh + "  ·  " + sample.name_en]),
      el("p", { class: "product-line" }, [sample.plan_wording]),
      el("p", { class: "product-line" }, ["FCC / IC：" + sample.fcc_wording]),
      el("p", { class: "product-note" }, [sample.accuracy_class_note])
    );
  }

  function field(label, value) {
    return el("div", { class: "field" }, [el("span", { class: "field-label" }, [label]), el("span", {}, [value])]);
  }

  function renderCard(row) {
    const entry = row.entry;
    const card = el("article", {
      class: "card" + (row.applies ? "" : " card-muted"),
      id: "row-" + entry.id,
    });
    const head = el("div", { class: "card-head" }, [
      el("div", { class: "card-kicker" }, [
        el("span", { class: "market" }, [row.marketName]),
        el("span", { class: "status status-" + statusSlug(entry.status) }, [entry.status]),
        el("span", { class: "dim" }, [row.dimension.code + " " + row.dimension.name_zh]),
      ]),
      el("code", { class: "matrix-key" }, [row.matrixKey]),
    ]);
    card.append(head);
    if (!row.applies) {
      card.append(el("p", { class: "reason" }, ["当前属性下不进入适用清单。" + row.applyReason]));
    }
    if (row.conditional) {
      card.append(el("p", { class: "chip" }, [row.conditional.label]));
    }
    card.append(el("h3", {}, [entry.regulation_name]));
    card.append(
      el("div", { class: "facts" }, [
        fact("标准号", logic.displayStandards(entry)),
        fact("主管机构", entry.authority),
        fact("强制性（规划书原文）", entry.obligation),
        fact("认证路径", entry.certification_route),
        fact("标签要求", logic.displayLabel(entry)),
        fact("核实日期", logic.displayVerified(entry)),
      ])
    );
    card.append(el("p", { class: "basis" }, [entry.status_basis]));
    const source = el("p", { class: "source" }, [
      "来源 ",
      el("a", { href: entry.source_url, rel: "noopener noreferrer" }, [entry.source_url]),
    ]);
    card.append(source);
    (entry.additional_sources || []).forEach(function (sourceItem) {
      card.append(
        el("p", { class: "source extra-source" }, [
          sourceItem.role + "：",
          el("a", { href: sourceItem.url, rel: "noopener noreferrer" }, [sourceItem.title]),
        ])
      );
    });
    if (entry.band_limits) card.append(renderBands(entry.band_limits));
    if (entry.health_canada_reply) card.append(renderReply(entry.health_canada_reply));
    row.notes.forEach(function (note) {
      card.append(el("p", { class: "note" }, [note]));
    });
    card.append(renderDropbox(row));
    const mark = el("label", { class: "mark" }, [
      el("input", { type: "checkbox" }),
      " 已在这台电脑上标记看过",
    ]);
    const box = mark.querySelector("input");
    box.checked = Boolean(checked[entry.id]);
    box.addEventListener("change", function () {
      checked[entry.id] = box.checked;
      if (!box.checked) delete checked[entry.id];
      saveChecked();
    });
    card.append(mark);
    return card;
  }

  function fact(label, value) {
    return el("div", {}, [el("div", { class: "field-label" }, [label]), el("div", {}, [value])]);
  }

  function statusSlug(status) {
    if (status === "已核实") return "ok";
    if (status === "待核实") return "pending";
    return "na";
  }

  function renderBands(bands) {
    const table = el("table", { class: "bands" });
    table.append(el("caption", {}, [bands.heading]));
    const head = el("tr");
    bands.columns.forEach(function (column) {
      head.append(el("th", {}, [column]));
    });
    const body = el("tr");
    bands.values.forEach(function (value) {
      body.append(el("td", {}, [value]));
    });
    table.append(el("thead", {}, [head]), el("tbody", {}, [body]));
    const wrap = el("div", { class: "band-wrap" }, [table, el("p", { class: "note" }, [bands.note])]);
    if (bands.row_label_in_plan) {
      wrap.append(el("p", { class: "note" }, ["第四节行名：" + bands.row_label_in_plan]));
    }
    return wrap;
  }

  function renderReply(reply) {
    const block = el("section", { class: "reply" }, [
      el("h4", {}, [reply.heading]),
      el("p", { class: "reply-letter" }, [reply.letter]),
      el("p", { class: "reply-conclusion" }, [reply.conclusion]),
    ]);
    const table = el("table", { class: "reply-table" });
    reply.points.forEach(function (point) {
      table.append(el("tr", {}, [el("th", {}, [point.topic]), el("td", {}, [point.text])]));
    });
    block.append(table);
    const list = el("ol");
    reply.actions.forEach(function (action) {
      list.append(el("li", {}, [action]));
    });
    block.append(el("p", { class: "field-label" }, ["规划书中的处理建议"]), list);
    return block;
  }

  function renderDropbox(row) {
    const kb = data.product.knowledge_base;
    const block = el("div", { class: "dropbox" }, [
      el("p", { class: "field-label" }, ["Dropbox 路径（知识库约定，不是共享链接）"]),
      el("p", { class: "path" }, [row.folder]),
      el("p", { class: "path-sub" }, ["文件名：" + row.filenamePattern]),
    ]);
    const actions = el("div", { class: "path-actions no-print" });
    const copyFolder = el("button", { type: "button" }, ["复制文件夹路径"]);
    copyFolder.addEventListener("click", function () {
      copyText(row.folder, copyFolder);
    });
    actions.append(copyFolder);
    block.append(actions);
    if (row.evidence.length) {
      const list = el("ul", { class: "evidence" });
      row.evidence.forEach(function (item) {
        list.append(el("li", {}, [item.type_code + "  " + item.dropbox_path]));
      });
      block.append(el("p", { class: "field-label" }, ["data/evidence.yaml 里登记的路径"]), list);
    } else {
      block.append(el("p", { class: "path-sub" }, ["还没有在 data/evidence.yaml 登记文件。证书和报告留在 Dropbox，不要提交到本仓库。"]));
    }
    block.append(el("p", { class: "path-sub" }, [kb.filename_example_note + " 举例：" + kb.filename_example]));
    return block;
  }

  function renderResults() {
    const host = document.getElementById("results");
    const rows = logic.visibleRows(data, state);
    const summary = summaryText(rows);
    host.replaceChildren();
    host.append(el("p", { class: "summary", id: "result-summary" }, [summary]));
    if (!rows.length) {
      host.append(el("p", { class: "empty" }, ["当前筛选下没有条目。勾选至少一个市场，或放宽属性与搜索。"]));
      return;
    }
    if (state.view === "dimension") {
      const dimension = data.markets[0].dimensions.find(function (item) {
        return item.code === state.dimensionCode;
      });
      host.append(el("h2", {}, [dimension.code + "  " + dimension.name_zh + "  ·  " + dimension.dimension_code]));
      rows.forEach(function (row) {
        host.append(renderCard(row));
      });
      return;
    }
    let current = "";
    rows.forEach(function (row) {
      if (row.marketCode !== current) {
        current = row.marketCode;
        const count = rows.filter(function (item) {
          return item.marketCode === current;
        }).length;
        host.append(el("h2", {}, [row.marketName + "（" + row.marketCode + "）· " + count + " 条"]));
      }
      host.append(renderCard(row));
    });
  }

  function summaryText(rows) {
    const names = { checklist: "适用清单", market: "按市场", dimension: "按维度" };
    const markets = data.product.market_order
      .filter(function (code) {
        return state.markets[code];
      })
      .map(function (code) {
        const market = data.markets.find(function (item) {
          return item.market === code;
        });
        return market.market_name_zh;
      });
    const bits = data.product.attributes.map(function (attribute) {
      if (!attributeEnabled(attribute)) return attribute.label + "：停用";
      const value = state.attrs[attribute.id];
      if (attribute.type === "boolean") return attribute.label + "：" + (value ? "是" : "否");
      const option = attribute.options.find(function (item) {
        return item.id === value;
      });
      return attribute.label + "：" + (option ? option.label : value);
    });
    return names[state.view] + " · " + (markets.join("、") || "未选市场") + " · " + rows.length + " 条 · " + bits.join(" · ");
  }

  function buildShell() {
    const kb = data.product.knowledge_base;
    const layout = el("div", { class: "layout" });
    const panel = el("form", { class: "panel no-print", id: "filters" });
    panel.addEventListener("submit", function (event) {
      event.preventDefault();
    });

    panel.append(el("h2", {}, ["市场"]));
    data.product.market_order.forEach(function (code) {
      const market = data.markets.find(function (item) {
        return item.market === code;
      });
      const input = el("input", { type: "checkbox", "data-market": code });
      input.checked = state.markets[code];
      input.addEventListener("change", function () {
        state.markets[code] = input.checked;
        renderResults();
      });
      panel.append(el("label", { class: "check" }, [input, " " + market.market_name_zh]));
    });

    panel.append(el("h2", {}, ["产品属性"]));
    data.product.attributes.forEach(function (attribute) {
      const wrap = el("label", { class: "attr" });
      wrap.append(el("span", { class: "attr-label" }, [attribute.label]));
      let input;
      if (attribute.type === "boolean") {
        input = el("input", { type: "checkbox", "data-attr": attribute.id });
        input.checked = Boolean(state.attrs[attribute.id]);
        input.addEventListener("change", function () {
          state.attrs[attribute.id] = input.checked;
          syncEnabled();
          renderResults();
        });
      } else {
        input = el("select", { "data-attr": attribute.id });
        attribute.options.forEach(function (option) {
          const node = el("option", { value: option.id }, [option.label]);
          if (option.id === state.attrs[attribute.id]) node.selected = true;
          input.append(node);
        });
        input.addEventListener("change", function () {
          state.attrs[attribute.id] = input.value;
          renderResults();
        });
      }
      wrap.append(input);
      wrap.append(el("span", { class: "help" }, [attribute.help]));
      panel.append(wrap);
    });

    panel.append(el("h2", {}, ["视图"]));
    const views = [
      ["checklist", "适用清单"],
      ["market", "按市场"],
      ["dimension", "按维度"],
    ];
    views.forEach(function (pair) {
      const input = el("input", { type: "radio", name: "view", value: pair[0] });
      input.checked = state.view === pair[0];
      input.addEventListener("change", function () {
        if (!input.checked) return;
        state.view = pair[0];
        syncDimensionVisibility();
        renderResults();
      });
      panel.append(el("label", { class: "check" }, [input, " " + pair[1]]));
    });

    const dimensionWrap = el("label", { class: "attr", id: "dimension-wrap" });
    dimensionWrap.append(el("span", { class: "attr-label" }, ["维度"]));
    const dimensionSelect = el("select", { id: "dimension-select" });
    data.markets[0].dimensions.forEach(function (dimension) {
      const option = el("option", { value: dimension.code }, [
        dimension.code + " " + dimension.name_zh,
      ]);
      if (dimension.code === state.dimensionCode) option.selected = true;
      dimensionSelect.append(option);
    });
    dimensionSelect.addEventListener("change", function () {
      state.dimensionCode = dimensionSelect.value;
      renderResults();
    });
    dimensionWrap.append(dimensionSelect);
    panel.append(dimensionWrap);

    panel.append(el("h2", {}, ["搜索"]));
    const search = el("input", {
      type: "search",
      id: "search",
      placeholder: "法规、标准号、机构、URL",
      "aria-label": "在当前结果中搜索",
    });
    search.addEventListener("input", function () {
      state.query = search.value;
      renderResults();
    });
    panel.append(search);

    const reset = el("button", { type: "button", class: "ghost", id: "reset" }, ["恢复 UNI-8 样板默认"]);
    reset.addEventListener("click", function () {
      const next = logic.defaultState(data);
      state.markets = next.markets;
      state.attrs = next.attrs;
      state.view = next.view;
      state.dimensionCode = next.dimensionCode;
      state.query = "";
      search.value = "";
      panel.querySelectorAll("input[data-market]").forEach(function (input) {
        input.checked = state.markets[input.getAttribute("data-market")];
      });
      panel.querySelectorAll("input[type=checkbox][data-attr]").forEach(function (input) {
        input.checked = Boolean(state.attrs[input.getAttribute("data-attr")]);
      });
      panel.querySelectorAll("select[data-attr]").forEach(function (input) {
        input.value = state.attrs[input.getAttribute("data-attr")];
      });
      panel.querySelectorAll('input[name="view"]').forEach(function (input) {
        input.checked = input.value === state.view;
      });
      dimensionSelect.value = state.dimensionCode;
      syncEnabled();
      syncDimensionVisibility();
      renderResults();
    });
    panel.append(reset);

    const actions = el("div", { class: "export-bar" });
    const excel = el("button", { type: "button", id: "export-xlsx" }, ["导出 Excel"]);
    excel.addEventListener("click", exportExcel);
    const pdf = el("button", { type: "button", id: "export-pdf" }, ["打印 / 存为 PDF"]);
    pdf.addEventListener("click", function () {
      window.print();
    });
    actions.append(excel, pdf);
    panel.append(actions);
    panel.append(
      el("p", { class: "help" }, [
        "Excel 在浏览器里生成。PDF 请在打印对话框里选「另存为 PDF」或「Microsoft Print to PDF」。导出的是当前视图和筛选。",
      ])
    );

    const legend = el("details", { class: "legend" });
    legend.append(el("summary", {}, ["状态、维度代码和 Dropbox 命名"]));
    legend.append(
      el("p", {}, [
        "已核实：强制性栏有 ✓。N/A：栏内写了 N/A，表示核实后没有针对性法规。待核实：栏内写了待核实，或者 ✓、待核实、N/A 都没有。没有标记的格子不写成已核实。强制性原文仍照规划书显示。",
      ])
    );
    legend.append(el("p", {}, ["核实日期是空的，因为规划书没有逐格日期。"]));
    const codes = el("ul");
    kb.dimension_codes.forEach(function (item) {
      codes.append(el("li", {}, [item.id + "  " + item.name_zh]));
    });
    legend.append(codes);
    const types = el("ul");
    kb.type_codes.forEach(function (item) {
      types.append(el("li", {}, [item.code + "  " + item.meaning]));
    });
    legend.append(types);
    legend.append(el("p", {}, ["矩阵键示例 " + kb.matrix_key_example + "。index.xlsx 建议列：" + kb.index_columns.join("、") + "。"]));
    legend.append(el("p", {}, [kb.privacy_note]));
    panel.append(legend);

    const main = el("div", { class: "results", id: "results" });
    layout.append(panel, main);
    app.replaceChildren(layout);
    syncEnabled();
    syncDimensionVisibility();
  }

  function syncEnabled() {
    data.product.attributes.forEach(function (attribute) {
      const input = document.querySelector("[data-attr='" + attribute.id + "']");
      if (!input) return;
      const enabled = attributeEnabled(attribute);
      input.disabled = !enabled;
      input.closest(".attr").classList.toggle("is-disabled", !enabled);
    });
  }

  function syncDimensionVisibility() {
    const wrap = document.getElementById("dimension-wrap");
    if (wrap) wrap.hidden = state.view !== "dimension";
  }

  function exportExcel() {
    const rows = logic.visibleRows(data, state);
    const table = logic.exportTable(rows, state, data.product);
    const bytes = window.buildXlsx(table.sheets);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    const stamp = new Date();
    const month = String(stamp.getMonth() + 1).padStart(2, "0");
    const day = String(stamp.getDate()).padStart(2, "0");
    link.href = URL.createObjectURL(blob);
    link.download = "合规清单_UNI-8_" + stamp.getFullYear() + month + day + ".xlsx";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  renderProduct();
  buildShell();
  renderResults();
  window.__complianceTest = {
    state: state,
    visibleRows: function () {
      return logic.visibleRows(data, state);
    },
    setAttr: function (id, value) {
      state.attrs[id] = value;
      const input = document.querySelector("[data-attr='" + id + "']");
      if (input) {
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = value;
      }
      syncEnabled();
      renderResults();
    },
    setView: function (view) {
      state.view = view;
      document.querySelectorAll('input[name="view"]').forEach(function (input) {
        input.checked = input.value === view;
      });
      syncDimensionVisibility();
      renderResults();
    },
    setMarkets: function (map) {
      Object.keys(map).forEach(function (code) {
        state.markets[code] = map[code];
        const input = document.querySelector("[data-market='" + code + "']");
        if (input) input.checked = map[code];
      });
      renderResults();
    },
  };
})();
