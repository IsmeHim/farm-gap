const fs = require('fs');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cdCount = buf.readUInt16LE(eocd + 10);
  let cdPos = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < cdCount; i++) {
    const compMethod = buf.readUInt16LE(cdPos + 10);
    const compSize = buf.readUInt32LE(cdPos + 20);
    const nameLen = buf.readUInt16LE(cdPos + 28);
    const extraLen = buf.readUInt16LE(cdPos + 30);
    const commentLen = buf.readUInt16LE(cdPos + 32);
    const localHeaderOffset = buf.readUInt32LE(cdPos + 42);
    const name = buf.slice(cdPos + 46, cdPos + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);
    const data = compMethod === 8 ? zlib.inflateRawSync(compData) : compData;
    entries.push({ name, data, compMethod });
    cdPos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function writeZipEntries(zipPath, entries) {
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompData = entry.data;
    const crc = crc32(uncompData);
    const compData = entry.compMethod === 8
      ? zlib.deflateRawSync(uncompData, { level: 6 })
      : uncompData;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(entry.compMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compData.length, 18);
    localHeader.writeUInt32LE(uncompData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(entry.compMethod, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compData.length, 20);
    cdHeader.writeUInt32LE(uncompData.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(cdHeader, 46);

    localParts.push(localHeader, compData);
    cdParts.push(cdHeader);
    offset += localHeader.length + compData.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...localParts, cdBuf, eocd]));
}

const THAI_LETTERS = [
  'ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ',
  'ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท',
  'ธ', 'น', 'บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม',
  'ย', 'ร', 'ล', 'ว', 'ศ', 'ษ', 'ส', 'ห', 'ฬ', 'อ', 'ฮ'
];

const mapping = JSON.parse(fs.readFileSync('scratch/toc_mapping.json', 'utf8').replace(/^\uFEFF/, ''));
const wordPages = JSON.parse(fs.readFileSync('scratch/word_pages.json', 'utf8').replace(/^\uFEFF/, ''));

const entries = readZipEntries('Research-Paper.docx');
const docEntry = entries.find(e => e.name === 'word/document.xml');
let docXml = docEntry.data.toString('utf8');

// 1. Update <w:sectPr> across all 21 sections with schema-valid <w:pgNumType> before <w:cols>
let sectCounter = 0;
docXml = docXml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, (sectXml) => {
  sectCounter++;
  // Remove any existing <w:pgNumType .../>
  let cleaned = sectXml.replace(/<w:pgNumType[^/>]*\/>/g, '');
  let pgNumTag = '';
  if (sectCounter === 1) {
    // Section 1: Cover + Inner Cover (no page numbering)
    pgNumTag = '';
  } else if (sectCounter === 2) {
    // Section 2: บทคัดย่อ starts at ก (thaiLetters, start=1)
    pgNumTag = '<w:pgNumType w:fmt="thaiLetters" w:start="1"/>';
  } else if (sectCounter >= 3 && sectCounter <= 7) {
    // Sections 3..7: ABSTRACT, กิตติกรรมประกาศ, สารบัญ, สารบัญตาราง, สารบัญภาพ (continue thaiLetters)
    pgNumTag = '<w:pgNumType w:fmt="thaiLetters"/>';
  } else if (sectCounter === 8) {
    // Section 8: บทที่ 1 starts at 1 (decimal, start=1)
    pgNumTag = '<w:pgNumType w:fmt="decimal" w:start="1"/>';
  } else {
    // Sections 9..21: บทที่ 2..5, บรรณานุกรม, ภาคผนวก ก..ซ (continue decimal)
    pgNumTag = '<w:pgNumType w:fmt="decimal"/>';
  }

  if (pgNumTag) {
    cleaned = cleaned.replace('<w:cols ', `${pgNumTag}<w:cols `);
  }
  return cleaned;
});
console.log(`✅ Configured <w:pgNumType> across ${sectCounter} sections.`);

// 2. Update cached header values in word/header*.xml
const headerCacheUpdates = {
  'word/header2.xml': 'ก',
  'word/header3.xml': 'ค',
  'word/header4.xml': 'จ',
  'word/header5.xml': 'ฉ',
  'word/header6.xml': 'ฌ',
  'word/header7.xml': 'ฎ',
  'word/header8.xml': '2',
  'word/header10.xml': '12',
  'word/header12.xml': '21',
  'word/header14.xml': '49',
  'word/header16.xml': '62',
  'word/header18.xml': '67',
  'word/header20.xml': '70',
  'word/header22.xml': '75',
};

for (const [hdrName, newVal] of Object.entries(headerCacheUpdates)) {
  const hdrEntry = entries.find(e => e.name === hdrName);
  if (hdrEntry) {
    let hdrXml = hdrEntry.data.toString('utf8');
    hdrXml = hdrXml.replace(/(<w:fldChar w:fldCharType="separate"\/>[\s\S]*?<w:t>)[\s\S]*?(<\/w:t>)/, `$1${newVal}$2`);
    hdrEntry.data = Buffer.from(hdrXml, 'utf8');
  }
}

// 3. Update all 100 TOC, LOT, and LOF lines in word/document.xml
// Note: Cover takes 2 physical pages (1..2).
// Front matter takes 11 physical pages (3..13 -> ก..ฎ, where index = physPage - 3).
// Chapter 1 starts at physical page 14 -> Content page 1 (contentPage = physPage - 13).
const pMatches = [...docXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
const tocLines = pMatches
  .map((m, idx) => ({ idx, pXml: m[0], start: m.index, end: m.index + m[0].length }))
  .filter(p => p.pXml.includes('<w:tab/>') && p.pXml.includes('w:leader="dot"'));

const summaryLines = [];

for (let i = tocLines.length - 1; i >= 0; i--) {
  const toc = tocLines[i];
  const mapItem = mapping[i];
  const pageInfo = wordPages[mapItem.bmName];
  const physPage = pageInfo.adjPage;

  let newPageStr;
  if (i < 6) {
    // Front matter: physPage 3 -> ก (index 0)
    const letterIdx = physPage - 3;
    newPageStr = THAI_LETTERS[letterIdx];
  } else {
    // Content & Back matter: physPage 14 -> 1
    newPageStr = String(physPage - 13);
  }

  summaryLines.unshift({ idx: i + 1, title: mapItem.leftText, page: newPageStr });

  const tabPos = toc.pXml.indexOf('<w:tab/>');
  const beforeTab = toc.pXml.slice(0, tabPos + '<w:tab/>'.length);
  const afterTab = toc.pXml.slice(tabPos + '<w:tab/>'.length).replace(
    /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/,
    `<w:t>${newPageStr}</w:t>`
  );
  const newPXml = beforeTab + afterTab;
  docXml = docXml.slice(0, toc.start) + newPXml + docXml.slice(toc.end);
}

// Also remove temporary _TocTarget_ bookmarks so the document stays clean
docXml = docXml.replace(/<w:bookmarkStart w:id="9\d\d\d" w:name="_TocTarget_\d+"\/>/g, '');
docXml = docXml.replace(/<w:bookmarkEnd w:id="9\d\d\d"\/>/g, '');

docEntry.data = Buffer.from(docXml, 'utf8');
writeZipEntries('Research-Paper.docx', entries);

for (const item of summaryLines) {
  console.log(`[#${item.idx}] ${item.title} -> ${item.page}`);
}
console.log('🎉 Updated all sections, headers, and 100 TOC/LOT/LOF entries in Research-Paper.docx!');
