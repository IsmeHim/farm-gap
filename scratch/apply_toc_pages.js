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

const mapping = JSON.parse(fs.readFileSync('scratch/toc_mapping.json', 'utf8').replace(/^\uFEFF/, ''));
const wordPages = JSON.parse(fs.readFileSync('scratch/word_pages.json', 'utf8').replace(/^\uFEFF/, ''));

// Ensure Chapter 2, 3, 4, 5 headings match their chapter start pages (same page as 2.1, 3.1, 4.1, 5.1)
wordPages['_TocTarget_15'] = wordPages['_TocTarget_16']; // บทที่ 2 -> 24
wordPages['_TocTarget_24'] = wordPages['_TocTarget_25']; // บทที่ 3 -> 33
wordPages['_TocTarget_33'] = wordPages['_TocTarget_34']; // บทที่ 4 -> 61
wordPages['_TocTarget_40'] = wordPages['_TocTarget_41']; // บทที่ 5 -> 74
fs.writeFileSync('scratch/word_pages.json', JSON.stringify(wordPages, null, 2), 'utf8');

const entries = readZipEntries('Research-Paper.docx');
const docEntry = entries.find(e => e.name === 'word/document.xml');
let docXml = docEntry.data.toString('utf8');

const pMatches = [...docXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
const tocLines = pMatches
  .map((m, idx) => ({ idx, pXml: m[0], start: m.index, end: m.index + m[0].length }))
  .filter(p => p.pXml.includes('<w:tab/>') && p.pXml.includes('w:leader="dot"'));

if (tocLines.length !== mapping.length) {
  throw new Error(`TOC line count mismatch: ${tocLines.length} vs ${mapping.length}`);
}

let changedCount = 0;
// Replace from back to front so string indices remain valid
for (let i = tocLines.length - 1; i >= 0; i--) {
  const toc = tocLines[i];
  const mapItem = mapping[i];
  const pageInfo = wordPages[mapItem.bmName];
  if (!pageInfo) throw new Error(`Missing page info for ${mapItem.bmName}`);
  const newPageStr = String(pageInfo.adjPage);

  if (mapItem.oldPage !== newPageStr) {
    changedCount++;
    console.log(`[#${i + 1}] "${mapItem.leftText}": ${mapItem.oldPage} -> ${newPageStr}`);
  } else {
    console.log(`[#${i + 1}] "${mapItem.leftText}": ${newPageStr} (unchanged)`);
  }

  // Update the page number after <w:tab/> inside this TOC paragraph
  const tabPos = toc.pXml.indexOf('<w:tab/>');
  const beforeTab = toc.pXml.slice(0, tabPos + '<w:tab/>'.length);
  const afterTab = toc.pXml.slice(tabPos + '<w:tab/>'.length).replace(
    /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/,
    `<w:t>${newPageStr}</w:t>`
  );
  const newPXml = beforeTab + afterTab;
  docXml = docXml.slice(0, toc.start) + newPXml + docXml.slice(toc.end);
}

docEntry.data = Buffer.from(docXml, 'utf8');
writeZipEntries('Research-Paper.docx', entries);
console.log(`\n🎉 Updated ${changedCount} / ${tocLines.length} entries in Research-Paper.docx!`);
