(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el.apply(null, arguments);
  };
  var STEPS = ["名称与型号", "选市场", "选模块", "问答", "模板与组件", "生成工作区"];

  function questionVisible(question, draft) {
    if (question.modules.length && !question.modules.some(function (item) { return draft.modules.indexOf(item) !== -1; })) return false;
    if (question.markets && question.markets.length && !question.markets.some(function (item) { return draft.markets.indexOf(item) !== -1; })) return false;
    if (question.show_when) {
      var keys = Object.keys(question.show_when);
      for (var i = 0; i < keys.length; i += 1) {
        if (draft.answers[keys[i]] !== question.show_when[keys[i]]) return false;
      }
    }
    return true;
  }

  function render(host, draft, onChange, onFinish, onCancel) {
    var step = draft._step || 1;
    host.replaceChildren();
    var box = el("section", { id: "wizard", class: "wizard" });
    box.append(el("h2", {}, ["向导 · " + (draft.name || "新产品")]));
    var steps = el("ol", { class: "steps" });
    STEPS.forEach(function (label, index) {
      steps.append(el("li", { class: index + 1 === step ? "on" : "" }, [String(index + 1) + " " + label]));
    });
    box.append(steps);
    if (step === 1) box.append(renderIdentity(draft));
    if (step === 2) box.append(renderMarkets(draft));
    if (step === 3) box.append(renderModules(draft));
    if (step === 4) box.append(renderQuestions(draft));
    if (step === 5) box.append(renderRecommend(draft));
    if (step === 6) box.append(renderBuild(draft));
    var bar = el("div", { class: "wizard-bar" });
    if (step > 1) {
      var back = el("button", { type: "button", class: "ghost", id: "wizard-back" }, ["上一步"]);
      back.addEventListener("click", function () {
        draft._step = step - 1;
        onChange(draft);
      });
      bar.append(back);
    }
    var cancel = el("button", { type: "button", class: "ghost", id: "wizard-cancel" }, ["返回项目列表"]);
    cancel.addEventListener("click", onCancel);
    bar.append(cancel);
    if (step < 6) {
      var next = el("button", { type: "button", id: "wizard-next" }, ["下一步"]);
      next.addEventListener("click", function () {
        var error = validate(step, draft);
        var slot = box.querySelector(".error");
        if (error) {
          if (slot) slot.textContent = error;
          return;
        }
        draft._step = step + 1;
        onChange(draft);
      });
      bar.append(next);
    } else {
      var done = el("button", { type: "button", id: "wizard-finish" }, ["生成工作区"]);
      done.addEventListener("click", function () {
        draft.wizardComplete = true;
        delete draft._step;
        onFinish(draft);
      });
      bar.append(done);
    }
    box.append(bar);
    host.append(box);
  }

  function validate(step, draft) {
    if (step === 1 && !String(draft.name || "").trim()) return "请填写产品名称。";
    if (step === 2 && !draft.markets.length) return "请至少选一个市场。第一期只有欧盟、加拿大、美国。";
    if (step === 3 && !draft.modules.length) return "请至少选一个模块。";
    return "";
  }

  function renderIdentity(draft) {
    if (!draft.answers) draft.answers = root.ComplianceStore.blankAnswers();
    var name = el("input", { id: "product-name", type: "text", value: draft.name || "" });
    name.addEventListener("input", function () { draft.name = name.value; });
    var model = el("input", { id: "product-model", type: "text", value: (draft.archive && draft.archive.basic && draft.archive.basic.model) || "" });
    model.addEventListener("input", function () {
      root.ComplianceStore.ensureArchive(draft);
      draft.archive.basic.model = model.value;
    });
    var sample = el("button", { type: "button", class: "ghost", id: "use-uni8" }, ["从 UNI-8 样板开始"]);
    sample.addEventListener("click", function () {
      var preset = root.ComplianceStore.uni8Project();
      draft.name = preset.name;
      draft.markets = preset.markets.slice();
      draft.modules = preset.modules.slice();
      draft.answers = JSON.parse(JSON.stringify(preset.answers));
      root.ComplianceStore.ensureArchive(draft);
      draft.archive = JSON.parse(JSON.stringify(preset.archive));
      if (root.__wizardRefresh) root.__wizardRefresh();
    });
    return el("div", { id: "wizard-identity" }, [
      el("p", {}, ["先写产品名称和型号。问答只出现在后面勾选的模块里。"]),
      el("label", { class: "attr" }, ["产品名称", name]),
      el("label", { class: "attr" }, ["型号", model]),
      sample,
      el("p", { class: "error", role: "alert" }),
      el("p", { class: "help" }, ["命名规则：型号_市场_维度_类型_编号_签发日期_版本，例如 UNI-8_EU_08METRO_CERT_TC1234_20260115_v1.pdf。这是命名举例，不是真实证书。"]),
    ]);
  }

  function renderMarkets(draft) {
    var wrap = el("div", {}, [
      el("p", {}, ["第一期只有这三个市场。其他市场没有数据，不能选。"]),
      el("p", { class: "error", role: "alert" }),
    ]);
    var names = { EU: "欧盟", CA: "加拿大", US: "美国" };
    ["EU", "CA", "US"].forEach(function (code) {
      var input = el("input", { type: "checkbox", "data-market": code });
      input.checked = draft.markets.indexOf(code) !== -1;
      input.addEventListener("change", function () {
        if (input.checked && draft.markets.indexOf(code) === -1) draft.markets.push(code);
        if (!input.checked) draft.markets = draft.markets.filter(function (item) { return item !== code; });
      });
      wrap.append(el("label", { class: "choice" }, [input, " " + names[code] + "（" + code + "）"]));
    });
    return wrap;
  }

  function renderModules(draft) {
    var wrap = el("div", {}, [
      el("p", {}, ["模块只用来筛选已经写好的格子。勾选不会增加规划书里没有的法规。"]),
      el("p", { class: "error", role: "alert" }),
    ]);
    root.COMPLIANCE_DATA.modules.forEach(function (mod) {
      var input = el("input", { type: "checkbox", "data-module": mod.id });
      input.checked = draft.modules.indexOf(mod.id) !== -1;
      input.addEventListener("change", function () {
        if (input.checked && draft.modules.indexOf(mod.id) === -1) draft.modules.push(mod.id);
        if (!input.checked) draft.modules = draft.modules.filter(function (item) { return item !== mod.id; });
      });
      wrap.append(el("label", { class: "choice choice-block" }, [
        input,
        el("span", {}, [el("strong", {}, [mod.id]), el("span", { class: "help" }, [mod.summary])]),
      ]));
    });
    return wrap;
  }

  function renderQuestions(draft) {
    var wrap = el("div", { id: "wizard-questions" });
    wrap.append(el("p", {}, ["每题下面是依据和来源。电池题按加拿大复函 26-005366-600：商用不自动豁免。"]));
    var any = false;
    root.COMPLIANCE_DATA.questions.forEach(function (question) {
      if (!questionVisible(question, draft)) return;
      any = true;
      wrap.append(renderOneQuestion(draft, question));
    });
    if (!any) wrap.append(el("p", {}, ["当前模块下没有额外问题。"]));
    return wrap;
  }

  function renderOneQuestion(draft, question) {
    var block = el("fieldset", { class: "question", id: "q-" + question.id }, [
      el("legend", {}, [question.prompt]),
    ]);
    if (question.type === "boolean") {
      var yes = el("input", { type: "radio", name: question.id, value: "yes" });
      var no = el("input", { type: "radio", name: question.id, value: "no" });
      yes.checked = draft.answers[question.id] === true;
      no.checked = draft.answers[question.id] === false;
      var set = function (value) {
        draft.answers[question.id] = value;
      };
      yes.addEventListener("change", function () { set(true); rerenderIfNeeded(draft); });
      no.addEventListener("change", function () { set(false); rerenderIfNeeded(draft); });
      block.append(el("label", { class: "choice" }, [yes, " 是"]), el("label", { class: "choice" }, [no, " 否"]));
    } else if (question.type === "enum") {
      var select = el("select", { id: "answer-" + question.id });
      question.options.forEach(function (option) {
        var node = el("option", { value: option.id }, [option.label]);
        if (draft.answers[question.id] === option.id) node.selected = true;
        select.append(node);
      });
      if (!draft.answers[question.id]) draft.answers[question.id] = question.options[0].id;
      select.addEventListener("change", function () { draft.answers[question.id] = select.value; });
      block.append(select);
    } else {
      var input = el("input", { type: "text", id: "answer-" + question.id, value: draft.answers[question.id] || "" });
      if (question.placeholder) input.setAttribute("placeholder", question.placeholder);
      input.addEventListener("input", function () { draft.answers[question.id] = input.value; });
      block.append(input);
    }
    block.append(el("p", { class: "basis" }, ["依据：" + question.basis]));
    var sources = el("p", { class: "source" }, ["来源："]);
    question.sources.forEach(function (source, index) {
      if (index) sources.append("；");
      if (source.url) sources.append(el("a", { href: source.url, rel: "noopener noreferrer" }, [source.label]));
      else sources.append(source.label);
    });
    block.append(sources);
    return block;
  }

  function rerenderIfNeeded(draft) {
    if (draft._step === 4 && root.__wizardRefresh) root.__wizardRefresh();
  }

  function renderRecommend(draft) {
    var docs = root.ComplianceTemplates.forModules(draft.modules, "document");
    var labels = root.ComplianceTemplates.forModules(draft.modules, "label");
    var wrap = el("div", { id: "wizard-recommend" }, [
      el("p", {}, ["下面这些会放进工作区。模板只有骨架，需要你确认的地方标了「待确认」。没有付费标准原文。"]),
      el("h3", {}, ["文件模板"]),
    ]);
    docs.forEach(function (item) { wrap.append(el("p", {}, [item.title])); });
    wrap.append(el("h3", {}, ["标签模板"]));
    labels.forEach(function (item) {
      if (item.id === "lbl-fcc-a" && draft.markets.indexOf("US") === -1) return;
      if (item.id === "lbl-ised" && draft.markets.indexOf("CA") === -1) return;
      wrap.append(el("p", {}, [item.title]));
    });
    wrap.append(el("h3", {}, ["工作区组件"]));
    root.ComplianceTemplates.widgets.forEach(function (item) {
      wrap.append(el("p", {}, [item.title + "：" + item.text]));
    });
    return wrap;
  }

  function renderBuild(draft) {
    return el("div", { id: "wizard-build" }, [
      el("p", { class: "disclaimer" }, [root.ComplianceStore.DISCLAIMER]),
      el("p", {}, ["产品：" + (draft.name || "未命名")]),
      el("p", {}, ["市场：" + (draft.markets.join("、") || "未选")]),
      el("p", {}, ["模块：" + (draft.modules.join("、") || "未选")]),
      el("p", {}, ["生成后可以改答案、勾进度、填证书到期日。数据写在本机 data_local，并备份到 Dropbox 的 00_工具备份。"]),
      (function () {
        var box = el("label", { class: "choice" }, []);
        var input = el("input", { type: "checkbox", id: "create-folders" });
        input.checked = true;
        box.append(input, " 在 Dropbox 里为这个型号建立文件夹（复制 _新产品模板）");
        return box;
      })(),
    ]);
  }

  root.ComplianceWizard = {
    render: function (host, draft, onChange, onFinish, onCancel) {
      root.__wizardRefresh = function () {
        render(host, draft, onChange, onFinish, onCancel);
      };
      render(host, draft, onChange, onFinish, onCancel);
    },
    questionVisible: questionVisible,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
