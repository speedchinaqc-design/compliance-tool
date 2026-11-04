(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el.apply(null, arguments);
  };
  var section = "home";
  var SECTIONS = [
    ["home", "档案首页"],
    ["basic", "基本信息"],
    ["sensitive", "成本与供应商"],
    ["evidence", "证据登记"],
    ["comparison", "对比清单"],
    ["bom", "关键件"],
    ["labels", "标签与铭牌"],
    ["manuals", "说明书"],
    ["parties", "责任主体"],
    ["schedule", "费用与进度"],
    ["issues", "问题与纠正"],
    ["letters", "官方往来"],
    ["changes", "变更记录"],
    ["other", "其他资料"],
  ];
  var STATUSES = ["研发", "送测", "已上市", "停产"];
  var EVIDENCE_TYPES = ["测试报告", "证书", "DoC", "标签照片", "说明书", "技术文件", "注册文件", "合规文档", "往来函件"];
  var COMPARE = ["符合", "差距", "缺失"];
  var MARK = { "符合": "✅符合", "差距": "⚠️差距", "缺失": "❌缺失" };

  function render(host, project, rows, onChange) {
    root.ComplianceStore.ensureArchive(project);
    loadOther(project);
    var archive = project.archive;
    host.replaceChildren();
    var page = el("div", { id: "product-archive" });
    page.append(el("p", { class: "help" }, ["证据文件只放在 Dropbox。这里只保存路径和字段，不保存文件本身。"]));
    page.append(renderAlerts(project, rows));
    var nav = el("div", { class: "tabs", id: "archive-nav" });
    SECTIONS.forEach(function (pair) {
      var button = el("button", { type: "button", class: pair[0] === section ? "on" : "", "data-archive": pair[0] }, [pair[1]]);
      button.addEventListener("click", function () {
        section = pair[0];
        render(host, project, rows, onChange);
      });
      nav.append(button);
    });
    page.append(nav);
    if (section === "home") page.append(renderHome(project, rows, onChange));
    if (section === "basic") page.append(renderBasic(project, onChange));
    if (section === "sensitive") page.append(renderSensitive(project, onChange));
    if (section === "evidence") page.append(renderEvidence(project, rows, onChange));
    if (section === "comparison") page.append(renderComparison(project, rows, onChange));
    if (section === "bom") page.append(renderBom(project, onChange));
    if (section === "labels") page.append(renderLabels(project, rows, onChange));
    if (section === "manuals") page.append(renderManuals(project, onChange));
    if (section === "parties") page.append(renderParties(project, onChange));
    if (section === "schedule") page.append(renderSchedule(project, onChange));
    if (section === "issues") page.append(renderIssues(project, onChange));
    if (section === "letters") page.append(renderLetters(project, onChange));
    if (section === "changes") page.append(renderChanges(project, onChange));
    if (section === "other") page.append(renderOther(project));
    host.append(page);
  }

  function pathField(label, value, onValue) {
    var input = el("input", { type: "text", value: value || "" });
    input.addEventListener("change", function () { onValue(input.value); });
    var actions = root.CompliancePaths.buttons(function () { return input.value; });
    return el("div", { class: "path-field" }, [el("label", { class: "attr" }, [label, input]), actions]);
  }

  function textField(label, value, onValue) {
    var input = el("input", { type: "text", value: value || "" });
    input.addEventListener("change", function () { onValue(input.value); });
    return el("label", { class: "attr" }, [label, input]);
  }

  function dateField(label, value, onValue) {
    var input = el("input", { type: "date", value: value || "" });
    input.addEventListener("change", function () { onValue(input.value); });
    return el("label", { class: "attr" }, [label, input]);
  }

  function selectField(label, value, options, onValue) {
    var select = el("select");
    options.forEach(function (item) {
      var option = el("option", { value: item }, [item]);
      if (item === value) option.selected = true;
      select.append(option);
    });
    select.addEventListener("change", function () { onValue(select.value); });
    return el("label", { class: "attr" }, [label, select]);
  }

  function renderAlerts(project, rows) {
    var lines = [];
    (project.archive.evidence || []).forEach(function (item) {
      var days = root.ComplianceStore.daysUntil(item.expiry);
      if (days == null) return;
      if (days <= 30) lines.push("30 天内或已到期：" + (item.reportNo || item.type) + " · " + item.expiry);
      else if (days <= 90) lines.push("90 天内到期：" + (item.reportNo || item.type) + " · " + item.expiry);
    });
    root.ComplianceStore.transitionDates(rows).forEach(function (item) {
      if (item.days == null) return;
      if (item.days < 0) lines.push("过渡/生效日期已过：" + item.requirement + " · " + item.date);
      else if (item.days <= 30) lines.push("30 天内到期的法规日期：" + item.requirement + " · " + item.date);
      else if (item.days <= 90) lines.push("90 天内到期的法规日期：" + item.requirement + " · " + item.date);
    });
    var unsorted = otherFiles(project, "待分类");
    if (unsorted.length) lines.push("待分类里有 " + unsorted.length + " 个文件，请归到对应市场和维度。参考目录里的文件不计入正式证据。");
    var gaps = root.ComplianceStore.modelGaps(project);
    if (gaps.length) lines.push("型号未被证据覆盖：" + gaps.join("；"));
    (project.archive.evidence || []).forEach(function (item) {
      (item.requirementIds || []).forEach(function (id) {
        var row = rows.filter(function (entry) { return entry.entry.id === id; })[0];
        if (!row) return;
        var gap = root.ComplianceStore.versionGap(item, row.entry);
        if (gap === "版本可能不一致") lines.push(id + "：" + gap + "（证据 " + item.standardVersion + "）");
      });
    });
    var box = el("div", { id: "archive-alerts", class: lines.length ? "note" : "help" });
    box.append(el("p", {}, [lines.length ? "档案提醒" : "档案提醒：没有 90 天内的到期项。已过的法规日期仍会列在下面。"]));
    lines.forEach(function (line) { box.append(el("p", {}, [line])); });
    box.append(el("p", { class: "help" }, ["每月提醒由 Dan Bot 另行处理。这里只在打开档案时显示。"]));
    return box;
  }

  function summaryRows(project, rows) {
    var result = [];
    project.markets.forEach(function (market) {
      project.modules.forEach(function (moduleName) {
        var related = rows.filter(function (row) {
          return row.marketCode === market && (row.entry.modules || []).indexOf(moduleName) !== -1;
        });
        if (!related.length) return;
        var comparisons = (project.archive.comparisons || []).filter(function (item) {
          return related.some(function (row) { return row.entry.id === item.requirement; });
        });
        var evidence = (project.archive.evidence || []).filter(function (item) {
          return (item.requirementIds || []).some(function (id) {
            return related.some(function (row) { return row.entry.id === id; });
          });
        });
        var expiries = evidence.map(function (item) { return item.expiry; }).filter(Boolean).sort();
        var status = "待确认";
        if (comparisons.some(function (item) { return root.ComplianceStore.countsAsMissing(project, item); })) status = "缺失";
        else if (comparisons.some(function (item) { return item.status === "差距"; })) status = "差距";
        else if (comparisons.length && comparisons.every(function (item) { return item.status === "符合"; })) status = "符合";
        result.push({
          market: market,
          module: moduleName,
          status: status,
          evidenceNos: evidence.map(function (item) { return item.reportNo || "待确认"; }).join("；") || "无",
          expiry: expiries[0] || "",
        });
      });
    });
    return result;
  }

  function requirementTitle(rows, id) {
    var row = (rows || []).filter(function (entry) { return entry.entry.id === id; })[0];
    if (!row) return id;
    var zh = row.dimension.name_zh || "";
    var reg = row.entry.regulation_name || "";
    if (zh && reg) return id + " " + zh + " " + reg;
    return id + " " + (zh || reg);
  }

  function renderHome(project, rows, onChange) {
    var records = summaryRows(project, rows);
    var basic = project.archive.basic;
    var aggregate = root.ComplianceStore.aggregateStatus(basic);
    var table = el("table", { class: "bands", id: "archive-home" });
    table.append(el("caption", {}, ["市场 × 模块"]));
    var head = el("tr");
    ["市场", "模块", "对比状态", "证据编号", "最近到期"].forEach(function (label) {
      head.append(el("th", {}, [label]));
    });
    var body = el("tbody");
    records.forEach(function (record) {
      body.append(el("tr", {}, [
        el("td", {}, [record.market]),
        el("td", {}, [record.module]),
        el("td", {}, [MARK[record.status] || record.status]),
        el("td", {}, [record.evidenceNos]),
        el("td", {}, [record.expiry || "未填"]),
      ]));
    });
    table.append(el("thead", {}, [head]), body);
    var market = el("select", { id: "audit-market" });
    ["", "EU", "CA", "US"].forEach(function (code) {
      market.append(el("option", { value: code }, [code || "全部市场"]));
    });
    var sensitive = el("input", { type: "checkbox", id: "audit-sensitive" });
    var excel = el("button", { type: "button", id: "audit-excel" }, ["导出审核包 Excel"]);
    excel.addEventListener("click", function () { exportAudit(project, market.value, sensitive.checked); });
    var summaryExcel = el("button", { type: "button", id: "summary-excel" }, ["导出汇总 Excel"]);
    summaryExcel.addEventListener("click", function () { exportSummary(project, records); });
    var print = el("button", { type: "button", class: "ghost", id: "summary-print" }, ["打印 / 存为 PDF"]);
    print.addEventListener("click", function () {
      document.body.classList.add("print-archive");
      window.print();
      document.body.classList.remove("print-archive");
    });
    var waivers = root.ComplianceStore.waiverRecords(project).map(function (item) {
      return requirementTitle(rows, item.id) + " · 决定人 " + (item.decider || "未填") + " · " + (item.decidedOn || "日期未填") + (item.note ? " · " + item.note : "");
    });
    return el("div", {}, [
      el("p", { id: "product-status", class: "note" }, ["产品状态：" + aggregate + "。由各变体是否「已上市」汇总，主型号本身不是变体。"]),
      waivers.length ? el("p", { class: "help" }, ["领导层决定先不做测试（不计入缺失证据）：" + waivers.join("；")]) : null,
      table,
      el("div", { class: "wizard-bar no-print" }, [
        market,
        el("label", { class: "choice" }, [sensitive, " 审核包包含成本与供应商（默认不含）"]),
        excel,
        summaryExcel,
        print,
      ]),
      el("p", { class: "help" }, ["审核包含技术文件目录和证据清单。费用数字只在勾选后出现。"]),
    ]);
  }

  function commitVariants(project, onChange, rerender) {
    root.ComplianceStore.touchVariants(project.archive);
    onChange(project);
    if (rerender) refresh();
  }

  function localThumb(path) {
    if (!path) return el("p", { class: "help" }, ["未填路径，没有缩略图。"]);
    var img = el("img", { class: "thumb", alt: "本地缩略图", src: "/api/preview?path=" + encodeURIComponent(path) });
    img.addEventListener("error", function () {
      var note = el("p", { class: "help" }, ["本机还没有这张图片。路径仍可打开文件夹。"]);
      if (img.parentNode) img.replaceWith(note);
    });
    return img;
  }

  function photoEditors(paths, onCommit) {
    var stack = el("div", { class: "photo-stack" });
    [0, 1, 2].forEach(function (index) {
      stack.append(pathField("照片 " + (index + 1), paths[index], function (value) {
        paths[index] = value;
        onCommit();
      }));
      stack.append(localThumb(paths[index]));
    });
    return stack;
  }

  function renderBasic(project, onChange) {
    var basic = project.archive.basic;
    root.ComplianceStore.migrateVariants(project.archive);
    var box = el("div", { class: "card", id: "basic-info" }, [
      textField("名称", project.name, function (value) {
        project.name = value || project.name;
        onChange(project);
      }),
      textField("型号", basic.model, function (value) { basic.model = value; onChange(project); }),
      el("p", { class: "help" }, ["主型号单独填写，不占变体行。变体默认 6 行，空型号不进入状态和铭牌。"]),
      pathField("主型号照片的 Dropbox 路径", basic.photoPath, function (value) { basic.photoPath = value; onChange(project); refresh(); }),
    ]);
    if (basic.photoPath) box.append(localThumb(basic.photoPath));
    var table = el("table", { class: "bands variant-table", id: "variant-table" });
    table.append(el("caption", {}, ["型号变体"]));
    var head = el("tr");
    ["变体型号", "屏幕尺寸", "照片", ""].forEach(function (label) { head.append(el("th", {}, [label])); });
    var body = el("tbody");
    (basic.variantRows || []).forEach(function (row, index) {
      body.append(el("tr", {}, [
        el("td", {}, [textField("变体型号", row.model, function (value) {
          row.model = value.trim();
          commitVariants(project, onChange, true);
        })]),
        el("td", {}, [textField("屏幕尺寸", row.screen, function (value) {
          row.screen = value;
          commitVariants(project, onChange, false);
        })]),
        el("td", {}, [photoEditors(row.photos, function () { commitVariants(project, onChange, true); })]),
        el("td", {}, [removeButton(function () {
          basic.variantRows.splice(index, 1);
          commitVariants(project, onChange, true);
        })]),
      ]));
    });
    table.append(el("thead", {}, [head]), body);
    box.append(el("div", { class: "table-scroll" }, [table]));
    box.append(addButton("增加变体", function () {
      basic.variantRows.push(root.ComplianceStore.emptyVariantRow(basic));
      commitVariants(project, onChange, true);
    }));
    var filled = root.ComplianceStore.filledVariants(basic);
    box.append(el("p", { id: "status-aggregate", class: "note" }, [
      "产品状态：" + root.ComplianceStore.aggregateStatus(basic) + "。只统计已填写的变体：全部是已上市、只有一部分已上市，或都还没有上市。",
    ]));
    var statusTable = el("table", { class: "bands variant-table", id: "variant-status" });
    statusTable.append(el("caption", {}, ["各变体状态与上市日期"]));
    var statusHead = el("tr");
    ["变体型号", "状态", "状态说明", "EU 上市日期", "CA 上市日期", "US 上市日期"].forEach(function (label) {
      statusHead.append(el("th", {}, [label]));
    });
    var statusBody = el("tbody");
    if (!filled.length) statusBody.append(el("tr", {}, [el("td", { colspan: "6" }, ["先填写变体型号。空行不会出现在这里。"])]));
    filled.forEach(function (row) {
      statusBody.append(el("tr", {}, [
        el("td", {}, [row.model]),
        el("td", {}, [selectField("状态", row.status || "研发", STATUSES, function (value) {
          row.status = value;
          commitVariants(project, onChange, true);
        })]),
        el("td", {}, [textField("状态说明", row.statusNote, function (value) {
          row.statusNote = value;
          commitVariants(project, onChange, false);
        })]),
        el("td", {}, [dateField("EU 上市日期", row.launchDates.EU, function (value) {
          row.launchDates.EU = value;
          commitVariants(project, onChange, false);
        })]),
        el("td", {}, [dateField("CA 上市日期", row.launchDates.CA, function (value) {
          row.launchDates.CA = value;
          commitVariants(project, onChange, false);
        })]),
        el("td", {}, [dateField("US 上市日期", row.launchDates.US, function (value) {
          row.launchDates.US = value;
          commitVariants(project, onChange, false);
        })]),
      ]));
    });
    statusTable.append(el("thead", {}, [statusHead]), statusBody);
    box.append(el("div", { class: "table-scroll" }, [statusTable]));
    var file = el("input", { type: "file", accept: "image/*", id: "thumb-file" });
    file.addEventListener("change", function () {
      var picked = file.files && file.files[0];
      if (!picked) return;
      shrinkImage(picked, function (url) {
        basic.thumbnail = url || "";
        onChange(project);
        var note = box.querySelector(".thumb-note");
        if (note) note.textContent = url ? "已保存小缩略图（只在本机）。" : "图片太大，没有保存。请改用 Dropbox 路径。";
      });
    });
    box.append(el("label", { class: "attr" }, ["或为主型号选择一张小缩略图（不上传）", file]));
    box.append(el("p", { class: "help thumb-note" }, [basic.thumbnail ? "本机已有缩略图。" : "未存缩略图。"]));
    if (basic.thumbnail) box.append(el("img", { src: basic.thumbnail, alt: "产品缩略图", class: "thumb" }));
    return box;
  }

  function renderSensitive(project, onChange) {
    var data = project.archive.sensitive;
    var box = el("div", { class: "card", id: "sensitive-section" }, [
      el("p", { class: "note" }, ["商业敏感。审核包默认不包含本节。"]),
      textField("说明", data.note, function (value) { data.note = value; onChange(project); }),
      textField("成本备注", data.costNote, function (value) { data.costNote = value; onChange(project); }),
    ]);
    (data.suppliers || []).forEach(function (item, index) {
      box.append(el("div", { class: "question" }, [
        textField("供应商", item.name, function (value) { item.name = value; onChange(project); }),
        textField("部件", item.component, function (value) { item.component = value; onChange(project); }),
        pathField("Dropbox 路径", item.dropboxPath, function (value) { item.dropboxPath = value; onChange(project); }),
        removeButton(function () { data.suppliers.splice(index, 1); onChange(project); refresh(); }),
      ]));
    });
    box.append(addButton("添加供应商", function () {
      data.suppliers.push({ name: "待确认", component: "待确认", dropboxPath: "" });
      onChange(project);
      refresh();
    }));
    return box;
  }

  function renderEvidence(project, rows, onChange) {
    var box = el("div", {}, [
      el("h3", {}, ["清单要求的证据类型"]),
    ]);
    rows.forEach(function (row) {
      box.append(el("p", {}, [requirementTitle(rows, row.entry.id) + "：" + (row.entry.evidence_types || []).join("、")]));
    });
    (project.archive.evidence || []).forEach(function (item, index) {
      var linked = (item.requirementIds || []).map(function (id) {
        var row = rows.filter(function (entry) { return entry.entry.id === id; })[0];
        return row ? requirementTitle(rows, id) + " · " + root.ComplianceStore.versionGap(item, row.entry) : id;
      }).join("；");
      box.append(el("article", { class: "card" }, [
        selectField("类型", item.type, EVIDENCE_TYPES, function (value) { item.type = value; onChange(project); }),
        pathField("Dropbox 路径", item.dropboxPath, function (value) { item.dropboxPath = value; onChange(project); }),
        textField("页码", item.page, function (value) { item.page = value; onChange(project); }),
        textField("标准", item.standard, function (value) { item.standard = value; onChange(project); }),
        textField("标准版本", item.standardVersion, function (value) { item.standardVersion = value; onChange(project); refresh(); }),
        textField("实验室", item.lab, function (value) { item.lab = value; onChange(project); }),
        textField("报告号或证书号", item.reportNo, function (value) { item.reportNo = value; onChange(project); }),
        dateField("签发日期", item.issueDate, function (value) { item.issueDate = value; onChange(project); }),
        dateField("到期", item.expiry, function (value) { item.expiry = value; onChange(project); refresh(); }),
        textField("覆盖型号（顿号分隔）", (item.modelsCovered || []).join("、"), function (value) {
          item.modelsCovered = value.split("、").map(function (part) { return part.trim(); }).filter(Boolean);
          onChange(project);
          refresh();
        }),
        textField("关键参数", item.keyParameters, function (value) { item.keyParameters = value; onChange(project); }),
        textField("结论", item.conclusion, function (value) { item.conclusion = value; onChange(project); }),
        textField("关联条目（仍填编号，例如 EU-01）", (item.requirementIds || []).join("、"), function (value) {
          item.requirementIds = value.split(/[、,，\s]+/).map(function (part) { return part.trim(); }).filter(Boolean);
          onChange(project);
          refresh();
        }),
        el("p", { class: "help" }, ["关联名称：" + ((item.requirementIds || []).map(function (id) { return requirementTitle(rows, id); }).join("；") || "未关联条目")]),
        el("p", { class: "help" }, ["版本核对：" + (linked || "未关联条目")]),
        el("p", { class: "path" }, [(item.dropboxPath || "路径待确认") + (item.page ? " 第 " + item.page + " 页" : "")]),
        root.CompliancePaths.buttons(function () { return item.dropboxPath; }),
        removeButton(function () { project.archive.evidence.splice(index, 1); onChange(project); refresh(); }),
      ]));
    });
    box.append(addButton("添加证据", function () {
      project.archive.evidence.push({
        id: "ev-" + Date.now().toString(36),
        requirementIds: [],
        type: "测试报告",
        dropboxPath: "",
        page: "",
        standard: "",
        standardVersion: "",
        lab: "待确认",
        reportNo: "待确认（非真实编号）",
        issueDate: "",
        expiry: "",
        modelsCovered: [],
        keyParameters: "待确认",
        conclusion: "待确认",
      });
      onChange(project);
      refresh();
    }));
    return box;
  }

  function renderComparison(project, rows, onChange) {
    var box = el("div", { id: "comparison-list" }, [
      el("p", {}, ["状态由导入的 Dan Bot 结果填入，也可以手改。工具自己不下结论。"]),
      el("p", { class: "help" }, ["请把说明书发给 Dan Bot，再导入 JSON 或 YAML。格式见 docs/ai-judgment-format.md 的对比清单。"]),
    ]);
    var input = el("input", { type: "file", id: "comparison-file", accept: ".json,.yaml,.yml,application/json,text/yaml" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = root.ComplianceStore.parseJudgmentText(String(reader.result || ""));
          var result = root.ComplianceStore.mergeJudgments(project, parsed);
          onChange(result.project);
          refresh();
        } catch (err) {
          box.append(el("p", { class: "error" }, ["没能读这个文件。" + (err.message || "")]));
        }
      };
      reader.readAsText(file);
    });
    box.append(input);
    var known = {};
    (project.archive.comparisons || []).forEach(function (item) { known[item.requirement] = item; });
    var ordered = rows.slice().sort(function (a, b) {
      return (known[a.entry.id] ? 0 : 1) - (known[b.entry.id] ? 0 : 1);
    });
    ordered.forEach(function (row) {
      var item = known[row.entry.id] || {
        requirement: row.entry.id,
        market: row.marketCode,
        module: (row.entry.modules || [])[0] || "",
        status: "",
        reason: "",
        source: "",
        dropboxPath: "",
        page: "",
      };
      function save() {
        var list = project.archive.comparisons.filter(function (current) { return current.requirement !== item.requirement; });
        if (item.status) list.push(item);
        project.archive.comparisons = list;
        onChange(project);
      }
      var statusSelect = el("select");
      [["", "未填写"], ["符合", "✅符合"], ["差距", "⚠️差距"], ["缺失", "❌缺失"]].forEach(function (pair) {
        var option = el("option", { value: pair[0] }, [pair[1]]);
        if (pair[0] === item.status) option.selected = true;
        statusSelect.append(option);
      });
      statusSelect.addEventListener("change", function () {
        item.status = statusSelect.value;
        save();
        refresh();
      });
      box.append(el("article", { class: "card", id: "cmp-" + row.entry.id }, [
        el("h3", {}, [row.entry.id + " " + (MARK[item.status] || "未填写")]),
        el("label", { class: "attr" }, ["状态", statusSelect]),
        textField("理由", item.reason, function (value) { item.reason = value; save(); }),
        textField("来源", item.source, function (value) { item.source = value; save(); }),
        pathField("Dropbox 路径", item.dropboxPath, function (value) { item.dropboxPath = value; save(); }),
        textField("页码", item.page, function (value) { item.page = value; save(); }),
        el("p", {}, [item.reason || "理由待确认"]),
        el("p", { class: "help" }, ["来源：" + (item.source || "待确认")]),
        el("p", { class: "path" }, ["追溯：" + (item.dropboxPath || row.folder) + (item.page ? " 第 " + item.page + " 页" : " 页码待确认")]),
        root.CompliancePaths.buttons(function () { return item.dropboxPath || row.folder; }),
      ]));
    });
    return box;
  }

  function renderBom(project, onChange) {
    return listEditor(project, project.archive.bom, "添加关键件", function () {
      return { type: "待确认", model: "待确认", supplier: "待确认（示例）", certifications: "待确认", affectedCertificates: "待确认" };
    }, function (item) {
      return [
        textField("类型", item.type, function (value) { item.type = value; onChange(project); }),
        textField("型号", item.model, function (value) { item.model = value; onChange(project); }),
        textField("供应商", item.supplier, function (value) { item.supplier = value; onChange(project); }),
        textField("自身认证（UL/CB/FCC ID/IC）", item.certifications, function (value) { item.certifications = value; onChange(project); }),
        textField("变更会影响到的证书", item.affectedCertificates, function (value) { item.affectedCertificates = value; onChange(project); }),
      ];
    }, onChange);
  }

  function renderLabels(project, rows, onChange) {
    var basic = project.archive.basic;
    root.ComplianceStore.migrateVariants(project.archive);
    var filled = root.ComplianceStore.filledVariants(basic);
    var box = el("div", { id: "nameplate-variants" });
    box.append(el("p", { class: "help" }, ["每个已填写的变体一行。铭牌照片各 3 个 Dropbox 路径。变体在基本信息里增删，这里跟着变。"]));
    var table = el("table", { class: "bands variant-table", id: "nameplate-table" });
    table.append(el("caption", {}, ["各变体铭牌与标签"]));
    var head = el("tr");
    ["变体型号", "铭牌照片", "标签信息"].forEach(function (label) { head.append(el("th", {}, [label])); });
    var body = el("tbody");
    if (!filled.length) body.append(el("tr", {}, [el("td", { colspan: "3" }, ["还没有填写变体型号。"])]));
    filled.forEach(function (row) {
      var info = el("textarea", { rows: "4" }, [row.labelInfo || ""]);
      info.addEventListener("change", function () {
        row.labelInfo = info.value;
        commitVariants(project, onChange, false);
      });
      body.append(el("tr", {}, [
        el("td", {}, [row.model]),
        el("td", {}, [photoEditors(row.nameplatePhotos, function () { commitVariants(project, onChange, true); })]),
        el("td", {}, [el("label", { class: "attr" }, ["标签信息", info])]),
      ]));
    });
    table.append(el("thead", {}, [head]), body);
    box.append(el("div", { class: "table-scroll" }, [table]));
    box.append(el("h3", {}, ["其他标签记录"]));
    box.append(el("p", { class: "help" }, ["原先按条目登记的标签还在这里，不并进变体行，避免把旧路径丢掉。"]));
    box.append(listEditor(project, project.archive.labels, "添加标签", function () {
      return { name: "待确认", designPath: "", photoPath: "", version: "待确认", requirementIds: [], checkNote: "待确认" };
    }, function (item) {
      var linked = (item.requirementIds || []).map(function (id) {
        var row = rows.filter(function (entry) { return entry.entry.id === id; })[0];
        if (!row) return id + "：不在当前适用清单";
        var types = (row.entry.evidence_types || []).join("、");
        var needsPhoto = (row.entry.evidence_types || []).indexOf("标签照片") !== -1;
        return requirementTitle(rows, id) + " 要求 " + types + (needsPhoto && !item.photoPath && !item.designPath ? "；路径仍待确认" : "");
      }).join("；");
      return [
        textField("名称", item.name, function (value) { item.name = value; onChange(project); }),
        pathField("设计稿 Dropbox 路径", item.designPath, function (value) { item.designPath = value; onChange(project); }),
        pathField("照片 Dropbox 路径", item.photoPath, function (value) { item.photoPath = value; onChange(project); }),
        textField("版本", item.version, function (value) { item.version = value; onChange(project); }),
        textField("对照条目", (item.requirementIds || []).join("、"), function (value) {
          item.requirementIds = value.split("、").map(function (part) { return part.trim(); }).filter(Boolean);
          onChange(project);
          refresh();
        }),
        textField("核对说明", item.checkNote, function (value) { item.checkNote = value; onChange(project); }),
        el("p", { class: "help" }, [linked || "尚未对照条目"]),
      ];
    }, onChange));
    return box;
  }

  function renderManuals(project, onChange) {
    return listEditor(project, project.archive.manuals, "添加说明书", function () {
      return { market: "EU", language: "待确认", version: "待确认", dropboxPath: "", warningLocations: "待确认" };
    }, function (item) {
      return [
        selectField("市场", item.market || "EU", ["EU", "CA", "US"], function (value) { item.market = value; onChange(project); }),
        textField("语言", item.language, function (value) { item.language = value; onChange(project); }),
        textField("版本", item.version, function (value) { item.version = value; onChange(project); }),
        pathField("Dropbox 路径", item.dropboxPath, function (value) { item.dropboxPath = value; onChange(project); }),
        textField("安全或电池警示所在位置", item.warningLocations, function (value) { item.warningLocations = value; onChange(project); }),
      ];
    }, onChange);
  }

  function renderParties(project, onChange) {
    var parties = project.archive.parties;
    var box = el("div", { class: "card" }, [
      el("p", { class: "help" }, ["联系方式只记 Dropbox 路径，不把电话和邮箱写进本工具。"]),
    ]);
    Object.keys(parties).forEach(function (key) {
      box.append(pathField(root.ComplianceStore.partyLabel(key) + " 的 Dropbox 路径", parties[key].dropboxPath, function (value) {
        parties[key].dropboxPath = value;
        onChange(project);
      }));
    });
    return box;
  }

  function renderSchedule(project, onChange) {
    return listEditor(project, project.archive.schedule, "添加实验室安排", function () {
      return { market: "EU", lab: "待确认（示例）", fee: "待确认（示例）", start: "", end: "" };
    }, function (item) {
      return [
        selectField("市场", item.market || "EU", ["EU", "CA", "US"], function (value) { item.market = value; onChange(project); }),
        textField("实验室", item.lab, function (value) { item.lab = value; onChange(project); }),
        textField("费用（审核包默认不导出）", item.fee, function (value) { item.fee = value; onChange(project); }),
        dateField("开始", item.start, function (value) { item.start = value; onChange(project); }),
        dateField("结束", item.end, function (value) { item.end = value; onChange(project); }),
      ];
    }, onChange);
  }

  function renderIssues(project, onChange) {
    return listEditor(project, project.archive.issues, "添加问题", function () {
      return { item: "待确认", fix: "待确认", retest: "待确认", feedback: "待确认", requirementIds: [] };
    }, function (item) {
      return [
        textField("不合格项", item.item, function (value) { item.item = value; onChange(project); }),
        textField("纠正", item.fix, function (value) { item.fix = value; onChange(project); }),
        textField("复测结果", item.retest, function (value) { item.retest = value; onChange(project); }),
        textField("客户或主管机关反馈", item.feedback, function (value) { item.feedback = value; onChange(project); }),
        textField("关联条目", (item.requirementIds || []).join("、"), function (value) {
          item.requirementIds = value.split("、").map(function (part) { return part.trim(); }).filter(Boolean);
          onChange(project);
        }),
      ];
    }, onChange);
  }

  function renderLetters(project, onChange) {
    var box = listEditor(project, project.archive.correspondence, "添加往来", function () {
      return { ref: "待确认", party: "待确认", date: "", summary: "待确认", dropboxPath: "", requirementIds: [] };
    }, function (item) {
      return [
        textField("编号", item.ref, function (value) { item.ref = value; onChange(project); }),
        textField("对方", item.party, function (value) { item.party = value; onChange(project); }),
        dateField("日期", item.date, function (value) { item.date = value; onChange(project); }),
        textField("摘要", item.summary, function (value) { item.summary = value; onChange(project); }),
        pathField("Dropbox 路径", item.dropboxPath, function (value) { item.dropboxPath = value; onChange(project); }),
        textField("关联条目", (item.requirementIds || []).join("、"), function (value) {
          item.requirementIds = value.split("、").map(function (part) { return part.trim(); }).filter(Boolean);
          onChange(project);
        }),
      ];
    }, onChange);
    return box;
  }

  function folderModel(project) {
    var raw = ((project.archive.basic && project.archive.basic.model) || project.name || "").trim();
    var cut = raw.split("（")[0].trim();
    return cut || raw;
  }

  function otherFiles(project, bucket) {
    var other = project._files && project._files.other;
    if (!other || !other[bucket]) return [];
    return other[bucket].files || [];
  }

  function loadOther(project) {
    var model = folderModel(project);
    if (!model || project._filesModel === model) return;
    project._filesModel = model;
    fetch("/api/files?model=" + encodeURIComponent(model)).then(function (response) {
      return response.json();
    }).then(function (data) {
      project._files = data;
      if (root.__archiveRefresh) root.__archiveRefresh();
    }).catch(function () {});
  }

  function renderOther(project) {
    loadOther(project);
    var other = (project._files && project._files.other) || {};
    var box = el("div", { id: "other-files" }, [
      el("p", {}, ["这些文件在 02_产品/" + folderModel(project) + "/09_其他资料。参考目录不计入正式证据。待分类里一旦有文件，档案提醒会提示你归类。"]),
      el("p", { class: "help" }, ["命名也可以用市场 GEN、维度 00GEN，例如 UNI-8_GEN_00GEN_RPT_CB12345_20260301_v1.pdf。CB12345 只是命名举例。"]),
    ]);
    ["通用", "待分类", "参考"].forEach(function (bucket) {
      var slot = other[bucket] || { logical: "/合规知识库/02_产品/" + folderModel(project) + "/09_其他资料/" + bucket, files: [] };
      var block = el("article", { class: "card" }, [
        el("h3", {}, [bucket + (bucket === "参考" ? "（不计入正式证据）" : "")]),
        el("p", { class: "path" }, [slot.logical || slot.folder || ""]),
        root.CompliancePaths.buttons(slot.logical || slot.folder || ""),
      ]);
      var files = slot.files || [];
      if (!files.length) block.append(el("p", { class: "help" }, ["这个文件夹里还没有文件。"]));
      files.forEach(function (file) {
        var note = file.formal ? "可按文件名预填，仍须你确认。" : "不作为正式证据。";
        block.append(el("p", {}, [file.name + " · " + file.size + " 字节 · " + file.mtime + " · " + note]));
      });
      box.append(block);
    });
    return box;
  }

  function renderChanges(project, onChange) {
    return listEditor(project, project.archive.changelog, "添加变更", function () {
      return { date: "", kind: "产品", summary: "待确认", actions: "待确认" };
    }, function (item) {
      return [
        dateField("日期", item.date, function (value) { item.date = value; onChange(project); }),
        selectField("类型", item.kind || "产品", ["产品", "供应商", "关键件", "标准"], function (value) { item.kind = value; onChange(project); }),
        textField("内容", item.summary, function (value) { item.summary = value; onChange(project); }),
        textField("需要做的事", item.actions, function (value) { item.actions = value; onChange(project); }),
      ];
    }, onChange);
  }

  function listEditor(project, list, label, factory, fields, onChange) {
    var box = el("div");
    list.forEach(function (item, index) {
      var block = el("article", { class: "card" });
      fields(item).forEach(function (node) { block.append(node); });
      block.append(removeButton(function () {
        list.splice(index, 1);
        onChange(project);
        refresh();
      }));
      box.append(block);
    });
    box.append(addButton(label, function () {
      list.push(factory());
      onChange(project);
      refresh();
    }));
    return box;
  }

  function addButton(label, onClick) {
    var button = el("button", { type: "button", class: "ghost" }, [label]);
    button.addEventListener("click", onClick);
    return button;
  }

  function removeButton(onClick) {
    var button = el("button", { type: "button", class: "ghost" }, ["删除这条"]);
    button.addEventListener("click", onClick);
    return button;
  }

  function refresh() {
    if (root.__archiveRefresh) root.__archiveRefresh();
  }

  function shrinkImage(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        var scale = Math.min(1, 160 / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        var url = canvas.toDataURL("image/jpeg", 0.7);
        done(url.length > 120000 ? "" : url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function exportSummary(project, records) {
    var basic = project.archive.basic;
    var rows = [["市场", "模块", "对比状态", "证据编号", "最近到期"]].concat(records.map(function (record) {
      return [record.market, record.module, MARK[record.status] || record.status, record.evidenceNos, record.expiry || ""];
    }));
    var variantRows = [
      ["产品状态", root.ComplianceStore.aggregateStatus(basic)],
      ["变体型号", "屏幕尺寸", "状态", "状态说明", "EU 上市日期", "CA 上市日期", "US 上市日期", "标签信息"],
    ].concat(root.ComplianceStore.filledVariants(basic).map(function (row) {
      return [row.model, row.screen, row.status, row.statusNote, row.launchDates.EU, row.launchDates.CA, row.launchDates.US, row.labelInfo];
    }));
    var decisions = [["条目", "决定人", "决定日期", "备注", "决定人和日期已填"]].concat(root.ComplianceStore.waiverRecords(project).map(function (item) {
      return [item.id, item.decider, item.decidedOn, item.note, item.complete ? "是" : "否"];
    }));
    downloadXlsx(project.name + "_档案汇总.xlsx", [
      { name: "汇总", rows: rows },
      { name: "变体", rows: variantRows },
      { name: "测试决定", rows: decisions },
      { name: "说明", rows: [["免责声明", root.ComplianceStore.DISCLAIMER], ["证据", "只含路径和编号，不含文件"], ["测试决定", "领导层决定先不做测试的条目不计入缺失证据"]] },
    ]);
  }

  function exportAudit(project, market, includeSensitive) {
    var pack = root.ComplianceStore.auditPack(project, market, includeSensitive);
    var evidenceRows = [["类型", "编号", "标准", "版本", "实验室", "签发", "到期", "型号", "路径", "页码", "结论"]].concat(pack.evidence.map(function (item) {
      return [item.type, item.reportNo, item.standard, item.standardVersion, item.lab, item.issueDate, item.expiry, (item.modelsCovered || []).join("、"), item.dropboxPath, item.page, item.conclusion];
    }));
    var compareRows = [["条目", "市场", "模块", "状态", "理由", "来源", "路径", "页码"]].concat(pack.comparisons.map(function (item) {
      return [item.requirement, item.market, item.module, MARK[item.status] || item.status, item.reason, item.source, item.dropboxPath, item.page];
    }));
    var sheets = [
      { name: "技术文件目录", rows: pack.technicalIndex.map(function (line) { return [line]; }) },
      { name: "证据清单", rows: evidenceRows },
      { name: "对比", rows: compareRows },
      { name: "进度", rows: [["市场", "实验室", "开始", "结束", "费用"]].concat(pack.schedule.map(function (item) {
        return [item.market, item.lab, item.start, item.end, item.fee || ""];
      })) },
    ];
    sheets.push({
      name: "变体",
      rows: [["产品状态", pack.statusAggregate || ""]].concat([["变体型号", "屏幕尺寸", "状态", "状态说明", "EU 上市日期", "CA 上市日期", "US 上市日期", "标签信息", "照片", "铭牌照片"]]).concat((pack.variants || []).map(function (row) {
        return [row.model, row.screen, row.status, row.statusNote, row.launchDates.EU, row.launchDates.CA, row.launchDates.US, row.labelInfo, (row.photos || []).join("；"), (row.nameplatePhotos || []).join("；")];
      })),
    });
    sheets.push({
      name: "测试决定",
      rows: [["条目", "决定人", "决定日期", "备注", "决定人和日期已填"]].concat((pack.testDecisions || []).map(function (item) {
        return [item.id, item.decider, item.decidedOn, item.note, item.complete ? "是" : "否"];
      })),
    });
    if (includeSensitive && pack.sensitive) {
      sheets.push({
        name: "成本与供应商",
        rows: [["说明", pack.sensitive.note || ""], ["成本", pack.sensitive.costNote || ""]].concat((pack.sensitive.suppliers || []).map(function (item) {
          return [item.name, item.component, item.dropboxPath];
        })),
      });
    }
    downloadXlsx(project.name + "_审核包_" + (market || "全部") + ".xlsx", sheets);
  }

  function downloadXlsx(name, sheets) {
    var bytes = root.buildXlsx(sheets);
    var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  }

  root.ComplianceArchive = {
    render: function (host, project, rows, onChange) {
      root.__archiveRefresh = function () { render(host, project, rows, onChange); };
      render(host, project, rows, onChange);
    },
    summaryRows: summaryRows,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
