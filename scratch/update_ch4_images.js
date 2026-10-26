const fs = require('fs');
const path = require('path');
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

function getImageDimensions(buf) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return {
      w: buf.readUInt32BE(16),
      h: buf.readUInt32BE(20),
      ext: 'png',
    };
  }
  // JPEG signature: FF D8
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let pos = 2;
    while (pos < buf.length) {
      if (buf[pos] !== 0xFF) {
        pos++;
        continue;
      }
      let marker = buf[pos + 1];
      while (marker === 0xFF) {
        pos++;
        marker = buf[pos + 1];
      }
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        const h = buf.readUInt16BE(pos + 5);
        const w = buf.readUInt16BE(pos + 7);
        return { w, h, ext: 'jpeg' };
      }
      const segLen = buf.readUInt16BE(pos + 2);
      pos += 2 + segLen;
    }
  }
  throw new Error('Unsupported image format');
}

const mappings = [
  { fig: '4.7', src: 'images/4.7.jpg', scratchDest: 'scratch/fig4_7_liff_shop.png', baseMedia: 'image13' },
  { fig: '4.8', src: 'images/4.8.png', scratchDest: 'scratch/fig4_8_flex_status.png', baseMedia: 'image14' },
  { fig: '4.9', src: 'images/4.9.png', scratchDest: 'scratch/fig4_9_qr_traceability.png', baseMedia: 'image15' },
  { fig: '4.11', src: 'images/4.11.png', scratchDest: 'scratch/fig4_11_gemini_chat.png', baseMedia: 'image17' },
];

const entries = readZipEntries('Research-Paper.docx');
const docEntry = entries.find(e => e.name === 'word/document.xml');
const relsEntry = entries.find(e => e.name === 'word/_rels/document.xml.rels');
const ctEntry = entries.find(e => e.name === '[Content_Types].xml');

let docXml = docEntry.data.toString('utf8');
let relsXml = relsEntry.data.toString('utf8');
let ctXml = ctEntry.data.toString('utf8');

// Ensure jpeg ContentType exists in [Content_Types].xml
if (!ctXml.includes('Extension="jpeg"')) {
  ctXml = ctXml.replace('<Types ', '<Types ').replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
}

const TARGET_CX = 5166360; // 5.65 inches in EMUs

for (const item of mappings) {
  const imgBuf = fs.readFileSync(item.src);
  const { w, h, ext } = getImageDimensions(imgBuf);
  const newCy = Math.round((TARGET_CX * h) / w);

  // 1. Copy to scratch/
  fs.copyFileSync(item.src, item.scratchDest);

  // 2. Find existing media entry (either .png or .jpeg)
  const mediaEntry = entries.find(
    e => e.name === `word/media/${item.baseMedia}.png` || e.name === `word/media/${item.baseMedia}.jpeg`
  );
  if (!mediaEntry) throw new Error(`Missing word/media/${item.baseMedia}.* in Research-Paper.docx`);

  const newMediaName = `word/media/${item.baseMedia}.${ext}`;
  const newRelTarget = `media/${item.baseMedia}.${ext}`;
  mediaEntry.name = newMediaName;
  mediaEntry.data = imgBuf;

  // 3. Find rId in word/_rels/document.xml.rels and update Target if needed
  const relRegex = new RegExp(`<Relationship\\s+Id="(rId\\d+)"[^>]*Target="media/${item.baseMedia}\\.(png|jpeg)"[^>]*/>`);
  const relMatch = relsXml.match(relRegex);
  if (!relMatch) throw new Error(`Missing Relationship for media/${item.baseMedia} in word/_rels/document.xml.rels`);
  const rId = relMatch[1];
  relsXml = relsXml.replace(
    new RegExp(`Target="media/${item.baseMedia}\\.(png|jpeg)"`),
    `Target="${newRelTarget}"`
  );

  // 4. Update <wp:extent> and <a:ext> in word/document.xml for this rId
  const embedPos = docXml.indexOf(`r:embed="${rId}"`);
  if (embedPos === -1) throw new Error(`Missing r:embed="${rId}" in word/document.xml`);
  const drawingStart = docXml.lastIndexOf('<w:drawing>', embedPos);
  const drawingEnd = docXml.indexOf('</w:drawing>', embedPos) + '</w:drawing>'.length;
  let drawingXml = docXml.slice(drawingStart, drawingEnd);

  drawingXml = drawingXml
    .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${TARGET_CX}" cy="${newCy}"/>`)
    .replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${TARGET_CX}" cy="${newCy}"/>`);

  docXml = docXml.slice(0, drawingStart) + drawingXml + docXml.slice(drawingEnd);
  console.log(`✅ Updated Figure ${item.fig} (${newMediaName}, ${rId}): ${w}x${h}px (${ext}) -> cx=${TARGET_CX}, cy=${newCy}`);
}

docEntry.data = Buffer.from(docXml, 'utf8');
relsEntry.data = Buffer.from(relsXml, 'utf8');
ctEntry.data = Buffer.from(ctXml, 'utf8');
writeZipEntries('Research-Paper.docx', entries);
console.log('🎉 Successfully updated Figures 4.7, 4.8, 4.9, and 4.11 in Research-Paper.docx!');
