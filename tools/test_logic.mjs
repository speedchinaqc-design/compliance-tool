import fs from "fs";
import vm from "vm";
import { execFileSync } from "child_process";

for (const file of ["js/xlsx.js", "js/logic.js", "js/data.js"]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const { ComplianceLogic, COMPLIANCE_DATA, buildXlsx, xlsxCrc32 } = globalThis;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const crc = xlsxCrc32(new TextEncoder().encode("123456789"));
assert(crc === 0xcbf43926, "crc32 测试向量不对：" + crc.toString(16));

const defaults = ComplianceLogic.defaultState(COMPLIANCE_DATA);
assert(defaults.attrs.has_wifi === true, "默认应有 Wi-Fi");
assert(defaults.attrs.has_battery === true, "默认应有电池");
assert(defaults.attrs.battery_mount === "unknown", "电池安装方式默认未知");
assert(defaults.attrs.legal_for_trade === true, "默认为贸易结算");
assert(defaults.attrs.b2b_login_only === false, "默认不假设仅 B2B");
assert(defaults.attrs.processes_personal_data === false, "默认不假设处理个人数据");

const checklist = ComplianceLogic.visibleRows(COMPLIANCE_DATA, defaults);
assert(checklist.length === 24, "样板清单应为 24 条，实际 " + checklist.length);
assert(checklist.some((row) => row.entry.id === "CA-07"), "应包含加拿大电池");
assert(checklist.some((row) => row.entry.id === "CA-01" && row.entry.status === "N/A"), "加拿大网络安全应为 N/A");

const wifiOff = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  attrs: { ...defaults.attrs, has_wifi: false },
});
assert(wifiOff.length === 18, "关掉 Wi-Fi 后应为 18 条，实际 " + wifiOff.length);
assert(!wifiOff.some((row) => row.dimension.code === "01" || row.dimension.code === "06"), "关掉 Wi-Fi 后不应再列无线和网络安全");

const batteryOff = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  attrs: { ...defaults.attrs, has_battery: false },
});
assert(batteryOff.length === 21, "关掉电池后应为 21 条，实际 " + batteryOff.length);
assert(!batteryOff.some((row) => row.dimension.code === "07"), "关掉电池后不应再列电池");

const tradeOff = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  attrs: { ...defaults.attrs, legal_for_trade: false },
});
assert(tradeOff.length === 21, "关掉贸易结算后应为 21 条，实际 " + tradeOff.length);
assert(!tradeOff.some((row) => row.dimension.code === "08"), "关掉贸易结算后不应再列法制计量");

const marketView = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  view: "market",
  attrs: { ...defaults.attrs, has_wifi: false },
});
const hiddenRadio = marketView.find((row) => row.entry.id === "EU-06");
assert(hiddenRadio && hiddenRadio.applies === false, "按市场视图仍应显示不适用的无线条目");

const canadaOnly = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  markets: { EU: false, CA: true, US: false },
});
assert(canadaOnly.length === 8, "只选加拿大应为 8 条，实际 " + canadaOnly.length);

const radioView = ComplianceLogic.visibleRows(COMPLIANCE_DATA, { ...defaults, view: "dimension", dimensionCode: "06" });
assert(radioView.length === 3, "按维度看无线应为 3 个市场");
assert(radioView[1].matrixKey === "CA-06", "市场顺序应为欧、加、美，第二行是 CA-06，实际 " + radioView[1].matrixKey);
assert(radioView[1].folder === "/合规知识库/02_产品/UNI-8/CA/06RADIO/", "Dropbox 文件夹不对：" + radioView[1].folder);
assert(radioView[1].filenamePattern.startsWith("UNI-8_CA_06RADIO_"), "文件名规则不对");

const caBattery = checklist.find((row) => row.entry.id === "CA-07");
assert(caBattery.folder === "/合规知识库/02_产品/UNI-8/CA/07BATT/", caBattery.folder);
assert(caBattery.matrixKey === "CA-07", caBattery.matrixKey);
assert(caBattery.entry.status === "已核实", "加拿大电池应为已核实");
assert(caBattery.entry.obligation.includes("强制风险"), "应保留强制性原文");
assert(caBattery.notes.some((note) => note.includes("无需 B2B")), "未选 B2B 时应提示个人可获得");
assert(caBattery.entry.health_canada_reply.conclusion.includes("逐案判断"), "应带上复函结论");
assert(caBattery.entry.label_requirements.includes("英法双语警示"), "标签要求应来自规划书原文");

const b2b = ComplianceLogic.visibleRows(COMPLIANCE_DATA, {
  ...defaults,
  attrs: { ...defaults.attrs, b2b_login_only: true, battery_mount: "soldered" },
}).find((row) => row.entry.id === "CA-07");
assert(b2b.notes.some((note) => note.includes("仅限商用")), "B2B 提示应引用复函");
assert(b2b.notes.some((note) => note.includes("澳洲")), "焊接不应套用澳洲豁免");

const usPack = checklist.find((row) => row.entry.id === "US-02");
assert(usPack.entry.status === "待核实", "美国包装应为待核实");
assert(usPack.entry.source_url === "https://calrecycle.ca.gov/packaging/packaging-epr/", "美国包装 URL 被改动");

const gdpr = checklist.find((row) => row.entry.id === "EU-03");
assert(gdpr.entry.obligation.includes("视情况"), "GDPR 强制性原文应保留");
assert(gdpr.conditional && gdpr.conditional.on === false, "未勾选处理个人数据时应标明");

const queried = ComplianceLogic.visibleRows(COMPLIANCE_DATA, { ...defaults, query: "PIPEDA" });
assert(queried.length === 1 && queried[0].entry.id === "CA-03", "搜索 PIPEDA 应只剩加拿大数据保护");

const urls = new Set();
COMPLIANCE_DATA.markets.forEach((market) => {
  market.dimensions.forEach((dimension) => {
    dimension.entries.forEach((entry) => urls.add(entry.source_url));
  });
});
assert(urls.size === 21, "去重后来源 URL 应为 21 个，实际 " + urls.size);

const table = ComplianceLogic.exportTable(checklist, defaults, COMPLIANCE_DATA.product);
assert(table.sheets[0].rows[0].includes("法规名称"), "导出表应有法规名称列");
assert(table.sheets[0].rows[1][1] === "欧盟", "导出行应按欧盟开头");
assert(table.sheets[1].rows.some((row) => row[0].includes("纽扣电池")), "筛选表应记下电池属性");

const bytes = buildXlsx(table.sheets);
fs.writeFileSync("/tmp/uni8-checklist.xlsx", bytes);
const listing = execFileSync("python3", ["-c", `
import zipfile
from xml.etree import ElementTree as ET
z = zipfile.ZipFile("/tmp/uni8-checklist.xlsx")
names = set(z.namelist())
assert "[Content_Types].xml" in names
assert "xl/worksheets/sheet1.xml" in names
ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
def texts(name):
    root = ET.fromstring(z.read(name))
    return [t.text or "" for t in root.findall(".//m:t", ns)], root
sheet1, root1 = texts("xl/worksheets/sheet1.xml")
blob = "\\n".join(sheet1)
assert "欧盟" in blob
assert "https://eur-lex.europa.eu/eli/dir/2014/31/oj" in blob
assert "加拿大" in blob
sheet2, root2 = texts("xl/worksheets/sheet2.xml")
assert any("石田" in item for item in sheet2)
print("xlsx rows", len(root1.findall(".//m:row", ns)), "cells", len(sheet1))
`], { encoding: "utf8" });
console.log(listing.trim());
console.log("logic tests passed");
