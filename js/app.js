(function () {
  "use strict";

  var data = window.COMPLIANCE_DATA;
  var store = window.ComplianceStore;
  var el = window.ComplianceDom.el;
  var app = document.getElementById("app");
  var facts = document.getElementById("product-facts");
  store.seedIfEmpty();

  function showList() {
    facts.textContent = "第一期市场只有欧盟、加拿大、美国。项目存在这台浏览器，可用 JSON 备份到 Dropbox。";
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
    bar.append(create, sample, exp, imp);
    page.append(bar);
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

  showList();
})();
