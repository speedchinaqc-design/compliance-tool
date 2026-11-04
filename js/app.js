(function () {
  "use strict";

  var data = window.COMPLIANCE_DATA;
  var store = window.ComplianceStore;
  var el = window.ComplianceDom.el;
  var app = document.getElementById("app");
  var facts = document.getElementById("product-facts");
  store.seedIfEmpty();

  function showList() {
    var version = window.APP_VERSION || "";
    var versionNode = document.getElementById("app-version");
    if (versionNode) versionNode.textContent = version ? "v" + version : "";
    facts.textContent = "第一期市场只有欧盟、加拿大、美国。账号和项目存在本机 data_local，浏览器和桌面版共用。";
    app.replaceChildren();
    var projects = store.load();
    var page = el("section", { id: "project-list" }, [
      el("h2", {}, ["产品项目"]),
      el("p", { class: "disclaimer" }, [store.DISCLAIMER]),
    ]);
    var bar = el("div", { class: "wizard-bar" });
    var create = el("button", { type: "button", id: "create-project" }, ["新建产品"]);
    create.addEventListener("click", function () {
      var project = store.blankProject("新产品");
      store.replace(project);
      openWizard(project.id);
    });
    var sample = el("button", { type: "button", class: "ghost", id: "create-uni8" }, ["按 UNI-8 样板新建"]);
    sample.addEventListener("click", function () {
      var project = store.uni8Project();
      project.id = "uni8-" + Date.now().toString(36);
      project.sample = false;
      project.wizardComplete = false;
      project.name = "UNI-8";
      store.replace(project);
      openWizard(project.id);
    });
    var exp = el("button", { type: "button", class: "ghost", id: "export-projects" }, ["导出 JSON"]);
    exp.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(store.exportPayload(), null, 2)], { type: "application/json" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "合规项目备份.json";
      document.body.append(link);
      link.click();
      link.remove();
    });
    var imp = el("input", { type: "file", id: "import-projects", accept: ".json,application/json" });
    imp.addEventListener("change", function () {
      var file = imp.files && imp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          store.importPayload(JSON.parse(String(reader.result || "")));
          showList();
        } catch (err) {
          window.alert("没能导入。" + (err.message || ""));
        }
      };
      reader.readAsText(file);
    });
    var settings = el("button", { type: "button", class: "ghost", id: "open-settings" }, ["备份与 Dropbox"]);
    settings.addEventListener("click", showSettings);
    var update = el("button", { type: "button", class: "ghost", id: "check-update" }, ["检查更新"]);
    update.addEventListener("click", checkUpdate);
    bar.append(create, sample, exp, imp, settings, update);
    page.append(bar);
    page.append(el("div", { id: "backup-banner" }));
    loadBackupBanner();
    if (!projects.length) page.append(el("p", { class: "empty" }, ["还没有产品。可以新建，或按 UNI-8 样板开始。"]));
    projects.forEach(function (project) {
      var card = el("article", { class: "card", id: "project-" + project.id }, [
        el("h3", {}, [project.name]),
        el("p", { class: "help" }, [
          (project.wizardComplete ? "工作区已生成" : "向导未完成") +
            " · 市场 " + (project.markets.join("、") || "未选") +
            " · 模块 " + (project.modules.join("、") || "未选"),
        ]),
      ]);
      var actions = el("div", { class: "wizard-bar" });
      var open = el("button", { type: "button" }, [project.wizardComplete ? "打开工作区" : "继续向导"]);
      open.addEventListener("click", function () {
        if (project.wizardComplete) openWorkspace(project.id);
        else openWizard(project.id);
      });
      var rename = el("button", { type: "button", class: "ghost" }, ["重命名"]);
      rename.addEventListener("click", function () {
        var name = window.prompt("产品名称", project.name);
        if (!name) return;
        store.rename(project.id, name);
        showList();
      });
      var copy = el("button", { type: "button", class: "ghost" }, ["复制"]);
      copy.addEventListener("click", function () {
        store.duplicate(project.id);
        showList();
      });
      var del = el("button", { type: "button", class: "ghost" }, ["删除"]);
      del.addEventListener("click", function () {
        if (!window.confirm("删除产品「" + project.name + "」？只删除这台浏览器里的项目，不删除 YAML。")) return;
        store.remove(project.id);
        showList();
      });
      actions.append(open, rename, copy, del);
      card.append(actions);
      page.append(card);
    });
    app.append(page);
  }

  function openWizard(id) {
    var project = store.get(id);
    if (!project) return showList();
    if (!project._step) project._step = 1;
    facts.textContent = "正在填写：" + project.name;
    window.ComplianceWizard.render(app, project, function (next) {
      store.replace(next);
      openWizard(next.id);
    }, function (next) {
      next.wizardComplete = true;
      store.replace(next);
      var createFolders = document.getElementById("create-folders");
      var model = (next.archive && next.archive.basic && next.archive.basic.model) || next.name;
      if (createFolders && createFolders.checked && model) {
        fetch("/api/product-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: model }),
        }).then(function (response) { return response.json(); }).then(function (data) {
          if (data && data.note) window.alert(data.note + (data.path ? "\n" + data.path : ""));
          openWorkspace(next.id);
        }).catch(function () { openWorkspace(next.id); });
        return;
      }
      openWorkspace(next.id);
    }, showList);
  }

  function openWorkspace(id, tab) {
    var project = store.get(id);
    if (!project) return showList();
    facts.textContent = project.name + " · 本地工作区";
    window.__workspaceBack = showList;
    window.__workspaceWizard = function () {
      project._step = 1;
      store.replace(project);
      openWizard(project.id);
    };
    window.ComplianceWorkspace.render(app, project, tab || "checklist", function (next) {
      store.replace(next);
    }, showList, window.__workspaceWizard);
  }

  function loadBackupBanner() {
    var host = document.getElementById("backup-banner");
    if (!host) return;
    fetch("/api/library").then(function (response) { return response.json(); }).then(function (info) {
      var when = info.lastBackupAt;
      var old = true;
      if (when) {
        var age = Date.now() - Date.parse(when);
        old = !(age >= 0) || age > 7 * 86400000;
      }
      host.replaceChildren();
      var text = when ? "最近备份：" + when : "还没有成功备份。";
      if (info.lastBackupError) text += " " + info.lastBackupError;
      if (!info.rootExists) text += " Dropbox 根目录目前不存在：" + info.root;
      host.append(el("p", { class: old ? "note" : "help" }, [old ? "超过 7 天没有备份，或还没备份过。" + text : text]));
      if (info.backupDir) host.append(window.CompliancePaths.buttons(info.backupDir));
    }).catch(function () {});
  }

  function showSettings() {
    fetch("/api/store").then(function (response) { return response.json(); }).then(function (storeData) {
      var settings = storeData.settings || {};
      app.replaceChildren();
      var path = el("input", { id: "dropbox-root", type: "text", value: settings.dropboxRoot || "" });
      var keep = el("input", { id: "backup-keep", type: "number", value: String(settings.backupKeep || 20) });
      var save = el("button", { type: "button", id: "save-settings" }, ["保存"]);
      save.addEventListener("click", function () {
        var live = window.ComplianceLocal.snapshot();
        live.settings = live.settings || {};
        live.settings.dropboxRoot = path.value.trim();
        live.settings.backupKeep = Number(keep.value || 20);
        window.ComplianceLocal.persist().then(function () { showList(); });
      });
      var back = el("button", { type: "button", class: "ghost" }, ["返回"]);
      back.addEventListener("click", showList);
      app.append(el("section", { id: "settings-page" }, [
        el("h2", {}, ["备份与 Dropbox"]),
        el("p", { class: "help" }, ["默认根目录是本机的 Dropbox\\合规知识库。留空就用这个默认位置。自动备份写到其中的 00_工具备份，只保留最近若干份。"]),
        el("label", { class: "attr" }, ["Dropbox 根目录", path]),
        window.CompliancePaths.buttons(function () { return path.value || ""; }),
        el("label", { class: "attr" }, ["保留备份份数", keep]),
        el("div", { class: "wizard-bar" }, [save, back]),
      ]));
    });
  }

  function checkUpdate() {
    fetch("/api/update").then(function (response) { return response.json(); }).then(function (info) {
      if (!info.ok) {
        window.alert("没能查看 GitHub 发布。" + (info.error || ""));
        return;
      }
      if (!info.newer) {
        window.alert("当前已是 v" + info.local + "。");
        return;
      }
      var ok = window.confirm("发现 " + info.latest + "，当前是 v" + info.local + "。\n下载并覆盖程序文件？data_local 会保留。");
      if (!ok) return;
      fetch("/api/update/apply", { method: "POST" }).then(function (response) { return response.json(); }).then(function (result) {
        window.alert(result.message || result.error || "已处理");
      });
    }).catch(function () { window.alert("检查更新失败。"); });
  }

  if (window.ComplianceLocal) {
    window.ComplianceLocal.ready.then(function () {
      store.seedIfEmpty();
      showList();
    }).catch(function () {
      facts.textContent = "没有连上本机服务。请运行 python3 tools/serve.py 。";
    });
  } else {
    store.seedIfEmpty();
    showList();
  }
})();
