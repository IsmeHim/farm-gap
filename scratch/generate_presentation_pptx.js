import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ============================================================================
// 1. Minimal Pure-Node ZIP Builder (PKZIP Standard with CRC32 & DeflateRaw)
// ============================================================================
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

class ZipArchive {
  constructor() {
    this.entries = [];
  }

  addFile(filePath, content) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    const nameBuf = Buffer.from(filePath.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    this.entries.push({
      nameBuf,
      uncompressedSize: data.length,
      compressedData: compressed,
      compressedSize: compressed.length,
      crc,
    });
  }

  toBuffer() {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of this.entries) {
      const localHeader = Buffer.alloc(30 + entry.nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
      localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8)
      localHeader.writeUInt16LE(8, 8);          // Compression method (8 = Deflate)
      localHeader.writeUInt16LE(0, 10);         // Last mod file time
      localHeader.writeUInt16LE(0x5421, 12);    // Last mod file date
      localHeader.writeUInt32LE(entry.crc, 14);
      localHeader.writeUInt32LE(entry.compressedSize, 18);
      localHeader.writeUInt32LE(entry.uncompressedSize, 22);
      localHeader.writeUInt16LE(entry.nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);         // Extra field length
      entry.nameBuf.copy(localHeader, 30);

      localParts.push(localHeader, entry.compressedData);

      const centralHeader = Buffer.alloc(46 + entry.nameBuf.length);
      centralHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
      centralHeader.writeUInt16LE(20, 4);         // Version made by
      centralHeader.writeUInt16LE(20, 6);         // Version needed to extract
      centralHeader.writeUInt16LE(0x0800, 8);     // General purpose bit flag (UTF-8)
      centralHeader.writeUInt16LE(8, 10);         // Compression method (Deflate)
      centralHeader.writeUInt16LE(0, 12);         // File time
      centralHeader.writeUInt16LE(0x5421, 14);    // File date
      centralHeader.writeUInt32LE(entry.crc, 16);
      centralHeader.writeUInt32LE(entry.compressedSize, 20);
      centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
      centralHeader.writeUInt16LE(entry.nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);         // Extra field length
      centralHeader.writeUInt16LE(0, 32);         // File comment length
      centralHeader.writeUInt16LE(0, 34);         // Disk number start
      centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
      centralHeader.writeUInt32LE(0, 38);         // External file attributes
      centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header
      entry.nameBuf.copy(centralHeader, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + entry.compressedSize;
    }

    const centralDirSize = centralParts.reduce((acc, b) => acc + b.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // End of central dir signature
    eocd.writeUInt16LE(0, 4);          // Number of this disk
    eocd.writeUInt16LE(0, 6);          // Disk where central directory starts
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);         // Comment length

    return Buffer.concat([...localParts, ...centralParts, eocd]);
  }
}

// ============================================================================
// 2. OpenXML PresentationML Helpers (16:9 Widescreen: 13.333" x 7.5")
// ============================================================================
const EMU_PER_INCH = 914400;
const SLIDE_W_IN = 13.333333;
const SLIDE_H_IN = 7.5;
const SLIDE_W_EMU = 12192000;
const SLIDE_H_EMU = 6858000;
const FONT_FAMILY = 'Leelawadee UI';

function emu(inches) {
  return Math.round(inches * EMU_PER_INCH);
}

function xmlEscape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { buf, width, height };
}

// Theme Palette (Clean AgriTech Modern)
const C = {
  bgLight: 'F8FAFC',       // Slate 50
  bgWhite: 'FFFFFF',       // Pure White
  bgSoftGreen: 'ECFDF5',   // Emerald 50
  bgSoftTeal: 'F0FDFA',    // Teal 50
  bgSoftAmber: 'FFFBEB',   // Amber 50
  bgSoftRose: 'FFF1F2',    // Rose 50
  bgSoftBlue: 'EFF6FF',    // Blue 50
  bgDark: '064E3B',        // Emerald 950/900
  bgDarkCard: '065F46',    // Emerald 800
  emerald: '059669',       // Emerald 600
  emeraldDark: '047857',   // Emerald 700
  emeraldLight: 'A7F3D0',  // Emerald 200
  teal: '0D9488',          // Teal 600
  tealLight: '99F6E4',     // Teal 200
  amber: 'D97706',         // Amber 600
  amberLight: 'FDE68A',    // Amber 200
  rose: 'E11D48',          // Rose 600
  roseLight: 'FECDD3',     // Rose 200
  blue: '2563EB',          // Blue 600
  blueLight: 'BFDBFE',     // Blue 200
  textDark: '0F172A',      // Slate 900
  textBody: '334155',      // Slate 700
  textMuted: '64748B',     // Slate 500
  border: 'E2E8F0',        // Slate 200
  borderGreen: 'A7F3D0',
  white: 'FFFFFF',
};

class SlideBuilder {
  constructor(slideNumber) {
    this.slideNumber = slideNumber;
    this.shapes = [];
    this.images = []; // { rId, mediaName }
    this.nextShapeId = 2;
  }

  // Add background solid rectangle
  addBackground(colorHex = C.bgLight) {
    this.addRect(0, 0, SLIDE_W_IN, SLIDE_H_IN, {
      fill: colorHex,
      line: null,
    });
  }

  // Add rectangle or rounded rectangle with optional text paragraphs
  addRect(x, y, w, h, opts = {}) {
    const id = this.nextShapeId++;
    const prst = opts.round ? 'roundRect' : 'rect';
    const adjXml = opts.round
      ? `<a:avLst><a:gd name="adj" fmla="val ${opts.roundRadius || 6000}"/></a:avLst>`
      : '<a:avLst/>';

    const fillXml = opts.fill
      ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`
      : '<a:noFill/>';

    const lineW = Math.round((opts.lineWidthPt || 1) * 12700);
    const lineXml = opts.line
      ? `<a:ln w="${lineW}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>`
      : '<a:ln><a:noFill/></a:ln>';

    const anchor = opts.valign || 't'; // 't', 'ctr', 'b'
    const padL = emu(opts.padX ?? opts.padL ?? 0.14);
    const padR = emu(opts.padX ?? opts.padR ?? 0.14);
    const padT = emu(opts.padY ?? opts.padT ?? 0.10);
    const padB = emu(opts.padY ?? opts.padB ?? 0.10);

    const paragraphs = opts.paragraphs || (opts.text !== undefined ? [{
      text: opts.text,
      size: opts.fontSize || 16,
      bold: opts.bold || false,
      color: opts.color || C.textDark,
      align: opts.align || 'l',
    }] : []);

    let pXml = '';
    if (paragraphs.length === 0) {
      pXml = '<a:p><a:endParaRPr lang="th-TH" sz="1400"/></a:p>';
    } else {
      for (const p of paragraphs) {
        const algn = p.align || opts.align || 'l'; // 'l', 'ctr', 'r'
        const spcBefore = p.spaceBeforePt ? `<a:spcBef><a:spcPts val="${Math.round(p.spaceBeforePt * 100)}"/></a:spcBef>` : '';
        const spcAfter = p.spaceAfterPt ? `<a:spcAft><a:spcPts val="${Math.round(p.spaceAfterPt * 100)}"/></a:spcAft>` : '';
        const lnSpc = p.lineSpacingPct ? `<a:lnSpc><a:spcPct val="${Math.round(p.lineSpacingPct * 1000)}"/></a:lnSpc>` : '';
        const pPr = `<a:pPr algn="${algn}">${lnSpc}${spcBefore}${spcAfter}</a:pPr>`;

        const runs = p.runs || [{
          text: p.text ?? '',
          size: p.size || opts.fontSize || 16,
          bold: p.bold ?? opts.bold ?? false,
          italic: p.italic ?? false,
          color: p.color || opts.color || C.textDark,
        }];

        let runsXml = '';
        for (const r of runs) {
          const sz = Math.round((r.size || 16) * 100);
          const bAttr = r.bold ? ' b="1"' : '';
          const iAttr = r.italic ? ' i="1"' : '';
          const clr = r.color || C.textDark;
          runsXml += `
            <a:r>
              <a:rPr lang="th-TH" altLang="en-US" sz="${sz}"${bAttr}${iAttr} dirty="0">
                <a:solidFill><a:srgbClr val="${clr}"/></a:solidFill>
                <a:latin typeface="${FONT_FAMILY}"/>
                <a:ea typeface="${FONT_FAMILY}"/>
                <a:cs typeface="${FONT_FAMILY}"/>
              </a:rPr>
              <a:t>${xmlEscape(r.text)}</a:t>
            </a:r>`;
        }
        pXml += `<a:p>${pPr}${runsXml}</a:p>`;
      }
    }

    const shapeXml = `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="Shape ${id}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${emu(x)}" y="${emu(y)}"/>
            <a:ext cx="${emu(w)}" cy="${emu(h)}"/>
          </a:xfrm>
          <a:prstGeom prst="${prst}">${adjXml}</a:prstGeom>
          ${fillXml}
          ${lineXml}
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0" anchor="${anchor}" lIns="${padL}" tIns="${padT}" rIns="${padR}" bIns="${padB}"/>
          <a:lstStyle/>
          ${pXml}
        </p:txBody>
      </p:sp>`;

    this.shapes.push(shapeXml);
  }

  // Add text box without fill/border
  addText(x, y, w, h, opts = {}) {
    this.addRect(x, y, w, h, {
      ...opts,
      fill: null,
      line: null,
      padX: opts.padX ?? 0.04,
      padY: opts.padY ?? 0.02,
    });
  }

  // Add standard clean slide header + top accent bar + slide number pill
  addHeader(categoryTag, titleText, subtitleText = null) {
    this.addBackground(C.bgLight);

    // Top thin emerald bar
    this.addRect(0, 0, SLIDE_W_IN, 0.08, { fill: C.emerald, line: null });

    // Category pill
    this.addRect(0.65, 0.35, 3.2, 0.34, {
      round: true,
      roundRadius: 25000,
      fill: C.bgSoftGreen,
      line: C.borderGreen,
      lineWidthPt: 1,
      valign: 'ctr',
      align: 'ctr',
      padX: 0.1,
      padY: 0.02,
      text: categoryTag,
      fontSize: 12,
      bold: true,
      color: C.emeraldDark,
    });

    // Slide number badge on top-right
    this.addRect(SLIDE_W_IN - 1.45, 0.35, 0.80, 0.34, {
      round: true,
      roundRadius: 25000,
      fill: C.bgWhite,
      line: C.border,
      lineWidthPt: 1,
      valign: 'ctr',
      align: 'ctr',
      padX: 0.05,
      padY: 0.02,
      text: `${this.slideNumber} / 15`,
      fontSize: 12,
      bold: true,
      color: C.textMuted,
    });

    // Main Slide Title
    this.addText(0.65, 0.76, 11.8, 0.55, {
      text: titleText,
      fontSize: 26,
      bold: true,
      color: C.textDark,
      valign: 'ctr',
    });

    if (subtitleText) {
      this.addText(0.65, 1.28, 11.8, 0.34, {
        text: subtitleText,
        fontSize: 14,
        bold: false,
        color: C.textMuted,
        valign: 'ctr',
      });
    }

    // Subtle bottom footer bar
    this.addText(0.65, 7.08, 9.0, 0.30, {
      text: 'FarmGAP • ระบบบริหารจัดการฟาร์มผักตามมาตรฐาน GAP และสั่งซื้อออนไลน์ด้วย AI บน LINE OA',
      fontSize: 11,
      color: C.textMuted,
      valign: 'ctr',
    });
  }

  // Add clean card with a colored top or left accent bar
  addCard(x, y, w, h, {
    badge = null,
    badgeBg = C.emerald,
    badgeColor = C.white,
    title = '',
    titleColor = C.textDark,
    titleSize = 17,
    bullets = [],
    bulletSize = 14,
    fill = C.bgWhite,
    border = C.border,
    accentColor = null,
  } = {}) {
    // Base white rounded card
    this.addRect(x, y, w, h, {
      round: true,
      roundRadius: 4500,
      fill,
      line: border,
      lineWidthPt: 1.2,
    });

    // Optional top accent strip inside card
    if (accentColor) {
      this.addRect(x + 0.18, y + 0.14, 0.55, 0.07, {
        round: true,
        roundRadius: 20000,
        fill: accentColor,
        line: null,
      });
    }

    let curY = y + (accentColor ? 0.28 : 0.18);

    if (badge) {
      this.addRect(x + 0.20, curY, Math.min(w - 0.4, Math.max(0.9, badge.length * 0.11 + 0.35)), 0.32, {
        round: true,
        roundRadius: 20000,
        fill: badgeBg,
        line: null,
        valign: 'ctr',
        align: 'ctr',
        padX: 0.08,
        padY: 0.02,
        text: badge,
        fontSize: 11.5,
        bold: true,
        color: badgeColor,
      });
      curY += 0.38;
    }

    if (title) {
      this.addText(x + 0.20, curY, w - 0.40, 0.42, {
        text: title,
        fontSize: titleSize,
        bold: true,
        color: titleColor,
        valign: 't',
      });
      curY += 0.42;
    }

    if (bullets && bullets.length > 0) {
      const paras = bullets.map((b) => {
        if (typeof b === 'string') {
          return {
            spaceAfterPt: 5,
            lineSpacingPct: 115,
            runs: [
              { text: '• ', size: bulletSize, bold: true, color: accentColor || C.emerald },
              { text: b, size: bulletSize, bold: false, color: C.textBody },
            ],
          };
        }
        return {
          spaceAfterPt: 5,
          lineSpacingPct: 115,
          runs: [
            { text: '• ', size: bulletSize, bold: true, color: accentColor || C.emerald },
            { text: b.lead ? `${b.lead}: ` : '', size: bulletSize, bold: true, color: C.textDark },
            { text: b.text || '', size: bulletSize, bold: false, color: C.textBody },
          ],
        };
      });

      this.addText(x + 0.20, curY, w - 0.40, Math.max(0.4, h - (curY - y) - 0.12), {
        paragraphs: paras,
        valign: 't',
      });
    }
  }

  // Add image inside a clean framed card while preserving exact aspect ratio
  addFramedImage(x, y, w, h, mediaInfo, caption = null) {
    // Card frame
    this.addRect(x, y, w, h, {
      round: true,
      roundRadius: 3500,
      fill: C.bgWhite,
      line: C.border,
      lineWidthPt: 1.2,
    });

    const pad = 0.14;
    const capH = caption ? 0.34 : 0;
    const availW = w - pad * 2;
    const availH = h - pad * 2 - capH;

    const imgRatio = mediaInfo.width / mediaInfo.height;
    const boxRatio = availW / availH;

    let drawW, drawH;
    if (imgRatio > boxRatio) {
      drawW = availW;
      drawH = availW / imgRatio;
    } else {
      drawH = availH;
      drawW = availH * imgRatio;
    }

    const drawX = x + pad + (availW - drawW) / 2;
    const drawY = y + pad + (availH - drawH) / 2;

    const rId = `rIdImg${this.images.length + 1}`;
    this.images.push({ rId, mediaName: mediaInfo.mediaName });

    const id = this.nextShapeId++;
    const picXml = `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${id}" name="Picture ${id}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${emu(drawX)}" y="${emu(drawY)}"/>
            <a:ext cx="${emu(drawW)}" cy="${emu(drawH)}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
    this.shapes.push(picXml);

    if (caption) {
      this.addText(x + 0.12, y + h - capH - 0.04, w - 0.24, capH, {
        text: caption,
        fontSize: 11.5,
        bold: true,
        color: C.textMuted,
        align: 'ctr',
        valign: 'ctr',
      });
    }
  }

  // Raw image without card border (e.g. university logo)
  addRawImage(x, y, w, h, mediaInfo) {
    const imgRatio = mediaInfo.width / mediaInfo.height;
    const boxRatio = w / h;
    let drawW, drawH;
    if (imgRatio > boxRatio) {
      drawW = w;
      drawH = w / imgRatio;
    } else {
      drawH = h;
      drawW = h * imgRatio;
    }
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;

    const rId = `rIdImg${this.images.length + 1}`;
    this.images.push({ rId, mediaName: mediaInfo.mediaName });
    const id = this.nextShapeId++;

    const picXml = `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${id}" name="Picture ${id}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${emu(drawX)}" y="${emu(drawY)}"/>
            <a:ext cx="${emu(drawW)}" cy="${emu(drawH)}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
    this.shapes.push(picXml);
  }

  toXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${this.shapes.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
  }

  toRelsXml() {
    const imgRels = this.images
      .map(
        (img) =>
          `<Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img.mediaName}"/>`
      )
      .join('\n  ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  ${imgRels}
</Relationships>`;
  }
}

// ============================================================================
// 3. Load Project Images & Build All 15 Clean Slides
// ============================================================================
const scratchDir = path.resolve('scratch');
const mediaMap = {};
let mediaCounter = 1;

function registerImage(fileName) {
  const fullPath = path.join(scratchDir, fileName);
  if (!fs.existsSync(fullPath)) return null;
  if (mediaMap[fileName]) return mediaMap[fileName];
  const info = getPngDimensions(fullPath);
  const mediaName = `image${mediaCounter++}.png`;
  mediaMap[fileName] = { ...info, mediaName, fileName };
  return mediaMap[fileName];
}

const imgLogo = registerImage('yru_logo_highres.png') || registerImage('yru_logo_0.png');
const imgArch = registerImage('fig3_1_architecture.png');
const imgUseCase = registerImage('fig3_4_use_case.png');
const imgEr = registerImage('fig3_5_er_diagram.png');
const imgDash = registerImage('fig4_1_dashboard.png');
const imgPlots = registerImage('fig4_2_plots_soil.png');
const imgNursery = registerImage('fig4_3_nursery_planting.png');
const imgPhi = registerImage('fig4_4_chemical_phi.png');
const imgHarvest = registerImage('fig4_5_harvest_lot.png');
const imgGapReport = registerImage('fig4_6_gap_report.png');
const imgLiff = registerImage('fig4_7_liff_shop.png');
const imgFlex = registerImage('fig4_8_flex_status.png');
const imgQr = registerImage('fig4_9_qr_traceability.png');
const imgKmeans = registerImage('fig4_10_kmeans_ai.png');
const imgGemini = registerImage('fig4_11_gemini_chat.png');

const slides = [];
function createSlide() {
  const s = new SlideBuilder(slides.length + 1);
  slides.push(s);
  return s;
}

// ----------------------------------------------------------------------------
// SLIDE 1: Cover Slide (หน้าปกคลีนๆ โมเดิร์น)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addBackground(C.bgLight);

  // Left decorative vertical accent panel
  s.addRect(0, 0, 0.22, SLIDE_H_IN, { fill: C.emerald, line: null });

  // Main Hero Card
  s.addRect(0.65, 0.55, 12.0, 6.4, {
    round: true,
    roundRadius: 3500,
    fill: C.bgWhite,
    line: C.border,
    lineWidthPt: 1.5,
  });

  if (imgLogo) {
    s.addRawImage(1.1, 0.90, 1.15, 1.35, imgLogo);
  }

  // University & Degree Tag
  s.addRect(2.45, 1.02, 5.8, 0.40, {
    round: true,
    roundRadius: 25000,
    fill: C.bgSoftGreen,
    line: C.borderGreen,
    valign: 'ctr',
    padX: 0.18,
    text: 'สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร มหาวิทยาลัยราชภัฏยะลา',
    fontSize: 12.5,
    bold: true,
    color: C.emeraldDark,
  });

  s.addText(2.45, 1.50, 6.0, 0.35, {
    text: 'โครงงานทางวิทยาการคอมพิวเตอร์ • ปีการศึกษา 2569',
    fontSize: 13.5,
    bold: true,
    color: C.amber,
  });

  // Thai Title
  s.addText(1.1, 2.35, 11.1, 1.30, {
    paragraphs: [
      {
        lineSpacingPct: 115,
        runs: [
          {
            text: 'ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์\nด้วยปัญญาประดิษฐ์บน LINE Official Account',
            size: 30,
            bold: true,
            color: C.textDark,
          },
        ],
      },
    ],
  });

  // English Title
  s.addText(1.1, 3.72, 11.1, 0.75, {
    text: 'A Vegetable Farm Management and Online Ordering System Using Artificial Intelligence on LINE Official Account (FarmGAP)',
    fontSize: 15,
    color: C.textMuted,
  });

  // 3 Info Cards at bottom of cover
  s.addCard(1.1, 4.75, 3.55, 1.75, {
    badge: 'ผู้จัดทำโครงงาน',
    badgeBg: C.emerald,
    title: 'นายอับดุลรอฮีม จิเตะ',
    titleSize: 17,
    bullets: ['รหัสนักศึกษา: 406659018', 'วท.บ. วิทยาการคอมพิวเตอร์'],
    fill: C.bgSoftGreen,
    border: C.borderGreen,
  });

  s.addCard(4.88, 4.75, 3.55, 1.75, {
    badge: 'อาจารย์ที่ปรึกษา',
    badgeBg: C.teal,
    title: 'ผศ.อิสมาแอ ล่าเตะเกะ',
    titleSize: 17,
    bullets: ['อาจารย์ที่ปรึกษาโครงงานหลัก', 'สาขาวิชาวิทยาการคอมพิวเตอร์'],
    fill: C.bgSoftTeal,
    border: C.tealLight,
  });

  s.addCard(8.66, 4.75, 3.55, 1.75, {
    badge: 'อาจารย์ประจำวิชา',
    badgeBg: C.amber,
    title: 'อ.สุลัยมาน เภอโส๊ะ',
    titleSize: 17,
    bullets: ['อาจารย์ประจำวิชาโครงงาน', 'คณะวิทยาศาสตร์เทคโนโลยีฯ'],
    fill: C.bgSoftAmber,
    border: C.amberLight,
  });
}

// ----------------------------------------------------------------------------
// SLIDE 2: ที่มาและปัญหาเดิม (Pain Points)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '01 • BACKGROUND & PAIN POINTS',
    'ที่มาและความสำคัญ: ปัญหาเดิมของฟาร์มผัก',
    'จุดเริ่มต้นจากการแก้ปัญหาการจดสมุดส่งตรวจมาตรฐาน GAP (มกษ. 9001) และข้อจำกัดการรับออเดอร์ทางโทรศัพท์'
  );

  s.addCard(0.65, 1.85, 3.85, 4.95, {
    badge: 'ปัญหาที่ 1 • ด้านเอกสาร GAP',
    badgeBg: C.amber,
    title: 'การจดบันทึกในสมุดกระดาษ',
    bullets: [
      { lead: 'ข้อมูลกระจัดกระจาย', text: 'ต้องจดแยกหลายสมุด ทั้งเตรียมดิน เพาะกล้า ปุ๋ย และเก็บเกี่ยว' },
      { lead: 'คำนวณอายุพืชซับซ้อน', text: 'นับรวมวันเพาะกล้าและวันปลูกบนแคร่ด้วยมือมักคลาดเคลื่อน' },
      { lead: 'ยากต่อการสรุปส่งตรวจ', text: 'เสียเวลารวบรวมประวัติรายแปลงเพื่อทำรายงาน บธ.-02 และ บธ.-04' },
    ],
    accentColor: C.amber,
  });

  s.addCard(4.74, 1.85, 3.85, 4.95, {
    badge: 'ปัญหาที่ 2 • ด้านความปลอดภัย',
    badgeBg: C.rose,
    title: 'ความเสี่ยงระยะปลอดภัย (PHI)',
    bullets: [
      { lead: 'ลืมวันหยุดพ่นสาร (PHI)', text: 'การจำด้วยคนอาจเผลอตัดผักที่ยังไม่พ้นระยะปลอดภัยไปจำหน่าย' },
      { lead: 'เสี่ยงไม่ผ่านเกณฑ์ GAP', text: 'หากตรวจพบสารตกค้างเกินค่า MRL จะถูกระงับใบรับรองทันที' },
      { lead: 'ขาดการตรวจสอบย้อนกลับ', text: 'ผู้บริโภคไม่สามารถรู้แหล่งที่มาและประวัติความปลอดภัยของผัก' },
    ],
    accentColor: C.rose,
  });

  s.addCard(8.83, 1.85, 3.85, 4.95, {
    badge: 'ปัญหาที่ 3 • ด้านการจำหน่าย',
    badgeBg: C.blue,
    title: 'ลูกค้าต้องโทรสั่งซื้อ',
    bullets: [
      { lead: 'รับสายไม่ทันเมื่อลูกค้าเยอะ', text: 'เจ้าของฟาร์มต้องทำงานในแปลงและคอยรับโทรศัพท์พร้อมกัน' },
      { lead: 'ลูกค้าไม่เห็นสต็อกจริง', text: 'ไม่ทราบว่าวันนี้มีผักชนิดใดตัดใหม่หรือเหลือจำนวนกี่ถุง' },
      { lead: 'ขาดการตลาดเชิงรุก', text: 'ไม่มีระบบวิเคราะห์พฤติกรรมลูกค้าเพื่อแจ้งเตือนเมื่อมีผักตัดใหม่' },
    ],
    accentColor: C.blue,
  });
}

// ----------------------------------------------------------------------------
// SLIDE 3: วัตถุประสงค์ของโครงงาน (Objectives)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '02 • OBJECTIVES',
    'วัตถุประสงค์ของโครงงานวิจัย (4 ข้อหลัก)',
    'มุ่งเน้นการแก้ปัญหาครบวงจรตั้งแต่ต้นน้ำ (การปลูกตามมาตรฐาน GAP) ไปจนถึงปลายน้ำ (การขายด้วย AI บน LINE)'
  );

  s.addCard(0.65, 1.85, 5.85, 2.35, {
    badge: 'วัตถุประสงค์ข้อที่ 1',
    badgeBg: C.emerald,
    title: 'พัฒนาระบบบริหารจัดการฟาร์มผักตามมาตรฐาน GAP (มกษ. 9001)',
    bullets: [
      'รองรับตั้งแต่ตั้งค่าคลังชนิดผัก จัดการแปลง/แคร่ปลูก บันทึกเตรียมดิน และเพาะกล้า',
      'คำนวณอายุพืชสะสม ล็อกการเก็บเกี่ยวตามค่า PHI และพิมพ์รายงาน GAP ขนาด A4 อัตโนมัติ',
    ],
    accentColor: C.emerald,
  });

  s.addCard(6.80, 1.85, 5.85, 2.35, {
    badge: 'วัตถุประสงค์ข้อที่ 2',
    badgeBg: C.teal,
    title: 'พัฒนาระบบสั่งซื้อออนไลน์และตรวจสอบย้อนกลับด้วย QR Code',
    bullets: [
      'สั่งซื้อผ่าน LINE LIFF แจ้งเตือนสถานะด้วย Flex Message และให้เจ้าของจัดการออเดอร์ผ่าน LINE',
      'สร้าง QR Code ประจำล็อตการผลิต (Lot ID) ให้ผู้บริโภคสแกนดูประวัติความปลอดภัยได้ทันที',
    ],
    accentColor: C.teal,
  });

  s.addCard(0.65, 4.45, 5.85, 2.35, {
    badge: 'วัตถุประสงค์ข้อที่ 3',
    badgeBg: C.blue,
    title: 'ประยุกต์ใช้ AI วิเคราะห์กลุ่มลูกค้าและแชทบอทรับคำสั่งซื้อ',
    bullets: [
      'ใช้อัลกอริทึม K-Means Clustering (4 มิติ) แบ่งกลุ่มลูกค้า 3 กลุ่มเพื่อยิงแจ้งเตือนผักตัดใหม่ตรงกลุ่ม',
      'ใช้โมเดลภาษา Google Gemini AI ตอบคำถามและรับออเดอร์อัตโนมัติโดยอ้างอิงสต็อกจริง',
    ],
    accentColor: C.blue,
  });

  s.addCard(6.80, 4.45, 5.85, 2.35, {
    badge: 'วัตถุประสงค์ข้อที่ 4',
    badgeBg: C.amber,
    title: 'ทดสอบการทำงานและประเมินความพึงพอใจของระบบ',
    bullets: [
      'ทดสอบความถูกต้องตามกรณีใช้งาน (Functional Testing) ทั้ง 13 Use Cases',
      'ประเมินความเหมาะสมโดยผู้เชี่ยวชาญ 3 ท่าน (วค-4) และความพึงพอใจผู้ใช้ 3 ท่าน (วค-5)',
    ],
    accentColor: C.amber,
  });
}

// ----------------------------------------------------------------------------
// SLIDE 4: สถาปัตยกรรมระบบ (System Architecture)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '03 • SYSTEM ARCHITECTURE',
    'สถาปัตยกรรมระบบและเทคโนโลยีที่ใช้พัฒนา (Tech Stack)',
    'เชื่อมโยงเว็บแอปพลิเคชันฝั่งฟาร์ม ระบบร้านค้า LINE Official Account และโมดูลปัญญาประดิษฐ์เข้าด้วยกัน'
  );

  s.addCard(0.65, 1.85, 4.80, 1.55, {
    badge: '1. Frontend & LINE Client',
    badgeBg: C.emerald,
    title: 'React.js + Tailwind CSS + LINE LIFF',
    bullets: [
      'Responsive Web Admin สำหรับเจ้าของฟาร์ม',
      'LINE LIFF หน้าร้านค้าออนไลน์และหน้าสแกน QR Code',
    ],
  });

  s.addCard(0.65, 3.55, 4.80, 1.55, {
    badge: '2. Backend & Relational DB',
    badgeBg: C.teal,
    title: 'Node.js (Express) + MySQL 18 ตาราง',
    bullets: [
      'RESTful API + Webhook จัดการตรรกะ GAP และ PHI',
      'เชื่อมโยงทุกรอบการปลูกด้วยรหัส planting_id',
    ],
  });

  s.addCard(0.65, 5.25, 4.80, 1.55, {
    badge: '3. AI & Messaging Integration',
    badgeBg: C.blue,
    title: 'K-Means + Co-occurrence + Gemini AI',
    bullets: [
      'วิเคราะห์กลุ่มลูกค้า 4 มิติ & แนะนำสินค้าซื้อคู่กัน',
      'Google Gemini AI พร้อม Dynamic Context Injection',
    ],
  });

  if (imgArch) {
    s.addFramedImage(5.70, 1.85, 6.95, 4.95, imgArch, 'ภาพสถาปัตยกรรมระบบ FarmGAP (System Architecture)');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 5: การออกแบบระบบและฐานข้อมูล (Use Cases & ER Diagram)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '04 • SYSTEM DESIGN & DATABASE',
    'การออกแบบกรณีใช้งาน (13 Use Cases) และฐานข้อมูล (18 ตาราง)',
    'แบ่งสิทธิ์การทำงานชัดเจนระหว่างเจ้าของฟาร์ม (8 Use Cases) และลูกค้าบน LINE (5 Use Cases)'
  );

  if (imgUseCase) {
    s.addFramedImage(0.65, 1.85, 5.85, 4.95, imgUseCase, 'Use Case Diagram (13 กรณีใช้งานหลัก)');
  }

  if (imgEr) {
    s.addFramedImage(6.80, 1.85, 5.85, 4.95, imgEr, 'ER Diagram ฐานข้อมูลเชิงสัมพันธ์ MySQL ทั้ง 18 ตาราง');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 6: แดชบอร์ดภาพรวมฟาร์ม (Farm Overview Dashboard)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '05 • GAP FARM MANAGEMENT',
    'แดชบอร์ดภาพรวมฟาร์มและตัวชี้วัดสำคัญ (Dashboard)',
    'รวบรวมสถานะแปลงปลูก การแจ้งเตือนระยะปลอดภัย PHI และยอดคำสั่งซื้อประจำวันไว้ในหน้าเดียว'
  );

  s.addCard(0.65, 1.85, 4.55, 4.95, {
    badge: 'FARM OVERVIEW DASHBOARD',
    badgeBg: C.emerald,
    title: 'จุดเด่นของหน้าแดชบอร์ด',
    bullets: [
      { lead: 'ตัวชี้วัดเรียลไทม์', text: 'แสดงรายได้รวม จำนวนรอบปลูกที่กำลังดำเนินการ และออเดอร์ใหม่จาก LINE' },
      { lead: 'แจ้งเตือนแคร่พร้อมเก็บ', text: 'ไฮไลท์แคร่ปลูกที่อายุครบ 100% เพื่อให้เกษตรกรวางแผนตัดผัก' },
      { lead: 'เตือนสถานะล็อก PHI', text: 'แสดงจำนวนแปลงที่ยังติดระยะหยุดพ่นสารเคมีชัดเจน' },
      { lead: 'กราฟและสต็อกคงเหลือ', text: 'ติดตามความคืบหน้ารายแปลงและแจ้งเตือนเมื่อสต็อกผักใกล้หมด' },
    ],
    accentColor: C.emerald,
  });

  if (imgDash) {
    s.addFramedImage(5.45, 1.85, 7.20, 4.95, imgDash, 'หน้าจอแดชบอร์ดภาพรวมฟาร์ม (Farm Overview Dashboard)');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 7: คลังชนิดผัก แปลงปลูก และการเพาะกล้า (Plots, Soil & Nursery)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '06 • CROP CATALOG, PLOTS & NURSERY',
    'การตั้งค่าคลังชนิดผัก เตรียมดิน และคำนวณอายุพืชสะสม',
    'เริ่มต้นจากตั้งค่า Master Data ชนิดผัก เชื่อมโยงสู่การเตรียมดินรายแคร่ และการนับอายุรวมวันเพาะกล้า'
  );

  s.addCard(0.65, 1.85, 12.0, 1.45, {
    badge: 'ลำดับการทำงานต้นน้ำ (STEP 1 - 3)',
    badgeBg: C.emerald,
    title: '',
    bullets: [
      { lead: '1. คลังชนิดผัก (Crops Master Data)', text: 'กำหนดชื่อผัก วันเพาะกล้า วันเติบโตเป้าหมาย และราคาขายตั้งต้น' },
      { lead: '2. จัดการแคร่ & เตรียมดิน (GAP ข้อ 2)', text: 'บันทึกสูตรผสมดิน ปูนขาว และค่า pH ก่อนเริ่มปลูก   |   3. เพาะกล้า & ย้ายปลูก: คำนวณอายุสะสม (วันเพาะ + วันบนแคร่)' },
    ],
  });

  if (imgPlots) {
    s.addFramedImage(0.65, 3.50, 5.85, 3.35, imgPlots, 'หน้าจอจัดการแปลงปลูก แคร่ปลูก และบันทึกสูตรเตรียมดิน');
  }

  if (imgNursery) {
    s.addFramedImage(6.80, 3.50, 5.85, 3.35, imgNursery, 'การเพาะกล้า ย้ายลงแคร่ และคำนวณอายุพืชสะสม (เช่น 33/20 วัน)');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 8: ไฮไลท์สำคัญ — ระบบควบคุมปุ๋ย/สารเคมี และล็อกการเก็บเกี่ยว (PHI Lockdown)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '07 • KEY HIGHLIGHT: PHI SAFETY LOCK',
    'การบันทึกปุ๋ย/สารเคมี และระบบล็อกการเก็บเกี่ยวตามค่า PHI',
    'หัวใจสำคัญของมาตรฐาน GAP ข้อ 3 เพื่อป้องกันผลผลิตที่มีสารตกค้างหลุดออกสู่ผู้บริโภค'
  );

  s.addCard(0.65, 1.85, 4.65, 4.95, {
    badge: 'GAP CRITERION 3 • PHI LOCKDOWN',
    badgeBg: C.rose,
    title: 'กลไกป้องกันสารตกค้างอัตโนมัติ',
    bullets: [
      { lead: 'แยกสถานะแปลงชัดเจน', text: 'ในฟอร์มระบุว่าแปลงใดกำลังเพาะกล้า กำลังปลูก หรือพร้อมเก็บ 100% เพื่อกันกดผิด' },
      { lead: 'ระบุค่า PHI ตามฉลาก', text: 'ชีวภัณฑ์/ปุ๋ยอินทรีย์ = 0 วัน, สารเคมีระบุวันหยุดพ่นก่อนเก็บ (เช่น 7 หรือ 14 วัน)' },
      { lead: 'คำนวณวันปลอดภัย', text: 'Safe Harvest Date = วันที่พ่นสาร + จำนวนวัน PHI' },
      { lead: 'ล็อกปุ่มเก็บเกี่ยวทันที', text: 'หากยังไม่ครบกำหนด ระบบจะขึ้นแบนเนอร์สีแดงและไม่อนุญาตให้บันทึกเก็บเกี่ยว' },
    ],
    accentColor: C.rose,
    fill: C.bgSoftRose,
    border: C.roseLight,
  });

  if (imgPhi) {
    s.addFramedImage(5.55, 1.85, 7.10, 4.95, imgPhi, 'หน้าจอบันทึกการใช้ปุ๋ย/สารบำรุง และการควบคุมระยะปลอดภัย (PHI)');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 9: การเก็บเกี่ยว สร้างรหัส Lot QR Code และรายงาน GAP A4
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '08 • HARVEST, LOT QR & A4 GAP REPORT',
    'การเก็บเกี่ยวผลผลิต สร้างรหัส Lot QR และพิมพ์รายงาน GAP (A4)',
    'เชื่อมโยงผลผลิตเข้าสู่คลังสินค้า/ห้องเย็น พร้อมออกเอกสารทางการแบบ บธ.-02 และ บธ.-04 ได้ในคลิกเดียว'
  );

  if (imgHarvest) {
    s.addFramedImage(0.65, 1.85, 5.85, 4.95, imgHarvest, 'บันทึกเก็บเกี่ยว คัดเกรด ซิงค์สต็อก และสร้างรหัส Lot QR Code');
  }

  if (imgGapReport) {
    s.addFramedImage(6.80, 1.85, 5.85, 4.95, imgGapReport, 'รายงานมาตรฐาน GAP รูปแบบเอกสาร A4 (แบบ บธ.-02 และ บธ.-04)');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 10: ร้านค้าออนไลน์ LINE LIFF & QR Code Traceability
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '09 • LINE LIFF STORE & QR TRACEABILITY',
    'ร้านค้าออนไลน์ผ่าน LINE LIFF และการสแกน QR ตรวจสอบย้อนกลับ',
    'ลูกค้าสั่งซื้อผักสดได้ทันทีโดยไม่ต้องโหลดแอปเพิ่ม และสแกน QR ข้างถุงผักเพื่อดูประวัติความปลอดภัย'
  );

  if (imgLiff) {
    s.addFramedImage(0.65, 1.85, 5.85, 4.95, imgLiff, 'หน้าร้านค้าออนไลน์ LINE LIFF แสดงสต็อกจริงและผักที่มักซื้อคู่กัน');
  }

  if (imgQr) {
    s.addFramedImage(6.80, 1.85, 5.85, 4.95, imgQr, 'หน้าตรวจสอบย้อนกลับ (Traceability) เมื่อผู้บริโภคสแกน QR Code');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 11: การแจ้งเตือนและจัดการออเดอร์ 2 ทางผ่าน LINE Flex Message
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '10 • TWO-WAY LINE ORDER MANAGEMENT',
    'แจ้งเตือนสถานะเรียลไทม์ & เจ้าของฟาร์มจัดการออเดอร์ใน LINE',
    'ลดภาระการเปิดคอมพิวเตอร์ เจ้าของฟาร์มสามารถกดรับออเดอร์ ยืนยันส่ง และตัดสต็อกจากในแชท LINE ได้ทันที'
  );

  s.addCard(0.65, 1.85, 4.65, 4.95, {
    badge: 'INTERACTIVE FLEX MESSAGE',
    badgeBg: C.emerald,
    title: 'จัดการครบวงจรในแชท LINE',
    bullets: [
      { lead: 'ฝั่งลูกค้า (Customer)', text: 'รับการ์ดใบเสร็จ ติดตามสถานะจัดส่งเรียลไทม์ และการ์ดยกเลิกพร้อมปุ่มกดสั่งซื้อผักใหม่' },
      { lead: 'แจ้งเตือนเจ้าของฟาร์ม', text: 'เมื่อมีออเดอร์เข้า ระบบส่งการ์ดพร้อมรูปสลิปเข้า LINE เจ้าของฟาร์มทันที' },
      { lead: 'กดปุ่มยืนยันจัดส่ง & ตัดสต็อก', text: 'กดปุ่มบนการ์ดเพื่อยืนยันส่งและตัดสต็อกคลังห้องเย็น (GAP ข้อ 6) อัตโนมัติ' },
      { lead: 'พิมพ์ใบปะหน้าพัสดุ', text: 'กดปุ่มเปิดหน้าพิมพ์ใบปะหน้าพัสดุจากมือถือได้ทันที' },
    ],
    accentColor: C.emerald,
  });

  if (imgFlex) {
    s.addFramedImage(5.55, 1.85, 7.10, 4.95, imgFlex, 'การ์ดแจ้งเตือนสถานะคำสั่งซื้อและการจัดการออเดอร์ผ่าน LINE Flex Message');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 12: ปัญญาประดิษฐ์ 1 — K-Means Clustering (4 มิติ)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '11 • AI MODULE 1: K-MEANS CLUSTERING',
    'การจัดกลุ่มลูกค้าด้วย K-Means (4 มิติ) เพื่อยิงแจ้งเตือนตรงกลุ่ม',
    'วิเคราะห์พฤติกรรมการซื้อและปรับมาตรฐานข้อมูลด้วย Z-Score Standardization แบ่งลูกค้าออกเป็น 3 กลุ่ม'
  );

  s.addCard(0.65, 1.85, 4.65, 4.95, {
    badge: 'K-MEANS CLUSTERING (K = 3)',
    badgeBg: C.blue,
    title: 'วิเคราะห์ 4 มิติ & ยิงบรอดแคสต์',
    bullets: [
      { lead: 'ตัวแปร 4 มิติ', text: 'ความถี่การซื้อ, ยอดซื้อเฉลี่ย, สัดส่วนผักสลัด, สัดส่วนผักปรุงสุก' },
      { lead: 'กลุ่มที่ 1: สลัดเลิฟเวอร์', text: 'เน้นซื้อกรีนโอ๊ค เรดโอ๊ค คอส สำหรับทำสลัด' },
      { lead: 'กลุ่มที่ 2: ลูกค้าประจำสายสุขภาพ', text: 'ซื้อสม่ำเสมอ ผสมผสานผักใบและผักสลัด' },
      { lead: 'กลุ่มที่ 3: ร้านอาหารและค้าส่ง', text: 'ยอดสั่งซื้อต่อบิลสูง เน้นสั่งยกกิโลกรัม' },
      { lead: 'Targeted LINE Push', text: 'เมื่อเก็บเกี่ยวผักใหม่ เลือกยิงแจ้งเตือนเฉพาะกลุ่มที่สนใจได้ทันที' },
    ],
    accentColor: C.blue,
    fill: C.bgSoftBlue,
    border: C.blueLight,
  });

  if (imgKmeans) {
    s.addFramedImage(5.55, 1.85, 7.10, 4.95, imgKmeans, 'หน้าจอวิเคราะห์กลุ่มลูกค้าด้วย K-Means (K = 3) และปุ่มยิงแจ้งเตือน LINE เฉพาะกลุ่ม');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 13: ปัญญาประดิษฐ์ 2 — แชทบอท Google Gemini AI
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '12 • AI MODULE 2: GOOGLE GEMINI CHATBOT',
    'แชทบอทอัจฉริยะตอบคำถามและรับคำสั่งซื้อด้วย Google Gemini AI',
    'ผสานเทคนิค Dynamic Context Injection ดึงข้อมูลสต็อกจริงและสถานะปลอดสารเคมีจากฐานข้อมูลก่อนตอบ'
  );

  s.addCard(0.65, 1.85, 4.65, 4.95, {
    badge: 'GOOGLE GEMINI LLM + FALLBACK',
    badgeBg: C.teal,
    title: 'ฉลาด แม่นยำ ไม่มั่วข้อมูล',
    bullets: [
      { lead: 'Dynamic Context Injection', text: 'ดึงรายการผักที่มีสต็อกจริง ราคา และสถานะ PHI แนบเข้า System Prompt ทุกครั้ง' },
      { lead: 'เข้าใจภาษาพูดธรรมชาติ', text: 'ลูกค้าพิมพ์สั่งผัก ถามเมนูอาหาร หรือวิธีเก็บรักษาผักได้เหมือนคุยกับเจ้าของฟาร์ม' },
      { lead: 'สรุปตะกร้า & สร้างออเดอร์', text: 'สกัดชื่อผักและจำนวน สร้างบิลสั่งซื้อและส่ง QR พร้อมเพย์ในแชทอัตโนมัติ' },
      { lead: 'Multi-Model Fallback', text: 'สลับโมเดลสำรองอัตโนมัติ 3 ลำดับขั้น รองรับการใช้งานต่อเนื่อง 24 ชม.' },
    ],
    accentColor: C.teal,
    fill: C.bgSoftTeal,
    border: C.tealLight,
  });

  if (imgGemini) {
    s.addFramedImage(5.55, 1.85, 7.10, 4.95, imgGemini, 'การสนทนาและรับคำสั่งซื้ออัตโนมัติด้วย Google Gemini AI บน LINE OA');
  }
}

// ----------------------------------------------------------------------------
// SLIDE 14: ผลการทดสอบระบบและการประเมินผล (Testing & Evaluation)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '13 • TESTING & SYSTEM EVALUATION',
    'ผลการทดสอบฟังก์ชัน (13 Use Cases) และการประเมินระบบ',
    'ทดสอบแบบ Black-box Functional Testing และประเมินตามเกณฑ์คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร'
  );

  s.addCard(0.65, 1.85, 3.85, 4.95, {
    badge: 'FUNCTIONAL TESTING',
    badgeBg: C.emerald,
    title: 'ผ่านครบทั้ง 13 Use Cases (100%)',
    bullets: [
      { lead: 'UC01 - UC08 (ฝั่งฟาร์ม)', text: 'เข้าสู่ระบบ, คลังผัก/แปลง, เพาะกล้า, ปุ๋ย/ล็อก PHI, ศัตรูพืช, เก็บเกี่ยว/QR, รายงาน GAP A4' },
      { lead: 'UC09 - UC13 (ฝั่งลูกค้า & AI)', text: 'สั่งซื้อผ่าน LIFF/Gemini, แจ้งเตือน & จัดการออเดอร์ใน LINE, สแกน QR, วิเคราะห์ K-Means' },
      { lead: 'ผลการทดสอบ', text: 'ทำงานถูกต้องแม่นยำตามข้อกำหนดทุกฟังก์ชัน' },
    ],
    accentColor: C.emerald,
    fill: C.bgSoftGreen,
    border: C.borderGreen,
  });

  s.addCard(4.74, 1.85, 3.85, 4.95, {
    badge: 'แบบประเมิน วค-4',
    badgeBg: C.blue,
    title: 'ประเมินโดยผู้เชี่ยวชาญ 3 ท่าน',
    bullets: [
      { lead: 'ด้านที่ 1 (25 คะแนน)', text: 'ความครบถ้วนของฟังก์ชันการทำงาน' },
      { lead: 'ด้านที่ 2 (25 คะแนน)', text: 'ความสอดคล้องตามมาตรฐาน GAP (มกษ. 9001)' },
      { lead: 'ด้านที่ 3 (25 คะแนน)', text: 'ประสิทธิภาพของ LINE OA และปัญญาประดิษฐ์' },
      { lead: 'ด้านที่ 4 (25 คะแนน)', text: 'ความปลอดภัยและฐานข้อมูล (รวม 100 คะแนน)' },
    ],
    accentColor: C.blue,
  });

  s.addCard(8.83, 1.85, 3.85, 4.95, {
    badge: 'แบบประเมิน วค-5',
    badgeBg: C.amber,
    title: 'ความพึงพอใจผู้ใช้งาน 3 ท่าน',
    bullets: [
      { lead: 'ด้านที่ 1 (25 คะแนน)', text: 'การออกแบบหน้าจอและความง่ายในการใช้งาน' },
      { lead: 'ด้านที่ 2 (25 คะแนน)', text: 'ความสะดวกในการบันทึกข้อมูลฟาร์มและออกรายงาน' },
      { lead: 'ด้านที่ 3 (25 คะแนน)', text: 'ความรวดเร็วในการสั่งซื้อผ่าน LINE LIFF & บอท' },
      { lead: 'ด้านที่ 4 (25 คะแนน)', text: 'ความน่าเชื่อถือของการตรวจสอบย้อนกลับ QR' },
    ],
    accentColor: C.amber,
  });
}

// ----------------------------------------------------------------------------
// SLIDE 15: สรุปผลประโยชน์และถาม-ตอบ (Conclusion & Q&A)
// ----------------------------------------------------------------------------
{
  const s = createSlide();
  s.addHeader(
    '14 • CONCLUSION & Q&A',
    'สรุปผลประโยชน์ที่ได้รับจากระบบ FarmGAP',
    'เชื่อมโยงการจัดการฟาร์มผักปลอดสารพิษตามมาตรฐาน GAP สู่การจำหน่ายออนไลน์อัจฉริยะ'
  );

  s.addCard(0.65, 1.85, 3.85, 2.75, {
    badge: '1. ยกระดับมาตรฐาน GAP',
    badgeBg: C.emerald,
    title: 'ปลอดภัย & ไร้เอกสารกระดาษ',
    bullets: [
      'ลดภาระการจดสมุดและพิมพ์รายงาน A4 ได้ทันที',
      'ป้องกันการเก็บผักที่ติดระยะสารเคมี (PHI) 100%',
    ],
    accentColor: C.emerald,
  });

  s.addCard(4.74, 1.85, 3.85, 2.75, {
    badge: '2. เพิ่มประสิทธิภาพการขาย',
    badgeBg: C.teal,
    title: 'สั่งซื้ออัตโนมัติ 24 ชั่วโมง',
    bullets: [
      'ลดภาระการรับสายโทรศัพท์ด้วย LINE LIFF & Gemini',
      'เจ้าของฟาร์มกดยืนยันส่งและตัดสต็อกใน LINE ได้เลย',
    ],
    accentColor: C.teal,
  });

  s.addCard(8.83, 1.85, 3.85, 2.75, {
    badge: '3. ความเชื่อมั่นผู้บริโภค',
    badgeBg: C.amber,
    title: 'โปร่งใส & การตลาดตรงกลุ่ม',
    bullets: [
      'สแกน Lot QR Code ตรวจสอบแหล่งที่มาได้จริง',
      'ยิงแจ้งเตือนผักตัดใหม่ตรงกลุ่มลูกค้าด้วย K-Means',
    ],
    accentColor: C.amber,
  });

  // Bottom Thank You / Q&A Banner
  s.addRect(0.65, 4.88, 12.0, 1.95, {
    round: true,
    roundRadius: 4500,
    fill: C.bgDark,
    line: C.emerald,
    lineWidthPt: 1.5,
    valign: 'ctr',
    align: 'ctr',
    paragraphs: [
      {
        align: 'ctr',
        spaceAfterPt: 4,
        runs: [{ text: 'THANK YOU • ขอบคุณคณะกรรมการทุกท่านครับ', size: 24, bold: true, color: C.white }],
      },
      {
        align: 'ctr',
        runs: [
          {
            text: 'พร้อมรับฟังข้อเสนอแนะและตอบคำถาม (Q & A) • นายอับดุลรอฮีม จิเตะ (406659018)',
            size: 15,
            bold: false,
            color: C.emeraldLight,
          },
        ],
      },
    ],
  });
}

// ============================================================================
// 4. Assemble OpenXML Package & Write FarmGAP-Presentation.pptx
// ============================================================================
const zip = new ZipArchive();

// 4.1 [Content_Types].xml
const slideOverrides = slides
  .map(
    (_, idx) =>
      `  <Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  )
  .join('\n');

zip.addFile(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${slideOverrides}
</Types>`
);

// 4.2 _rels/.rels
zip.addFile(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
);

// 4.3 docProps/core.xml & docProps/app.xml
zip.addFile(
  'docProps/core.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account (FarmGAP)</dc:title>
  <dc:creator>อับดุลรอฮีม จิเตะ (406659018)</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-10-25T12:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-25T12:00:00Z</dcterms:modified>
</cp:coreProperties>`
);

zip.addFile(
  'docProps/app.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>Widescreen</PresentationFormat>
  <Slides>${slides.length}</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>
  <Company>Yala Rajabhat University</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
);

// 4.4 ppt/presentation.xml & ppt/_rels/presentation.xml.rels
const sldIdEntries = slides
  .map((_, idx) => `    <p:sldId id="${256 + idx}" r:id="rIdSlide${idx + 1}"/>`)
  .join('\n');

zip.addFile(
  'ppt/presentation.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
${sldIdEntries}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_W_EMU}" cy="${SLIDE_H_EMU}"/>
  <p:notesSz cx="${SLIDE_H_EMU}" cy="${SLIDE_W_EMU}"/>
  <p:defaultTextStyle>
    <a:defPPr>
      <a:defRPr lang="th-TH"/>
    </a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`
);

const presSlideRels = slides
  .map(
    (_, idx) =>
      `  <Relationship Id="rIdSlide${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`
  )
  .join('\n');

zip.addFile(
  'ppt/_rels/presentation.xml.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rIdPresProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rIdViewProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  <Relationship Id="rIdTableStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
${presSlideRels}
</Relationships>`
);

// 4.5 ppt/presProps.xml, viewProps.xml, tableStyles.xml
zip.addFile(
  'ppt/presProps.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
);

zip.addFile(
  'ppt/viewProps.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
          xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>
  <p:slideViewPr>
    <p:cSldViewPr>
      <p:cViewPr varScale="1">
        <p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale>
        <p:origin x="0" y="0"/>
      </p:cViewPr>
    </p:cSldViewPr>
  </p:slideViewPr>
</p:viewPr>`
);

zip.addFile(
  'ppt/tableStyles.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`
);

// 4.6 ppt/slideMasters/slideMaster1.xml & rels
zip.addFile(
  'ppt/slideMasters/slideMaster1.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rIdLayout1"/>
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200" b="1"/></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr algn="l"><a:defRPr sz="1600"/></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`
);

zip.addFile(
  'ppt/slideMasters/_rels/slideMaster1.xml.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
);

// 4.7 ppt/slideLayouts/slideLayout1.xml & rels
zip.addFile(
  'ppt/slideLayouts/slideLayout1.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
);

zip.addFile(
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
);

// 4.8 ppt/theme/theme1.xml
zip.addFile(
  'ppt/theme/theme1.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="FarmGAP Clean Theme">
  <a:themeElements>
    <a:clrScheme name="FarmGAP">
      <a:dk1><a:srgbClr val="0F172A"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="334155"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="059669"/></a:accent1>
      <a:accent2><a:srgbClr val="0D9488"/></a:accent2>
      <a:accent3><a:srgbClr val="D97706"/></a:accent3>
      <a:accent4><a:srgbClr val="2563EB"/></a:accent4>
      <a:accent5><a:srgbClr val="E11D48"/></a:accent5>
      <a:accent6><a:srgbClr val="10B981"/></a:accent6>
      <a:hlink><a:srgbClr val="059669"/></a:hlink>
      <a:folHlink><a:srgbClr val="047857"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="FarmGAP Fonts">
      <a:majorFont>
        <a:latin typeface="${FONT_FAMILY}"/>
        <a:ea typeface="${FONT_FAMILY}"/>
        <a:cs typeface="${FONT_FAMILY}"/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="${FONT_FAMILY}"/>
        <a:ea typeface="${FONT_FAMILY}"/>
        <a:cs typeface="${FONT_FAMILY}"/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="FarmGAP Formats">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`
);

// 4.9 Add all slides and their relationships
slides.forEach((slide, idx) => {
  const num = idx + 1;
  zip.addFile(`ppt/slides/slide${num}.xml`, slide.toXml());
  zip.addFile(`ppt/slides/_rels/slide${num}.xml.rels`, slide.toRelsXml());
});

// 4.10 Add all registered PNG images into ppt/media/
for (const info of Object.values(mediaMap)) {
  zip.addFile(`ppt/media/${info.mediaName}`, info.buf);
}

// Write final .pptx file
const outputPath = path.resolve('FarmGAP-Presentation.pptx');
fs.writeFileSync(outputPath, zip.toBuffer());
console.log(`✅ Successfully generated ${slides.length}-slide presentation: ${outputPath}`);
