(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el.apply(null, arguments);
  };

  function render(project, rows, onChange) {
    root.ComplianceStore.ensureArchive(project);
    if (root.ComplianceStore.ensureCompareTodos(project)) onChange(project);
    var archive = project.archive;
    var counts = root.ComplianceStore.compareSummary(archive);
    var box = el("div", { id: "material-control" });
    box.append(el("p", { id: "compare-counts" }, [
      "一致 " + counts.consistent + " · 不一致 " + counts.diff + " · 缺失 " + counts.missing + " · 未登记 " + counts.unregistered + " · 过期 " + counts.expired + " · 疑似匹配 " + counts.fuzzy,
    ]));
    (root.ComplianceStore.materialAlerts(archive) || []).forEach(function (note) {
      box.append(el("p", { class: "note" }, [note]));
    });
    box.append(el("h3", { "data-fold": "关键元器件总表", "data-summary": "关键元器件总表：共 " + (archive.components || []).length + " 行" }, ["关键元器件总表"]));
    box.append(el("p", { class: "help" }, ["合并 CB 的 Critical components information 和 UL 的 List of critical components。这里只存字段和路径。"]));
    var query = el("input", { type: "search", id: "component-search", placeholder: "按部件或制造商搜索" });
    var tableHost = el("div");
    function paint() {
      var text = query.value.trim().toLowerCase();
      tableHost.replaceChildren(componentTable(project, text, onChange));
    }
    query.addEventListener("input", paint);
    box.append(query, tableHost);
    paint();
    box.append(el("h3", { "data-fold": "从报告导入关键件", "data-summary": "从报告导入关键件：" + ((archive.componentPreview || []).length ? "待确认 " + archive.componentPreview.length + " 行" : "未导入") }, ["从报告导入关键件"]));
    box.append(importPanel(project, onChange));
    box.append(el("h3", { "data-fold": "供应商材料保证书", "data-summary": "材料保证书：共 " + (archive.materials || []).length + " 份", "data-warn": (root.ComplianceStore.materialAlerts(archive) || []).length ? "1" : "0" }, ["供应商材料保证书"]));
    box.append(el("p", { class: "help" }, [
      "模板栏位：成型廠名稱 MOLDER NAME、購買者 PURCHASER NAME、料號 PART NUMBER、品名 PART DESCRIPTION、數量/採購單號碼 QUANTITY/P.O. NO.、規格書號碼 SPECIFICATION NO.、成型日期 MOLDING DATE、出貨日期 SHIPPING DATE、原料製造商 MATERIAL MANUFACTURER、原料型號 MATERIAL DESIGNATION、原料 UL 號碼 MATERIAL UL FILE NUMBER、原料防火等級 MATERIAL FLAMMABILITY CLASS、色料或添加劑 COLOR CONCENTRATES OR ADDITIVES、二次料 REGRIND %、Rev。命名示例 UNI-8_GEN_10MAT_COC_料号_20260301_V1.pdf。文件夹 GEN/10MAT_材料保证书。VO 或 V0 会记成 V-0。",
    ]));
    box.append(materialPanel(project, onChange));
    box.append(el("h3", { "data-fold": "交叉比对", "data-summary": "交叉比对：不一致 " + counts.diff + "、缺失 " + counts.missing + "、未登记 " + counts.unregistered, "data-warn": counts.diff || counts.missing || counts.unregistered || counts.expired ? "1" : "0" }, ["交叉比对"]));
    box.append(comparePanel(project, onChange));
    return box;
  }

  function componentTable(project, query, onChange) {
    var table = el("table", { class: "bands", id: "component-table" });
    var head = el("tr");
    ["部件名称", "制造商/商标", "型号", "技术参数", "依据标准", "认证标志/证书号", "料号", "来源", "报告号", "页码", "到期", ""].forEach(function (label) {
      head.append(el("th", {}, [label]));
    });
    var body = el("tbody");
    (project.archive.components || []).forEach(function (item, index) {
      var blob = (item.name + " " + item.manufacturer).toLowerCase();
      if (query && blob.indexOf(query) === -1) return;
      function cell(key) {
        var input = el("input", { type: "text", value: item[key] || "" });
        input.addEventListener("change", function () { item[key] = input.value; onChange(project); });
        return el("td", {}, [input]);
      }
      var source = el("select");
      ["", "CB", "UL"].forEach(function (label) {
        var option = el("option", { value: label }, [label || "未填"]);
        if (item.source === label) option.selected = true;
        source.append(option);
      });
      source.addEventListener("change", function () { item.source = source.value; onChange(project); });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        project.archive.components.splice(index, 1);
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      });
      body.append(el("tr", {}, [
        cell("name"), cell("manufacturer"), cell("model"), cell("parameters"), cell("standard"), cell("certMark"), cell("partNo"),
        el("td", {}, [source]), cell("reportNo"), cell("page"), cell("expiry"), el("td", {}, [del]),
      ]));
    });
    table.append(el("thead", {}, [head]), body);
    var add = el("button", { type: "button", class: "ghost" }, ["添加关键件"]);
    add.addEventListener("click", function () {
      project.archive.components.push({
        id: "cmp-" + Date.now().toString(36),
        name: "", manufacturer: "", model: "", parameters: "", standard: "", certMark: "", partNo: "", source: "", reportNo: "", page: "", supplierPath: "", expiry: "", legacy: null,
      });
      onChange(project);
      if (root.__archiveRefresh) root.__archiveRefresh();
    });
    return el("div", { class: "table-scroll" }, [table, add]);
  }

  function importPanel(project, onChange) {
    var box = el("div");
    var pick = el("button", { type: "button" }, ["选择 PDF 或 Word"]);
    pick.addEventListener("click", function () {
      fetch("/api/pick-files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: false }) }).then(function (response) {
        return response.json();
      }).then(function (data) {
        if (data.outside && data.outside.length) window.alert("这些文件不在 Dropbox 合规知识库里：\n" + data.outside.join("\n"));
        var file = (data.files || [])[0];
        if (!file) return;
        return fetch("/api/extract-components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: file }) }).then(function (response) {
          return response.json();
        }).then(function (extracted) {
          project.archive.componentPreview = (extracted.rows || []).map(function (row) {
            row.source = "";
            row.reportNo = "";
            row.keep = true;
            return row;
          });
          project._extractNote = extracted.message || (extracted.needsOcr ? "需要识别" : extracted.incomplete ? "提取不完整" : "");
          onChange(project);
          if (root.__archiveRefresh) root.__archiveRefresh();
        });
      }).catch(function () { window.alert("没能读取报告。文件仍只在本机。"); });
    });
    var template = el("button", { type: "button", class: "ghost" }, ["下载 Excel 模板"]);
    template.addEventListener("click", function () { downloadTemplate(); });
    var csv = el("input", { type: "file", accept: ".csv,.json,application/json,text/csv" });
    csv.addEventListener("change", function () {
      var file = csv.files && csv.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        importText(project, String(reader.result || ""), file.name, onChange);
      };
      reader.readAsText(file);
    });
    box.append(el("div", { class: "wizard-bar" }, [pick, template, csv]));
    if (project._extractNote) box.append(el("p", { class: "note" }, [project._extractNote]));
    (project.archive.componentPreview || []).forEach(function (row, index) {
      var name = el("input", { type: "text", value: row.name || "" });
      name.addEventListener("change", function () { row.name = name.value; });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        project.archive.componentPreview.splice(index, 1);
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      });
      box.append(el("div", { class: "screen-line" }, [name, el("span", {}, [row.manufacturer || ""]), del]));
    });
    if ((project.archive.componentPreview || []).length) {
      var confirm = el("button", { type: "button" }, ["确认导入"]);
      confirm.addEventListener("click", function () {
        project.archive.componentPreview.forEach(function (row) {
          project.archive.components.push({
            id: "cmp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: row.name || "", manufacturer: row.manufacturer || "", model: row.model || "", parameters: row.parameters || "",
            standard: row.standard || "", certMark: row.certMark || "", partNo: row.partNo || "", source: row.source || "",
            reportNo: row.reportNo || "", page: row.page || "", supplierPath: "", expiry: "", legacy: null,
          });
        });
        project.archive.componentPreview = [];
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      });
      box.append(confirm);
    }
    return box;
  }

  function importText(project, text, name, onChange) {
    var rows = [];
    if (name.indexOf(".json") !== -1 || text.trim().charAt(0) === "{") {
      var data = JSON.parse(text);
      rows = data.components || [];
    } else {
      text.split(/\r?\n/).slice(1).forEach(function (line) {
        if (!line.trim()) return;
        var cells = line.split(",");
        rows.push({ name: cells[0], manufacturer: cells[1], model: cells[2], parameters: cells[3], standard: cells[4], certMark: cells[5], partNo: cells[6], source: cells[7], reportNo: cells[8], page: cells[9] });
      });
    }
    project.archive.componentPreview = rows;
    project._extractNote = "待确认 " + rows.length + " 行。";
    onChange(project);
    if (root.__archiveRefresh) root.__archiveRefresh();
  }

  function downloadTemplate() {
    var header = ["部件名称", "制造商/商标", "型号", "技术参数", "依据标准", "认证标志/证书号", "料号", "来源", "报告号", "页码"];
    var bytes = root.buildXlsx([{ name: "关键件", rows: [header] }]);
    var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "关键件导入模板.xlsx";
    document.body.append(link);
    link.click();
    link.remove();
  }

  function materialPanel(project, onChange) {
    var box = el("div", { id: "material-certs" });
    var pick = el("button", { type: "button" }, ["选择保证书"]);
    pick.addEventListener("click", function () {
      fetch("/api/pick-files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: false }) }).then(function (response) {
        return response.json();
      }).then(function (data) {
        if (data.outside && data.outside.length) window.alert("这些文件不在 Dropbox 合规知识库里：\n" + data.outside.join("\n"));
        return Promise.all((data.files || []).map(function (path) {
          return fetch("/api/extract-material", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: path }) }).then(function (response) {
            return response.json();
          }).then(function (extracted) {
            return { path: path, extracted: extracted };
          });
        }));
      }).then(function (items) {
        project._materialPreview = items || [];
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      }).catch(function () { window.alert("没能读取保证书。文件仍只在本机。"); });
    });
    box.append(pick);
    (project._materialPreview || []).forEach(function (item, index) {
      var fields = (item.extracted && item.extracted.fields) || {};
      var signed = el("input", { type: "checkbox" });
      signed.addEventListener("change", function () { item.signed = signed.checked; });
      var save = el("button", { type: "button" }, ["确认这条"]);
      save.addEventListener("click", function () {
        fields.path = item.path;
        fields.signed = !!item.signed;
        fields.id = "mat-" + Date.now().toString(36);
        project.archive.materials.push(fields);
        project._materialPreview.splice(index, 1);
        onChange(project);
        if (root.__archiveRefresh) root.__archiveRefresh();
      });
      var note = item.extracted && item.extracted.message ? item.extracted.message : (item.extracted && item.extracted.incomplete ? "提取不完整，待确认" : "待确认");
      box.append(el("article", { class: "card" }, [
        el("p", { class: "path" }, [item.path]),
        el("p", { class: "note" }, [note + " · " + (fields.partNo || "未填料号") + " · " + (fields.ulFile || "") + " " + (fields.flammability || "")]),
        el("label", { class: "choice" }, [signed, " 已签章盖章"]),
        save,
      ]));
    });
    return box;
  }

  function comparePanel(project, onChange) {
    var rows = root.ComplianceStore.compareComponents(project.archive);
    var table = el("table", { class: "bands", id: "compare-table" });
    var head = el("tr");
    ["对象", "状态", "差异", "报告页", "保证书路径", ""].forEach(function (label) { head.append(el("th", {}, [label])); });
    var body = el("tbody");
    rows.forEach(function (row) {
      var confirm = null;
      if (row.fuzzy && row.material && row.component) {
        confirm = el("button", { type: "button" }, ["确认匹配"]);
        confirm.addEventListener("click", function () {
          project.archive.mappings.push({ componentId: row.component.id, materialId: row.material.id });
          onChange(project);
          if (root.__archiveRefresh) root.__archiveRefresh();
        });
      }
      var path = row.material && row.material.path;
      body.append(el("tr", {}, [
        el("td", {}, [row.label]),
        el("td", { class: row.status === "不一致" || row.status === "缺失" || row.status === "未登记" ? "missing" : "" }, [row.status]),
        el("td", { class: row.diffs.length ? "missing" : "" }, [row.diffs.join("、")]),
        el("td", {}, [row.component ? (row.component.reportNo || "") + " " + (row.component.page || "") : ""]),
        el("td", {}, [path || ""]),
        el("td", {}, [confirm, path ? root.CompliancePaths.buttons(path) : null]),
      ]));
    });
    table.append(el("thead", {}, [head]), body);
    var excel = el("button", { type: "button" }, ["导出比对 Excel"]);
    excel.addEventListener("click", function () {
      var sheet = [["对象", "状态", "差异", "报告号", "页码", "保证书路径"]].concat(rows.map(function (row) {
        return [row.label, row.status, row.diffs.join("、"), row.component ? row.component.reportNo : "", row.component ? row.component.page : "", row.material ? row.material.path : ""];
      }));
      var bytes = root.buildXlsx([{ name: "比对", rows: sheet }]);
      var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "关键件比对.xlsx";
      document.body.append(link);
      link.click();
      link.remove();
    });
    return el("div", { class: "table-scroll" }, [table, excel]);
  }

  root.ComplianceMaterials = { render: render };
})(typeof globalThis !== "undefined" ? globalThis : this);
