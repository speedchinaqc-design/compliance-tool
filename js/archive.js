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
    ["cb", "CB 体系"],
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
    if (section === "cb") page.append(renderCb(project, rows, onChange));
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
    var cb = project.archive.basic && project.archive.basic.cb;
    if (cb && cb.expiry) {
      var cbDays = root.ComplianceStore.daysUntil(cb.expiry);
      if (cbDays != null && cbDays <= 30) lines.push("CB 证书 30 天内或已到期：" + (cb.number || "未填证书号") + " · " + cb.expiry);
      else if (cbDays != null && cbDays <= 90) lines.push("CB 证书 90 天内到期：" + (cb.number || "未填证书号") + " · " + cb.expiry);
    }
    ((cb && cb.links) || []).forEach(function (id) {
      var linked = rows.filter(function (entry) { return entry.entry.id === id; })[0];
      if (!linked || !cb.standardVersion) return;
      var cbGap = root.ComplianceStore.versionGap({ standardVersion: cb.standardVersion }, linked.entry);
      if (cbGap === "版本可能不一致") lines.push(id + "：CB 标准版本" + cbGap + "（" + cb.standardVersion + "）");
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
          flags: root.ComplianceStore.homeCellFlags(project, related.map(function (row) { return row.entry.id; }), comparisons, evidence),
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

  var HOME_MARKETS = ["EU", "CA", "US"];
  var HOME_STATUSES = ["已齐全", "缺证据", "即将过期", "需要复核", "领导层决定不测试"];

  function filterStorageKey(project) {
    return "compliance-archive-filter-v1:" + (project.id || "");
  }

  function readHomeFilter(project, modules) {
    var fallback = { markets: HOME_MARKETS.slice(), modules: modules.slice(), statuses: HOME_STATUSES.slice() };
    try {
      var raw = root.localStorage && root.localStorage.getItem(filterStorageKey(project));
      if (!raw) return fallback;
      var saved = JSON.parse(raw);
      function keep(list, allowed) {
        if (!Array.isArray(list)) return allowed.slice();
        return list.filter(function (item) { return allowed.indexOf(item) !== -1; });
      }
      return {
        markets: saved.allMarkets ? HOME_MARKETS.slice() : keep(saved.markets, HOME_MARKETS),
        modules: saved.allModules ? modules.slice() : keep(saved.modules, modules),
        statuses: saved.allStatuses ? HOME_STATUSES.slice() : keep(saved.statuses, HOME_STATUSES),
      };
    } catch (err) {
      return fallback;
    }
  }

  function writeHomeFilter(project, filter, modules) {
    try {
      if (!root.localStorage) return;
      root.localStorage.setItem(filterStorageKey(project), JSON.stringify({
        markets: filter.markets,
        modules: filter.modules,
        statuses: filter.statuses,
        allMarkets: filter.markets.length === HOME_MARKETS.length,
        allModules: filter.modules.length === modules.length,
        allStatuses: filter.statuses.length === HOME_STATUSES.length,
      }));
    } catch (err) {}
  }

  function homeFilterMode(selected, all) {
    if (!selected.length) return "none";
    if (selected.length >= all.length) return "all";
    return "some";
  }

  function homeRowVisible(record, filter, modules) {
    var marketMode = homeFilterMode(filter.markets, HOME_MARKETS);
    if (marketMode === "none") return false;
    if (marketMode === "some" && filter.markets.indexOf(record.market) === -1) return false;
    var moduleMode = homeFilterMode(filter.modules, modules);
    if (moduleMode === "none") return false;
    if (moduleMode === "some" && filter.modules.indexOf(record.module) === -1) return false;
    var statusMode = homeFilterMode(filter.statuses, HOME_STATUSES);
    if (statusMode === "none") return false;
    if (statusMode === "some" && !filter.statuses.some(function (flag) { return (record.flags || []).indexOf(flag) !== -1; })) return false;
    return true;
  }

  function renderHome(project, rows, onChange) {
    var records = summaryRows(project, rows);
    var modules = [];
    records.forEach(function (record) {
      if (modules.indexOf(record.module) === -1) modules.push(record.module);
    });
    var filter = readHomeFilter(project, modules);
    var basic = project.archive.basic;
    var aggregate = root.ComplianceStore.aggregateStatus(basic);
    var table = el("table", { class: "bands", id: "archive-home" });
    var head = el("tr");
    ["市场", "模块", "对比状态", "证据编号", "最近到期"].forEach(function (label) {
      head.append(el("th", {}, [label]));
    });
    var body = el("tbody");
    table.append(el("thead", {}, [head]), body);
    var count = el("p", { id: "archive-filter-count", class: "help" });
    function shownRecords() {
      return records.filter(function (record) { return homeRowVisible(record, filter, modules); });
    }
    function paintRows() {
      var shown = shownRecords();
      body.replaceChildren();
      if (!shown.length) body.append(el("tr", {}, [el("td", { colspan: "5" }, ["没有符合筛选的项。"])]));
      shown.forEach(function (record) {
        body.append(el("tr", {}, [
          el("td", {}, [record.market]),
          el("td", {}, [record.module]),
          el("td", {}, [MARK[record.status] || record.status]),
          el("td", {}, [record.evidenceNos]),
          el("td", {}, [record.expiry || "未填"]),
        ]));
      });
      count.textContent = "显示 " + shown.length + " / 共 " + records.length + " 项";
      writeHomeFilter(project, filter, modules);
    }
    function optionGroup(title, name, options, selected) {
      var group = el("fieldset", {}, [el("legend", {}, [title])]);
      options.forEach(function (option) {
        var input = el("input", { type: "checkbox", name: name, value: option });
        if (selected.indexOf(option) !== -1) input.checked = true;
        input.addEventListener("change", function () {
          var picked = [];
          group.querySelectorAll("input[type=checkbox]").forEach(function (box) {
            if (box.checked) picked.push(box.value);
          });
          filter[name] = picked;
          paintRows();
        });
        group.append(el("label", { class: "choice" }, [input, " " + option]));
      });
      return group;
    }
    var filterBar = el("div", { id: "archive-filter", class: "archive-filter no-print" }, [
      optionGroup("市场", "markets", HOME_MARKETS, filter.markets),
      optionGroup("模块", "modules", modules, filter.modules),
      optionGroup("状态", "statuses", HOME_STATUSES, filter.statuses),
    ]);
    var clear = el("button", { type: "button", class: "ghost", id: "archive-filter-clear" }, ["清空筛选"]);
    clear.addEventListener("click", function () {
      filter.markets = HOME_MARKETS.slice();
      filter.modules = modules.slice();
      filter.statuses = HOME_STATUSES.slice();
      filterBar.querySelectorAll("input[type=checkbox]").forEach(function (input) { input.checked = true; });
      paintRows();
    });
    filterBar.append(clear);
    paintRows();
    var market = el("select", { id: "audit-market" });
    ["", "EU", "CA", "US"].forEach(function (code) {
      market.append(el("option", { value: code }, [code || "全部市场"]));
    });
    var sensitive = el("input", { type: "checkbox", id: "audit-sensitive" });
    var excel = el("button", { type: "button", id: "audit-excel" }, ["导出审核包 Excel"]);
    excel.addEventListener("click", function () { exportAudit(project, market.value, sensitive.checked); });
    var summaryExcel = el("button", { type: "button", id: "summary-excel" }, ["导出汇总 Excel"]);
    summaryExcel.addEventListener("click", function () {
      var shown = shownRecords();
      var onlyFiltered = root.confirm("导出当前筛选的 " + shown.length + " 项？\n确定：只导出筛选结果\n取消：导出全部 " + records.length + " 项");
      exportSummary(project, onlyFiltered ? shown : records);
    });
    var print = el("button", { type: "button", class: "ghost", id: "summary-print" }, ["打印 / 存为 PDF"]);
    print.addEventListener("click", function () {
      document.body.classList.add("print-archive");
      window.print();
      document.body.classList.remove("print-archive");
    });
    var waivers = root.ComplianceStore.waiverRecords(project).map(function (item) {
      return requirementTitle(rows, item.id) + " · 决定人 " + (item.decider || "未填") + " · " + (item.decidedOn || "日期未填") + (item.note ? " · " + item.note : "");
    });
    var counts = root.ComplianceStore.todoCounts(project.todos);
    return el("div", {}, [
      renderOverview(project),
      el("p", { id: "todo-counts" }, ["产品测试：待定 " + counts.pending + " · 进行中 " + counts.doing + " · 逾期 " + counts.overdue]),
      el("p", { id: "product-status", class: "note" }, ["产品状态：" + aggregate + "。由各变体是否「已上市」汇总，主型号本身不是变体。"]),
      waivers.length ? el("p", { class: "help" }, ["领导层决定先不做测试（不计入缺失证据）：" + waivers.join("；")]) : null,
      el("h3", {}, ["市场 × 模块"]),
      filterBar,
      el("p", { class: "help" }, ["状态可多选：一行只要命中所选中的一项就会留下。即将过期包括已到期和 90 天内。全选等于不限。"]),
      count,
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

  function screenEditors(row, onCommit) {
    if (!Array.isArray(row.screens)) row.screens = [{ text: row.screen || "" }];
    var box = el("div", { class: "screen-stack" });
    var summary = el("p", { class: "help screen-summary" });
    function paintSummary() {
      var text = root.ComplianceStore.screenSummary(row.screens);
      row.screen = text;
      summary.textContent = text || "尚未填写屏幕尺寸。";
    }
    (row.screens || []).forEach(function (item, index) {
      var input = el("input", { type: "text", value: item.text || "", placeholder: "例如 10寸+7寸" });
      input.addEventListener("change", function () {
        item.text = input.value;
        paintSummary();
        onCommit(false);
      });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        row.screens.splice(index, 1);
        paintSummary();
        onCommit(true);
      });
      box.append(el("div", { class: "screen-line" }, [
        el("span", { class: "screen-label" }, ["操作屏+客显屏"]),
        input,
        del,
      ]));
    });
    var add = el("button", { type: "button", class: "ghost" }, ["增加屏幕尺寸"]);
    add.addEventListener("click", function () {
      row.screens.push({ text: "" });
      onCommit(true);
    });
    paintSummary();
    box.append(summary, add);
    return box;
  }

  function choosePhotos(list, onCommit) {
    fetch("/api/pick-images", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function (response) {
      return response.json();
    }).then(function (data) {
      if (!data || data.ok === false) {
        window.alert((data && data.error) || "没能打开文件选择窗口。");
        return;
      }
      if (data.cancelled) return;
      if (data.outside && data.outside.length) window.alert("这些文件不在 Dropbox 合规知识库里，没有加入：\n" + data.outside.join("\n"));
      (data.files || []).forEach(function (path) {
        list.push({ path: path, typical: !list.some(function (photo) { return photo.typical && photo.path; }) });
      });
      if ((data.files || []).length) {
        for (var i = list.length - 1; i >= 0; i -= 1) {
          if (!list[i].path && list.length > 1) list.splice(i, 1);
        }
        if (list.length && !list.some(function (photo) { return photo.typical; })) list[0].typical = true;
        onCommit();
      }
    }).catch(function () {
      window.alert("没能打开文件选择窗口。请用 python3 tools/serve.py 或桌面版。");
    });
  }

  function photoListEditors(list, onCommit) {
    if (!Array.isArray(list)) return el("div");
    var stack = el("div", { class: "photo-stack" });
    list.forEach(function (item, index) {
      stack.append(pathField("照片路径（点“选择图片”自动填）", item.path, function (value) {
        item.path = value;
        if (!list.some(function (photo) { return photo.typical; })) item.typical = true;
        onCommit();
      }));
      if (item.path) stack.append(localThumb(item.path));
      var typical = el("button", { type: "button", class: item.typical ? "" : "ghost" }, [item.typical ? "典型照片" : "设为典型照片"]);
      typical.addEventListener("click", function () {
        list.forEach(function (photo) { photo.typical = false; });
        item.typical = true;
        onCommit();
      });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        list.splice(index, 1);
        if (list.length && !list.some(function (photo) { return photo.typical; })) list[0].typical = true;
        onCommit();
      });
      stack.append(el("div", { class: "wizard-bar" }, [typical, del]));
    });
    var pick = el("button", { type: "button" }, ["选择图片"]);
    pick.addEventListener("click", function () { choosePhotos(list, onCommit); });
    var add = el("button", { type: "button", class: "ghost" }, ["增加照片"]);
    add.addEventListener("click", function () {
      list.push({ path: "", typical: !list.some(function (photo) { return photo.typical; }) });
      onCommit();
    });
    stack.append(el("div", { class: "wizard-bar" }, [pick, add]));
    return stack;
  }

  function renderOverview(project) {
    var data = root.ComplianceStore.overview(project);
    var box = el("section", { id: "product-overview", class: "card" }, [
      el("h3", {}, ["产品信息总览"]),
      el("p", { id: "overview-count" }, [data.label]),
    ]);
    var missing = data.items.filter(function (item) { return !item.filled; });
    if (missing.length) {
      var list = el("ul", { id: "overview-missing" });
      missing.forEach(function (item) {
        var button = el("button", { type: "button", class: "ghost missing" }, [item.text]);
        button.addEventListener("click", function () { openSection(item.section); });
        list.append(el("li", {}, [button]));
      });
      box.append(list);
    }
    root.ComplianceStore.filledVariants(project.archive.basic).forEach(function (row) {
      var summary = root.ComplianceStore.screenSummary(row.screens) || "屏幕未填";
      var dates = "EU " + ((row.launchDates && row.launchDates.EU) || "未填") + " · CA " + ((row.launchDates && row.launchDates.CA) || "未填") + " · US " + ((row.launchDates && row.launchDates.US) || "未填");
      var openBasic = el("button", { type: "button", class: "ghost" }, [row.model + " · " + summary + " · " + (row.status || "状态未填") + " · " + dates]);
      openBasic.addEventListener("click", function () { openSection("basic"); });
      var openLabel = el("button", { type: "button", class: row.labelInfo ? "ghost" : "ghost missing" }, ["铭牌标签：" + (row.labelInfo || "未填")]);
      openLabel.addEventListener("click", function () { openSection("labels"); });
      box.append(el("div", { class: "wizard-bar" }, [openBasic, openLabel]));
    });
    var cb = (project.archive.basic && project.archive.basic.cb) || {};
    function jump(label, target, warn) {
      var button = el("button", { type: "button", class: warn ? "ghost missing" : "ghost" }, [label]);
      button.addEventListener("click", function () { openSection(target); });
      return button;
    }
    box.append(el("div", { class: "wizard-bar" }, [
      jump("责任主体", "parties", false),
      jump("CB 证书号：" + (cb.number || "未填"), "cb", !cb.number),
      jump("关键件 " + ((project.archive.bom || []).length), "bom", !(project.archive.bom || []).length),
      jump("证据 " + ((project.archive.evidence || []).length), "evidence", !(project.archive.evidence || []).length),
    ]));
    return box;
  }

  function openSection(name) {
    section = name || "home";
    refresh();
  }

  function renderBasic(project, onChange) {
    var basic = project.archive.basic;
    root.ComplianceStore.migrateVariants(project.archive);
    var box = el("div", { class: "card", id: "basic-info" }, [
      renderOverview(project),
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
    ["变体型号", "屏幕尺寸（操作屏尺寸+客显屏尺寸）", "照片", ""].forEach(function (label) { head.append(el("th", {}, [label])); });
    var body = el("tbody");
    (basic.variantRows || []).forEach(function (row, index) {
      body.append(el("tr", {}, [
        el("td", {}, [
          textField("变体型号", row.model, function (value) {
            row.model = value.trim();
            commitVariants(project, onChange, true);
          }),
          (function () {
            var typical = root.ComplianceStore.typicalPhoto(row.photos);
            return typical ? localThumb(typical.path) : el("p", { class: "help" }, ["还没有典型照片。"]);
          })(),
        ]),
        el("td", {}, [screenEditors(row, function (rerender) { commitVariants(project, onChange, !!rerender); })]),
        el("td", {}, [photoListEditors(row.photos, function () { commitVariants(project, onChange, true); })]),
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
    var file = el("input", { type: "file", accept: "image/*", id: "thumb-file", multiple: "multiple" });
    file.addEventListener("change", function () {
      var files = file.files ? Array.prototype.slice.call(file.files) : [];
      var pending = files.length;
      if (!pending) return;
      basic.thumbnails = basic.thumbnails || [];
      files.forEach(function (picked) {
        shrinkImage(picked, function (url) {
          pending -= 1;
          if (url) basic.thumbnails.push({ url: url, main: !basic.thumbnails.some(function (item) { return item.main; }) });
          if (pending === 0) {
            var main = basic.thumbnails.filter(function (item) { return item.main; })[0];
            basic.thumbnail = main ? main.url : "";
            onChange(project);
            refresh();
          }
        });
      });
    });
    box.append(el("label", { class: "attr" }, ["为主型号选择小缩略图（不上传，可多选）", file]));
    box.append(el("p", { class: "help thumb-note" }, [(basic.thumbnails || []).length ? "缩略图只存在本机，不会上传。" : "未存缩略图。"]));
    var gallery = el("div", { id: "main-thumbs", class: "wizard-bar" });
    (basic.thumbnails || []).forEach(function (item, index) {
      var card = el("div", { class: "card" }, [el("img", { src: item.url, alt: "主型号缩略图", class: "thumb" })]);
      var pick = el("button", { type: "button", class: item.main ? "" : "ghost" }, [item.main ? "主图" : "设为主图"]);
      pick.addEventListener("click", function () {
        basic.thumbnails.forEach(function (thumb) { thumb.main = false; });
        item.main = true;
        basic.thumbnail = item.url;
        onChange(project);
        refresh();
      });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        basic.thumbnails.splice(index, 1);
        if (basic.thumbnails.length && !basic.thumbnails.some(function (thumb) { return thumb.main; })) basic.thumbnails[0].main = true;
        var main = basic.thumbnails.filter(function (thumb) { return thumb.main; })[0];
        basic.thumbnail = main ? main.url : "";
        onChange(project);
        refresh();
      });
      card.append(pick, del);
      gallery.append(card);
    });
    box.append(gallery);
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
        el("td", {}, [photoListEditors(row.nameplatePhotos, function () { commitVariants(project, onChange, true); })]),
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

  function renderCb(project, rows, onChange) {
    var cb = project.archive.basic.cb;
    var folder = "/合规知识库/02_产品/" + folderModel(project) + "/GEN/04ELEC_电气安全/";
    var box = el("div", { id: "cb-record", class: "card" }, [
      el("h3", {}, ["CB 体系"]),
      el("p", { class: "help" }, ["这不是新的法规条目。证书和报告作为 EU-04、CA-04、US-04 里已有 62368-1 要求的参考证据。文件放在 GEN/04ELEC_电气安全，不把内容抄进仓库。"]),
      el("p", { class: "path" }, [folder]),
      root.CompliancePaths.buttons(folder),
    ]);
    function text(label, key) {
      box.append(textField(label, cb[key], function (value) { cb[key] = value; onChange(project); }));
    }
    text("CB 证书号", "number");
    text("NCB", "ncb");
    text("测试实验室", "lab");
    text("标准版本", "standardVersion");
    ["EU", "CA", "US"].forEach(function (code) {
      box.append(textField(code + " 国家差异", cb.differences[code], function (value) {
        cb.differences[code] = value;
        onChange(project);
      }));
    });
    box.append(textField("覆盖型号（顿号分隔）", (cb.modelsCovered || []).join("、"), function (value) {
      cb.modelsCovered = value.split("、").map(function (part) { return part.trim(); }).filter(Boolean);
      onChange(project);
    }));
    box.append(dateField("签发日期", cb.issueDate, function (value) { cb.issueDate = value; onChange(project); }));
    box.append(dateField("有效期", cb.expiry, function (value) { cb.expiry = value; onChange(project); refresh(); }));
    box.append(pathField("证书 Dropbox 路径", cb.certificatePath, function (value) { cb.certificatePath = value; onChange(project); }));
    box.append(pathField("报告 Dropbox 路径", cb.reportPath, function (value) { cb.reportPath = value; onChange(project); }));
    var targets = [
      ["EU-04", "EU LVD / EN IEC 62368-1"],
      ["CA-04", "CA CSA C22.2 No. 62368-1"],
      ["US-04", "US UL 62368-1"],
    ];
    box.append(el("p", {}, ["可作为参考证据连到这些已有条目："]));
    targets.forEach(function (pair) {
      var input = el("input", { type: "checkbox" });
      input.checked = (cb.links || []).indexOf(pair[0]) !== -1;
      input.addEventListener("change", function () {
        var links = (cb.links || []).filter(function (id) { return id !== pair[0]; });
        if (input.checked) links.push(pair[0]);
        cb.links = links;
        onChange(project);
        refresh();
      });
      var row = rows.filter(function (entry) { return entry.entry.id === pair[0]; })[0];
      var note = row ? requirementTitle(rows, pair[0]) : pair[1];
      box.append(el("label", { class: "choice" }, [input, " " + note]));
      if (input.checked && row && cb.standardVersion) {
        box.append(el("p", { class: "help" }, ["版本核对：" + root.ComplianceStore.versionGap({ standardVersion: cb.standardVersion }, row.entry)]));
      }
    });
    box.append(renderCbHistory(project, cb, onChange));
    return box;
  }

  function renderCbHistory(project, cb, onChange) {
    var box = el("section", { id: "cb-history" }, [el("h3", {}, ["CB 履历"])]);
    var draft = (cb.history || []).some(function (item) { return !item.readonly; });
    var add = el("button", { type: "button", id: "cb-add-update" }, ["新增 CB 更新"]);
    add.disabled = draft;
    add.addEventListener("click", function () {
      cb.history = cb.history || [];
      cb.history.push({
        id: "cbh-" + Date.now().toString(36),
        updatedOn: "",
        kind: "标准换版",
        number: cb.number || "",
        standardVersion: cb.standardVersion || "",
        summary: "",
        certificatePath: cb.certificatePath || "",
        reportPath: cb.reportPath || "",
        readonly: false,
      });
      onChange(project);
      refresh();
    });
    box.append(add);
    (cb.history || []).forEach(function (entry) {
      if (entry.readonly) {
        box.append(el("article", { class: "card" }, [
          el("p", {}, [entry.updatedOn || "日期未填", " · ", entry.kind, " · ", entry.number || "证书号未填"]),
          el("p", {}, ["标准版本：" + (entry.standardVersion || "未填")]),
          el("p", { class: "fixed-note" }, [entry.summary || ""]),
          el("p", { class: "path" }, [entry.certificatePath || "证书路径未填"]),
          entry.certificatePath ? root.CompliancePaths.buttons(entry.certificatePath) : null,
          el("p", { class: "path" }, [entry.reportPath || ""]),
          entry.reportPath ? root.CompliancePaths.buttons(entry.reportPath) : null,
        ]));
        return;
      }
      var kind = el("select");
      ["标准换版", "产品迭代", "新增型号", "证书续期", "其他"].forEach(function (label) {
        var option = el("option", { value: label }, [label]);
        if (entry.kind === label) option.selected = true;
        kind.append(option);
      });
      kind.addEventListener("change", function () { entry.kind = kind.value; onChange(project); });
      var updatedOn = el("input", { type: "date", value: entry.updatedOn || "" });
      updatedOn.addEventListener("change", function () { entry.updatedOn = updatedOn.value; onChange(project); });
      var number = el("input", { type: "text", value: entry.number || "" });
      number.addEventListener("change", function () { entry.number = number.value; onChange(project); });
      var version = el("input", { type: "text", value: entry.standardVersion || "" });
      version.addEventListener("change", function () { entry.standardVersion = version.value; onChange(project); });
      var summary = el("textarea", { class: "fixed-note", rows: "4" }, [entry.summary || ""]);
      summary.addEventListener("change", function () { entry.summary = summary.value; onChange(project); });
      var cert = el("input", { type: "text", value: entry.certificatePath || "" });
      cert.addEventListener("change", function () { entry.certificatePath = cert.value; onChange(project); });
      var report = el("input", { type: "text", value: entry.reportPath || "" });
      report.addEventListener("change", function () { entry.reportPath = report.value; onChange(project); });
      var save = el("button", { type: "button" }, ["保存此更新"]);
      save.addEventListener("click", function () {
        cb.number = entry.number || "";
        cb.standardVersion = entry.standardVersion || "";
        cb.certificatePath = entry.certificatePath || "";
        cb.reportPath = entry.reportPath || "";
        entry.readonly = true;
        project.archive.changelog = project.archive.changelog || [];
        project.archive.changelog.push({
          date: entry.updatedOn || "",
          kind: "标准",
          summary: "CB 更新：" + (entry.kind || "") + " " + (entry.number || ""),
          actions: entry.summary || "",
        });
        onChange(project);
        refresh();
      });
      box.append(el("article", { class: "card", id: "cb-draft" }, [
        el("label", { class: "attr" }, ["更新日期", updatedOn]),
        el("label", { class: "attr" }, ["更新类型", kind]),
        el("label", { class: "attr" }, ["证书号/修订号", number]),
        el("label", { class: "attr" }, ["标准版本", version]),
        el("label", { class: "attr" }, ["简要说明", summary]),
        el("label", { class: "attr" }, ["证书 Dropbox 路径", cert]),
        root.CompliancePaths.buttons(function () { return cert.value; }),
        el("label", { class: "attr" }, ["报告 Dropbox 路径", report]),
        root.CompliancePaths.buttons(function () { return report.value; }),
        save,
      ]));
    });
    return box;
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
      ["变体型号", "屏幕尺寸（操作屏尺寸+客显屏尺寸）", "状态", "状态说明", "EU 上市日期", "CA 上市日期", "US 上市日期", "标签信息"],
    ].concat(root.ComplianceStore.filledVariants(basic).map(function (row) {
      return [row.model, root.ComplianceStore.screenSummary(row.screens) || row.screen, row.status, row.statusNote, row.launchDates.EU, row.launchDates.CA, row.launchDates.US, row.labelInfo];
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
        return [row.model, row.screen, row.status, row.statusNote, row.launchDates.EU, row.launchDates.CA, row.launchDates.US, row.labelInfo, (row.photos || []).map(function (item) { return item.path || item; }).join("；"), (row.nameplatePhotos || []).map(function (item) { return item.path || item; }).join("；")];
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
