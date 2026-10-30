/* =====================================================================
   xlsx.js — builds a REAL Excel (.xlsx) file with no libraries.
   An .xlsx file is secretly a ZIP of small XML files. So we:
     1. write the XML text for one sheet,
     2. pack the XML files into a ZIP ("store" mode = no compression),
     3. hand the bytes to the browser as a download.
   Input: rows = [[cell, cell...], ...]  (text or numbers).
   ===================================================================== */
const enc = new TextEncoder();

// ---- CRC32: a checksum that ZIP files require for each file ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- ZIP header layouts: field name -> [byte position, size in bytes] ----
// (Taken from the ZIP file format spec. ZIP stores numbers "little-endian".)
const LOCAL_HEADER = { signature: [0, 4], version: [4, 2], flags: [6, 2], method: [8, 2], time: [10, 2], date: [12, 2],
  crc: [14, 4], packedSize: [18, 4], size: [22, 4], nameLength: [26, 2], extraLength: [28, 2] };
const CENTRAL_HEADER = { signature: [0, 4], madeBy: [4, 2], version: [6, 2], flags: [8, 2], method: [10, 2], time: [12, 2],
  date: [14, 2], crc: [16, 4], packedSize: [20, 4], size: [24, 4], nameLength: [28, 2], extraLength: [30, 2],
  commentLength: [32, 2], disk: [34, 2], internalAttrs: [36, 2], externalAttrs: [38, 4], offset: [42, 4] };

// Build a header from named values. Any field we don't pass becomes 0.
function makeHeader(layout, totalBytes, values) {
  const view = new DataView(new ArrayBuffer(totalBytes));
  for (const [field, [pos, bytes]] of Object.entries(layout)) {
    const value = values[field] ?? 0;
    if (bytes === 4) view.setUint32(pos, value, true);
    else view.setUint16(pos, value, true);
  }
  return new Uint8Array(view.buffer);
}

const UTF8_FLAG = 0x0800;  // tells readers the file names are UTF-8
const DOS_DATE = 33;       // 1980-01-01, a valid placeholder date

// ---- Pack files into a ZIP. files = [{ name, text }] ----
function zip(files) {
  const parts = [], central = [];
  let offset = 0; // where the next file starts inside the ZIP
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text);
    const common = { version: 20, flags: UTF8_FLAG, method: 0, date: DOS_DATE, crc: crc32(data),
      packedSize: data.length, size: data.length, nameLength: name.length }; // method 0 = stored, no compression
    parts.push(makeHeader(LOCAL_HEADER, 30, { ...common, signature: 0x04034b50 }), name, data);
    central.push(makeHeader(CENTRAL_HEADER, 46, { ...common, signature: 0x02014b50, madeBy: 20, offset }), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22)); // "end of central directory" record
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- XML helpers ----
const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const colName = (i) => String.fromCharCode(65 + i); // 0 → A, 1 → B ...

function sheetXml(rows) {
  const body = rows.map((row, r) => {
    const cells = row.map((v, c) => {
      const ref = `${colName(c)}${r + 1}`;
      return typeof v === 'number'
        ? `<c r="${ref}"><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

// ---- Public: rows in → .xlsx Blob out ----
export function buildXlsx(rows, sheetName = 'Transactions') {
  const H = '<?xml version="1.0" encoding="UTF-8"?>';
  return zip([
    { name: '[Content_Types].xml', text: `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: '_rels/.rels', text: `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', text: `${H}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml(rows) },
  ]);
}
