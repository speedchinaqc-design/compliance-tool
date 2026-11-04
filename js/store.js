(function (root) {
  "use strict";

  var KEY = "compliance-tool-projects-v1";
  var DISCLAIMER = "注意：您最终必须根据相关法律法规最新版本、指导文件或其他来源的要求采取行动。";
  var JUDGMENT_STATUS = ["已核实", "待核实", "N/A", "待确认"];

  function now() {
    return new Date().toISOString();
  }

  function uid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function blankAnswers() {
    return {
      product_function: "",
      materials: "",
      voltage: "",
      has_wifi: false,
      has_battery: false,
      battery_mount: "unknown",
      commercial_form_note: "尚未分析",
      legal_for_trade: false,
      b2b_login_only: false,
      processes_personal_data: false,
    };
  }

  function uni8Project() {
    var stamp = now();
    return {
      id: "uni-8-sample",
      name: "UNI-8",
      sample: true,
      wizardComplete: true,
      markets: ["EU", "CA", "US"],
      modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"],
      answers: {
        product_function: "非自动衡器，计价贴标。准确度等级在规划书中是推断 III 级，待确认。",
        materials: "",
        voltage: "100–240 V AC",
        has_wifi: true,
        has_battery: true,
        battery_mount: "unknown",
        commercial_form_note: "尚未分析",
        legal_for_trade: true,
        b2b_login_only: false,
        processes_personal_data: false,
      },
      checks: {},
      tests: {},
      aiJudgments: [],
      archive: sampleArchive(),
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  function blankProject(name) {
    var stamp = now();
    return {
      id: uid(),
      name: name || "未命名产品",
      sample: false,
      wizardComplete: false,
      markets: [],
      modules: [],
      answers: blankAnswers(),
      checks: {},
      tests: {},
      aiJudgments: [],
      archive: blankArchive(),
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  function load() {
    if (root.ComplianceLocal && root.ComplianceLocal.snapshot()) {
      var live = root.ComplianceLocal.snapshot().projects;
      return Array.isArray(live) ? live : [];
    }
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data.projects) ? data.projects : [];
    } catch (err) {
      return [];
    }
  }

  function save(projects) {
    if (root.ComplianceLocal && root.ComplianceLocal.snapshot()) {
      root.ComplianceLocal.snapshot().projects = projects;
      root.ComplianceLocal.persist();
      return projects;
    }
    root.localStorage.setItem(KEY, JSON.stringify({ format: "compliance-tool-projects-v1", projects: projects }));
    return projects;
  }

  function seedIfEmpty() {
    var projects = load();
    if (projects.length) return projects;
    return save([uni8Project()]);
  }

  function replace(project) {
    var projects = load();
    var found = false;
    var next = projects.map(function (item) {
      if (item.id !== project.id) return item;
      found = true;
      project.updatedAt = now();
      return project;
    });
    if (!found) next.push(project);
    save(next);
    return project;
  }

  function get(id) {
    return load().filter(function (item) { return item.id === id; })[0] || null;
  }

  function remove(id) {
    save(load().filter(function (item) { return item.id !== id; }));
  }

  function duplicate(id) {
    var source = get(id);
    if (!source) return null;
    var copy = JSON.parse(JSON.stringify(source));
    copy.id = uid();
    copy.name = source.name + " 副本";
    copy.sample = false;
    copy.createdAt = now();
    copy.updatedAt = copy.createdAt;
    var projects = load();
    projects.push(copy);
    save(projects);
    return copy;
  }

  function rename(id, name) {
    var project = get(id);
    if (!project) return null;
    project.name = String(name || "").trim() || project.name;
    return replace(project);
  }

  function exportPayload(projects) {
    return {
      format: "compliance-tool-projects-v1",
      exportedAt: now(),
      note: "备份用。不含登录密码。可存到 Dropbox，不要把证书 PDF 放进这个 JSON。",
      projects: projects || load(),
    };
  }

  function importPayload(payload) {
    var incoming = payload && payload.projects ? payload.projects : Array.isArray(payload) ? payload : payload && payload.id ? [payload] : [];
    if (!incoming.length) throw new Error("文件里没有项目。");
    var projects = load();
    incoming.forEach(function (item) {
      if (!item || !item.name) throw new Error("有项目缺少名称。");
      if (!item.id) item.id = uid();
      var index = -1;
      projects.forEach(function (current, i) {
        if (current.id === item.id) index = i;
      });
      item.updatedAt = now();
      if (index >= 0) projects[index] = item;
      else projects.push(item);
    });
    return save(projects);
  }

  function normalizeJudgment(item) {
    if (!item || typeof item !== "object") return null;
    var status = item.status || "待核实";
    if (JUDGMENT_STATUS.indexOf(status) === -1) return null;
    var market = item.market || "";
    var moduleName = item.module || "";
    var requirement = item.requirement || item.requirement_id || "";
    if (!requirement && !(market && moduleName)) return null;
    var layer1 = item.layer1 || {};
    var layer2 = item.layer2 || {};
    return {
      requirement: String(requirement),
      market: String(market),
      module: String(moduleName),
      layer1: {
        regulation: String(layer1.regulation || ""),
        official_link: String(layer1.official_link || layer1.official_url || ""),
      },
      layer2: {
        standard: String(layer2.standard || ""),
        dropbox_path: String(layer2.dropbox_path || ""),
        link: String(layer2.link || ""),
      },
      conclusion: String(item.conclusion || "待确认"),
      source: String(item.source || ""),
      status: status,
    };
  }

  function mergeJudgments(project, fileObject) {
    var list = (fileObject && fileObject.judgments) || [];
    var merged = 0;
    var skipped = 0;
    var current = (project.aiJudgments || []).slice();
    list.forEach(function (item) {
      var row = normalizeJudgment(item);
      if (!row) {
        skipped += 1;
        return;
      }
      var index = -1;
      current.forEach(function (existing, i) {
        if (row.requirement && existing.requirement === row.requirement) index = i;
      });
      if (index >= 0) current[index] = row;
      else current.push(row);
      merged += 1;
    });
    project.aiJudgments = current;
    var comparisons = mergeComparisons(project, fileObject);
    return {
      project: project,
      merged: merged,
      skipped: skipped,
      comparisons: comparisons.merged,
      comparisonsSkipped: comparisons.skipped,
    };
  }

  var WAIVER_STATUS = "领导层决定先不做测试";

  function emptyLaunchDates(source) {
    source = source || {};
    return { EU: source.EU || "", CA: source.CA || "", US: source.US || "" };
  }

  function threePaths(value) {
    var list = Array.isArray(value) ? value : [];
    return [0, 1, 2].map(function (index) { return String(list[index] || ""); });
  }

  function normalizePhotoList(value) {
    if (Array.isArray(value)) {
      if (!value.length) return [];
      if (value[0] && typeof value[0] === "object") {
        var objects = value.map(function (item) {
          return { path: String((item && item.path) || ""), typical: !!(item && item.typical) };
        });
        if (!objects.some(function (item) { return item.typical; }) && objects.length) objects[0].typical = true;
        return objects;
      }
      var paths = value.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
      if (!paths.length) return [{ path: "", typical: true }];
      return paths.map(function (path, index) { return { path: path, typical: index === 0 }; });
    }
    if (typeof value === "string" && value.trim()) return [{ path: value.trim(), typical: true }];
    return [{ path: "", typical: true }];
  }

  function typicalPhoto(list) {
    var photos = list || [];
    return photos.filter(function (item) { return item && item.typical && item.path; })[0] || photos.filter(function (item) { return item && item.path; })[0] || null;
  }

  function pairText(operatorSize, customerSize) {
    var operator = String(operatorSize || "").trim();
    var customer = String(customerSize || "").trim();
    if (operator && customer) return operator + "+" + customer;
    return operator || customer;
  }

  function screenSummary(screens) {
    var parts = (screens || []).map(function (item) {
      return String((item && item.text) || "").trim();
    }).filter(Boolean);
    if (!parts.length) return "";
    return "操作屏+客显屏 " + parts.join("；");
  }

  function keepTextRow(item) {
    var row = { text: String((item && item.text) || "") };
    if (item && item.operator && typeof item.operator === "object") {
      row.operator = { type: String(item.operator.type || ""), size: String(item.operator.size || "") };
    }
    if (item && item.customer && typeof item.customer === "object") {
      row.customer = { type: String(item.customer.type || ""), size: String(item.customer.size || "") };
    }
    return row;
  }

  function textFromPair(item) {
    var operator = (item && item.operator) || {};
    var customer = (item && item.customer) || {};
    var text = pairText(operator.size, customer.size);
    if (!text) return null;
    return {
      text: text,
      operator: { type: String(operator.type || ""), size: String(operator.size || "") },
      customer: { type: String(customer.type || ""), size: String(customer.size || "") },
    };
  }

  function pairFlatScreens(flat) {
    var rows = [];
    var index;
    for (index = 0; index < flat.length; index += 2) {
      var left = flat[index] || {};
      var right = flat[index + 1] || {};
      var text = pairText(left.size, right.size);
      if (!text) continue;
      rows.push({
        text: text,
        operator: { type: String(left.type || ""), size: String(left.size || "") },
        customer: { type: String(right.type || ""), size: String(right.size || "") },
      });
    }
    return rows;
  }

  function normalizeScreens(source) {
    var raw = source && source.screens;
    if (Array.isArray(raw)) {
      if (!raw.length) return [];
      if (raw[0] && typeof raw[0] === "object" && Object.prototype.hasOwnProperty.call(raw[0], "text")) {
        return raw.map(keepTextRow);
      }
      if (raw[0] && typeof raw[0] === "object" && raw[0].operator) {
        return raw.map(textFromPair).filter(Boolean);
      }
      return pairFlatScreens(raw.map(function (item) {
        var entry = item && typeof item === "object" ? item : {};
        return { type: String(entry.type || ""), size: String(entry.size || "") };
      }));
    }
    var legacy = String((source && source.screen) || "").trim();
    return legacy ? [{ text: legacy }] : [];
  }

  function emptyVariantRow(basic) {
    basic = basic || {};
    var screens = [{ text: "" }];
    return {
      model: "",
      screen: screenSummary(screens),
      screens: screens,
      photos: [{ path: "", typical: true }],
      status: basic.status || "研发",
      statusNote: basic.statusNote || "",
      launchDates: emptyLaunchDates(basic.launchDates),
      nameplatePhotos: [{ path: "", typical: true }],
      labelInfo: "",
    };
  }

  function normalizeVariantRow(row, basic) {
    var source = row && typeof row === "object" ? row : {};
    var screens = normalizeScreens(source);
    basic = basic || {};
    return {
      model: String(source.model || "").trim(),
      screen: screenSummary(screens),
      screens: screens,
      photos: normalizePhotoList(source.photos),
      status: String(source.status || basic.status || "研发"),
      statusNote: source.statusNote != null ? String(source.statusNote) : String(basic.statusNote || ""),
      launchDates: emptyLaunchDates(source.launchDates || basic.launchDates),
      nameplatePhotos: normalizePhotoList(source.nameplatePhotos),
      labelInfo: String(source.labelInfo || ""),
    };
  }

  function legacyVariantNames(value) {
    var names = [];
    function pushText(text) {
      String(text || "").split("、").forEach(function (part) {
        var name = part.trim();
        if (name) names.push(name);
      });
    }
    if (typeof value === "string") pushText(value);
    else if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (typeof item === "string") pushText(item);
        else if (item && typeof item === "object") pushText(item.model || "");
      });
    }
    return names;
  }

  function rowsFromLegacy(basic) {
    var value = basic.variants;
    var rows = [];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          var kept = normalizeVariantRow(item, basic);
          if (!kept.status) kept.status = basic.status || "研发";
          if (kept.model) rows.push(kept);
          return;
        }
        legacyVariantNames(item).forEach(function (name) {
          var row = emptyVariantRow(basic);
          row.model = name;
          rows.push(row);
        });
      });
      return rows;
    }
    legacyVariantNames(value).forEach(function (name) {
      var row = emptyVariantRow(basic);
      row.model = name;
      rows.push(row);
    });
    return rows;
  }

  function filledVariants(basic) {
    return ((basic && basic.variantRows) || []).filter(function (row) {
      return row && String(row.model || "").trim();
    });
  }

  function syncVariantNames(basic) {
    if (!basic) return [];
    if (Array.isArray(basic.variantRows)) {
      basic.variants = filledVariants(basic).map(function (row) { return String(row.model).trim(); });
    } else {
      basic.variants = legacyVariantNames(basic.variants);
    }
    return basic.variants;
  }

  function aggregateStatus(basicOrRows) {
    var rows = Array.isArray(basicOrRows) ? basicOrRows : filledVariants(basicOrRows);
    rows = rows.filter(function (row) { return row && String(row.model || "").trim(); });
    var launched = rows.filter(function (row) { return row.status === "已上市"; }).length;
    if (!rows.length || launched === 0) return "未上市";
    if (launched === rows.length) return "全部已上市";
    return "部分已上市";
  }

  function migrateVariants(archive) {
    if (!archive || !archive.basic) return false;
    var basic = archive.basic;
    var changed = false;
    if (!basic.launchDates || typeof basic.launchDates !== "object") {
      basic.launchDates = { EU: "", CA: "", US: "" };
      changed = true;
    }
    if (!Array.isArray(basic.variantRows)) {
      basic.variantRows = rowsFromLegacy(basic);
      while (basic.variantRows.length < 6) basic.variantRows.push(emptyVariantRow(basic));
      changed = true;
    } else {
      var normalized = basic.variantRows.map(function (row) { return normalizeVariantRow(row, basic); });
      if (JSON.stringify(normalized) !== JSON.stringify(basic.variantRows)) {
        basic.variantRows = normalized;
        changed = true;
      }
    }
    var names = syncVariantNames(basic);
    if (!Array.isArray(basic.variants)) {
      basic.variants = names;
      changed = true;
    }
    basic.statusAggregate = aggregateStatus(basic);
    if (normalizeThumbnails(basic)) changed = true;
    if (normalizeCb(basic)) changed = true;
    if (normalizeUl(basic)) changed = true;
    return changed;
  }

  function normalizeUl(basic) {
    var source = basic.ul && typeof basic.ul === "object" ? basic.ul : {};
    var next = blankUl();
    if (!basic.ul) next.links = ["US-04"];
    ["fileNo", "ccn", "certType", "standard", "standardVersion", "issueDate", "certificatePath", "reportPath", "followUpPath"].forEach(function (key) {
      next[key] = String(source[key] || next[key] || "");
    });
    if (next.certType !== "Listed" && next.certType !== "Recognized" && next.certType !== "Classified") next.certType = "Listed";
    next.modelsCovered = normalizeModelNames(source.modelsCovered);
    next.modelsNote = String(source.modelsNote || "");
    next.links = Array.isArray(source.links) ? source.links.map(function (item) { return String(item || ""); }).filter(Boolean) : next.links.slice();
    if (Array.isArray(source.history) && source.history.length) {
      next.history = source.history.map(function (item) { return blankHistory(item); });
    } else if (next.fileNo || next.standardVersion || next.certificatePath || next.reportPath) {
      next.history = [blankHistory({
        updatedOn: next.issueDate,
        kind: "其他",
        number: next.fileNo,
        standardVersion: next.standardVersion,
        summary: "由现有 UL 资料迁入",
        certificatePath: next.certificatePath,
        reportPath: next.reportPath,
        readonly: true,
      })];
    }
    var changed = JSON.stringify(basic.ul) !== JSON.stringify(next);
    basic.ul = next;
    return changed;
  }

  function normalizeThumbnails(basic) {
    var before = JSON.stringify(Array.isArray(basic.thumbnails) ? basic.thumbnails : []) + "|" + String(basic.thumbnail || "");
    var list = [];
    if (Array.isArray(basic.thumbnails)) {
      basic.thumbnails.forEach(function (item) {
        if (item && typeof item === "object" && item.url) list.push({ url: String(item.url), main: !!item.main });
        else if (typeof item === "string" && item) list.push({ url: item, main: false });
      });
    }
    if (!list.length && basic.thumbnail) list.push({ url: String(basic.thumbnail), main: true });
    if (list.length && !list.some(function (item) { return item.main; })) list[0].main = true;
    var chosen = -1;
    list.forEach(function (item, index) { if (item.main && chosen < 0) chosen = index; });
    list.forEach(function (item, index) { item.main = index === chosen; });
    var main = chosen >= 0 ? list[chosen] : null;
    basic.thumbnails = list;
    basic.thumbnail = main ? main.url : "";
    return before !== JSON.stringify(basic.thumbnails) + "|" + String(basic.thumbnail || "");
  }

  function blankCb() {
    return {
      number: "",
      ncb: "",
      lab: "",
      standardVersion: "",
      differences: { EU: "", CA: "", US: "" },
      modelsCovered: [],
      modelsNote: "",
      issueDate: "",
      expiry: "",
      certificatePath: "",
      reportPath: "",
      links: [],
      history: [],
    };
  }

  function blankUl() {
    return {
      fileNo: "",
      ccn: "",
      certType: "Listed",
      standard: "",
      standardVersion: "",
      modelsCovered: [],
      modelsNote: "",
      issueDate: "",
      certificatePath: "",
      reportPath: "",
      followUpPath: "",
      links: ["US-04"],
      history: [],
    };
  }

  function normalizeModelNames(value) {
    var names = [];
    var list = typeof value === "string" ? [value] : (value || []);
    list.forEach(function (item) {
      var text = typeof item === "string" ? item : (item && item.name) || "";
      String(text).split("、").forEach(function (part) {
        if (part.trim()) names.push(part.trim());
      });
    });
    return names;
  }

  function blankHistory(source) {
    source = source || {};
    return {
      id: source.id || ("cbh-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      updatedOn: String(source.updatedOn || source.issueDate || ""),
      kind: String(source.kind || "其他"),
      number: String(source.number || ""),
      standardVersion: String(source.standardVersion || ""),
      summary: String(source.summary || ""),
      certificatePath: String(source.certificatePath || ""),
      reportPath: String(source.reportPath || ""),
      readonly: !!source.readonly,
    };
  }

  function normalizeCb(basic) {
    var source = basic.cb && typeof basic.cb === "object" ? basic.cb : {};
    var next = blankCb();
    ["number", "ncb", "lab", "standardVersion", "issueDate", "expiry", "certificatePath", "reportPath"].forEach(function (key) {
      next[key] = String(source[key] || "");
    });
    next.differences = {
      EU: String((source.differences && source.differences.EU) || ""),
      CA: String((source.differences && source.differences.CA) || ""),
      US: String((source.differences && source.differences.US) || ""),
    };
    next.modelsCovered = normalizeModelNames(source.modelsCovered);
    next.modelsNote = String(source.modelsNote || "");
    next.links = Array.isArray(source.links) ? source.links.map(function (item) { return String(item || ""); }).filter(Boolean) : [];
    if (Array.isArray(source.history) && source.history.length) {
      next.history = source.history.map(function (item) { return blankHistory(item); });
    } else if (next.number || next.standardVersion || next.certificatePath || next.reportPath || next.expiry) {
      next.history = [blankHistory({
        updatedOn: next.issueDate,
        kind: "其他",
        number: next.number,
        standardVersion: next.standardVersion,
        summary: "由现有 CB 资料迁入",
        certificatePath: next.certificatePath,
        reportPath: next.reportPath,
        readonly: true,
      })];
    }
    var changed = JSON.stringify(basic.cb) !== JSON.stringify(next);
    basic.cb = next;
    return changed;
  }

  function touchVariants(archive) {
    if (!archive || !archive.basic) return;
    (archive.basic.variantRows || []).forEach(function (row) {
      if (Array.isArray(row.screens)) row.screen = screenSummary(row.screens);
    });
    syncVariantNames(archive.basic);
    archive.basic.statusAggregate = aggregateStatus(archive.basic);
  }

  function variantModels(project) {
    var basic = project.archive && project.archive.basic;
    if (!basic) return [];
    if (Array.isArray(basic.variantRows)) {
      return filledVariants(basic).map(function (row) { return String(row.model).trim(); });
    }
    return legacyVariantNames(basic.variants);
  }

  var CB_MODULE_ID = "CB 体系（IEC 62368-1）";

  function moduleLabel(id) {
    if (id === CB_MODULE_ID) return "CB 体系";
    return id || "";
  }

  function readCheck(project, id) {
    var checks = (project && project.checks) || {};
    var meta = (project && project.checkMeta && project.checkMeta[id]) || {};
    return {
      status: checks[id] || "未办理",
      reason: meta.reason || "",
      note: meta.note || "",
      decidedOn: meta.decidedOn || "",
      decider: meta.decider || "",
      remark: meta.remark || "",
    };
  }

  function applyChecklist(project, id, patch) {
    project.checks = project.checks || {};
    project.checkMeta = project.checkMeta || {};
    if (patch.status) project.checks[id] = patch.status;
    var meta = project.checkMeta[id] || { reason: "", note: "", decidedOn: "", decider: "", remark: "" };
    ["reason", "note", "decidedOn", "decider", "remark"].forEach(function (key) {
      if (patch[key] != null) meta[key] = patch[key];
    });
    project.checkMeta[id] = meta;
    var todo = findReqTodo(project, id);
    if (!todo || patch.fromTodo) return meta;
    if (project.checks[id] === "不做") {
      todo.conclusion = "不做";
      todo.skipReason = meta.reason || "不适用";
      todo.decidedOn = meta.decidedOn || "";
      todo.decider = meta.decider || "";
      if (meta.reason === "其他") todo.note = meta.note || "";
    } else if (todo.conclusion === "不做") {
      todo.conclusion = todo.priorConclusion && todo.priorConclusion !== "不做" && todo.priorConclusion !== "已取消" ? todo.priorConclusion : "待定";
      todo.skipReason = "";
    }
    return meta;
  }

  function applyTodoToCheck(project, todo) {
    if (!project || !todo || todo.kind !== "checklist" || !todo.sourceId) return;
    project.checks = project.checks || {};
    project.checkMeta = project.checkMeta || {};
    var id = todo.sourceId;
    var meta = project.checkMeta[id] || { reason: "", note: "", decidedOn: "", decider: "", remark: "" };
    if (todo.conclusion === "不做") {
      project.checks[id] = "不做";
      meta.reason = todo.skipReason || "";
      meta.decidedOn = todo.decidedOn || "";
      meta.decider = todo.decider || "";
      if (todo.skipReason === "其他") meta.note = todo.note || "";
    } else if (project.checks[id] === "不做") {
      project.checks[id] = "未办理";
    }
    project.checkMeta[id] = meta;
  }

  function findReqTodo(project, id) {
    return ((project && project.todos) || []).filter(function (item) {
      return item && item.kind === "checklist" && (item.key === "req:" + id || item.sourceId === id);
    })[0] || null;
  }

  function isTestWaived(project, id) {
    var todo = findReqTodo(project, id);
    if (todo) return todo.conclusion === "不做" && todo.skipReason === "领导层决定";
    var test = project && project.tests && project.tests[id];
    return !!(test && test.status === WAIVER_STATUS);
  }

  function skipsEvidence(project, id) {
    var todo = findReqTodo(project, id);
    if (todo) return todo.conclusion === "不做" || todo.conclusion === "已取消";
    return isTestWaived(project, id);
  }

  function waiverRecords(project) {
    var byId = {};
    ((project && project.todos) || []).forEach(function (todo) {
      if (!todo || todo.kind !== "checklist" || todo.conclusion !== "不做" || todo.skipReason !== "领导层决定") return;
      var id = todo.sourceId || String(todo.key || "").replace(/^req:/, "");
      byId[id] = {
        id: id,
        decider: todo.decider || "",
        decidedOn: todo.decidedOn || "",
        note: todo.note || "",
        complete: !!(todo.decider && todo.decidedOn),
      };
    });
    Object.keys((project && project.tests) || {}).forEach(function (id) {
      if (byId[id]) return;
      var test = project.tests[id];
      if (!test || test.status !== WAIVER_STATUS) return;
      byId[id] = {
        id: id,
        decider: test.decider || "",
        decidedOn: test.decidedOn || "",
        note: test.note || "",
        complete: !!(test.decider && test.decidedOn),
      };
    });
    return Object.keys(byId).map(function (id) { return byId[id]; });
  }

  function countsAsMissing(project, item) {
    return !!(item && item.status === "缺失" && !isTestWaived(project, item.requirement));
  }

  function homeCellFlags(project, ids, comparisons, evidence) {
    var list = ids || [];
    var evidenced = {};
    (evidence || []).forEach(function (item) {
      (item.requirementIds || []).forEach(function (id) { evidenced[id] = true; });
    });
    var missingCompare = (comparisons || []).some(function (item) { return countsAsMissing(project, item); });
    var gap = (comparisons || []).some(function (item) { return item.status === "差距"; });
    var uncovered = list.filter(function (id) {
      return !evidenced[id] && !skipsEvidence(project, id);
    });
    var lack = missingCompare || uncovered.length > 0;
    var flags = [];
    if (list.length && !lack && !gap) flags.push("已齐全");
    if (lack) flags.push("缺证据");
    if ((evidence || []).some(function (item) {
      var days = daysUntil(item.expiry);
      return days != null && days <= 90;
    })) flags.push("即将过期");
    if (list.some(function (id) {
      var review = project && project.reviews && project.reviews[id];
      return review && review.status === "需要复核";
    })) flags.push("需要复核");
    if (list.some(function (id) { return isTestWaived(project, id); })) flags.push("领导层决定不测试");
    return flags;
  }

  function blankTodo(source) {
    return {
      key: source.key,
      kind: source.kind,
      sourceId: source.sourceId,
      title: source.title || "",
      conclusion: "待定",
      skipReason: "",
      note: "",
      decider: "",
      decidedOn: "",
      owner: "",
      due: "",
      progress: "未开始",
      evidenceIds: [],
      expiry: "",
      priorConclusion: "",
      cancelReason: "",
      legacy: null,
    };
  }

  function todoFromLegacy(id, test) {
    var item = blankTodo({ key: "req:" + id, kind: "checklist", sourceId: id, title: id });
    test = test || {};
    item.legacy = {
      status: test.status || "",
      expiry: test.expiry || "",
      note: test.note || "",
      decider: test.decider || "",
      decidedOn: test.decidedOn || "",
    };
    item.note = test.note || "";
    item.decider = test.decider || "";
    item.decidedOn = test.decidedOn || "";
    item.expiry = test.expiry || "";
    if (test.status === WAIVER_STATUS) {
      item.conclusion = "不做";
      item.skipReason = "领导层决定";
    } else if (test.status === "未开始" || test.status === "进行中" || test.status === "已完成") {
      item.conclusion = "要做";
      item.progress = test.status;
    } else {
      item.conclusion = "待定";
    }
    return item;
  }

  function syncTodos(project, sources) {
    if (!project) return [];
    if (!Array.isArray(project.todos)) project.todos = [];
    var changed = false;
    if (!project.testsMigrated) {
      Object.keys(project.tests || {}).forEach(function (id) {
        var key = "req:" + id;
        if (project.todos.some(function (item) { return item.key === key; })) return;
        project.todos.push(todoFromLegacy(id, project.tests[id]));
        changed = true;
      });
      project.testsMigrated = true;
      changed = true;
    }
    var active = {};
    (sources || []).forEach(function (source) {
      active[source.key] = source;
      var existing = project.todos.filter(function (item) { return item.key === source.key; })[0];
      if (!existing) {
        existing = blankTodo(source);
        project.todos.push(existing);
        changed = true;
      }
      if (existing.title !== source.title || existing.kind !== source.kind || existing.sourceId !== source.sourceId) {
        existing.title = source.title;
        existing.kind = source.kind;
        existing.sourceId = source.sourceId;
        changed = true;
      }
      if (source.removed || source.na) {
        if (existing.conclusion !== "已取消") {
          existing.priorConclusion = existing.conclusion;
          existing.conclusion = "已取消";
          existing.cancelReason = source.removed ? "来源已删除" : "不适用";
          changed = true;
        }
      } else if (existing.conclusion === "已取消" && existing.cancelReason && existing.priorConclusion) {
        existing.conclusion = existing.priorConclusion;
        existing.priorConclusion = "";
        existing.cancelReason = "";
        changed = true;
      }
    });
    project.todos.forEach(function (todo) {
      if (active[todo.key] || todo.conclusion === "已取消") return;
      todo.priorConclusion = todo.conclusion;
      todo.conclusion = "已取消";
      todo.cancelReason = "来源已不在当前清单";
      changed = true;
    });
    return changed;
  }

  function todoCounts(todos) {
    var counts = { pending: 0, doing: 0, overdue: 0 };
    (todos || []).forEach(function (item) {
      if (!item || item.conclusion === "已取消") return;
      if (item.conclusion === "待定") counts.pending += 1;
      if (item.conclusion === "要做" && item.progress === "进行中") counts.doing += 1;
      if (item.conclusion === "要做" && item.progress !== "已完成" && item.due && daysUntil(item.due) != null && daysUntil(item.due) < 0) counts.overdue += 1;
    });
    return counts;
  }

  function nextCustomId(project, market) {
    var prefix = String(market || "EU") + "-C";
    var next = 1;
    (project.customEntries || []).forEach(function (item) {
      var match = new RegExp("^" + prefix + "(\\d+)$").exec(item.id || "");
      if (match) next = Math.max(next, Number(match[1]) + 1);
    });
    return prefix + (next < 10 ? "0" + next : String(next));
  }

  function overview(project) {
    ensureArchive(project);
    var archive = project.archive;
    var basic = archive.basic;
    var items = [];
    function add(id, label, filled, section) {
      var ok = !!filled;
      items.push({ id: id, label: label, filled: ok, section: section, text: ok ? label : "未填：" + label });
    }
    var variants = filledVariants(basic);
    if (!variants.length) add("variants", "变体型号", false, "basic");
    variants.forEach(function (row) {
      var name = row.model;
      add("screen-" + name, name + " 屏幕尺寸", screenSummary(row.screens), "basic");
      add("status-" + name, name + " 状态", row.status, "basic");
      add("eu-" + name, name + " EU 上市日期", row.launchDates && row.launchDates.EU, "basic");
      add("ca-" + name, name + " CA 上市日期", row.launchDates && row.launchDates.CA, "basic");
      add("us-" + name, name + " US 上市日期", row.launchDates && row.launchDates.US, "basic");
      add("label-" + name, name + " 铭牌标签", row.labelInfo, "labels");
      add("photo-" + name, name + " 典型照片", typicalPhoto(row.photos), "basic");
    });
    var parties = archive.parties || {};
    Object.keys(parties).forEach(function (key) {
      add("party-" + key, partyLabel(key), parties[key] && parties[key].dropboxPath, "parties");
    });
    add("cb", "CB 证书号", archive.basic.cb && archive.basic.cb.number, "cb");
    add("ul", "UL File No.", archive.basic.ul && archive.basic.ul.fileNo, "ul");
    add("bom", "关键件", (archive.components || archive.bom || []).length, "bom");
    add("materials", "材料保证书", (archive.materials || []).length, "bom");
    add("evidence", "证据", (archive.evidence || []).length, "evidence");
    var filled = items.filter(function (item) { return item.filled; }).length;
    return {
      items: items,
      filled: filled,
      total: items.length,
      label: "已填 " + filled + " / " + items.length + " 项",
      compare: compareSummary(archive),
      alerts: materialAlerts(archive),
    };
  }

  function blankComponent(source) {
    source = source || {};
    return {
      id: String(source.id || ("cmp-" + Math.random().toString(36).slice(2, 10))),
      name: String(source.name || source.type || ""),
      manufacturer: String(source.manufacturer || source.supplier || ""),
      model: String(source.model || ""),
      parameters: String(source.parameters || ""),
      standard: String(source.standard || ""),
      certMark: String(source.certMark || source.certifications || ""),
      partNo: String(source.partNo || ""),
      source: String(source.source || ""),
      reportNo: String(source.reportNo || ""),
      page: String(source.page || ""),
      supplierPath: String(source.supplierPath || ""),
      expiry: String(source.expiry || ""),
      legacy: source.legacy || (source.affectedCertificates ? { affectedCertificates: String(source.affectedCertificates) } : null),
    };
  }

  function blankMaterial(source) {
    source = source || {};
    return {
      id: String(source.id || ("mat-" + Math.random().toString(36).slice(2, 10))),
      path: String(source.path || ""),
      molder: String(source.molder || ""),
      purchaser: String(source.purchaser || ""),
      partNo: String(source.partNo || ""),
      description: String(source.description || ""),
      quantity: String(source.quantity || ""),
      specNo: String(source.specNo || ""),
      moldingDate: String(source.moldingDate || ""),
      shippingDate: String(source.shippingDate || ""),
      manufacturer: String(source.manufacturer || ""),
      designation: String(source.designation || ""),
      ulFile: String(source.ulFile || ""),
      flammability: String(source.flammability || ""),
      additives: String(source.additives || ""),
      regrind: String(source.regrind || ""),
      rev: String(source.rev || ""),
      signed: !!source.signed,
    };
  }

  function migrateArchiveExtras(archive) {
    if (!archive) return false;
    var changed = false;
    if (!Array.isArray(archive.components)) {
      archive.components = (archive.bom || []).map(blankComponent);
      changed = true;
    } else {
      var components = archive.components.map(blankComponent);
      if (JSON.stringify(components) !== JSON.stringify(archive.components)) {
        archive.components = components;
        changed = true;
      }
    }
    if (!Array.isArray(archive.materials)) {
      archive.materials = [];
      changed = true;
    } else {
      var materials = archive.materials.map(blankMaterial);
      if (JSON.stringify(materials) !== JSON.stringify(archive.materials)) {
        archive.materials = materials;
        changed = true;
      }
    }
    if (!Array.isArray(archive.mappings)) {
      archive.mappings = [];
      changed = true;
    }
    if (!Array.isArray(archive.componentPreview)) {
      archive.componentPreview = [];
      changed = true;
    }
    return changed;
  }

  function normToken(value) {
    return String(value || "").toLowerCase().replace(/[\s\-_.]/g, "");
  }

  function compareComponents(archive) {
    archive = archive || {};
    var components = archive.components || [];
    var materials = archive.materials || [];
    var mappings = archive.mappings || [];
    var used = {};
    var rows = [];
    components.forEach(function (component) {
      var mapped = mappings.filter(function (item) { return item.componentId === component.id && item.materialId; })[0];
      var material = mapped ? materials.filter(function (item) { return item.id === mapped.materialId; })[0] : null;
      var fuzzy = false;
      if (!material && component.partNo) {
        material = materials.filter(function (item) { return normToken(item.partNo) && normToken(item.partNo) === normToken(component.partNo); })[0] || null;
      }
      if (!material) {
        material = materials.filter(function (item) {
          return normToken(item.designation) && normToken(item.designation) === normToken(component.model)
            && normToken(item.ulFile) && normToken(item.ulFile) === normToken(component.certMark)
            && normToken(item.manufacturer) && normToken(item.manufacturer) === normToken(component.manufacturer);
        })[0] || null;
      }
      if (!material) {
        material = materials.filter(function (item) {
          var score = 0;
          if (normToken(item.designation) && normToken(item.designation) === normToken(component.model)) score += 1;
          if (normToken(item.ulFile) && normToken(item.ulFile) === normToken(component.certMark)) score += 1;
          if (normToken(item.manufacturer) && normToken(item.manufacturer) === normToken(component.manufacturer)) score += 1;
          return score === 2;
        })[0] || null;
        fuzzy = !!material;
      }
      if (material) used[material.id] = true;
      var diffs = [];
      if (material && !fuzzy) {
        if (normToken(material.manufacturer) !== normToken(component.manufacturer)) diffs.push("制造商");
        if (normToken(material.designation) !== normToken(component.model)) diffs.push("型号");
        if (normToken(material.ulFile) !== normToken(component.certMark)) diffs.push("UL 号");
        if (normToken(material.flammability) && normToken(component.parameters) && normToken(material.flammability) !== normToken(component.parameters)) diffs.push("防火等级");
      }
      var expired = (material && material.shippingDate && monthsSince(material.shippingDate) >= 12) || (component.expiry && daysUntil(component.expiry) != null && daysUntil(component.expiry) < 0);
      var status = "缺失";
      if (material && expired) status = "过期";
      else if (material && fuzzy && !mapped) status = "疑似匹配";
      else if (material && diffs.length) status = "不一致";
      else if (material) status = "一致";
      rows.push({
        id: component.id,
        label: component.name || component.partNo || component.model || component.id,
        status: status,
        diffs: diffs,
        fuzzy: status === "疑似匹配",
        component: component,
        material: material || null,
      });
    });
    materials.forEach(function (material) {
      if (used[material.id]) return;
      rows.push({
        id: "mat-" + material.id,
        label: material.partNo || material.designation || material.id,
        status: "未登记",
        diffs: [],
        fuzzy: false,
        component: null,
        material: material,
      });
    });
    return rows;
  }

  function compareSummary(archive) {
    var counts = { consistent: 0, diff: 0, missing: 0, unregistered: 0, expired: 0, fuzzy: 0 };
    compareComponents(archive).forEach(function (row) {
      if (row.status === "一致") counts.consistent += 1;
      if (row.status === "不一致") counts.diff += 1;
      if (row.status === "缺失") counts.missing += 1;
      if (row.status === "未登记") counts.unregistered += 1;
      if (row.status === "过期") counts.expired += 1;
      if (row.status === "疑似匹配") counts.fuzzy += 1;
    });
    return counts;
  }

  function monthsSince(isoDate) {
    var time = Date.parse(isoDate + "T00:00:00");
    if (Number.isNaN(time)) return null;
    return (Date.now() - time) / (86400000 * 30.4);
  }

  function materialAlerts(archive) {
    var notes = [];
    var latest = {};
    (archive.materials || []).forEach(function (item) {
      var key = normToken(item.partNo) + "|" + normToken(item.molder || item.manufacturer);
      var when = item.shippingDate || item.moldingDate;
      if (when && (!latest[key] || when > latest[key])) latest[key] = when;
      if (!item.signed) notes.push((item.partNo || "未填料号") + " 保证书未签章，无效需补");
      var regrind = parseFloat(item.regrind);
      if (!Number.isNaN(regrind) && regrind > 25) notes.push((item.partNo || item.designation || "材料") + " 二次料 " + item.regrind + "%，超过 25%");
      if (!item.partNo || !item.manufacturer || !item.ulFile) notes.push((item.partNo || item.description || "材料保证书") + " 不完整");
      if (item.shippingDate && !item.path) notes.push((item.partNo || "批次") + " " + item.shippingDate + " 缺批次保证书");
    });
    Object.keys(latest).forEach(function (key) {
      var age = monthsSince(latest[key]);
      if (age == null) return;
      var label = key.split("|")[0] || "料号";
      if (age >= 12) notes.push(label + " 保证书已过期（" + latest[key] + "）");
      else if (age >= 11) notes.push(label + " 保证书即将到期（" + latest[key] + "）");
    });
    (archive.components || []).forEach(function (item) {
      var days = daysUntil(item.expiry);
      if (days != null && days <= 90) notes.push((item.name || item.partNo || "关键件") + " 证书" + (days < 0 ? "已过期" : "将在 " + days + " 天内到期"));
    });
    return notes;
  }

  function ensureCompareTodos(project) {
    if (!project || !project.archive) return false;
    project.todos = project.todos || [];
    var changed = false;
    compareComponents(project.archive).forEach(function (row) {
      if (row.status !== "不一致" && row.status !== "未登记") return;
      var key = "cmp:" + row.id;
      if (project.todos.some(function (item) { return item.key === key; })) return;
      project.todos.push({
        key: key,
        kind: "compare",
        sourceId: row.id,
        title: "评估是否需向 CB/UL 报备 · " + row.label,
        conclusion: "待定",
        skipReason: "",
        note: row.status,
        decider: "",
        decidedOn: "",
        owner: "",
        due: "",
        progress: "未开始",
        evidenceIds: [],
        expiry: "",
        priorConclusion: "",
        cancelReason: "",
        legacy: null,
      });
      changed = true;
    });
    return changed;
  }

  function blankArchive() {
    var basicSeed = {
      model: "",
      variants: [],
      photoPath: "",
      thumbnail: "",
      thumbnails: [],
      status: "研发",
      statusNote: "",
      launchDates: { EU: "", CA: "", US: "" },
      cb: blankCb(),
      ul: blankUl(),
    };
    basicSeed.variantRows = [0, 1, 2, 3, 4, 5].map(function () { return emptyVariantRow(basicSeed); });
    basicSeed.statusAggregate = "未上市";
    return {
      basic: basicSeed,
      sensitive: { note: "", costNote: "", suppliers: [] },
      evidence: [],
      comparisons: [],
      changelog: [],
      bom: [],
      components: [],
      materials: [],
      mappings: [],
      componentPreview: [],
      labels: [],
      manuals: [],
      parties: {
        applicant: { dropboxPath: "" },
        manufacturer: { dropboxPath: "" },
        euAuthorizedRep: { dropboxPath: "" },
        caImporter: { dropboxPath: "" },
        usResponsibleParty: { dropboxPath: "" },
      },
      schedule: [],
      issues: [],
      correspondence: [],
    };
  }

  function sampleArchive() {
    var folder = "/合规知识库/02_产品/UNI-8/CA/07BATT/";
    var variant = "UNI-8 15/30 kg（示例，待确认）";
    return {
      basic: {
        model: "UNI-8（示例）",
        variants: [variant, "其他型号（示例，待确认）"],
        photoPath: "/合规知识库/02_产品/UNI-8/照片_待确认/",
        thumbnail: "",
        status: "研发",
        statusNote: "示例/待确认，不是已确认的项目状态。",
        launchDates: { EU: "", CA: "", US: "" },
      },
      sensitive: {
        note: "示例/待确认。本节默认不进入审核包。",
        costNote: "待确认（示例）",
        suppliers: [
          {
            name: "待确认（示例）",
            component: "待确认",
            dropboxPath: "/合规知识库/02_产品/UNI-8/供应商_待确认/",
          },
        ],
      },
      evidence: [
        {
          id: "ev-sample-ca07",
          requirementIds: ["CA-07"],
          type: "测试报告",
          dropboxPath: folder,
          page: "待确认",
          standard: "ANSI/UL 4200A-2023",
          standardVersion: "2023",
          lab: "待确认（示例）",
          reportNo: "待确认（示例，非真实编号）",
          issueDate: "",
          expiry: "",
          modelsCovered: [variant],
          keyParameters: "待确认（示例）",
          conclusion: "待确认（示例）",
        },
      ],
      comparisons: [
        {
          requirement: "CA-07",
          market: "CA",
          module: "电池",
          status: "差距",
          reason: "示例/待确认：复函 26-005366-600 写明商用不自动豁免，书面分析尚未留存。这不是已核实的差距结论。",
          source: "示例 / 规划书复函要点 26-005366-600",
          dropboxPath: folder,
          page: "待确认",
        },
      ],
      changelog: [
        {
          date: "2026-11-04",
          kind: "产品",
          summary: "示例：建立档案占位，尚未登记真实变更。",
          actions: "待确认",
        },
      ],
      bom: [
        {
          type: "纽扣电池（示例）",
          model: "待确认",
          supplier: "待确认（示例）",
          certifications: "待确认：UL / CB / FCC ID / IC",
          affectedCertificates: "CA-07、EU-07、US-07（示例，待确认）",
        },
      ],
      labels: [
        {
          name: "加拿大双语警示（示例）",
          designPath: folder,
          photoPath: "",
          version: "待确认",
          requirementIds: ["CA-07"],
          checkNote: "待确认：对照清单要求的英法双语警示。",
        },
      ],
      manuals: [
        {
          market: "CA",
          language: "英法（示例，是否已有待确认）",
          version: "待确认",
          dropboxPath: folder,
          warningLocations: "待确认：产品、包装、说明书",
        },
      ],
      parties: {
        applicant: { dropboxPath: "/合规知识库/02_产品/UNI-8/责任主体_待确认/" },
        manufacturer: { dropboxPath: "/合规知识库/02_产品/UNI-8/责任主体_待确认/" },
        euAuthorizedRep: { dropboxPath: "/合规知识库/02_产品/UNI-8/责任主体_待确认/" },
        caImporter: { dropboxPath: "/合规知识库/02_产品/UNI-8/责任主体_待确认/" },
        usResponsibleParty: { dropboxPath: "/合规知识库/02_产品/UNI-8/责任主体_待确认/" },
      },
      schedule: [
        {
          market: "CA",
          lab: "待确认（示例）",
          fee: "待确认（示例，审核包默认不含费用）",
          start: "",
          end: "",
        },
      ],
      issues: [
        {
          item: "示例：纽扣电池安装方式未知",
          fix: "待确认",
          retest: "待确认",
          feedback: "待确认",
          requirementIds: ["CA-07"],
        },
      ],
      correspondence: [
        {
          ref: "26-005366-600",
          party: "Health Canada",
          date: "2026-10-16",
          summary: "示例：规划书记载的复函收文日期。函件非公开，不在仓库。",
          dropboxPath: folder,
          requirementIds: ["CA-07"],
        },
      ],
    };
  }

  function ensureArchive(project) {
    var created = false;
    if (!(project.archive && project.archive.basic && project.archive.parties)) {
      project.archive = project.id === "uni-8-sample" ? sampleArchive() : blankArchive();
      created = true;
    }
    var migrated = migrateVariants(project.archive);
    if (migrateArchiveExtras(project.archive)) migrated = true;
    return created || migrated;
  }

  function partyLabel(key) {
    return {
      applicant: "申请人",
      manufacturer: "制造商",
      euAuthorizedRep: "欧盟授权代表",
      caImporter: "加拿大进口商",
      usResponsibleParty: "美国责任方",
    }[key] || key;
  }

  function daysUntil(isoDate) {
    if (!isoDate) return null;
    var time = Date.parse(isoDate + "T00:00:00");
    if (Number.isNaN(time)) return null;
    return Math.ceil((time - Date.now()) / 86400000);
  }

  function listedVersions(entry) {
    var blob = (entry.standard_numbers || []).join(" ");
    return blob.match(/(?:19|20)\d{2}|V\d+(?:\.\d+)?/g) || [];
  }

  function versionGap(evidence, entry) {
    if (!evidence.standardVersion) return "证据未填版本";
    var listed = listedVersions(entry);
    if (!listed.length) return "清单未写版本，无法比对";
    var version = String(evidence.standardVersion);
    var hit = listed.some(function (item) {
      return version.indexOf(item) !== -1 || item.indexOf(version) !== -1;
    });
    return hit ? "版本一致" : "版本可能不一致";
  }

  function modelGaps(project) {
    var variants = variantModels(project);
    return variants.filter(function (variant) {
      return !(project.archive.evidence || []).some(function (item) {
        return (item.modelsCovered || []).indexOf(variant) !== -1;
      });
    });
  }

  function transitionDates(rows) {
    var found = [];
    rows.forEach(function (row) {
      var text = row.entry.regulation_name || "";
      var matches = text.match(/20\d{2}-\d{2}-\d{2}/g) || [];
      matches.forEach(function (date) {
        found.push({ date: date, requirement: row.entry.id, days: daysUntil(date), text: text });
      });
    });
    return found;
  }

  function normalizeComparison(item) {
    if (!item || typeof item !== "object") return null;
    var raw = String(item.status || "");
    var status = { "符合": "符合", "✅符合": "符合", "差距": "差距", "⚠️差距": "差距", "缺失": "缺失", "❌缺失": "缺失" }[raw];
    if (!status) return null;
    var requirement = String(item.requirement || item.requirement_id || "");
    if (!requirement) return null;
    return {
      requirement: requirement,
      market: String(item.market || ""),
      module: String(item.module || ""),
      status: status,
      reason: String(item.reason || "待确认"),
      source: String(item.source || ""),
      dropboxPath: String(item.dropbox_path || item.dropboxPath || ""),
      page: String(item.page || ""),
    };
  }

  function mergeComparisons(project, fileObject) {
    ensureArchive(project);
    var list = (fileObject && (fileObject.comparisons || fileObject.evidence_comparisons)) || [];
    var merged = 0;
    var skipped = 0;
    var current = (project.archive.comparisons || []).slice();
    list.forEach(function (item) {
      var row = normalizeComparison(item);
      if (!row) {
        skipped += 1;
        return;
      }
      var index = -1;
      current.forEach(function (existing, i) {
        if (existing.requirement === row.requirement) index = i;
      });
      if (index >= 0) current[index] = row;
      else current.push(row);
      merged += 1;
    });
    project.archive.comparisons = current;
    return { merged: merged, skipped: skipped };
  }

  function applyRegulationUpdates(projects, fileObject) {
    var updates = (fileObject && fileObject.updates) || [];
    var count = 0;
    updates.forEach(function (update) {
      if (!update || !update.requirement) return;
      var market = String(update.requirement).split("-")[0];
      projects.forEach(function (project) {
        if (project.markets && project.markets.length && project.markets.indexOf(market) === -1) return;
        project.reviews = project.reviews || {};
        project.reviews[update.requirement] = {
          status: "需要复核",
          summary: String(update.summary || "来源页有变化"),
          at: String(update.detected_at || ""),
          sourceUrl: String(update.source_url || ""),
        };
        count += 1;
      });
    });
    return count;
  }

  function auditPack(project, market, includeSensitive) {
    ensureArchive(project);
    function inMarket(ids) {
      if (!market) return true;
      return (ids || []).some(function (id) { return String(id).indexOf(market + "-") === 0; });
    }
    var evidence = (project.archive.evidence || []).filter(function (item) {
      return inMarket(item.requirementIds);
    });
    var comparisons = (project.archive.comparisons || []).filter(function (item) {
      return !market || item.market === market || String(item.requirement).indexOf(market + "-") === 0;
    });
    var schedule = (project.archive.schedule || []).filter(function (item) {
      return !market || !item.market || item.market === market;
    }).map(function (item) {
      var copy = {
        market: item.market,
        lab: item.lab,
        start: item.start,
        end: item.end,
      };
      if (includeSensitive) copy.fee = item.fee;
      return copy;
    });
    var basic = project.archive.basic;
    return {
      market: market || "全部",
      technicalIndex: [
        "产品说明：" + (basic.model || project.name) + "（待确认处仍待确认）",
        "产品状态：" + (basic.statusAggregate || aggregateStatus(basic)),
        "证据只列路径和编号，文件在 Dropbox。",
        "付费标准原文不纳入。",
      ].concat(waiverRecords(project).map(function (item) {
        return "领导层决定先不做测试：" + item.id + " · 决定人 " + (item.decider || "未填") + " · " + (item.decidedOn || "日期未填") + (item.note ? " · " + item.note : "") + "。不计入缺失证据。";
      })),
      evidence: evidence,
      comparisons: comparisons,
      schedule: schedule,
      variants: filledVariants(basic).map(function (row) {
        return {
          model: row.model,
          screen: screenSummary(row.screens) || row.screen,
          screens: row.screens || [],
          status: row.status,
          statusNote: row.statusNote,
          launchDates: row.launchDates,
          photos: row.photos,
          nameplatePhotos: row.nameplatePhotos,
          labelInfo: row.labelInfo,
        };
      }),
      statusAggregate: basic.statusAggregate || aggregateStatus(basic),
      testDecisions: waiverRecords(project),
      sensitive: includeSensitive ? project.archive.sensitive : null,
    };
  }

  function nextContentKind(lines, index) {
    var i;
    for (i = index + 1; i < lines.length; i += 1) {
      var trimmed = lines[i].trim();
      if (!trimmed || trimmed.charAt(0) === "#") continue;
      return trimmed.indexOf("- ") === 0 ? "list" : "map";
    }
    return "map";
  }

  function parseSimpleYaml(text) {
    var lines = text.split(/\r?\n/);
    var rootNode = {};
    var stack = [{ indent: -1, value: rootNode }];
    lines.forEach(function (raw, index) {
      if (!raw.trim() || raw.trim().charAt(0) === "#") return;
      var indent = raw.match(/^\s*/)[0].length;
      var line = raw.trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      var parent = stack[stack.length - 1].value;
      if (line.indexOf("- ") === 0) {
        if (!Array.isArray(parent)) throw new Error("YAML 列表位置无法识别");
        var rest = line.slice(2);
        var obj = {};
        parent.push(obj);
        stack.push({ indent: indent, value: obj });
        if (rest.indexOf(":") !== -1) {
          var parts = rest.split(":");
          var key = parts.shift().trim();
          obj[key] = strip(parts.join(":").trim());
        }
        return;
      }
      var colon = line.indexOf(":");
      if (colon === -1) throw new Error("无法识别的 YAML 行");
      var keyName = line.slice(0, colon).trim();
      var keyValue = line.slice(colon + 1).trim();
      if (!keyValue) {
        var container = nextContentKind(lines, index) === "list" ? [] : {};
        parent[keyName] = container;
        stack.push({ indent: indent, value: container });
        return;
      }
      parent[keyName] = strip(keyValue);
    });
    return rootNode;
  }

  function strip(value) {
    if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') || (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")) {
      return value.slice(1, -1);
    }
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }

  function parseJudgmentText(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) throw new Error("文件是空的。");
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
      var data = JSON.parse(trimmed);
      return Array.isArray(data) ? { judgments: data } : data;
    }
    return parseSimpleYaml(trimmed);
  }

  root.ComplianceStore = {
    DISCLAIMER: DISCLAIMER,
    KEY: KEY,
    blankAnswers: blankAnswers,
    uni8Project: uni8Project,
    blankProject: blankProject,
    load: load,
    save: save,
    seedIfEmpty: seedIfEmpty,
    replace: replace,
    get: get,
    remove: remove,
    duplicate: duplicate,
    rename: rename,
    exportPayload: exportPayload,
    importPayload: importPayload,
    mergeJudgments: mergeJudgments,
    mergeComparisons: mergeComparisons,
    applyRegulationUpdates: applyRegulationUpdates,
    parseJudgmentText: parseJudgmentText,
    normalizeJudgment: normalizeJudgment,
    normalizeComparison: normalizeComparison,
    ensureArchive: ensureArchive,
    migrateVariants: migrateVariants,
    touchVariants: touchVariants,
    emptyVariantRow: emptyVariantRow,
    aggregateStatus: aggregateStatus,
    filledVariants: filledVariants,
    isTestWaived: isTestWaived,
    waiverRecords: waiverRecords,
    countsAsMissing: countsAsMissing,
    screenSummary: screenSummary,
    compareComponents: compareComponents,
    compareSummary: compareSummary,
    materialAlerts: materialAlerts,
    ensureCompareTodos: ensureCompareTodos,
    blankUl: blankUl,
    moduleLabel: moduleLabel,
    CB_MODULE_ID: CB_MODULE_ID,
    readCheck: readCheck,
    applyChecklist: applyChecklist,
    applyTodoToCheck: applyTodoToCheck,
    normalizePhotoList: normalizePhotoList,
    typicalPhoto: typicalPhoto,
    homeCellFlags: homeCellFlags,
    syncTodos: syncTodos,
    todoCounts: todoCounts,
    todoFromLegacy: todoFromLegacy,
    nextCustomId: nextCustomId,
    overview: overview,
    skipsEvidence: skipsEvidence,
    blankCb: blankCb,
    WAIVER_STATUS: WAIVER_STATUS,
    blankArchive: blankArchive,
    sampleArchive: sampleArchive,
    daysUntil: daysUntil,
    versionGap: versionGap,
    modelGaps: modelGaps,
    transitionDates: transitionDates,
    auditPack: auditPack,
    partyLabel: partyLabel,
    listedVersions: listedVersions,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
