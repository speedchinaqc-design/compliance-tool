(function (root) {
  "use strict";

  var el = function () {
    return root.ComplianceDom.el.apply(null, arguments);
  };
  var pageFolds = [];

  function storageKey(project) {
    return "compliance-fold-v1:" + ((project && project.id) || "global");
  }

  function load(project) {
    try {
      return JSON.parse(root.localStorage.getItem(storageKey(project)) || "{}") || {};
    } catch (err) {
      return {};
    }
  }

  function save(project, map) {
    try {
      root.localStorage.setItem(storageKey(project), JSON.stringify(map));
    } catch (err) { /* 浏览器可能拒绝写入 */ }
  }

  function toolbar() {
    var open = el("button", { type: "button", id: "fold-all-open" }, ["全部展开"]);
    var shut = el("button", { type: "button", id: "fold-all-shut" }, ["全部收起"]);
    open.addEventListener("click", function () { pageFolds.forEach(function (item) { item.set(true); }); });
    shut.addEventListener("click", function () { pageFolds.forEach(function (item) { item.set(false); }); });
    return el("div", { class: "fold-toolbar wizard-bar no-print", id: "fold-toolbar" }, [open, shut]);
  }

  function summaryFor(heading, body) {
    var given = heading.getAttribute("data-summary");
    if (given) return given;
    var check = body.querySelector("select[data-check]");
    if (check) return "办理状态：" + check.value;
    var rows = body.querySelectorAll("tbody tr").length;
    if (rows) return "共 " + rows + " 行";
    var missing = body.querySelectorAll(".missing").length;
    if (missing) return "有 " + missing + " 处提醒";
    return "";
  }

  function foldHeader(heading, project, map) {
    if (!heading || heading.closest(".fold")) return;
    var title = (heading.textContent || "").trim();
    var parent = heading.parentNode;
    if (!parent) return;
    var body = el("div", { class: "fold-body" });
    var sibling = heading.nextSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.tagName === "H3") break;
      var next = sibling.nextSibling;
      body.append(sibling);
      sibling = next;
    }
    var summaryText = summaryFor(heading, body);
    var warn = heading.getAttribute("data-warn") === "1" || !!body.querySelector(".missing");
    var id = heading.getAttribute("data-fold") || title;
    var expanded = Object.prototype.hasOwnProperty.call(map, id) ? !!map[id] : warn;
    var button = el("button", { type: "button", class: "fold-toggle", "aria-expanded": expanded ? "true" : "false" }, [
      el("span", { class: "fold-title" }, [title]),
      el("span", { class: "fold-summary" }, [summaryText]),
    ]);
    if (!expanded) body.hidden = true;
    function set(open) {
      expanded = !!open;
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      body.hidden = !expanded;
      map[id] = expanded;
      save(project, map);
    }
    button.addEventListener("click", function () { set(!expanded); });
    pageFolds.push({ set: set });
    parent.replaceChild(el("section", { class: "fold" + (warn ? " fold-warn" : "") }, [button, body]), heading);
  }

  function limitTables(container) {
    container.querySelectorAll("table").forEach(function (table) {
      if (table.getAttribute("data-limited")) return;
      var rows = table.tBodies[0] ? Array.prototype.slice.call(table.tBodies[0].rows) : [];
      if (rows.length <= 10) return;
      table.setAttribute("data-limited", "1");
      function apply(showAll) {
        rows.forEach(function (row, index) { row.hidden = !showAll && index >= 10; });
      }
      apply(false);
      var open = false;
      var button = el("button", { type: "button", class: "ghost table-more" }, ["显示全部（共 " + rows.length + " 行）"]);
      button.addEventListener("click", function () {
        open = !open;
        apply(open);
        button.textContent = open ? "只看前 10 行（共 " + rows.length + " 行）" : "显示全部（共 " + rows.length + " 行）";
      });
      table.insertAdjacentElement("afterend", button);
    });
  }

  function apply(container, project) {
    if (!container) return;
    pageFolds.length = 0;
    var map = load(project);
    var headers = Array.prototype.slice.call(container.querySelectorAll("h3"));
    for (var i = headers.length - 1; i >= 0; i -= 1) foldHeader(headers[i], project, map);
    limitTables(container);
  }

  root.ComplianceFold = { toolbar: toolbar, apply: apply };
})(typeof globalThis !== "undefined" ? globalThis : this);
