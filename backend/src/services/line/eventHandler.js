import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';
import { client, lineConfig, getChatSession, setChatSession, clearChatSession } from './config.js';
import { askGemini, isCancelWithGemini } from './ai/gemini.js';
import { getFarmContext, getOwnerContactInfo } from './ai/farmContext.js';
import { extractOrderIntent } from './parsers/orderIntent.js';
import { parseSmartCustomerContact, detectPaymentMethodWithGemini } from './parsers/addressParser.js';
import { replyWelcome } from './flex/welcomeCard.js';
import { replyVegMenu } from './flex/vegMenuCard.js';
import { replyWebStoreLink } from './flex/webStoreCard.js';
import { replyInvoiceAndPayment, replySlipConfirmed } from './flex/invoiceCard.js';
import { replyCodOrderConfirmation } from './flex/codCard.js';
import { replyPaymentMethodSelection } from './flex/paymentSelectionCard.js';
import { replyOrderStatus, replyOrderHistory } from './flex/orderStatusCard.js';
import { replyRefundInstructions, replyOwnerContact } from './flex/refundCard.js';
import { replyMissingContactInfo } from './flex/missingContactCard.js';
import { sendSmartOrderDraftConfirmation } from './flex/orderDraftCard.js';
import { createChatOrder, cancelChatOrder } from './orderService.js';
import { notifyAdminNewOrder } from './notifications/adminNotifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper: ดักจับเจตนายกเลิกออเดอร์ในทุกรูปแบบภาษาคน (รวมถึงคำลงท้าย ครับ/ค่ะ, ข้อความยาว, หรือพิมพ์ผิด เช่น ยกเลิกช)
export function isCancelIntent(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const t = rawText.trim().toLowerCase();
  const cleaned = t.replace(/[\s.,!?~_\-]/g, '');

  if (cleaned.includes('ไม่ยกเลิก') || cleaned.includes('อย่ายกเลิก') || cleaned.includes('อย่าเพิ่งยกเลิก')) {
    return false;
  }

  const cancelRegex = /(?:ขอ|ช่วย)?ยกเลิก|ไม่เอา|ไม่ซื้อ|ไม่อยากได้|ลบออเดอร์|ลบรายการ|cancel|cancle/;
  return cancelRegex.test(cleaned);
}

// Helper: ตรวจสอบว่าข้อความที่ลูกค้าพิมพ์มีเจตนาต้องการดูเมนูผักหรือรายการสินค้าหรือไม่
export function isMenuInquiry(rawText) {
  const clean = String(rawText || '').trim().toLowerCase();
  if (['เมนูผัก', 'เมนุผัก', 'สั่งซื้อ', 'เมนู', 'เมนุ', 'menu', 'ดูเมนู', 'ดูเมนุ', 'ขอดูเมนู', 'ขอดูเมนุ', 'สั่งผัก', 'ซื้อผัก', 'รายการผัก', 'ผัก', 'รายการสินค้า', 'ผักพร้อมส่ง'].includes(clean)) {
    return true;
  }

  const menuKeywords = [
    'มีเมนูอะไร',
    'มีเมนุอะไร',
    'เมนูอะไรบ้าง',
    'เมนุอะไรบ้าง',
    'เมนูมีอะไร',
    'เมนุมีอะไร',
    'มีเมนู',
    'มีเมนุ',
    'มีผักอะไร',
    'ผักอะไรบ้าง',
    'ผักมีอะไร',
    'มีอะไรบ้างวันนี้',
    'วันนี้มีอะไรบ้าง',
    'มีอะไรบ้าง',
    'ขายอะไรบ้าง',
    'มีอะไรขาย',
    'ขายอะไร',
    'ขอดูเมนู',
    'ขอดูเมนุ',
    'ดูเมนู',
    'ดูเมนุ',
    'ขอเมนู',
    'ขอเมนุ',
    'เปิดเมนู',
    'เปิดเมนุ',
    'รายการผัก',
    'รายการสินค้า',
    'ผักพร้อมส่ง',
    'ผักสดมีอะไร',
    'ขอดูผัก',
    'ดูผัก',
    'อยากสั่งผัก',
    'สั่งผักอะไรได้บ้าง',
    'มีผักไหม',
    'มีผักมั้ย',
    'ผักมีไหม',
    'ผักมีมั้ย',
    'มีของไหม',
    'มีของมั้ย',
    'วันนี้มีผัก',
  ];

  if (menuKeywords.some(kw => clean.includes(kw))) {
    const isDirectQuantityOrder = /\d+\s*(กิโล|กก|แพ็ค|ถุง|ขีด|ต้น|กระปุก|กล่อง)/.test(clean);
    if (!isDirectQuantityOrder) {
      return true;
    }
  }

  return false;
}

// Event parser and router
export async function handleEvent(event) {
  const userId = event.source?.userId;
  if (!userId) return;

  // 1. Follow Event: New user friends the official account
  if (event.type === 'follow') {
    let displayName = 'ลูกค้า LINE';
    let pictureUrl = null;

    try {
      if (lineConfig.channelAccessToken && lineConfig.channelAccessToken !== 'dummy_token') {
        const profile = await client.getProfile(userId);
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl;
      }
    } catch (e) {
      console.warn('Failed to fetch LINE profile:', e.message);
    }

    const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO customers (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
        [userId, displayName, pictureUrl]
      );
    } else {
      await pool.query(
        'UPDATE customers SET display_name = ?, picture_url = ? WHERE line_user_id = ?',
        [displayName, pictureUrl, userId]
      );
    }

    await replyWelcome(event.replyToken);
    return;
  }

  // 2. Image Message Event: Check if user is uploading a payment slip
  if (event.type === 'message' && event.message.type === 'image') {
    const session = await getChatSession(userId);

    if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
      let slipDataUrl = null;

      try {
        if (lineConfig.channelAccessToken && lineConfig.channelAccessToken !== 'dummy_token') {
          const contentRes = await fetch(
            `https://api-data.line.me/v2/bot/message/${event.message.id}/content`,
            {
              headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}` },
            }
          );
          if (contentRes.ok) {
            const arrayBuffer = await contentRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filename = `slip-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.jpg`;
            const targetPath = path.join(uploadsDir, filename);
            fs.writeFileSync(targetPath, buffer);
            slipDataUrl = `/uploads/${filename}`;
          }
        }
      } catch (imgErr) {
        console.warn('Failed to fetch image from LINE Content API:', imgErr.message);
      }

      // Fallback placeholder if token is dummy or download failed
      if (!slipDataUrl) {
        slipDataUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600&auto=format&fit=crop';
      }

      await pool.query('UPDATE orders SET slip_image_url = ?, status = "paid" WHERE id = ?', [
        slipDataUrl,
        session.order_id,
      ]);

      const orderCode = session.draft_data?.order_code || 'ORD';
      const orderIdForNotify = session.order_id;
      await clearChatSession(userId);
      await replySlipConfirmed(event.replyToken, orderCode);

      // แจ้งเตือนเจ้าของฟาร์มเมื่อลูกค้าสั่งซื้อและแนบสลิปชำระเงินสำเร็จ
      try {
        const [oRows] = await pool.query(
          `SELECT o.*, c.display_name AS customer_name, c.phone AS customer_phone, c.address AS customer_address 
           FROM orders o 
           LEFT JOIN customers c ON o.customer_id = c.id 
           WHERE o.id = ?`,
          [orderIdForNotify]
        );
        if (oRows.length > 0) {
          const [itemsRows] = await pool.query(
            `SELECT oi.*, p.name AS product_name, p.unit 
             FROM order_items oi 
             JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [orderIdForNotify]
          );
          oRows[0].items = itemsRows;
          notifyAdminNewOrder(oRows[0], 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder slip error:', e.message));
        }
      } catch (err) {
        console.error('Error in notifyAdminNewOrder for chat slip:', err.message);
      }
      return;
    }

    // Default image reply
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: 'ขอบคุณสำหรับรูปภาพครับ! หากต้องการสั่งซื้อผักสด สามารถพิมพ์รายการและจำนวนที่ต้องการได้เลยนะครับ เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" 🌱',
        },
      ],
    });
  }

  // 3. Text Message Event
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // คำสั่งพิเศษ: แสดง LINE User ID สำหรับนำไปผูกในหน้าตั้งค่าโปรไฟล์บนเว็บ FarmGAP
    const lowerText = text.toLowerCase();
    if (['myid', 'my id', 'id', 'ไอดี', 'admin', 'แอดมิน'].includes(lowerText)) {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: `🔑 LINE User ID ของคุณคือ:\n\n${userId}\n\n👉 แตะค้างที่ข้อความด้านล่างนี้เพื่อคัดลอกรหัส แล้วนำไปใส่ในหน้า "ตั้งค่าโปรไฟล์" บนเว็บไซต์ FarmGAP ได้เลยครับ 🌱`,
          },
          {
            type: 'text',
            text: userId,
          },
        ],
      });
    }

    // Ensure customer profile exists
    try {
      const [existing] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
      if (existing.length === 0) {
        let displayName = 'ลูกค้า LINE';
        let pictureUrl = null;
        try {
          if (lineConfig.channelAccessToken && lineConfig.channelAccessToken !== 'dummy_token') {
            const profile = await client.getProfile(userId);
            displayName = profile.displayName;
            pictureUrl = profile.pictureUrl;
          }
        } catch (_) {}
        await pool.query(
          'INSERT INTO customers (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
          [userId, displayName, pictureUrl]
        );
      }
    } catch (err) {
      console.error('Customer autosync failed:', err.message);
    }

    // Fetch active session state
    const session = await getChatSession(userId);
    const lowerTrimText = text.toLowerCase().trim();

    // 1. Global Greeting Handler: เมื่อลูกค้าทักทาย (สวัสดี, หหวัดดี, hello, hi ฯลฯ)
    // ส่งการ์ดต้อนรับ replyWelcome ทันทีใน 0.02 วินาที ไม่ผ่าน Gemini และไม่อยู่ใต้สถานะใดๆ
    const isGreeting = (
      ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'hello', 'hi', 'hey', 'start', 'เริ่มต้น', 'เริ่ม'].includes(lowerTrimText) ||
      lowerTrimText.startsWith('สวัสดี') ||
      lowerTrimText.startsWith('หวัดดี') ||
      lowerTrimText === 'ยินดีที่ได้รู้จัก'
    );
    if (isGreeting) {
      if (session && session.state === 'AWAITING_ADDRESS') {
        await clearChatSession(userId);
      }
      return replyWelcome(replyToken);
    }

    // วิเคราะห์เจตนายกเลิก: ตรวจสอบทั้ง Regex แบบ Fast-path และใช้ Gemini AI เฉพาะกรณีที่มีคำบอกเหตุผลยกเลิก
    let shouldCancel = isCancelIntent(text);
    if (!shouldCancel && session.state !== 'IDLE' && !isGreeting) {
      const cancelKeywords = ['เปลี่ยน', 'สะดวก', 'บาย', 'เซิล', 'ผ่าน', 'พอ', 'หยุด', 'ไม่พร้อม', 'ไว้ก่อน'];
      if (cancelKeywords.some(k => lowerTrimText.includes(k))) {
        shouldCancel = await isCancelWithGemini(text);
      }
    }

    // Global cancellation handler (เข้าใจภาษาธรรมชาติ เช่น ยกเลิกช, ยกเลิก ครับ, ขอยกเลิก, ไม่เอาแล้ว, ภาษาพูดนอกบท)
    if (shouldCancel) {
      if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
        const cancelledCode = await cancelChatOrder(session.order_id);
        const owner = await getOwnerContactInfo();
        await clearChatSession(userId);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: `ยกเลิกออเดอร์ ${cancelledCode} และคืนสต็อกผักสดเรียบร้อยแล้วครับ 🌱\n\n💸 หากคุณลูกค้าได้ทำการโอนเงินเข้ามาก่อนหน้านี้ สามารถส่งรูปสลิปพร้อมเลขบัญชีสำหรับรับเงินคืนในแชทนี้ หรือโทรแจ้งเจ้าของฟาร์มได้ที่เบอร์ ${owner.phone} (คุณ${owner.displayName}) ได้เลยครับ`,
            },
          ],
        });
      }

      if (session.state === 'AWAITING_ADDRESS' || session.state === 'AWAITING_PAYMENT_METHOD') {
        await clearChatSession(userId);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: 'ยกเลิกรายการสั่งซื้อเรียบร้อยแล้วครับ หากต้องการสั่งซื้อใหม่อีกครั้ง แจ้งได้ตลอดเวลาครับ 🌱',
            },
          ],
        });
      }

      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: 'ขณะนี้ไม่มีรายการที่อยู่ระหว่างการสั่งซื้อครับ หากต้องการสั่งผักสด พิมพ์แจ้งรายการได้เลยครับ เช่น "สั่งกรีนโอ๊ค 2 แพ็ค" 🌱',
          },
        ],
      });
    }

    // STATE: AWAITING_ADDRESS (Customer is providing shipping address & phone)
    if (session.state === 'AWAITING_ADDRESS' && session.draft_data?.items) {
      const items = session.draft_data.items;
      const totalAmount = session.draft_data.totalAmount || session.draft_data.total_amount;
      const draft = session.draft_data;

      // 1. ตรวจสอบว่าผู้ใช้สั่งซื้อใหม่ หรือต้องการเปลี่ยนรายการผักในออเดอร์หรือไม่
      const orderCheck = await extractOrderIntent(text);
      if (orderCheck.isOrder) {
        if (orderCheck.error) {
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: orderCheck.error }],
          });
        }
        if (orderCheck.items && orderCheck.items.length > 0) {
          return sendSmartOrderDraftConfirmation(replyToken, userId, orderCheck.items, orderCheck.totalAmount);
        }
      }

      // 2. ตรวจสอบว่าผู้ใช้ขอดูเมนูผักหรือไม่
      if (isMenuInquiry(text)) {
        return replyVegMenu(replyToken, userId);
      }

      // 2.1 ตรวจสอบว่าลูกค้ากดยืนยันใช้ข้อมูลจัดส่งเดิมหรือไม่
      const isConfirmExisting = [
        'ใช้ข้อมูลเดิม', 'ข้อมูลเดิม', 'ที่อยู่เดิม', 'ที่เดิม', 'เหมือนเดิม',
        'ส่งที่เดิม', 'ใช้ที่อยู่เดิม', 'ตามเดิม', 'ใช่', 'ใช่ครับ', 'ใช่ค่ะ', 'ตกลง', 'ok', 'yes'
      ].some(k => lowerTrimText === k || lowerTrimText.startsWith(k));

      if (isConfirmExisting) {
        let existingName = draft.existing_contact?.name || draft.contact_name;
        let existingPhone = draft.existing_contact?.phone || draft.contact_phone;
        let existingAddress = draft.existing_contact?.address || draft.contact_address;

        if (!existingAddress || !existingPhone) {
          const [custRows] = await pool.query('SELECT display_name, phone, address FROM customers WHERE line_user_id = ?', [userId]);
          if (custRows.length > 0) {
            existingName = existingName || (custRows[0].display_name !== 'ลูกค้า LINE' ? custRows[0].display_name : 'คุณลูกค้า');
            existingPhone = existingPhone || custRows[0].phone;
            existingAddress = existingAddress || custRows[0].address;
          }
        }

        if (existingAddress && existingPhone && existingAddress !== '-' && existingPhone !== '-') {
          const contactDraft = {
            ...draft,
            items,
            totalAmount,
            contact_name: existingName || 'คุณลูกค้า',
            contact_phone: existingPhone,
            contact_address: existingAddress,
          };

          // Transition to AWAITING_PAYMENT_METHOD and ask customer to choose
          await setChatSession(userId, 'AWAITING_PAYMENT_METHOD', null, contactDraft);
          return replyPaymentMethodSelection(replyToken, contactDraft);
        }
      }

      // Extract clean name, phone, address with hybrid AI & Regex
      const parsedContact = await parseSmartCustomerContact(text);

      // Merge with previously collected info in session draft
      const mergedName = parsedContact.name || draft.contact_name || null;
      const mergedPhone = parsedContact.phone || draft.contact_phone || null;
      const mergedAddress = parsedContact.address || draft.contact_address || null;

      // Fetch customer profile from DB
      const [customers] = await pool.query('SELECT * FROM customers WHERE line_user_id = ?', [userId]);
      const customer = customers[0] || {};

      // Determine missing fields
      const missingList = [];
      if (!mergedAddress) {
        missingList.push('🏠 ที่อยู่จัดส่ง (เช่น บ้านเลขที่, ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์)');
      }
      if (!mergedPhone) {
        missingList.push('📱 เบอร์โทรศัพท์ติดต่อ (10 หลัก สำหรับขนส่งโทรติดต่อ)');
      }
      if (!mergedName && (!customer.display_name || customer.display_name === 'ลูกค้า LINE')) {
        missingList.push('👤 ชื่อ-นามสกุล หรือชื่อเล่นของผู้รับ');
      }

      // ตรวจสอบว่าในข้อความนี้ มีข้อมูลติดต่อ (ชื่อ หรือ เบอร์ หรือ ที่อยู่) หรือไม่
      const providedContactInThisMsg = Boolean(
        parsedContact.name ||
        parsedContact.phone ||
        parsedContact.address
      );

      // ถ้าในข้อความนี้ไม่มีข้อมูลที่อยู่ เบอร์ หรือชื่อเลย และยังมีข้อมูลที่ขาดอยู่
      // แสดงว่าผู้ใช้กำลังพิมพ์สอบถามคำถาม หรือพูดคุยทั่วไป -> ให้ Gemini AI ตอบคำถามตามจริงทันที ไม่ตอบตัดบทซ้ำเดิม
      if (!providedContactInThisMsg && missingList.length > 0) {
        try {
          const farmContext = await getFarmContext();
          const itemsSummary = items.map(i => `${i.name} ${i.quantity} ${i.unit || 'แพ็ค'}`).join(', ');
          const addressInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้ากำลังทำรายการสั่งซื้อผักสด (${itemsSummary} ยอดรวม ฿${Number(totalAmount).toLocaleString()} บาท) และอยู่ในขั้นตอนพิมพ์แจ้งข้อมูลจัดส่ง (ชื่อ, เบอร์โทร, ที่อยู่)
[คำสั่งสำหรับ AI]:
1. ตอบคำถามหรือข้อความของลูกค้าอย่างสุภาพ เป็นมิตร และชาญฉลาดตามคำถามจริง
2. ต่อท้ายคำตอบด้วยข้อความแนะนำสั้นๆ: "(สามารถพิมพ์แจ้งชื่อ เบอร์โทร และที่อยู่จัดส่งในแชทนี้ได้เลยครับ หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกครับ 🌱)"`;

          const aiReply = await askGemini(text, addressInstruction);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: aiReply }],
          });
        } catch (err) {
          console.error('Error answering AWAITING_ADDRESS with Gemini:', err.message);
        }
      }

      // If any required field is missing, save current draft progress and prompt the customer
      if (missingList.length > 0) {
        await setChatSession(userId, 'AWAITING_ADDRESS', null, {
          ...draft,
          contact_name: mergedName,
          contact_phone: mergedPhone,
          contact_address: mergedAddress,
        });

        return replyMissingContactInfo(
          replyToken,
          {
            name: mergedName || (customer.display_name !== 'ลูกค้า LINE' ? customer.display_name : null),
            phone: mergedPhone,
            address: mergedAddress,
          },
          missingList
        );
      }

      // All required contact info is complete!
      const contactDraft = {
        ...draft,
        items,
        totalAmount,
        contact_name: mergedName,
        contact_phone: mergedPhone,
        contact_address: mergedAddress,
      };

      // Check if user explicitly stated payment method in this message
      const lowerText = text.toLowerCase();
      const isCodExplicit = lowerText.includes('ปลายทาง') || lowerText.includes('cod') || lowerText.includes('เก็บปลายทาง') || lowerText.includes('เงินสด');
      const isTransferExplicit = lowerText.includes('โอนเงิน') || lowerText.includes('โอน') || lowerText.includes('พร้อมเพย์') || lowerText.includes('qr');

      if (isCodExplicit) {
        try {
          const created = await createChatOrder(userId, contactDraft, 'cod');
          await clearChatSession(userId);
          notifyAdminNewOrder(created.fullOrder, 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder error:', e.message));
          return replyCodOrderConfirmation(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create COD order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      if (isTransferExplicit) {
        try {
          const created = await createChatOrder(userId, contactDraft, 'transfer');
          await setChatSession(userId, 'AWAITING_PAYMENT', created.orderId, {
            order_code: created.orderCode,
            total_amount: created.totalAmount,
            items: created.items,
            address: created.finalAddress,
            customer_name: created.finalName,
            phone: created.finalPhone,
          });
          return replyInvoiceAndPayment(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create transfer order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      // Transition to AWAITING_PAYMENT_METHOD and ask customer to choose
      await setChatSession(userId, 'AWAITING_PAYMENT_METHOD', null, contactDraft);
      return replyPaymentMethodSelection(replyToken, contactDraft);
    }

    // STATE: AWAITING_PAYMENT_METHOD (Customer is choosing between Bank Transfer and COD)
    if (session.state === 'AWAITING_PAYMENT_METHOD' && session.draft_data?.items) {
      // ตรวจสอบว่าลูกค้าเปลี่ยนใจพิมพ์สั่งซื้อใหม่หรือไม่
      const orderCheck = await extractOrderIntent(text);
      if (orderCheck.isOrder) {
        if (orderCheck.error) {
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: orderCheck.error }],
          });
        }
        if (orderCheck.items && orderCheck.items.length > 0) {
          return sendSmartOrderDraftConfirmation(replyToken, userId, orderCheck.items, orderCheck.totalAmount);
        }
      }

      const lowerText = text.toLowerCase().trim();
      let isCod = lowerText === 'เก็บเงินปลายทาง' || lowerText === 'ปลายทาง' || lowerText === 'cod' || lowerText.includes('ปลายทาง') || lowerText.includes('cod') || lowerText === '2' || lowerText.includes('เงินสด');
      let isTransfer = lowerText === 'โอนเงิน' || lowerText === 'โอน' || lowerText.includes('โอน') || lowerText.includes('พร้อมเพย์') || lowerText.includes('qr') || lowerText === '1' || lowerText === 'transfer';

      // ชั้นที่ 2: หาก Fast-path ยังไม่ตรง ให้ Gemini AI ช่วยวิเคราะห์เจตนาเลือกช่องทางชำระเงินจากภาษาพูด
      if (!isCod && !isTransfer) {
        const aiMethod = await detectPaymentMethodWithGemini(text);
        if (aiMethod === 'cod') isCod = true;
        if (aiMethod === 'transfer') isTransfer = true;
      }

      if (isCod) {
        try {
          const created = await createChatOrder(userId, session.draft_data, 'cod');
          await clearChatSession(userId);
          notifyAdminNewOrder(created.fullOrder, 'ORDER_COMPLETED').catch(e => console.error('notifyAdminNewOrder error:', e.message));
          return replyCodOrderConfirmation(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create COD order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      if (isTransfer) {
        try {
          const created = await createChatOrder(userId, session.draft_data, 'transfer');
          await setChatSession(userId, 'AWAITING_PAYMENT', created.orderId, {
            order_code: created.orderCode,
            total_amount: created.totalAmount,
            items: created.items,
            address: created.finalAddress,
            customer_name: created.finalName,
            phone: created.finalPhone,
          });
          return replyInvoiceAndPayment(replyToken, created.orderCode, created.totalAmount, created.items, created.formattedAddressDisplay);
        } catch (err) {
          console.error('Failed to create transfer order:', err.message);
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้งครับ' }],
          });
        }
      }

      // If user typed something else, respond with Gemini AI or payment selection
      try {
        const farmContext = await getFarmContext();
        const methodInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้ากำลังอยู่ในขั้นตอนเลือกช่องทางชำระเงิน (มี 2 ตัวเลือก: 1. โอนเงินผ่าน QR Code หรือ 2. เก็บเงินปลายทาง COD)
[คำสั่งสำหรับ AI]: ตอบคำถามหรือข้อความของลูกค้าอย่างสุภาพและเป็นมิตร และต่อท้ายด้วยคำถามว่าลูกค้าสะดวกชำระแบบ "โอนเงิน" หรือ "เก็บเงินปลายทาง" เพื่อดำเนินรายการต่อ`;
        const aiReply = await askGemini(text, methodInstruction);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: aiReply }],
        });
      } catch (_) {
        return replyPaymentMethodSelection(replyToken, session.draft_data);
      }
    }

    // STATE: AWAITING_PAYMENT (Customer typed text instead of sending slip image)
    if (session.state === 'AWAITING_PAYMENT' && session.order_id) {
      // ตรวจสอบว่าลูกค้าเปลี่ยนใจพิมพ์สั่งซื้อใหม่หรือไม่
      const orderCheck = await extractOrderIntent(text);
      if (orderCheck.isOrder) {
        if (orderCheck.error) {
          return client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: orderCheck.error }],
          });
        }
        if (orderCheck.items && orderCheck.items.length > 0) {
          return sendSmartOrderDraftConfirmation(replyToken, userId, orderCheck.items, orderCheck.totalAmount);
        }
      }

      const orderCode = session.draft_data?.order_code || 'ORD';
      const totalAmount = session.draft_data?.total_amount || 0;

      // ใช้ Gemini AI ช่วยตอบคำถามหรือข้อความของลูกค้า พร้อมแนบคำแนะนำการชำระเงิน/ยกเลิกท้ายข้อความอย่างเป็นมิตร
      try {
        const farmContext = await getFarmContext();
        const paymentInstruction = `${farmContext}
[สถานะปัจจุบันของลูกค้า]: ลูกค้าเพิ่งทำรายการสั่งซื้อออเดอร์หมายเลข ${orderCode} (ยอดชำระ ฿${Number(totalAmount).toLocaleString()} บาท) และอยู่ในขั้นตอนรอยืนยันการชำระเงิน (รอส่งรูปสลิปโอนเงิน)
[คำสั่งสำหรับ AI]:
1. ตอบคำถามหรือพูดคุยกับลูกค้าอย่างสุภาพ เป็นมิตร และชาญฉลาดตามสิ่งที่ลูกค้าพิมพ์มา
2. ต่อท้ายคำตอบด้วยข้อความสั้นๆ: "📌 (สำหรับออเดอร์ ${orderCode} ยอด ฿${Number(totalAmount).toLocaleString()} บาท สามารถแนบรูปสลิปเพื่อยืนยัน หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกครับ)"`;

        const aiReply = await askGemini(text, paymentInstruction);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: aiReply,
            },
          ],
        });
      } catch (err) {
        console.error('Error answering AWAITING_PAYMENT with Gemini:', err.message);
        return client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: `ขณะนี้คุณมีออเดอร์ ${orderCode} (ยอดชำระ ฿${Number(totalAmount).toLocaleString()} บาท) รอยืนยันการชำระเงินครับ\n\n📸 เมื่อโอนแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ\n❌ หรือพิมพ์ 'ยกเลิก' หากต้องการยกเลิกออเดอร์ครับ 🌱`,
            },
          ],
        });
      }
    }

    // STATE: IDLE (Standard conversation or new order intent)
    if (isMenuInquiry(text)) {
      return replyVegMenu(replyToken, userId);
    }
    if (
      ['เช็คสถานะ', 'ออเดอร์', 'สถานะ', 'สถานะออเดอร์', 'เช็คสถานะออเดอร์', 'ติดตามพัสดุ', 'เช็คพัสดุ', 'เช็คออเดอร์', 'ดูสถานะ', 'ตรวจสอบสถานะ'].includes(text) ||
      text.startsWith('เช็คสถานะ') ||
      text.startsWith('ดูสถานะ') ||
      text === 'status' ||
      lowerTrimText.includes('เช็คสถานะ') ||
      lowerTrimText.includes('ตามของ') ||
      lowerTrimText.includes('ส่งถึงไหน') ||
      lowerTrimText.includes('ของส่งยัง') ||
      lowerTrimText.includes('พัสดุถึงไหน')
    ) {
      return replyOrderStatus(replyToken, userId);
    }

    if (
      ['ดูประวัติ', 'ประวัติ', 'ประวัติการสั่งซื้อ', 'ประวัติออเดอร์', 'ดูประวัติการสั่งซื้อ', 'ประวัติการซื้อ'].includes(text) ||
      text.includes('ดูประวัติ') ||
      text.includes('ประวัติการสั่งซื้อ') ||
      text.includes('เคยสั่ง') ||
      text.includes('ออเดอร์เก่า') ||
      text === 'history'
    ) {
      return replyOrderHistory(replyToken, userId);
    }

    // ตรวจสอบคำถามขอเงินคืน (Refund)
    const isRefundInquiry = [
      'ขอเงินคืน', 'คืนเงิน', 'ขอเงินคืนยังไง', 'เงินคืน', 'ขอเงินคืนครับ',
      'ขอเงินคืนค่ะ', 'refund', 'ได้เงินคืนยังไง', 'ขอคืนเงิน', 'โอนแล้วขอยกเลิก', 'โอนเงินแล้วขอยกเลิก'
    ].some(k => lowerTrimText.includes(k));

    if (isRefundInquiry) {
      return replyRefundInstructions(replyToken);
    }

    // ตรวจสอบคำถามขอเบอร์โทร / ช่องทางติดต่อเจ้าของฟาร์มโดยตรง
    const isContactInquiry = (
      ['ขอเบอร์', 'เบอร์โทร', 'ขอเบอร์ติดต่อ', 'เบอร์ติดต่อ', 'ติดต่อเจ้าของ', 'ติดต่อคน', 'ติดต่อแอดมิน', 'เบอร์ฟาร์ม', 'ขอเบอร์โทร', 'โทรหาใคร', 'เบอร์โทรศัพท์'].some(k => lowerTrimText.includes(k)) ||
      (lowerTrimText.includes('เบอร์') && (lowerTrimText.includes('เจ้าของ') || lowerTrimText.includes('ฟาร์ม') || lowerTrimText.includes('แอดมิน') || lowerTrimText.includes('ติดต่อ')))
    );

    if (isContactInquiry) {
      return replyOwnerContact(replyToken);
    }

    // ตรวจสอบคำถามขอสั่งซื้อผ่านหน้าเว็บ / ขอลิงก์หน้าร้าน LIFF
    const isWebStoreInquiry = [
      'สั่งบนเว็บ', 'สั่งในเว็บ', 'สั่งผ่านเว็บ', 'หน้าเว็บ', 'หน้าร้าน', 'เว็บ', 'เว็ป', 'เวบ',
      'web', 'liff', 'ขอลิ้งค์', 'ขอลิงก์', 'ลิ้งสั่งซื้อ', 'ลิงก์สั่งซื้อ', 'สั่งซื้อผ่านเว็บ', 'เปิดเว็บ', 'เปิดหน้าร้าน', 'ขอเว็บ', 'สั่งผ่านเว็บยังไง'
    ].some(k => lowerTrimText === k || lowerTrimText.includes(k));

    if (isWebStoreInquiry) {
      return replyWebStoreLink(replyToken);
    }

    // Check if customer is attempting to cancel an order from IDLE state
    const isIdleCancel = isCancelIntent(text) || (await isCancelWithGemini(text));
    if (isIdleCancel) {
      try {
        const [orders] = await pool.query(
          `SELECT o.id, o.order_code, o.payment_method, o.status 
           FROM orders o 
           JOIN customers c ON o.customer_id = c.id 
           WHERE c.line_user_id = ? 
           ORDER BY o.id DESC LIMIT 1`,
          [userId]
        );
        if (orders.length > 0) {
          const lastOrder = orders[0];
          const st = (lastOrder.status || '').toLowerCase();
          const pm = (lastOrder.payment_method || '').toLowerCase();
          if (st === 'pending') {
            if (pm === 'transfer') {
              return replyRefundInstructions(replyToken);
            } else if (pm === 'cod') {
              await pool.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [lastOrder.id]);
              return client.replyMessage({
                replyToken: replyToken,
                messages: [
                  {
                    type: 'text',
                    text: `ยกเลิกออเดอร์เก็บเงินปลายทาง (${lastOrder.order_code}) เรียบร้อยแล้วครับ หากต้องการสั่งซื้อใหม่สามารถพิมพ์บอกผักที่ต้องการได้เลยครับ 🌱`,
                  },
                ],
              });
            }
          }
        }
      } catch (err) {
        console.error('Error handling IDLE cancel check:', err.message);
      }
    }

    // 1. ตรวจสอบการสั่งซื้อผักสดก่อนเป็นอันดับแรก (Local Order Intent Extraction - ตอบกลับได้ใน < 2ms ไม่ต้องรอ Gemini)
    const orderIntent = await extractOrderIntent(text);

    if (orderIntent.isOrder) {
      if (orderIntent.error) {
        return client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: orderIntent.error }],
        });
      }

      if (orderIntent.items && orderIntent.items.length > 0) {
        return sendSmartOrderDraftConfirmation(replyToken, userId, orderIntent.items, orderIntent.totalAmount);
      }
    }

    // 2. Smart Address & Contact Parser (เฉพาะกรณีที่ไม่ได้สั่งซื้อ และผู้ใช้พิมพ์ข้อมูลจัดส่งเข้ามา)
    const contactInfo = await parseSmartCustomerContact(text);
    if (contactInfo.hasAddress || (contactInfo.phone && contactInfo.address)) {
      try {
        await pool.query(
          'UPDATE customers SET address = COALESCE(?, address), phone = COALESCE(?, phone), display_name = COALESCE(?, display_name) WHERE line_user_id = ?',
          [contactInfo.address, contactInfo.phone, contactInfo.name, userId]
        );
      } catch (_) {}

      return client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: `ฟาร์มได้รับข้อมูลจัดส่งเรียบร้อยแล้วครับ ${contactInfo.name ? `(คุณ${contactInfo.name})` : ''} 📦🌱\n\nแต่ขณะนี้ยังไม่พบรายการผักสดที่ต้องการสั่งซื้อ รบกวนคุณลูกค้าพิมพ์บอกผักและจำนวนที่ต้องการสั่งได้เลยครับ เช่น:\n• "ขอสั่งผักกาดขาว 10 กิโล"\n• "สั่งกรีนโอ๊ค 2 แพ็ค"\n\nหรือพิมพ์ "เมนูผัก" เพื่อเลือกชมสินค้าทั้งหมดได้เลยครับ!`,
          },
        ],
      });
    }

    // Default conversational AI fallback (Gemini with farm context)
    try {
      const systemInstruction = await getFarmContext();
      const responseText = await askGemini(text, systemInstruction);

      // หาก AI วิเคราะห์แล้วว่าลูกค้าอยากดูเมนูผัก ให้แสดง Flex Message เมนูผักสวยๆ ทันที
      if (responseText.includes('[SHOW_MENU_CARD]') || isMenuInquiry(responseText)) {
        return replyVegMenu(replyToken, userId);
      }

      try {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: 'text', text: responseText }],
        });
      } catch (replyErr) {
        console.error('Failed to reply message to LINE:', replyErr.message);
      }
    } catch (err) {
      console.error('Error in conversational AI processing:', err.message);
      try {
        await replyVegMenu(replyToken, userId);
      } catch (_) {}
    }
  }
}
