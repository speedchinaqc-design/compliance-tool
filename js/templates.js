(function (root) {
  "use strict";

  var OPEN = "待确认";

  function doc(id, title, modules, blocks) {
    return { id: id, kind: "document", title: title, modules: modules, blocks: blocks };
  }

  function label(id, title, modules, blocks) {
    return { id: id, kind: "label", title: title, modules: modules, blocks: blocks };
  }

  var TEMPLATES = [
    doc("doc-doc", "符合性声明（DoC）", ["电子产品", "FCC/ISED", "计量"], [
      "制造商名称：" + OPEN,
      "地址：" + OPEN,
      "产品名称 / 型号：" + OPEN,
      "本声明覆盖的法规：从本产品适用清单里抄法规名称，不要另写规划书没有的法规。",
      "标准号：只写清单里已有的标准号。付费标准原文不放进本文件，也不放进仓库。",
      "签署人、职务、地点、日期：" + OPEN,
      "签名：" + OPEN,
    ]),
    doc("doc-tech", "技术文件目录", ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], [
      "1. 产品说明与照片：" + OPEN,
      "2. 电路图、布局、BOM：" + OPEN + "（规划书没有给出 UNI-8 的材料清单）",
      "3. 适用清单中的法规与标准号（只记编号）",
      "4. 测试报告索引：报告放 Dropbox，这里只记路径和编号",
      "5. 风险评估：" + OPEN,
      "6. 标签与说明书稿：" + OPEN,
      "7. 符合性声明",
      "8. 变更记录：" + OPEN,
    ]),
    doc("doc-risk", "风险评估", ["电子产品", "电池", "CRA"], [
      "每行：危害 | 对应清单条目 | 现有答案 | 结论（" + OPEN + "） | 负责人（" + OPEN + "）",
      "加拿大纽扣电池若在范围内：依据是复函 26-005366-600，商用不自动豁免。结论仍填 " + OPEN + "，不要写成已经豁免。",
      "不要把危害描述写成新的法规义务。",
    ]),
    doc("doc-cra", "CRA 漏洞处理政策", ["CRA"], [
      "适用范围：" + OPEN + "。欧盟格子把 RED 授权法规 (EU) 2022/30 和 CRA (EU) 2024/2847 写在一起。美国、加拿大归入本模块只为筛选，不是 CRA 法规本身。",
      "对外联系点：" + OPEN,
      "接收漏洞报告的途径：" + OPEN,
      "评估与修复的内部步骤：" + OPEN,
      "法规名里写的时间：报告义务 2026-09-11，全面适用 2027-12-11。是否适用于本产品：" + OPEN,
      "记录保存位置（Dropbox 路径）：" + OPEN,
    ]),
    label("lbl-ce", "CE 标志位置", ["电子产品", "计量"], [
      "标志放置位置：" + OPEN,
      "最小高度：" + OPEN + "（按现行标志规则自行核对，这里不抄尺寸条文）",
      "用于贸易结算时，规划书认证路径写明：CE + M + NB 号。",
      "NB 号：" + OPEN,
      "是否同时出现其他标志：" + OPEN,
    ]),
    label("lbl-fcc-a", "FCC Class A 声明", ["FCC/ISED"], [
      "只在所选市场包含美国、且模块包含 FCC/ISED 时使用。",
      "样板产品规划书已确认 Part 15B Class A。若本产品不是该样板，类别：" + OPEN,
      "声明放在产品、说明书还是包装：" + OPEN,
      "负责方名称和地址：" + OPEN,
      "声明正文：按 47 CFR Part 15B 现行文本自行填写。不要把法规全文抄进本工具。",
    ]),
    label("lbl-ised", "ISED / ICES 标签", ["FCC/ISED"], [
      "只在所选市场包含加拿大时使用。",
      "规划书认证路径写的是 SDoC + 标签声明，以及无线的 IC ID。",
      "标签声明的现行措辞：" + OPEN + "（这里不预写官方句）",
      "IC ID：" + OPEN,
      "英语 / 法语：" + OPEN,
    ]),
    label("lbl-metro", "计量标志", ["计量"], [
      "欧盟：规划书写明 CE + M + NB 号。NB 号 " + OPEN + "。证书号 " + OPEN + "。",
      "美国：NTEP 型式评价取得 CC 证书。CC 号 " + OPEN + "。",
      "加拿大：型式批准取得 NOA，并检定。NOA 号 " + OPEN + "。",
      "标志位置和首次检定安排：" + OPEN,
    ]),
    label("lbl-battery", "电池警示", ["电池"], [
      "加拿大：规划书要求产品、包装、说明书有英法双语警示。英文警示 " + OPEN + "。法文警示 " + OPEN + "。",
      "复函 26-005366-600：商用不自动豁免；“仅限商用”标签本身不豁免。",
      "欧盟：法规名写有标识。具体标识稿 " + OPEN + "。可拆卸（第 11 条，2027-02-18）是否适用 " + OPEN + "。",
      "美国：Reese's Law 在矩阵里是待核实（商用秤可能不适用）。在状态改变前，不要把美国警示写成已经强制。加州高氯酸盐标识是否适用：" + OPEN + "。",
    ]),
  ];

  var WIDGETS = [
    { id: "checklist", title: "合规清单", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "按所选市场、模块和问答生成适用条目。" },
    { id: "modules", title: "模块", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "显示这一产品勾选的模块，以及各模块在矩阵里的范围。" },
    { id: "documents", title: "文件模板", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "DoC、技术文件目录、风险评估；勾选 CRA 时加上漏洞处理政策。" },
    { id: "labels", title: "标签模板", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "CE、FCC Class A、ISED、计量标志、电池警示的空表，正文待确认。" },
    { id: "tests", title: "产品测试与证书到期", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "每条适用要求一条测试进度，可填证书到期日。" },
    { id: "ai", title: "AI判断结果导入", modules: ["电子产品", "电池", "CRA", "FCC/ISED", "计量"], text: "本工具不做判断。把说明书发给 Dan Bot 后，再导入结果文件。" },
  ];

  function overlaps(left, right) {
    return left.some(function (item) { return right.indexOf(item) !== -1; });
  }

  function forModules(modules, kind) {
    return TEMPLATES.filter(function (item) {
      if (kind && item.kind !== kind) return false;
      return overlaps(item.modules, modules);
    });
  }

  root.ComplianceTemplates = {
    all: TEMPLATES,
    widgets: WIDGETS,
    forModules: forModules,
    overlaps: overlaps,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
