// Minimal .xlsx writer (Office Open XML) — no external libraries.
// Produces a real Excel workbook: several sheets, bold/heading styles, fills,
// borders, column widths, frozen header rows and proper number formats.
//
// Usage: const bytes = buildXlsx([{ name, widths: [..], rows: [[cell, ...]], freeze: 1 }]);
// A cell is a primitive (string/number/null) or { v, s } where s is a style name:
//   "title" "subtitle" "head" "bold" "muted" "money" "moneyB" "bdt" "bdtB" "num" "numB" "int" "pct" "pctB" "hl" "hlMoney" "hlBdt" "best"

const XML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const xesc = (s) => String(s).replace(/[&<>"]/g, (c) => XML_ESC[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const BDT_FMT = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
const NUMFMTS = [[164, "#,##0.00"], [165, BDT_FMT], [166, '0.00"%"'], [167, "#,##0"], [168, "#,##0.####"]];

// cellXfs index for each style name: [numFmtId, fontId, fillId, borderId]
const STYLE_DEFS = {
  default: [0, 0, 0, 0], title: [0, 2, 0, 0], subtitle: [0, 3, 0, 0], head: [0, 1, 2, 1], bold: [0, 1, 0, 0], muted: [0, 3, 0, 0],
  money: [164, 0, 0, 0], moneyB: [164, 1, 0, 0], bdt: [165, 0, 0, 0], bdtB: [165, 1, 0, 0],
  num: [168, 0, 0, 0], numB: [168, 1, 0, 0], int: [167, 0, 0, 0], pct: [166, 0, 0, 0], pctB: [166, 1, 0, 0],
  hl: [0, 1, 3, 0], hlMoney: [164, 1, 3, 0], hlBdt: [165, 1, 3, 0], hlInt: [167, 1, 3, 0], hlPct: [166, 1, 3, 0], hlNum: [168, 1, 3, 0],
  best: [164, 4, 0, 0], bestMoney: [164, 4, 0, 0], bestBdt: [165, 4, 0, 0], wrap: [0, 0, 0, 0],
};
const STYLE_NAMES = Object.keys(STYLE_DEFS);
const styleIndex = (name) => Math.max(0, STYLE_NAMES.indexOf(name || "default"));

function stylesXml() {
  const fmts = NUMFMTS.map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${xesc(code)}"/>`).join("");
  const fonts = [
    '<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="16"/><name val="Calibri"/></font>',
    '<font><i/><sz val="10"/><color rgb="FF6E6E73"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><color rgb="FF1A7F37"/><name val="Calibri"/></font>',
  ];
  const fills = [
    '<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8E8ED"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F0F2"/><bgColor indexed="64"/></patternFill></fill>',
  ];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FF86868B"/></bottom><diagonal/></border>'];
  const xfs = STYLE_NAMES.map((n) => {
    const [fmt, font, fill, border] = STYLE_DEFS[n];
    const wrap = n === "wrap" || n === "muted" ? '<alignment wrapText="1" vertical="top"/>' : '<alignment vertical="top"/>';
    return `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${fmt ? ' applyNumberFormat="1"' : ""}${font ? ' applyFont="1"' : ""}${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""} applyAlignment="1">${wrap}</xf>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${NUMFMTS.length}">${fmts}</numFmts><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${STYLE_NAMES.length}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

const colName = (i) => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

function sheetXml(sh) {
  const rows = sh.rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      if (cell === null || cell === undefined || cell === "") return "";
      const o = typeof cell === "object" ? cell : { v: cell };
      if (o.v === null || o.v === undefined || o.v === "") return o.s ? `<c r="${colName(c)}${r + 1}" s="${styleIndex(o.s)}"/>` : "";
      const ref = `${colName(c)}${r + 1}`;
      // The lakh/crore format cannot show a minus sign, so negative taka uses the plain money format.
      const styleName = typeof o.v === "number" && o.v < 0 && /bdt/i.test(o.s || "") ? (o.s || "").replace(/bdt/i, (m) => (m[0] === "B" ? "Money" : "money")) : o.s;
      const s = styleIndex(styleName);
      if (typeof o.v === "number" && Number.isFinite(o.v)) return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(o.v)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const pane = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
  const merges = (sh.merges || []).length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData>${merges}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function safeSheetName(name, used) {
  let n = String(name).replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let base = n, k = 2;
  while (used.has(n.toLowerCase())) { n = (base.slice(0, 28) + " " + k++).slice(0, 31); }
  used.add(n.toLowerCase());
  return n;
}

export function buildXlsx(sheets, { title = "ProcureBest report", creator = "ProcureBest.com" } = {}) {
  const used = new Set();
  const names = sheets.map((s) => safeSheetName(s.name, used));
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(title)}</dc:title><dc:creator>${xesc(creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ProcureBest</Application></Properties>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": stylesXml(),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return zip(files);
}

// ---------------------------------------------------------------- ZIP (stored, no compression)
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true); local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true); cen.setUint16(28, nameBytes.length, true); cen.setUint16(30, 0, true); cen.setUint16(32, 0, true);
    cen.setUint16(34, 0, true); cen.setUint16(36, 0, true); cen.setUint32(38, 0, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}
