(function (root) {
  "use strict";

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    const total = parts.reduce(function (sum, part) {
      return sum + part.length;
    }, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach(function (part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function u16(value) {
    return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
  }

  function u32(value) {
    return new Uint8Array([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);
  }

  function textBytes(value) {
    return new TextEncoder().encode(String(value == null ? "" : value));
  }

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function colName(index) {
    let n = index + 1;
    let name = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function sheetXml(rows) {
    const xmlRows = rows.map(function (row, rowIndex) {
      const cells = row.map(function (value, colIndex) {
        const style = rowIndex === 0 ? ' s="1"' : ' s="2"';
        const text = xmlEscape(String(value == null ? "" : value).slice(0, 32000));
        return (
          '<c r="' +
          colName(colIndex) +
          (rowIndex + 1) +
          '" t="inlineStr"' +
          style +
          '><is><t xml:space="preserve">' +
          text +
          "</t></is></c>"
        );
      });
      return '<row r="' + (rowIndex + 1) + '">' + cells.join("") + "</row>";
    });
    const width = rows.reduce(function (max, row) {
      return Math.max(max, row.length);
    }, 1);
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      "<cols>" +
      '<col min="1" max="' +
      width +
      '" width="24" customWidth="1"/>' +
      '<col min="10" max="10" width="56" customWidth="1"/>' +
      '<col min="16" max="18" width="42" customWidth="1"/>' +
      '<col min="21" max="23" width="46" customWidth="1"/>' +
      "</cols>" +
      "<sheetData>" +
      xmlRows.join("") +
      "</sheetData></worksheet>"
    );
  }

  function stylesXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      "</fonts>" +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF123C38"/><bgColor indexed="64"/></patternFill></fill>' +
      "</fills>" +
      '<borders count="1"><border><left/><right/><top/><bottom/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
      "</cellXfs></styleSheet>"
    );
  }

  function workbookXml(names) {
    const sheets = names
      .map(function (name, index) {
        return '<sheet name="' + xmlEscape(name) + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>';
      })
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets>" +
      sheets +
      "</sheets></workbook>"
    );
  }

  function workbookRels(count) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      items.push(
        '<Relationship Id="rId' +
          (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) +
          '.xml"/>'
      );
    }
    items.push(
      '<Relationship Id="rId' +
        (count + 1) +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    );
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      items.join("") +
      "</Relationships>"
    );
  }

  function contentTypes(count) {
    const overrides = [
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ];
    for (let i = 0; i < count; i += 1) {
      overrides.push(
        '<Override PartName="/xl/worksheets/sheet' +
          (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      );
    }
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      overrides.join("") +
      "</Types>"
    );
  }

  function zipStore(files) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    // 2026-11-03 08:00，固定时间，避免同一张表每次字节都变。
    const time = 8 << 11;
    const date = (46 << 9) | (11 << 5) | 3;
    files.forEach(function (file) {
      const name = encoder.encode(file.name);
      const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(time),
        u16(date),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
        data,
      ]);
      const central = concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(time),
        u16(date),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const centralDir = concat(centrals);
    const eocd = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralDir.length),
      u32(offset),
      u16(0),
    ]);
    return concat(locals.concat([centralDir, eocd]));
  }

  function buildXlsx(sheets) {
    const files = [
      {
        name: "[Content_Types].xml",
        data: contentTypes(sheets.length),
      },
      {
        name: "_rels/.rels",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>",
      },
      { name: "xl/workbook.xml", data: workbookXml(sheets.map(function (sheet) { return sheet.name; })) },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels(sheets.length) },
      { name: "xl/styles.xml", data: stylesXml() },
    ];
    sheets.forEach(function (sheet, index) {
      files.push({ name: "xl/worksheets/sheet" + (index + 1) + ".xml", data: sheetXml(sheet.rows) });
    });
    return zipStore(files);
  }

  root.buildXlsx = buildXlsx;
  root.xlsxCrc32 = crc32;
})(typeof globalThis !== "undefined" ? globalThis : this);
