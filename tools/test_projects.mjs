import fs from "fs";
import vm from "vm";

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); },
  };
}

const sandbox = {
  crypto,
  TextEncoder,
  Uint8Array,
  localStorage: memoryStorage(),
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  isNaN,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["js/logic.js", "js/data.js", "js/store.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const store = sandbox.ComplianceStore;
const logic = sandbox.ComplianceLogic;
const data = sandbox.COMPLIANCE_DATA;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(data.modules.map((item) => item.id).join(",") === "电子产品,电池,CRA,FCC/ISED,计量", "模块目录不对");
const tagged = data.markets.flatMap((market) => market.dimensions.flatMap((dim) => dim.entries));
assert(tagged.length === 24, "仍然应是 24 条");
assert(tagged.every((entry) => entry.modules && entry.modules.length), "每条都要有模块");
assert(tagged.find((entry) => entry.id === "US-06").modules.join(",") === "FCC/ISED", "美国无线应只标 FCC/ISED");
assert(tagged.find((entry) => entry.id === "EU-06").modules.join(",") === "电子产品", "欧盟无线不标成 FCC/ISED");
assert(tagged.find((entry) => entry.id === "CA-07").modules[0] === "电池", "加拿大电池模块");

const uni = store.uni8Project();
const batteryRows = logic.visibleRows(data, {
  markets: { EU: true, CA: true, US: true },
  modules: ["电池"],
  attrs: uni.answers,
  view: "checklist",
  dimensionCode: "08",
  query: "",
});
assert(batteryRows.length === 3, "只选电池模块时应剩 3 条，实际 " + batteryRows.length);
assert(batteryRows.every((row) => row.entry.modules.indexOf("电池") !== -1), "滤出的条目应含电池模块");

store.seedIfEmpty();
assert(store.load().length === 1 && store.load()[0].name === "UNI-8", "空库应种入 UNI-8");
const copy = store.duplicate("uni-8-sample");
assert(copy.name === "UNI-8 副本" && copy.id !== "uni-8-sample", "复制应换 id");
store.rename(copy.id, "UNI-8B");
assert(store.get(copy.id).name === "UNI-8B", "重命名失败");
store.remove(copy.id);
assert(store.load().length === 1, "删除后应剩样板");

const yaml = fs.readFileSync("docs/ai-judgment.sample.json", "utf8").replace(
  '"requirement": "CA-07"',
  '"requirement": "CA-07"'
);
const fromJson = store.parseJudgmentText(fs.readFileSync("docs/ai-judgment.sample.json", "utf8"));
const merged = store.mergeJudgments(store.get("uni-8-sample"), fromJson);
assert(merged.merged === 1 && merged.skipped === 0, "JSON 判断应并入 1 条");
assert(merged.project.aiJudgments[0].status === "待核实", "状态应保留待核实");
assert(!JSON.stringify(merged.project.aiJudgments).includes("correct-horse"), "判断文件不应夹带密码");

const yamlText = `
note: 格式示例
judgments:
  - requirement: EU-07
    market: EU
    module: 电池
    layer1:
      regulation: 待确认
      official_link: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/eu-battery-regulation_en
    layer2:
      standard: 待确认
      dropbox_path: /合规知识库/02_产品/UNI-8/EU/07BATT/
      link: ""
    conclusion: 待确认
    source: 测试
    status: 待确认
`;
const fromYaml = store.parseJudgmentText(yamlText);
assert(fromYaml.judgments[0].layer1.regulation === "待确认", "YAML 第一层法规");
assert(fromYaml.judgments[0].layer2.dropbox_path.indexOf("/合规知识库/") === 0, "YAML Dropbox 路径");
const again = store.mergeJudgments(merged.project, fromYaml);
assert(again.project.aiJudgments.length === 2, "不同 requirement 应追加");
const bad = store.mergeJudgments(again.project, { judgments: [{ requirement: "EU-01", status: "随便写" }] });
assert(bad.skipped === 1, "非法状态应跳过");

const sample = store.uni8Project();
assert(sample.archive.evidence[0].reportNo.indexOf("非真实编号") !== -1, "示例证据不能写成真实编号");
assert(sample.archive.correspondence[0].ref === "26-005366-600", "应保留复函编号");
assert(sample.archive.correspondence[0].requirementIds[0] === "CA-07", "往来应连到 CA-07");
const pack = store.auditPack(sample, "CA", false);
assert(!pack.sensitive, "审核包默认不含敏感信息");
assert(pack.schedule[0].fee == null, "默认不导出费用");
assert(pack.evidence.length === 1, "加拿大审核包应有那条示例证据");
const withFee = store.auditPack(sample, "CA", true);
assert(withFee.sensitive && withFee.schedule[0].fee, "勾选后才带费用");
const compared = store.mergeComparisons(sample, {
  comparisons: [{ requirement: "EU-08", market: "EU", module: "计量", status: "✅符合", reason: "待确认", source: "示例", dropbox_path: "/合规知识库/02_产品/UNI-8/EU/08METRO/", page: "1" }],
});
assert(compared.merged === 1, "对比结果应并入");
assert(sample.archive.comparisons.some((item) => item.requirement === "EU-08" && item.status === "符合"), "✅符合 应规范成 符合");
const entry = data.markets.flatMap((market) => market.dimensions.flatMap((dim) => dim.entries)).find((item) => item.id === "CA-07");
assert(store.versionGap(sample.archive.evidence[0], entry) === "版本一致", "2023 应与清单里的 ANSI/UL 4200A-2023 一致");
assert(store.modelGaps(sample).length === 1, "未覆盖的示例型号应被标出");
const exported = JSON.stringify(store.exportPayload([sample]));
assert(exported.indexOf("26-005366-600") !== -1 && exported.indexOf("非真实编号") !== -1, "导出 JSON 应含档案");

const flagged = store.applyRegulationUpdates([sample], {
  updates: [{ requirement: "CA-07", source_url: "https://example.com/ca", detected_at: "2026-11-04", summary: "来源页有变化" }],
});
assert(flagged === 1 && sample.reviews["CA-07"].status === "需要复核", "应标记需要复核");

const legacy = store.blankArchive();
legacy.basic.photoPath = "/合规知识库/02_产品/UNI-8/照片_待确认/";
legacy.basic.variants = "UNI-8B、8P、8EV、8RP、";
legacy.basic.status = "送测";
legacy.basic.statusNote = "旧说明";
legacy.basic.launchDates = { EU: "2026-03-01", CA: "", US: "" };
delete legacy.basic.variantRows;
assert(store.migrateVariants(legacy) === true, "旧变体字符串应迁移");
assert(legacy.basic.variants.join("、") === "UNI-8B、8P、8EV、8RP", "空段应丢掉，型号保留");
assert(legacy.basic.variantRows.filter((row) => row.model).length === 4, "应拆成 4 行");
assert(legacy.basic.variantRows.length >= 6, "默认至少 6 行");
assert(legacy.basic.variantRows[0].status === "送测" && legacy.basic.variantRows[3].status === "送测", "旧状态应复制到每一行");
assert(legacy.basic.variantRows[0].statusNote === "旧说明" && legacy.basic.variantRows[2].launchDates.EU === "2026-03-01", "说明和上市日期应复制");
assert(legacy.basic.status === "送测" && legacy.basic.launchDates.EU === "2026-03-01", "产品级旧字段要留着");
assert(legacy.basic.photoPath.indexOf("照片_待确认") !== -1, "主型号照片路径不能丢");
assert(store.aggregateStatus(legacy.basic) === "未上市", "都还没上市");
legacy.basic.variantRows[0].status = "已上市";
assert(store.aggregateStatus(legacy.basic) === "部分已上市");
legacy.basic.variantRows.forEach((row) => { if (row.model) row.status = "已上市"; });
assert(store.aggregateStatus(legacy.basic) === "全部已上市");
const snapshot = JSON.stringify(legacy.basic.variantRows);
assert(store.migrateVariants(legacy) === false, "再次迁移不能改行");
assert(JSON.stringify(legacy.basic.variantRows) === snapshot, "迁移应幂等");

const waived = store.uni8Project();
const missing = { requirement: "EU-07", market: "EU", status: "缺失", reason: "", source: "", dropboxPath: "", page: "" };
assert(store.countsAsMissing(waived, missing), "未决定时缺失仍要计数");
waived.tests["EU-07"] = { status: store.WAIVER_STATUS, decider: "", decidedOn: "", note: "先不做" };
assert(!store.countsAsMissing(waived, missing), "决定先不做测试后不计入缺失");
assert(store.waiverRecords(waived)[0].complete === false, "缺决定人时应标未完成");
waived.tests["EU-07"].decider = "王敏";
waived.tests["EU-07"].decidedOn = "2026-11-01";
assert(store.waiverRecords(waived)[0].complete === true && store.waiverRecords(waived)[0].note === "先不做");
const packWithDecision = store.auditPack(waived, "EU", false);
assert(packWithDecision.testDecisions.length === 1, "审核包应带上测试决定");
assert(packWithDecision.technicalIndex.some((line) => line.indexOf("王敏") !== -1), "技术文件目录应写决定人");
console.log("project tests passed");
