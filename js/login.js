(function () {
  "use strict";

  var auth = window.ComplianceAuth;
  var root = document.getElementById("gate");
  var LOGIN_URL = "http://127.0.0.1:8765/login.html";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value === true ? "" : value);
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function field(label, opts) {
    var input = el("input", opts);
    return el("label", {}, [label, input]);
  }

  function privacyNote() {
    return el("p", { class: "warn" }, [
      "这是本机隐私门，不是强安全。密码只以加盐的 PBKDF2/SHA-256 哈希留在这台浏览器里，不会上传。能打开这台电脑或这份浏览器数据的人，仍可以清掉哈希，或直接看仓库里的 YAML。",
    ]);
  }

  function showError(box, message) {
    box.textContent = message || "";
  }

  function renderCryptoMissing() {
    root.replaceChildren(
      el("p", { class: "eyebrow" }, ["本地工具 · 第一期"]),
      el("h1", {}, ["需要本机页面服务"]),
      el("p", {}, [
        "这个页面打不开 WebCrypto（用 file:// 直接双击打开时，Chrome 通常没有它）。请在仓库根目录运行：",
      ]),
      el("pre", { class: "command" }, ["python3 tools/serve.py"]),
      el("p", {}, ["然后打开登录地址："]),
      el("p", { class: "login-url" }, [LOGIN_URL]),
      el("p", { class: "help" }, ["不要把密码写进文件，也不要改用一个明文来凑合。"]),
      privacyNote()
    );
  }

  function renderSetup() {
    var error = el("p", { class: "error", role: "alert" });
    var form = el("form", { id: "setup-form" }, [
      field("用户名", { name: "username", autocomplete: "username", required: true, maxlength: "64" }),
      field("密码", {
        name: "password",
        type: "password",
        autocomplete: "new-password",
        required: true,
        minlength: "8",
        maxlength: "200",
      }),
      field("再输入一次密码", {
        name: "confirm",
        type: "password",
        autocomplete: "new-password",
        required: true,
        minlength: "8",
        maxlength: "200",
      }),
      el("button", { type: "submit", id: "setup-submit" }, ["设好并进入"]),
      error,
    ]);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new window.FormData(form);
      var password = String(data.get("password") || "");
      var confirm = String(data.get("confirm") || "");
      if (password !== confirm) {
        showError(error, "两次密码不一致。");
        return;
      }
      var button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "正在保存哈希…";
      showError(error, "");
      auth
        .setup(data.get("username"), password)
        .then(function () {
          window.location.replace("index.html?v=20261104-4");
        })
        .catch(function (err) {
          button.disabled = false;
          button.textContent = "设好并进入";
          showError(error, err && err.message && err.message !== "no-crypto" ? err.message : "没能保存。请改用本机页面服务。");
        });
    });
    root.replaceChildren(
      el("p", { class: "eyebrow" }, ["本地工具 · 第一期"]),
      el("h1", {}, ["设置本机入口"]),
      el("p", {}, ["第一次使用。用户名和密码只留在这台浏览器里，之后打开清单要先登录。"]),
      privacyNote(),
      form
    );
  }

  function resetLocal() {
    var ok = window.confirm(
      "确定重置本机密码？\n\n这会清掉这台浏览器里为本工具保存的用户名、密码哈希、产品项目和进度。\n不会删除 YAML，也不会动 Dropbox。导出的 JSON 备份不受影响。\n\n重置后需要重新设置用户名和密码。"
    );
    if (!ok) return;
    auth.clearLocalData();
    renderSetup();
  }

  function renderLogin() {
    var error = el("p", { class: "error", role: "alert" });
    var form = el("form", { id: "login-form" }, [
      field("用户名", { name: "username", autocomplete: "username", required: true, maxlength: "64" }),
      field("密码", {
        name: "password",
        type: "password",
        autocomplete: "current-password",
        required: true,
        maxlength: "200",
      }),
      el("button", { type: "submit", id: "login-submit" }, ["登录"]),
      error,
    ]);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new window.FormData(form);
      var button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "正在核对…";
      showError(error, "");
      auth
        .login(data.get("username"), data.get("password"))
        .then(function (ok) {
          if (ok) {
            window.location.replace("index.html?v=20261104-4");
            return;
          }
          button.disabled = false;
          button.textContent = "登录";
          showError(error, "用户名或密码不对。");
        })
        .catch(function () {
          button.disabled = false;
          button.textContent = "登录";
          showError(error, "没能核对。请改用本机页面服务后再试。");
        });
    });
    var reset = el("button", { type: "button", class: "ghost", id: "reset-auth" }, ["重置本机密码"]);
    reset.addEventListener("click", resetLocal);
    root.replaceChildren(
      el("p", { class: "eyebrow" }, ["本地工具 · 第一期"]),
      el("h1", {}, ["登录"]),
      el("p", {}, ["进入欧盟、加拿大、美国合规清单。这次登录只在当前标签页有效，关掉标签页就要重新登录。"]),
      privacyNote(),
      form,
      reset
    );
  }

  if (auth.hasSession()) {
    window.location.replace("index.html?v=20261104-4");
    return;
  }
  if (!auth.cryptoAvailable()) {
    renderCryptoMissing();
    return;
  }
  if (!auth.hasRecord()) renderSetup();
  else renderLogin();
})();
