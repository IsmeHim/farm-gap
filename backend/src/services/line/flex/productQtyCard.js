import { client, getChatSession } from '../config.js';

// Flex Message: การ์ดเลือกจำนวนผักสุดน่ารักสำหรับใส่ตะกร้า (In-Chat Cart)
export async function replyProductQuantityCard(replyToken, userId, product) {
  if (!product || product.stock_quantity <= 0) {
    return client.replyMessage({
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: `ขออภัยครับ ขณะนี้ผัก "${product?.name || 'รายการนี้'}" ในสต็อกหมดชั่วคราวครับ 🌱\nสามารถพิมพ์ "เมนูผัก" เพื่อเลือกดูรายการอื่นๆ ที่พร้อมส่งได้เลยครับ 😊`,
        },
      ],
    });
  }

  // ดึงชื่อผักแบบสั้นสำหรับใส่ในปุ่ม เช่น "ผักคอส", "กรีนโอ๊ค", "ผักบุ้งจีน"
  const cleanName = product.name
    .replace(/\([^)]*\)/g, '')
    .replace(/สด|gap|พรีเมียม|เนื้อนุ่ม|กรอบพรีเมียม/gi, '')
    .trim();
  const shortName = cleanName.length > 0 ? cleanName : product.name;
  const unitPrice = Number(product.price) || 20;
  const stock = Number(product.stock_quantity);

  // เช็คว่ามีสินค้าในตะกร้าเดิมอยู่แล้วกี่ถุง
  let currentCartPacks = 0;
  try {
    const session = await getChatSession(userId);
    if (Array.isArray(session?.draft_data?.cart)) {
      currentCartPacks = session.draft_data.cart.reduce((sum, it) => sum + Number(it.quantity), 0);
    }
  } catch (_) {}

  // รูปภาพสินค้า
  const imgUrl = (product.image_url && product.image_url.startsWith('http'))
    ? product.image_url
    : 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';

  const flexCard = {
    type: 'flex',
    altText: `🌱 ต้องการสั่ง "${shortName}" กี่ถุงดีครับ? (ถุงละ ฿${unitPrice})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: imgUrl,
        size: 'full',
        aspectRatio: '20:12',
        aspectMode: 'cover',
      },
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: '🌱 เลือกจำนวนที่ต้องการสั่ง',
                weight: 'bold',
                size: 'sm',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'text',
                text: `฿${unitPrice} / ถุง`,
                weight: 'bold',
                size: 'xs',
                color: '#f4d27a',
                align: 'end',
                flex: 4,
              },
            ],
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: product.name,
            weight: 'bold',
            size: 'md',
            color: '#1b3a24',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: '#dcfce7',
                cornerRadius: 'md',
                paddingStart: 'sm',
                paddingEnd: 'sm',
                paddingTop: 'xs',
                paddingBottom: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: `💰 ฿${unitPrice} / ถุง (4 ขีด)`,
                    size: 'xxs',
                    color: '#15803d',
                    weight: 'bold',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: '#fef3c7',
                cornerRadius: 'md',
                paddingStart: 'sm',
                paddingEnd: 'sm',
                paddingTop: 'xs',
                paddingBottom: 'xs',
                contents: [
                  {
                    type: 'text',
                    text: `📦 พร้อมส่ง ${stock} ถุง`,
                    size: 'xxs',
                    color: '#92400e',
                    weight: 'bold',
                  },
                ],
              },
            ],
          },
          {
            type: 'separator',
            margin: 'sm',
          },
          {
            type: 'text',
            text: '👇 แตะเลือกจำนวนเพื่อใส่ตะกร้า:',
            size: 'xs',
            color: '#4b5563',
            weight: 'bold',
          },
          // แถวที่ 1: +1 ถุง / +2 ถุง
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: `+1 ถุง (฿${1 * unitPrice})`,
                  data: `action=add_to_cart&product_id=${product.id}&qty=1`,
                  displayText: `เพิ่ม ${shortName} 1 ถุง ลงตะกร้า`,
                },
                style: 'primary',
                color: '#16a34a',
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: `+2 ถุง (฿${2 * unitPrice})`,
                  data: `action=add_to_cart&product_id=${product.id}&qty=2`,
                  displayText: `เพิ่ม ${shortName} 2 ถุง ลงตะกร้า`,
                },
                style: 'primary',
                color: '#16a34a',
                height: 'sm',
              },
            ],
          },
          // แถวที่ 2: +3 ถุง / +5 ถุง
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: `+3 ถุง (฿${3 * unitPrice})`,
                  data: `action=add_to_cart&product_id=${product.id}&qty=3`,
                  displayText: `เพิ่ม ${shortName} 3 ถุง ลงตะกร้า`,
                },
                style: 'primary',
                color: '#16a34a',
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: `+5 ถุง (฿${5 * unitPrice})`,
                  data: `action=add_to_cart&product_id=${product.id}&qty=5`,
                  displayText: `เพิ่ม ${shortName} 5 ถุง ลงตะกร้า`,
                },
                style: 'primary',
                color: '#16a34a',
                height: 'sm',
              },
            ],
          },
          // แถวที่ 3: +1 กิโล / +2 กิโล
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '+1 กิโล',
                  data: `action=add_to_cart&product_id=${product.id}&qty_kg=1`,
                  displayText: `เพิ่ม ${shortName} 1 กิโล ลงตะกร้า`,
                },
                style: 'secondary',
                color: '#ecfdf5',
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '+2 กิโล',
                  data: `action=add_to_cart&product_id=${product.id}&qty_kg=2`,
                  displayText: `เพิ่ม ${shortName} 2 กิโล ลงตะกร้า`,
                },
                style: 'secondary',
                color: '#ecfdf5',
                height: 'sm',
              },
            ],
          },
          // แถวที่ 4: พิมพ์ระบุจำนวนเองในแชท
          {
            type: 'button',
            action: {
              type: 'message',
              label: '✏️ พิมพ์ระบุจำนวนเองในแชท',
              text: 'ระบุจำนวนเอง',
            },
            style: 'secondary',
            height: 'sm',
            margin: 'xs',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: `🧺 ดูตะกร้า ${currentCartPacks > 0 ? `(${currentCartPacks})` : ''}`,
              data: 'action=view_cart',
              displayText: 'ดูตะกร้าสินค้า',
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '📋 เมนูผักอื่น',
              data: 'action=show_menu',
              displayText: 'ดูเมนูผัก',
            },
            style: 'secondary',
            height: 'sm',
            flex: 1,
          },
        ],
      },
    },
  };

  // Quick Reply ลอยตัวเพื่อความสะดวกสูงสุดบนมือถือ
  const quickItems = [
    {
      type: 'action',
      action: {
        type: 'postback',
        label: `+1 ถุง (฿${1 * unitPrice})`,
        data: `action=add_to_cart&product_id=${product.id}&qty=1`,
        displayText: `เพิ่ม ${shortName} 1 ถุง ลงตะกร้า`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: `+2 ถุง (฿${2 * unitPrice})`,
        data: `action=add_to_cart&product_id=${product.id}&qty=2`,
        displayText: `เพิ่ม ${shortName} 2 ถุง ลงตะกร้า`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: `+3 ถุง (฿${3 * unitPrice})`,
        data: `action=add_to_cart&product_id=${product.id}&qty=3`,
        displayText: `เพิ่ม ${shortName} 3 ถุง ลงตะกร้า`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: `+5 ถุง (฿${5 * unitPrice})`,
        data: `action=add_to_cart&product_id=${product.id}&qty=5`,
        displayText: `เพิ่ม ${shortName} 5 ถุง ลงตะกร้า`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: '+1 กิโล',
        data: `action=add_to_cart&product_id=${product.id}&qty_kg=1`,
        displayText: `เพิ่ม ${shortName} 1 กิโล ลงตะกร้า`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'message',
        label: '✏️ พิมพ์จำนวนเอง',
        text: 'ระบุจำนวนเอง',
      },
    },
  ];

  if (currentCartPacks > 0) {
    quickItems.push({
      type: 'action',
      action: {
        type: 'postback',
        label: `🧺 ดูตะกร้า (${currentCartPacks} ถุง)`,
        data: 'action=view_cart',
        displayText: 'ดูตะกร้าสินค้า',
      },
    });
  }

  flexCard.quickReply = {
    items: quickItems,
  };

  return client.replyMessage({
    replyToken: replyToken,
    messages: [flexCard],
  });
}
