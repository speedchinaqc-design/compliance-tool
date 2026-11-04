(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el.apply(null, arguments);
  };
  var TABS = [
    ["archive", "产品档案"],
    ["checklist", "合规清单"],
    ["modules", "模块"],
    ["documents", "文件模板"],
    ["labels", "标签模板"],
    ["tests", "产品测试"],
    ["ai", "AI判断结果导入"],
  ];

  function projectState(project) {
    var markets = { EU: false, CA: false, US: false };
    project.markets.forEach(function (code) { markets[code] = true; });
    var answers = project.answers || {};
    return {
      markets: markets,
      modules: project.modules,
      attrs: {
        has_wifi: Boolean(answers.has_wifi),
        has_battery: Boolean(answers.has_battery),
        battery_mount: answers.battery_mount || "unknown",
        legal_for_trade: Boolean(answers.legal_for_trade),
        b2b_login_only: Boolean(answers.b2b_login_only),
        processes_personal_data: Boolean(answers.processes_personal_data),
      },
      view: "checklist",
      dimensionCode: "08",
      query: "",
    };
  }

  function rowsFor(project) {
    return root.ComplianceLogic.visibleRows(root.COMPLIANCE_DATA, projectState(project));
  }

  function judgmentFor(project, entryId) {
    return (project.aiJudgments || []).filter(function (item) {
      return item.requirement === entryId;
    })[0] || null;
  }

  function render(host, project, tab, onChange, onBack, onWizard) {
    host.replaceChildren();
    var page = el("section", { id: "workspace" });
    page.append(el("p", { class: "disclaimer", id: "disclaimer" }, [root.ComplianceStore.DISCLAIMER]));
    var head = el("div", { class: "workspace-head" }, [
      el("h2", {}, [project.name]),
      el("p", { class: "help" }, [
        "市场 " + project.markets.join("、") + " · 模块 " + project.modules.join("、"),
      ]),
    ]);
    var back = el("button", { type: "button", class: "ghost", id: "back-list" }, ["项目列表"]);
    back.addEventListener("click", onBack);
    var again = el("button", { type: "button", class: "ghost", id: "rerun-wizard" }, ["重新填写向导"]);
    again.addEventListener("click", onWizard);
    var excel = el("button", { type: "button", id: "export-xlsx" }, ["导出 Excel"]);
    excel.addEventListener("click", function () { exportExcel(project); });
    head.append(el("div", { class: "wizard-bar" }, [back, again, excel]));
    page.append(head);
    var tabs = el("div", { class: "tabs", id: "workspace-tabs" });
    TABS.forEach(function (pair) {
      var button = el("button", { type: "button", class: pair[0] === tab ? "on" : "", "data-tab": pair[0] }, [pair[1]]);
      button.addEventListener("click", function () { render(host, project, pair[0], onChange, onBack, onWizard); });
      tabs.append(button);
    });
    page.append(tabs);
    var body = el("div", { id: "workspace-body" });
    if (tab === "checklist") body.append(renderChecklist(project, onChange));
    if (tab === "modules") body.append(renderModules(project));
    if (tab === "documents") body.append(renderTemplates(project, "document"));
    if (tab === "labels") body.append(renderTemplates(project, "label"));
    if (tab === "tests") body.append(renderTests(project, onChange));
    if (tab === "archive") {
      if (root.ComplianceStore.ensureArchive(project)) onChange(project);
      root.ComplianceArchive.render(body, project, rowsFor(project), onChange);
    }
    if (tab === "ai") body.append(renderAi(project, onChange));
    page.append(body);
    host.append(page);
  }

  function renderChecklist(project, onChange) {
    var rows = rowsFor(project);
    var wrap = el("div", {}, [el("p", { class: "summary" }, ["适用清单 " + rows.length + " 条。状态和测试进度只存在这台浏览器，可导出 JSON。"])]);
    if (!rows.length) wrap.append(el("p", { class: "empty" }, ["当前市场、模块和问答下没有适用条目。"]));
    rows.forEach(function (row) { wrap.append(card(project, row, onChange)); });
    return wrap;
  }

  function card(project, row, onChange) {
    var entry = row.entry;
    var article = el("article", { class: "card", id: "row-" + entry.id }, [
      el("div", { class: "card-kicker" }, [
        el("span", { class: "market" }, [row.marketName]),
        el("span", { class: "status status-" + statusSlug(entry.status) }, [entry.status]),
        el("span", { class: "dim" }, [(entry.modules || []).join("、")]),
        el("code", { class: "matrix-key" }, [row.matrixKey]),
      ]),
      el("h3", {}, [entry.regulation_name]),
      el("p", {}, ["强制性（规划书原文）：" + entry.obligation]),
      el("p", {}, ["认证路径：" + entry.certification_route]),
      el("p", {}, ["标准号：" + root.ComplianceLogic.displayStandards(entry)]),
      el("p", {}, ["需要的证据：" + ((entry.evidence_types || []).join("、") || "未声明")]),
      el("p", { class: "source" }, ["来源 ", el("a", { href: entry.source_url, rel: "noopener noreferrer" }, [entry.source_url])]),
      el("p", { class: "path" }, [row.folder]),
      root.CompliancePaths.buttons(row.folder),
    ]);
    var review = project.reviews && project.reviews[entry.id];
    if (review && review.status === "需要复核") {
      var clear = el("button", { type: "button", class: "ghost" }, ["标记已复核"]);
      clear.addEventListener("click", function () {
        delete project.reviews[entry.id];
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      });
      article.append(el("p", { class: "note" }, ["需要复核。" + (review.summary || "") + (review.sourceUrl ? " " + review.sourceUrl : "")]), clear);
    }
    row.notes.forEach(function (note) { article.append(el("p", { class: "note" }, [note])); });
    if (entry.health_canada_reply) {
      var reply = entry.health_canada_reply;
      article.append(el("p", { class: "reply-conclusion" }, [reply.conclusion]));
      article.append(el("p", { class: "help" }, [reply.letter]));
    }
    var check = el("select", { "data-check": entry.id });
    ["未办理", "进行中", "已完成"].forEach(function (label) {
      var option = el("option", { value: label }, ["清单：" + label]);
      if ((project.checks || {})[entry.id] === label) option.selected = true;
      check.append(option);
    });
    if (!project.checks[entry.id]) project.checks[entry.id] = "未办理";
    check.addEventListener("change", function () {
      project.checks[entry.id] = check.value;
      onChange(project);
    });
    article.append(el("label", { class: "attr" }, ["办理状态", check]));
    var imported = judgmentFor(project, entry.id);
    if (imported) article.append(renderJudgment(imported));
    return article;
  }

  function renderJudgment(item) {
    return el("div", { class: "note" }, [
      el("p", {}, ["导入的判断 · " + item.status]),
      el("p", {}, ["第一层法规：" + (item.layer1.regulation || "待确认")]),
      item.layer1.official_link ? el("p", {}, ["官方链接 ", el("a", { href: item.layer1.official_link, rel: "noopener noreferrer" }, [item.layer1.official_link])]) : null,
      el("p", {}, ["第二层标准：" + (item.layer2.standard || "待确认")]),
      el("p", { class: "path" }, [item.layer2.dropbox_path || item.layer2.link || "标准位置待确认"]),
      item.layer2.dropbox_path ? root.CompliancePaths.buttons(item.layer2.dropbox_path) : null,
      el("p", {}, ["结论：" + item.conclusion]),
      el("p", { class: "help" }, ["来源：" + (item.source || "待确认") + "。这是导入结果，不覆盖矩阵原文。"]),
    ]);
  }

  function renderModules(project) {
    var wrap = el("div");
    root.COMPLIANCE_DATA.modules.forEach(function (mod) {
      if (project.modules.indexOf(mod.id) === -1) return;
      var block = el("article", { class: "card" }, [
        el("h3", {}, [mod.id]),
        el("p", {}, [mod.summary]),
      ]);
      rowsFor(project).forEach(function (row) {
        if ((row.entry.modules || []).indexOf(mod.id) === -1) return;
        block.append(el("p", {}, [row.marketName + " · " + row.dimension.name_zh + " · " + row.entry.status]));
      });
      wrap.append(block);
    });
    return wrap;
  }

  function renderTemplates(project, kind) {
    var items = root.ComplianceTemplates.forModules(project.modules, kind).filter(function (item) {
      if (item.id === "lbl-fcc-a" && project.markets.indexOf("US") === -1) return false;
      if (item.id === "lbl-ised" && project.markets.indexOf("CA") === -1) return false;
      return true;
    });
    var wrap = el("div", {}, [el("p", { class: "help" }, ["只有骨架。标了待确认的内容要你自己核对现行文本。付费标准原文不要写进来，也不要提交到仓库。"])]);
    if (!items.length) wrap.append(el("p", {}, ["当前模块没有这一类模板。"]));
    items.forEach(function (item) {
      var article = el("article", { class: "card", id: item.id }, [el("h3", {}, [item.title])]);
      var list = el("ul");
      item.blocks.forEach(function (line) { list.append(el("li", {}, [line])); });
      article.append(list);
      wrap.append(article);
    });
    return wrap;
  }

  function renderTests(project, onChange) {
    var rows = rowsFor(project);
    var wrap = el("div", {}, [el("p", {}, ["为每条适用要求记测试进度和证书到期日。日期留空表示还没有证书。选「领导层决定先不做测试」后，这一条不计入缺失证据，但要记下决定人和决定日期。"])]);
    var soon = [];
    rows.forEach(function (row) {
      var test = ensureTest(project, row.entry.id);
      if (test.expiry && withinDays(test.expiry, 90)) soon.push(row.entry.id + " · " + test.expiry);
    });
    wrap.append(el("p", { class: soon.length ? "note" : "help" }, [soon.length ? "已到期或 90 天内到期：" + soon.join("；") : "没有填在 90 天内到期或已到期的证书。"]));
    rows.forEach(function (row) {
      var test = ensureTest(project, row.entry.id);
      var status = el("select");
      ["未开始", "进行中", "已完成", "待确认", root.ComplianceStore.WAIVER_STATUS].forEach(function (label) {
        var option = el("option", { value: label }, [label]);
        if (test.status === label) option.selected = true;
        status.append(option);
      });
      status.addEventListener("change", function () {
        test.status = status.value;
        onChange(project);
        render(document.getElementById("app"), project, "tests", onChange, root.__workspaceBack, root.__workspaceWizard);
      });
      var expiry = el("input", { type: "date", value: test.expiry || "" });
      expiry.addEventListener("change", function () {
        test.expiry = expiry.value;
        onChange(project);
        render(document.getElementById("app"), project, "tests", onChange, root.__workspaceBack, root.__workspaceWizard);
      });
      var note = el("input", { type: "text", value: test.note || "", placeholder: "报告号或 Dropbox 文件名，待确认" });
      note.addEventListener("change", function () {
        test.note = note.value;
        onChange(project);
      });
      var block = el("article", { class: "card" }, [
        el("h3", {}, [row.entry.id + " " + row.dimension.name_zh]),
        el("p", { class: "help" }, [row.marketName + " · " + (row.entry.regulation_name || "")]),
        el("p", { class: "help" }, [row.matrixKey]),
        el("label", { class: "attr" }, ["测试进度", status]),
        el("label", { class: "attr" }, ["证书到期日", expiry]),
        el("label", { class: "attr" }, ["备注（可选）", note]),
      ]);
      if (test.status === root.ComplianceStore.WAIVER_STATUS) {
        var decider = el("input", { type: "text", value: test.decider || "", placeholder: "必填" });
        decider.addEventListener("change", function () {
          test.decider = decider.value.trim();
          onChange(project);
        });
        var decidedOn = el("input", { type: "date", value: test.decidedOn || "" });
        decidedOn.addEventListener("change", function () {
          test.decidedOn = decidedOn.value;
          onChange(project);
          render(document.getElementById("app"), project, "tests", onChange, root.__workspaceBack, root.__workspaceWizard);
        });
        block.append(el("label", { class: "attr" }, ["决定人", decider]));
        block.append(el("label", { class: "attr" }, ["决定日期", decidedOn]));
        if (!test.decider || !test.decidedOn) block.append(el("p", { class: "note" }, ["请填写决定人和决定日期。填齐之前，汇总里会标出未填，这一条仍然不计入缺失证据。"]));
        else block.append(el("p", { class: "help" }, ["已记录。这一条不计入缺失证据。"]));
      }
      wrap.append(block);
    });
    return wrap;
  }

  function renderAi(project, onChange) {
    var message = el("p", { class: "error", role: "alert", id: "ai-message" });
    var input = el("input", { type: "file", id: "ai-file", accept: ".json,.yaml,.yml,application/json,text/yaml" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = root.ComplianceStore.parseJudgmentText(String(reader.result || ""));
          var result = root.ComplianceStore.mergeJudgments(project, parsed);
          onChange(result.project);
          message.textContent = "已并入 " + result.merged + " 条，跳过 " + result.skipped + " 条。矩阵原文没有被改写。";
          render(document.getElementById("app"), project, "ai", onChange, root.__workspaceBack, root.__workspaceWizard);
        } catch (err) {
          message.textContent = "没能读这个文件。" + (err.message || "");
        }
      };
      reader.readAsText(file);
    });
    var wrap = el("div", { id: "ai-import" }, [
      el("p", {}, ["请把说明书发给 Dan Bot 做判断，再把结果文件导入这里。本工具里面没有 AI，也不会自动下结论。"]),
      el("p", { class: "help" }, ["格式见仓库 docs/ai-judgment-format.md。判断结果和对比清单可以放在同一个文件里。对比状态用符合、差距或缺失。"]),
      input,
      message,
    ]);
    (project.aiJudgments || []).forEach(function (item) {
      wrap.append(el("article", { class: "card" }, [
        el("h3", {}, [(item.requirement || "未编号") + " · " + item.module + " · " + item.status]),
        el("p", {}, [item.conclusion]),
      ]));
    });
    return wrap;
  }

  function ensureTest(project, id) {
    project.tests = project.tests || {};
    if (!project.tests[id]) project.tests[id] = { status: "未开始", expiry: "", note: "", decider: "", decidedOn: "" };
    return project.tests[id];
  }

  function withinDays(isoDate, days) {
    var time = Date.parse(isoDate + "T00:00:00");
    if (Number.isNaN(time)) return false;
    var diff = (time - Date.now()) / 86400000;
    return diff <= days;
  }

  function statusSlug(status) {
    if (status === "已核实") return "ok";
    if (status === "待核实") return "pending";
    return "na";
  }

  function exportExcel(project) {
    var rows = rowsFor(project);
    var table = root.ComplianceLogic.exportTable(rows, projectState(project), root.COMPLIANCE_DATA.product);
    table.sheets[1].rows.push(["产品", project.name]);
    table.sheets[1].rows.push(["免责声明", root.ComplianceStore.DISCLAIMER]);
    var decisions = [["条目", "名称", "状态", "决定人", "决定日期", "备注"]];
    rows.forEach(function (row) {
      var test = (project.tests || {})[row.entry.id];
      if (!test || test.status !== root.ComplianceStore.WAIVER_STATUS) return;
      decisions.push([row.entry.id, row.dimension.name_zh, test.status, test.decider || "", test.decidedOn || "", test.note || ""]);
    });
    table.sheets.push({ name: "测试决定", rows: decisions });
    var bytes = root.buildXlsx(table.sheets);
    var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "合规清单_" + project.name + ".xlsx";
    document.body.append(link);
    link.click();
    link.remove();
  }

  root.ComplianceWorkspace = {
    render: render,
    rowsFor: rowsFor,
    projectState: projectState,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
