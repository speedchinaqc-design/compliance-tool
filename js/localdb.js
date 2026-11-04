(function (root) {
  "use strict";

  var AUTH_KEY = "compliance-tool-auth-v1";
  var PROJECT_KEY = "compliance-tool-projects-v1";
  var cache = null;

  function emptyStore() {
    return {
      format: "compliance-tool-local-v1",
      account: null,
      projects: [],
      settings: {
        dropboxRoot: "",
        backupKeep: 20,
        lastBackupAt: null,
        lastBackupPath: "",
        lastBackupError: "",
      },
    };
  }

  function snapshot() {
    return cache;
  }

  function persist() {
    return fetch("/api/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cache),
    }).then(function (response) {
      if (!response.ok) throw new Error("保存失败");
      return response.json();
    }).then(function (data) {
      cache = data;
      return cache;
    });
  }

  function migrate(remote) {
    var store = remote && remote.format ? remote : emptyStore();
    var changed = false;
    try {
      if (!store.account) {
        var accountRaw = root.localStorage.getItem(AUTH_KEY);
        if (accountRaw) {
          store.account = JSON.parse(accountRaw);
          changed = true;
        }
      }
      if (!store.projects || !store.projects.length) {
        var projectRaw = root.localStorage.getItem(PROJECT_KEY);
        if (projectRaw) {
          var parsed = JSON.parse(projectRaw);
          var projects = Array.isArray(parsed) ? parsed : parsed.projects;
          if (projects && projects.length) {
            store.projects = projects;
            changed = true;
          }
        }
      }
    } catch (err) {
      changed = false;
    }
    cache = store;
    if (!changed) {
      try {
        root.localStorage.removeItem(AUTH_KEY);
        root.localStorage.removeItem(PROJECT_KEY);
      } catch (err) { /* 浏览器可能拒绝写入 */ }
      return Promise.resolve(cache);
    }
    return persist().then(function (saved) {
      try {
        root.localStorage.removeItem(AUTH_KEY);
        root.localStorage.removeItem(PROJECT_KEY);
      } catch (err) { /* ignore */ }
      return saved;
    });
  }

  var ready = fetch("/api/store").then(function (response) {
    if (!response.ok) throw new Error("本机接口没有响应");
    return response.json();
  }).then(migrate);

  root.ComplianceLocal = {
    ready: ready,
    snapshot: snapshot,
    persist: persist,
    emptyStore: emptyStore,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
