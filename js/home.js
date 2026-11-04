(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el(arguments[0], arguments[1], arguments[2]);
  };

  function renderDashboard(parent, projects, library) {
    var old = document.getElementById("dashboard");
    if (old) old.remove();
    var box = el("section", { id: "dashboard" }, [el("h2", {}, ["首页"])]);
    var expiring = [];
    var gaps = [];
    var pending = [];
    var reviews = [];
    projects.forEach(function (project) {
      var cb = project.archive && project.archive.basic && project.archive.basic.cb;
      (root.ComplianceStore.materialAlerts ? root.ComplianceStore.materialAlerts(project.archive || {}) : []).forEach(function (note) {
        expiring.push(project.name + " · " + note);
      });
      var cmp = project.archive && root.ComplianceStore.compareSummary ? root.ComplianceStore.compareSummary(project.archive) : null;
      if (cmp && (cmp.diff || cmp.missing || cmp.unregistered || cmp.expired)) {
        gaps.push(project.name + " · 关键件比对 不一致 " + cmp.diff + " · 缺失 " + cmp.missing + " · 未登记 " + cmp.unregistered + " · 过期 " + cmp.expired);
      }
      if (cb && cb.expiry) {
        var cbDays = root.ComplianceStore.daysUntil(cb.expiry);
        if (cbDays != null && cbDays <= 90) expiring.push(project.name + " · CB " + (cb.number || "证书") + " · " + cb.expiry + (cbDays <= 30 ? "（30 天内）" : ""));
      }
      ((project.archive && project.archive.evidence) || []).forEach(function (item) {
        var days = root.ComplianceStore.daysUntil(item.expiry);
        if (days != null && days <= 90) expiring.push(project.name + " · " + (item.reportNo || item.type) + " · " + item.expiry + (days <= 30 ? "（30 天内）" : ""));
      });
      ((project.archive && project.archive.comparisons) || []).forEach(function (item) {
        if (item.status === "差距" || root.ComplianceStore.countsAsMissing(project, item)) gaps.push(project.name + " · " + item.requirement + " · " + item.status);
      });
      Object.keys(project.reviews || {}).forEach(function (id) {
        if (project.reviews[id] && project.reviews[id].status === "需要复核") reviews.push(project.name + " · " + id + " · " + (project.reviews[id].summary || ""));
      });
    });
    (root.COMPLIANCE_DATA.markets || []).forEach(function (market) {
      market.dimensions.forEach(function (dimension) {
        dimension.entries.forEach(function (entry) {
          if (entry.status === "待核实") pending.push(entry.id + " " + dimension.name_zh);
        });
      });
    });
    box.append(line("90 天内到期或已到期的证据", expiring));
    box.append(line("对比为差距或缺失", gaps));
    box.append(line("清单状态为待核实", pending.slice(0, 12)));
    box.append(line("需要复核", reviews));
    var backup = library && library.lastBackupAt ? "最近备份：" + library.lastBackupAt : "还没有成功备份。";
    if (library && library.lastBackupError) backup += " " + library.lastBackupError;
    box.append(el("p", { class: library && library.lastBackupAt ? "help" : "note" }, [backup]));
    if (library && library.unsortedCount) box.append(el("p", { class: "note" }, ["待分类文件夹里共有 " + library.unsortedCount + " 个文件，请归类。参考目录不计入正式证据。"]));
    var waivers = [];
    projects.forEach(function (project) {
      root.ComplianceStore.waiverRecords(project).forEach(function (item) {
        waivers.push(project.name + " · " + item.id + " · 决定人 " + (item.decider || "未填") + " · " + (item.decidedOn || "日期未填"));
      });
    });
    if (waivers.length) box.append(line("领导层决定先不做测试（不计入缺失证据）", waivers));
    var input = el("input", { type: "file", id: "regulation-update-file", accept: ".json,.yaml,.yml,application/json" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = root.ComplianceStore.parseJudgmentText(String(reader.result || ""));
          var count = root.ComplianceStore.applyRegulationUpdates(projects, parsed);
          projects.forEach(function (project) { root.ComplianceStore.replace(project); });
          window.alert("已标记 " + count + " 处需要复核。");
          if (root.__showHome) root.__showHome();
        } catch (err) {
          window.alert("没能读法规更新文件。" + (err.message || ""));
        }
      };
      reader.readAsText(file);
    });
    box.append(el("p", { class: "help" }, ["来源页变化或 Dan Bot 的法规更新 JSON 会把相关行标成「需要复核」。格式见 docs/regulation-update-format.md。"]));
    box.append(input);
    if (parent.firstChild) parent.insertBefore(box, parent.firstChild);
    else parent.append(box);
  }

  function line(title, items) {
    var block = el("article", { class: "card" }, [el("h3", {}, [title + "（" + items.length + "）"])]);
    if (!items.length) block.append(el("p", { class: "help" }, ["没有。"]));
    items.slice(0, 8).forEach(function (item) { block.append(el("p", {}, [item])); });
    return block;
  }

  function renderSearch(parent, data, projects) {
    var box = el("section", { id: "global-search" }, [el("h2", {}, ["搜索"])]);
    var input = el("input", { type: "search", id: "search-all", placeholder: "例如 UL 4200A、NAWI、UNI-8" });
    var results = el("div", { id: "search-results" });
    input.addEventListener("input", function () {
      var hits = root.ComplianceSearch.searchAll(data, projects, input.value);
      results.replaceChildren();
      if (!input.value.trim()) return;
      if (!hits.length) results.append(el("p", {}, ["没有匹配。"]));
      hits.forEach(function (hit) {
        results.append(el("p", {}, [hit.kind + " · " + hit.title + (hit.detail ? " · " + hit.detail : "")]));
      });
    });
    box.append(input, results);
    parent.append(box);
  }

  root.ComplianceHome = { renderDashboard: renderDashboard, renderSearch: renderSearch };
})(typeof globalThis !== "undefined" ? globalThis : this);
