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

  function blankArchive() {
    return {
      basic: {
        model: "",
        variants: [],
        photoPath: "",
        thumbnail: "",
        status: "研发",
        statusNote: "",
        launchDates: { EU: "", CA: "", US: "" },
      },
      sensitive: { note: "", costNote: "", suppliers: [] },
      evidence: [],
      comparisons: [],
      changelog: [],
      bom: [],
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
    if (project.archive && project.archive.basic && project.archive.parties) return false;
    project.archive = project.id === "uni-8-sample" ? sampleArchive() : blankArchive();
    return true;
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
    var variants = ((project.archive && project.archive.basic.variants) || []).filter(Boolean);
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
    return {
      market: market || "全部",
      technicalIndex: [
        "产品说明：" + (project.archive.basic.model || project.name) + "（待确认处仍待确认）",
        "证据只列路径和编号，文件在 Dropbox。",
        "付费标准原文不纳入。",
      ],
      evidence: evidence,
      comparisons: comparisons,
      schedule: schedule,
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
