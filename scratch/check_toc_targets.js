const fs = require('fs');
const zlib = require('zlib');

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

function getText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map(t => t[1])
    .join('')
    .replace(/\u200b/g, '')
    .trim();
}

const entries = readZipEntries('Research-Paper.docx');
const docXml = entries.find(e => e.name === 'word/document.xml').data.toString('utf8');

const pMatches = [...docXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
pMatches.forEach((m, idx) => {
  const pXml = m[0];
  const isToc = pXml.includes('<w:tab/>') && pXml.includes('w:leader="dot"');
  if (isToc) return;
  const text = getText(pXml);
  if (text.startsWith('ตารางที่ ') || text.startsWith('ภาพที่ ') || text.startsWith('ตาราง ')) {
    console.log(`p#${idx}: "${text}"`);
  }
});
