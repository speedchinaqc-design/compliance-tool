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
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  function load() {
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
    return { project: project, merged: merged, skipped: skipped };
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
    parseJudgmentText: parseJudgmentText,
    normalizeJudgment: normalizeJudgment,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
