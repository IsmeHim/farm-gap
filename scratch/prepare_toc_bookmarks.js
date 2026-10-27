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

function getText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map(t => t[1])
    .join('')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = readZipEntries('Research-Paper.docx');
const docEntry = entries.find(e => e.name === 'word/document.xml');
let docXml = docEntry.data.toString('utf8');

// First, fix the 5 Chapter 3 figure titles in สารบัญภาพ so they match the actual Chapter 3 figures:
// In Chapter 3:
// ภาพที่ 3.1 แผนภาพกรณีใช้งานของระบบ (Use Case Diagram)
// ภาพที่ 3.2 สถาปัตยกรรมของระบบ FarmGAP (System Architecture)
// ภาพที่ 3.3 แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)
// ภาพที่ 3.4 แผนภาพกระแสข้อมูลระดับที่ 1 (Data Flow Diagram Level 1)
// ภาพที่ 3.5 แผนภาพความสัมพันธ์ของข้อมูล (Entity-Relationship Diagram: ER Diagram)
const lofFixes = [
  {
    oldText: 'ภาพที่ 3.1 สถาปัตยกรรมของระบบ FarmGAP (System Architecture)',
    newText: 'ภาพที่ 3.1 แผนภาพกรณีใช้งานของระบบ (Use Case Diagram)',
  },
  {
    oldText: 'ภาพที่ 3.2 แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)',
    newText: 'ภาพที่ 3.2 สถาปัตยกรรมของระบบ FarmGAP (System Architecture)',
  },
  {
    oldText: 'ภาพที่ 3.3 แผนภาพกระแสข้อมูลระดับที่ 1 (Data Flow Diagram Level 1)',
    newText: 'ภาพที่ 3.3 แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)',
  },
  {
    oldText: 'ภาพที่ 3.4 แผนภาพกรณีใช้งานของระบบ (Use Case Diagram)',
    newText: 'ภาพที่ 3.4 แผนภาพกระแสข้อมูลระดับที่ 1 (Data Flow Diagram Level 1)',
  },
];

// Perform LOF text replacements carefully using placeholders so they don't collide
lofFixes.forEach((f, idx) => {
  docXml = docXml.replace(`<w:t>${f.oldText}</w:t>`, `<w:t>__LOF_FIX_${idx}__</w:t>`);
});
lofFixes.forEach((f, idx) => {
  docXml = docXml.replace(`<w:t>__LOF_FIX_${idx}__</w:t>`, `<w:t>${f.newText}</w:t>`);
});

// Remove any existing _TocTarget_ bookmarks if re-running
docXml = docXml.replace(/<w:bookmarkStart w:id="9\d\d\d" w:name="_TocTarget_\d+"\/>/g, '');
docXml = docXml.replace(/<w:bookmarkEnd w:id="9\d\d\d"\/>/g, '');

// Parse all paragraphs
const pMatches = [...docXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
const paragraphs = pMatches.map((m, idx) => {
  const pXml = m[0];
  const text = getText(pXml);
  const isToc = pXml.includes('<w:tab/>') && pXml.includes('w:leader="dot"');
  return { idx, text, isToc, pXml, start: m.index, end: m.index + pXml.length };
});

const tocLines = paragraphs.filter(p => p.isToc);
console.log(`Found ${tocLines.length} TOC/LOT/LOF lines`);

const mappingReport = [];
const targetBookmarkInsertions = new Map(); // p.idx -> bookmarkName

tocLines.forEach((toc, tocIdx) => {
  const tabPos = toc.pXml.indexOf('<w:tab/>');
  const leftText = getText(toc.pXml.slice(0, tabPos));
  const oldPage = getText(toc.pXml.slice(tabPos));

  // Find target paragraph in the body (non-TOC)
  let target = paragraphs.find(p => !p.isToc && p.text === leftText);
  if (!target) {
    // Exact match on first 2 words for "บทที่ X ..." or "ภาคผนวก X ..."
    const tokens = leftText.split(' ');
    const prefix2 = tokens.slice(0, 2).join(' ');
    if (leftText.startsWith('บทที่ ') || leftText.startsWith('ภาคผนวก ')) {
      target = paragraphs.find(p => !p.isToc && p.text === prefix2);
    } else {
      target = paragraphs.find(p => !p.isToc && (p.text === prefix2 || p.text.startsWith(prefix2 + ' ')));
    }
  }
  if (!target) {
    throw new Error(`Could not find target paragraph for TOC line: "${leftText}"`);
  }

  const bmName = `_TocTarget_${tocIdx}`;
  const bmId = 9000 + tocIdx;
  if (!targetBookmarkInsertions.has(target.idx)) {
    targetBookmarkInsertions.set(target.idx, []);
  }
  targetBookmarkInsertions.get(target.idx).push({ bmName, bmId });

  mappingReport.push({
    tocIdx,
    tocParagraphIdx: toc.idx,
    leftText,
    oldPage,
    targetParagraphIdx: target.idx,
    targetText: target.text,
    bmName,
  });
});

// Insert bookmarks into target paragraphs from back to front so offsets stay valid
const sortedTargetIdxs = [...targetBookmarkInsertions.keys()].sort((a, b) => b - a);
for (const pIdx of sortedTargetIdxs) {
  const p = paragraphs[pIdx];
  const bms = targetBookmarkInsertions.get(pIdx);
  const starts = bms.map(b => `<w:bookmarkStart w:id="${b.bmId}" w:name="${b.bmName}"/>`).join('');
  const ends = bms.map(b => `<w:bookmarkEnd w:id="${b.bmId}"/>`).join('');
  // Insert right before </w:p>
  const newPXml = p.pXml.replace(/<\/w:p>$/, `${starts}${ends}</w:p>`);
  docXml = docXml.slice(0, p.start) + newPXml + docXml.slice(p.end);
}

docEntry.data = Buffer.from(docXml, 'utf8');
writeZipEntries('Research-Paper.docx', entries);
fs.writeFileSync('scratch/toc_mapping.json', JSON.stringify(mappingReport, null, 2), 'utf8');
console.log('✅ Inserted 100 bookmarks into Research-Paper.docx and saved scratch/toc_mapping.json');
