(function (root) {
  "use strict";

  var RECORD_KEY = "compliance-tool-auth-v1";
  var SESSION_KEY = "compliance-tool-session-v1";
  var ITERATIONS = 210000;
  var HASH_BITS = 256;

  function subtle() {
    try {
      if (!root.isSecureContext) return null;
      if (!root.crypto || !root.crypto.subtle) return null;
      return root.crypto.subtle;
    } catch (err) {
      return null;
    }
  }

  function cryptoAvailable() {
    return Boolean(subtle() && root.crypto.getRandomValues && root.TextEncoder && root.btoa && root.atob);
  }

  function bytesToB64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return root.btoa(binary);
  }

  function b64ToBytes(value) {
    var binary = root.atob(value);
    var out = new root.Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function equalBytes(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    var diff = 0;
    for (var i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
    return diff === 0;
  }

  function storeSnapshot() {
    if (!root.ComplianceLocal || !root.ComplianceLocal.snapshot()) return null;
    return root.ComplianceLocal.snapshot();
  }

  function readRecord() {
    var live = storeSnapshot();
    var data = live ? live.account : null;
    if (!data) {
      try {
        var raw = root.localStorage.getItem(RECORD_KEY);
        if (!raw) return null;
        data = JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }
    if (!data || data.algo !== "PBKDF2-SHA-256") return null;
    if (!data.username || !data.salt || !data.hash) return null;
    if (data.iterations !== ITERATIONS) return null;
    return data;
  }

  function writeRecord(record) {
    var live = storeSnapshot();
    if (live) {
      live.account = record;
      return root.ComplianceLocal.persist();
    }
    try {
      root.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
    } catch (err) { /* 测试环境或隐私模式 */ }
    return Promise.resolve(record);
  }

  function derive(password, salt, iterations) {
    var encoder = new root.TextEncoder();
    return subtle()
      .importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return subtle().deriveBits(
          { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
          key,
          HASH_BITS
        );
      })
      .then(function (bits) {
        return new root.Uint8Array(bits);
      });
  }

  function startSession(username) {
    root.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username: username, at: Date.now() })
    );
  }

  function hasSession() {
    try {
      var raw = root.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var session = JSON.parse(raw);
      var record = readRecord();
      return Boolean(session && record && session.username === record.username);
    } catch (err) {
      return false;
    }
  }

  function hasRecord() {
    return Boolean(readRecord());
  }

  function setup(username, password) {
    var name = String(username || "").trim();
    if (!cryptoAvailable()) return Promise.reject(new Error("no-crypto"));
    if (!name) return Promise.reject(new Error("请填写用户名。"));
    if (String(password || "").length < 8) return Promise.reject(new Error("密码至少 8 位。"));
    var salt = new root.Uint8Array(16);
    root.crypto.getRandomValues(salt);
    return derive(String(password), salt, ITERATIONS).then(function (hash) {
      var record = {
        username: name,
        salt: bytesToB64(salt),
        hash: bytesToB64(hash),
        iterations: ITERATIONS,
        algo: "PBKDF2-SHA-256",
      };
      return writeRecord(record).then(function () {
        startSession(name);
        return name;
      });
    });
  }

  function login(username, password) {
    var record = readRecord();
    if (!record || !cryptoAvailable()) return Promise.resolve(false);
    var name = String(username || "").trim();
    return derive(String(password || ""), b64ToBytes(record.salt), record.iterations).then(function (hash) {
      var ok = name === record.username && equalBytes(hash, b64ToBytes(record.hash));
      if (ok) startSession(record.username);
      return ok;
    });
  }

  function logout() {
    try {
      root.sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      /* 会话清掉失败时，关闭标签页也会结束这次登录。 */
    }
  }

  function clearLocalData() {
    try {
      root.localStorage.clear();
    } catch (err) { /* ignore */ }
    try {
      root.sessionStorage.clear();
    } catch (err) { /* ignore */ }
    var live = storeSnapshot();
    if (live) {
      live.account = null;
      live.projects = [];
      return root.ComplianceLocal.persist();
    }
    return Promise.resolve();
  }

  root.ComplianceAuth = {
    cryptoAvailable: cryptoAvailable,
    hasRecord: hasRecord,
    hasSession: hasSession,
    setup: setup,
    login: login,
    logout: logout,
    clearLocalData: clearLocalData,
    recordKey: RECORD_KEY,
    sessionKey: SESSION_KEY,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
