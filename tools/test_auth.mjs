import fs from "fs";
import vm from "vm";

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

const localStorage = memoryStorage();
const sessionStorage = memoryStorage();
const sandbox = {
  crypto,
  TextEncoder,
  Uint8Array,
  btoa,
  atob,
  localStorage,
  sessionStorage,
  isSecureContext: true,
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("js/auth.js", "utf8"), sandbox, { filename: "js/auth.js" });

const auth = sandbox.ComplianceAuth;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(auth.cryptoAvailable(), "测试环境应有 WebCrypto");
assert(auth.hasRecord() === false, "一开始不应有登录记录");
assert(auth.hasSession() === false, "一开始不应有会话");

let rejected = false;
try {
  await auth.setup("dan", "short");
} catch (err) {
  rejected = err.message.includes("8");
}
assert(rejected, "短密码应被拒绝");
assert(auth.hasRecord() === false, "失败的设置不应写入记录");

await auth.setup("  dan  ", "correct-horse");
assert(auth.hasSession(), "设置成功后应进入会话");
const stored = localStorage.dump()[auth.recordKey];
assert(!stored.includes("correct-horse"), "localStorage 里不能出现密码原文");
const record = JSON.parse(stored);
assert(record.username === "dan", "用户名应去掉首尾空格");
assert(record.algo === "PBKDF2-SHA-256", record.algo);
assert(record.iterations === 210000, "迭代次数应为 210000");
assert(record.salt && record.hash, "应保存盐和哈希");

auth.logout();
assert(auth.hasSession() === false, "退出后会话应消失");
assert(auth.hasRecord(), "退出不应清掉哈希");

assert((await auth.login("dan", "wrong-password")) === false, "错误密码不能登录");
assert(auth.hasSession() === false, "错误密码不应建立会话");
assert((await auth.login("other", "correct-horse")) === false, "用户名不对不能登录");
assert((await auth.login("dan", "correct-horse")) === true, "正确密码应能登录");
assert(auth.hasSession(), "登录后应有会话");

localStorage.setItem("compliance-tool-uni8-checked-v1", "{\"EU-01\":true}");
auth.clearLocalData();
assert(auth.hasRecord() === false, "重置应清掉登录记录");
assert(auth.hasSession() === false, "重置应清掉会话");
assert(localStorage.dump()["compliance-tool-uni8-checked-v1"] == null, "重置应清掉已看过标记");

const blocked = {
  crypto,
  TextEncoder,
  Uint8Array,
  btoa,
  atob,
  localStorage: memoryStorage(),
  sessionStorage: memoryStorage(),
  isSecureContext: false,
  console,
};
blocked.globalThis = blocked;
blocked.window = blocked;
vm.createContext(blocked);
vm.runInContext(fs.readFileSync("js/auth.js", "utf8"), blocked, { filename: "js/auth.js" });
assert(blocked.ComplianceAuth.cryptoAvailable() === false, "非安全上下文不应启用 WebCrypto");

function makeNode(tag) {
  return {
    tag,
    className: "",
    attrs: {},
    children: [],
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    append(...kids) {
      this.children.push(...kids);
    },
    replaceChildren(...kids) {
      this.children = kids;
    },
  };
}
function textOf(node) {
  if (typeof node === "string") return node;
  return (node.children || []).map(textOf).join(" ");
}
const gate = makeNode("section");
blocked.document = {
  getElementById(id) {
    return id === "gate" ? gate : null;
  },
  createElement(tag) {
    return makeNode(tag);
  },
  createTextNode(text) {
    return String(text);
  },
};
blocked.location = {
  replace(url) {
    blocked.replaced = url;
  },
};
vm.runInContext(fs.readFileSync("js/login.js", "utf8"), blocked, { filename: "js/login.js" });
const gateText = textOf(gate);
assert(gateText.includes("http://127.0.0.1:8765/login.html"), "缺少登录地址提示");
assert(gateText.includes("python3 tools/serve.py"), "缺少启动命令提示");
assert(!gate.children.some((node) => node.tag === "form"), "没有 WebCrypto 时不应出现密码表单");
assert(!blocked.replaced, "没有 WebCrypto 时不应跳进清单");

console.log("auth tests passed");
