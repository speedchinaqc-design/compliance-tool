(function (root) {
  "use strict";

  function searchAll(data, projects, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    var hits = [];
    (data.markets || []).forEach(function (market) {
      if (market.market_name_zh.toLowerCase().indexOf(q) !== -1 || market.market.toLowerCase().indexOf(q) !== -1) {
        hits.push({ kind: "市场", title: market.market_name_zh, detail: market.market });
      }
      market.dimensions.forEach(function (dimension) {
        dimension.entries.forEach(function (entry) {
          var blob = [entry.id, entry.regulation_name, (entry.standard_numbers || []).join(" "), entry.authority, dimension.name_zh].join("\n").toLowerCase();
          if (blob.indexOf(q) !== -1) {
            hits.push({ kind: "要求", title: entry.id + " " + dimension.name_zh, detail: (entry.standard_numbers || []).join("；") || entry.regulation_name });
          }
        });
      });
    });
    (projects || []).forEach(function (project) {
      var bits = [project.name, project.archive && project.archive.basic && project.archive.basic.model].join(" ");
      if (bits.toLowerCase().indexOf(q) !== -1) hits.push({ kind: "产品", title: project.name, detail: bits });
      ((project.archive && project.archive.evidence) || []).forEach(function (item) {
        var blob = [item.reportNo, item.standard, item.standardVersion, item.lab, item.dropboxPath, item.type].join(" ").toLowerCase();
        if (blob.indexOf(q) !== -1) hits.push({ kind: "证据", title: project.name + " · " + (item.reportNo || item.type), detail: item.dropboxPath || "" });
      });
    });
    return hits.slice(0, 80);
  }

  root.ComplianceSearch = { searchAll: searchAll };
})(typeof globalThis !== "undefined" ? globalThis : this);
