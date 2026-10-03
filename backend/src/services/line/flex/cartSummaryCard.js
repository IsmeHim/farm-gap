import { client } from '../config.js';

// Flex Message: สรุปตะกร้าสินค้าในห้องแชท (In-Chat Cart)
export async function replyCartSummary(replyToken, cart, newlyAddedItem = null) {
  const totalAmount = cart.reduce((sum, it) => sum + Number(it.subtotal || (it.quantity * it.price)), 0);
  const totalPacks = cart.reduce((sum, it) => sum + Number(it.quantity), 0);
  const totalKinds = cart.length;

  const itemRows = [];
  cart.forEach((it, idx) => {
    if (idx > 0) {
      itemRows.push({
        type: 'separator',
        margin: 'sm',
        color: '#f0f0f0',
      });
    }

    const isNewlyAdded = newlyAddedItem && Number(newlyAddedItem.product_id) === Number(it.product_id);

    itemRows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      alignItems: 'center',
      margin: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 6,
          spacing: 'none',
          contents: [
            {
              type: 'text',
              text: `${isNewlyAdded ? '✨ ' : ''}${it.name}`,
              weight: 'bold',
              size: 'sm',
              color: '#1b3a24',
              wrap: true,
            },
            {
              type: 'text',
              text: `${it.quantity} ${it.unit || 'ถุง'} x ฿${Number(it.price || it.unit_price).toLocaleString()}`,
              size: 'xxs',
              color: '#757575',
            },
          ],
        },
        {
          type: 'text',
          text: `฿${Number(it.subtotal || (it.quantity * (it.price || it.unit_price))).toLocaleString()}`,
          weight: 'bold',
          size: 'sm',
          color: '#2e7d32',
          align: 'end',
          flex: 3,
        },
      ],
    });
  });

  const headerNotice = newlyAddedItem
    ? `เพิ่ม "${newlyAddedItem.name}" (+${newlyAddedItem.addedQty} ถุง) ลงตะกร้าแล้ว!`
    : 'รายการสินค้าในตะกร้าปัจจุบันของคุณ';

  const flexCard = {
    type: 'flex',
    altText: `🧺 ตะกร้าสินค้าของคุณ (${totalPacks} ถุง • ฿${totalAmount.toLocaleString()} บาท)`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173f2a',
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: '🧺 ตะกร้าผักสดของคุณ',
                weight: 'bold',
                size: 'md',
                color: '#ffffff',
                flex: 8,
              },
              {
                type: 'text',
                text: `${totalPacks} ถุง`,
                weight: 'bold',
                size: 'xs',
                color: '#f4d27a',
                align: 'end',
                flex: 4,
              },
            ],
          },
          {
            type: 'text',
            text: headerNotice,
            size: 'xxs',
            color: '#c8e6c9',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          ...itemRows,
          {
            type: 'separator',
            margin: 'md',
            color: '#e0e0e0',
          },
          // Total Box
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 5,
                contents: [
                  {
                    type: 'text',
                    text: 'ยอดรวมทั้งสิ้น:',
                    size: 'sm',
                    color: '#616161',
                  },
                  {
                    type: 'text',
                    text: `(${totalKinds} ชนิด • รวม ${totalPacks} ถุง)`,
                    size: 'xxs',
                    color: '#9e9e9e',
                  },
                ],
              },
              {
                type: 'text',
                text: `฿${totalAmount.toLocaleString()} บาท`,
                size: 'lg',
                weight: 'bold',
                color: '#1b5e20',
                align: 'end',
                flex: 5,
              },
            ],
          },
          // Tip
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f1f8e9',
            cornerRadius: 'md',
            paddingAll: 'sm',
            margin: 'md',
            borderColor: '#c8e6c9',
            borderWidth: '1px',
            contents: [
              {
                type: 'text',
                text: '💡 แตะ [➕ เลือกผักเพิ่ม] เพื่อหยิบผักชนิดอื่นใส่ตะกร้าต่อ\nหรือแตะ [✅ สรุปสั่งซื้อเลย] เพื่อยืนยันและจัดส่งทันที 🌱',
                wrap: true,
                size: 'xs',
                color: '#2e7d32',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: `✅ สรุปสั่งซื้อเลย (฿${totalAmount.toLocaleString()})`,
              data: 'action=checkout_cart',
              displayText: 'ยืนยันสั่งซื้อผักในตะกร้า',
            },
            style: 'primary',
            color: '#16a34a',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '➕ เลือกผักชนิดอื่นเพิ่ม',
              data: 'action=show_menu',
              displayText: 'ดูเมนูผัก',
            },
            style: 'secondary',
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '🗑️ ล้างตะกร้า',
              data: 'action=clear_cart',
              displayText: 'ล้างตะกร้าสินค้า',
            },
            color: '#dc2626',
            height: 'sm',
          },
        ],
      },
    },
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: `✅ สั่งเลย (฿${totalAmount.toLocaleString()})`,
            data: 'action=checkout_cart',
            displayText: 'ยืนยันสั่งซื้อผักในตะกร้า',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '➕ เลือกผักเพิ่ม',
            data: 'action=show_menu',
            displayText: 'ดูเมนูผัก',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🗑️ ล้างตะกร้า',
            data: 'action=clear_cart',
            displayText: 'ล้างตะกร้าสินค้า',
          },
        },
      ],
    },
  };

  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [flexCard],
    });
  } catch (err) {
    console.error('Failed to reply cart summary:', err.message);
  }
}
