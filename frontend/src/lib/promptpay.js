import QRCode from 'qrcode';

/**
 * Bank of Thailand Standard EMVCo PromptPay Constants
 * Ref: Bank of Thailand & EMVCo QR Code Specification (dtinth/promptpay-qr)
 */
const ID_PAYLOAD_FORMAT = '00';
const ID_POI_METHOD = '01';
const ID_MERCHANT_INFORMATION_BOT = '29';
const ID_TRANSACTION_CURRENCY = '53';
const ID_TRANSACTION_AMOUNT = '54';
const ID_COUNTRY_CODE = '58';
const ID_CRC = '63';

const PAYLOAD_FORMAT_EMV_QRCPS_MERCHANT_PRESENTED_MODE = '01';
const POI_METHOD_STATIC = '11';
const POI_METHOD_DYNAMIC = '12';
const MERCHANT_INFORMATION_TEMPLATE_ID_GUID = '00';
const BOT_ID_MERCHANT_PHONE_NUMBER = '01';
const BOT_ID_MERCHANT_TAX_ID = '02';
const BOT_ID_MERCHANT_EWALLET_ID = '03';

// Official Bank of Thailand PromptPay Application Identifier (AID)
const GUID_PROMPTPAY = 'A000000677010111';
const TRANSACTION_CURRENCY_THB = '764';
const COUNTRY_CODE_TH = 'TH';

/**
 * Helper to encode Tag-Length-Value (TLV)
 */
function f(id, value) {
  const valStr = String(value);
  const lenStr = ('00' + valStr.length).slice(-2);
  return `${id}${lenStr}${valStr}`;
}

/**
 * Helper to join non-empty parts
 */
function serialize(parts) {
  return parts.filter(Boolean).join('');
}

/**
 * Clean target string (keep only digits)
 */
export function sanitizeTarget(id) {
  return String(id || '').replace(/[^0-9]/g, '');
}

/**
 * Format target ID to BOT standard:
 * - Mobile Phone (10 digits starting with 0, or 9 digits): padded to 13 digits with country code 66 (e.g. 0066812345678)
 * - Tax ID / Citizen ID (13 digits): raw 13 digits
 * - e-Wallet (15 digits): raw 15 digits
 */
export function formatTarget(id) {
  const numbers = sanitizeTarget(id);
  if (numbers.length >= 13) return numbers;
  return ('0000000000000' + numbers.replace(/^0/, '66')).slice(-13);
}

/**
 * Standard CRC16-CCITT / XMODEM calculation (Polynomial: 0x1021, Initial: 0xFFFF)
 */
export function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

/**
 * Parse numeric amount safely
 */
function parseAmount(amount) {
  if (typeof amount === 'number' && !isNaN(amount) && amount > 0) {
    return amount;
  }
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (amount && typeof amount === 'object' && typeof amount.amount === 'number' && amount.amount > 0) {
    return amount.amount;
  }
  return null;
}

/**
 * Generate Bank of Thailand standard EMVCo PromptPay Payload
 * Supports both static QR and dynamic QR with locked amount (Tag 54)
 * @param {string} target - Mobile number (10 digits), National ID (13 digits), or e-Wallet ID (15 digits)
 * @param {number|string|object} [amount] - Amount in Thai Baht (THB)
 * @returns {string} EMVCo standard payload string
 */
export function generatePromptPayPayload(target, amount) {
  const cleanTarget = sanitizeTarget(target);
  if (!cleanTarget) {
    throw new Error('กรุณาระบุหมายเลขพร้อมเพย์ (เบอร์โทรศัพท์หรือเลขบัตรประชาชน)');
  }

  const numAmount = parseAmount(amount);

  const targetType = cleanTarget.length >= 15
    ? BOT_ID_MERCHANT_EWALLET_ID
    : cleanTarget.length >= 13
      ? BOT_ID_MERCHANT_TAX_ID
      : BOT_ID_MERCHANT_PHONE_NUMBER;

  const data = [
    f(ID_PAYLOAD_FORMAT, PAYLOAD_FORMAT_EMV_QRCPS_MERCHANT_PRESENTED_MODE),
    f(ID_POI_METHOD, numAmount ? POI_METHOD_DYNAMIC : POI_METHOD_STATIC),
    f(ID_MERCHANT_INFORMATION_BOT, serialize([
      f(MERCHANT_INFORMATION_TEMPLATE_ID_GUID, GUID_PROMPTPAY),
      f(targetType, formatTarget(cleanTarget))
    ])),
    f(ID_COUNTRY_CODE, COUNTRY_CODE_TH),
    f(ID_TRANSACTION_CURRENCY, TRANSACTION_CURRENCY_THB),
    numAmount ? f(ID_TRANSACTION_AMOUNT, numAmount.toFixed(2)) : null
  ];

  const dataToCrc = serialize(data) + ID_CRC + '04';
  const checksum = crc16(dataToCrc);
  data.push(f(ID_CRC, checksum));

  return serialize(data);
}

/**
 * Generate Base64 Data URL for PromptPay QR Code
 * @param {string} target - PromptPay Number
 * @param {number|string|object} [amount] - Amount in THB
 * @param {object} [options] - QRCode options
 * @returns {Promise<string>} Base64 Data URL (image/png)
 */
export async function generatePromptPayQR(target, amount, options = {}) {
  const payload = generatePromptPayPayload(target, amount);
  return await QRCode.toDataURL(payload, {
    width: options.width || 320,
    margin: options.margin !== undefined ? options.margin : 2,
    color: {
      dark: options.darkColor || '#000000',
      light: options.lightColor || '#ffffff'
    },
    errorCorrectionLevel: 'M',
    ...options
  });
}
