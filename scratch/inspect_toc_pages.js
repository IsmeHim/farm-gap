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
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = readZipEntries('Research-Paper.docx');
const docXml = entries.find(e => e.name === 'word/document.xml').data.toString('utf8');
const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length;
const bodyEnd = docXml.lastIndexOf('</w:body>');
const bodyXml = docXml.slice(bodyStart, bodyEnd);

// Split bodyXml by <w:sectPr ... </w:sectPr>
const parts = bodyXml.split(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
const sectMatches = [...bodyXml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)];

sectMatches.forEach((m, idx) => {
  const partXml = parts[idx] || '';
  const pTexts = [...partXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    .map(pm => getText(pm[0]))
    .filter(Boolean);
  console.log(`Section ${idx + 1}: first texts = [${pTexts.slice(0, 3).map(s => `"${s.slice(0, 40)}"`).join(', ')}]`);
});
