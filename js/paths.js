(function (root) {
  "use strict";

  function el(tag, attrs, children) {
    return root.ComplianceDom.el(tag, attrs, children);
  }

  function logical(path) {
    var text = String(path || "").replace(/\\/g, "/").trim();
    var marker = "合规知识库";
    var at = text.indexOf(marker);
    if (at >= 0) return "/" + text.slice(at);
    if (!text) return "";
    if (text.charAt(0) !== "/") return "/合规知识库/" + text.replace(/^\/+/, "");
    return text;
  }

  function webUrl(path) {
    var parts = logical(path).split("/").filter(Boolean);
    if (!parts.length) return "";
    return "https://www.dropbox.com/home/" + parts.map(encodeURIComponent).join("/");
  }

  function openLocal(path) {
    var target = logical(path);
    if (!target) return;
    fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: target, create: false }),
    }).then(function (response) { return response.json(); }).then(function (data) {
      if (data && data.needConfirm) {
        var ok = window.confirm("文件夹还不存在：\n" + (data.path || target) + "\n\n要在 Dropbox 根目录里创建它吗？");
        if (!ok) return;
        return fetch("/api/open-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: target, create: true }),
        }).then(function (response) { return response.json(); });
      }
      if (data && data.ok === false && data.error) window.alert(data.error);
      return data;
    }).catch(function () {
      window.alert("打不开本地文件夹。请用 python3 tools/serve.py 或桌面版。");
    });
  }

  function buttons(pathOrGetter) {
    var wrap = el("div", { class: "path-actions" });
    var local = el("button", { type: "button", class: "ghost" }, ["打开本地文件夹"]);
    local.addEventListener("click", function () {
      var path = typeof pathOrGetter === "function" ? pathOrGetter() : pathOrGetter;
      openLocal(path);
    });
    var web = el("a", { class: "button-link", target: "_blank", rel: "noopener noreferrer" }, ["在网页版 Dropbox 打开"]);
    function sync() {
      var path = typeof pathOrGetter === "function" ? pathOrGetter() : pathOrGetter;
      var url = webUrl(path);
      if (url) web.setAttribute("href", url);
      else web.removeAttribute("href");
    }
    sync();
    if (typeof pathOrGetter === "function") {
      wrap.addEventListener("focusout", sync);
    }
    wrap.append(local, web);
    return wrap;
  }

  root.CompliancePaths = {
    logical: logical,
    webUrl: webUrl,
    buttons: buttons,
    openLocal: openLocal,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
