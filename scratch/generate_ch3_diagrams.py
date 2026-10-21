import os
import math
from PIL import Image, ImageDraw, ImageFont

FONT_REG_PATH = r"C:\Windows\Fonts\leelawad.ttf"
FONT_BOLD_PATH = r"C:\Windows\Fonts\leelawdb.ttf"
if not os.path.exists(FONT_REG_PATH):
    FONT_REG_PATH = r"C:\Windows\Fonts\tahoma.ttf"
    FONT_BOLD_PATH = r"C:\Windows\Fonts\tahomabd.ttf"


def get_font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD_PATH if bold else FONT_REG_PATH, size)


def draw_centered_multiline(draw, box, lines, font, fill="#111111", line_gap=6):
    x1, y1, x2, y2 = box
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    heights = []
    widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        widths.append(bbox[2] - bbox[0])
        heights.append(bbox[3] - bbox[1])
    total_h = sum(heights) + line_gap * max(0, len(lines) - 1)
    cur_y = cy - total_h / 2
    for line, w, h in zip(lines, widths, heights):
        draw.text((cx - w / 2, cur_y), line, font=font, fill=fill)
        cur_y += h + line_gap


def draw_arrow(draw, p1, p2, color="#222222", width=2, head_len=10, head_angle=0.45, both=False):
    draw.line([p1, p2], fill=color, width=width)
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    angle = math.atan2(dy, dx)
    x3 = p2[0] - head_len * math.cos(angle - head_angle)
    y3 = p2[1] - head_len * math.sin(angle - head_angle)
    x4 = p2[0] - head_len * math.cos(angle + head_angle)
    y4 = p2[1] - head_len * math.sin(angle + head_angle)
    draw.polygon([p2, (x3, y3), (x4, y4)], fill=color)
    if both:
        angle2 = angle + math.pi
        x5 = p1[0] - head_len * math.cos(angle2 - head_angle)
        y5 = p1[1] - head_len * math.sin(angle2 - head_angle)
        x6 = p1[0] - head_len * math.cos(angle2 + head_angle)
        y6 = p1[1] - head_len * math.sin(angle2 + head_angle)
        draw.polygon([p1, (x5, y5), (x6, y6)], fill=color)


def draw_datastore(draw, box, code_str, title_str, font_bold, font_reg):
    x1, y1, x2, y2 = box
    # Open-right rectangle with double left bar (Gane & Sarson / Yourdon DFD Data Store style)
    draw.rectangle([x1, y1, x2, y2], fill="#F8FAFC", outline="#1E293B", width=2)
    # Cover right border to make open-ended DFD data store or keep clean cylinder/store box
    split_x = x1 + 48
    draw.line([(split_x, y1), (split_x, y2)], fill="#1E293B", width=2)
    draw_centered_multiline(draw, (x1, y1, split_x, y2), [code_str], font_bold, fill="#0F172A")
    draw_centered_multiline(draw, (split_x, y1, x2, y2), [title_str], font_reg, fill="#0F172A")


# =============================================================================
# 1. ภาพที่ 3.1 สถาปัตยกรรมของระบบ FarmGAP (System Architecture)
# =============================================================================
def gen_fig3_1_architecture(out_path):
    W, H = 1600, 1020
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    f_title = get_font(26, bold=True)
    f_layer = get_font(20, bold=True)
    f_box_b = get_font(18, bold=True)
    f_box_r = get_font(16, bold=False)
    f_small = get_font(15, bold=False)

    # Outer border
    draw.rectangle([20, 20, W - 20, H - 20], outline="#334155", width=2)
    draw_centered_multiline(
        draw,
        (20, 30, W - 20, 75),
        ["สถาปัตยกรรมระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์ (FarmGAP System Architecture)"],
        f_title,
    )

    # Layer 1: Presentation & Client Layer
    draw.rounded_rectangle([60, 95, W - 60, 275], radius=10, fill="#F8FAFC", outline="#475569", width=2)
    draw.text((85, 105), "1. ชั้นส่วนติดต่อผู้ใช้งาน (Presentation & Client Layer)", font=f_layer, fill="#0F172A")

    client_boxes = [
        (90, 145, 520, 255, ["เว็บแอปพลิเคชันสำหรับเจ้าของฟาร์ม", "(React.js 18 + Vite + TailwindCSS)", "จัดการแปลงปลูก / GAP / สต็อก / บัญชี / AI"]),
        (585, 145, 1015, 255, ["หน้าร้านออนไลน์และแชทบอทบน LINE", "(LINE Official Account + LINE LIFF)", "เลือกซื้อผักสด / คุยกับ AI / เช็คสถานะจัดส่ง"]),
        (1080, 145, 1510, 255, ["หน้าเว็บตรวจสอบย้อนกลับสาธารณะ", "(Per-Cycle QR Code Traceability)", "สแกน QR Code ดูประวัติการปลูกรายรอบ"]),
    ]
    for x1, y1, x2, y2, lines in client_boxes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill="#FFFFFF", outline="#1E293B", width=2)
        draw_centered_multiline(draw, (x1, y1, x2, y2), lines, f_box_r)

    # Arrows Layer 1 -> Layer 2
    for cx, lbl in [(305, "RESTful API (JSON / JWT)"), (800, "HTTPS Webhook & LIFF API"), (1295, "Public Traceability API")]:
        draw_arrow(draw, (cx, 275), (cx, 335), both=True)
        draw.rectangle([cx - 115, 292, cx + 115, 318], fill="#FFFFFF")
        draw_centered_multiline(draw, (cx - 115, 292, cx + 115, 318), [lbl], f_small)

    # Layer 2: Application & API Gateway Layer
    draw.rounded_rectangle([60, 335, W - 60, 520], radius=10, fill="#F8FAFC", outline="#475569", width=2)
    draw.text((85, 345), "2. ชั้นประมวลผลตรรกะและบริการเว็บ (Application & Business Logic Layer - Node.js / Express.js)", font=f_layer, fill="#0F172A")

    app_boxes = [
        (90, 390, 420, 500, ["โมดูลบริหารจัดการฟาร์ม GAP", "แปลงปลูก / เตรียมดิน / เพาะกล้า", "คำนวณอายุพืชสะสม & ล็อกเก็บเกี่ยว PHI"]),
        (445, 390, 775, 500, ["โมดูลคลังสินค้าและคำสั่งซื้อ", "เก็บเกี่ยวเข้าสต็อกอัตโนมัติ", "ตะกร้าสั่งซื้อ / ตัดสต็อก / ใบเสร็จ"]),
        (800, 390, 1130, 500, ["โมดูลเชื่อมต่อ LINE Messaging", "Webhook Event Router", "Flex Message & Order Status Card"]),
        (1155, 390, 1510, 500, ["โมดูลรายงาน GAP & Traceability", "พิมพ์รายงาน GAP A4 รายรอบปลูก", "สร้าง QR Code ผูกรหัส planting_id"]),
    ]
    for x1, y1, x2, y2, lines in app_boxes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill="#FFFFFF", outline="#1E293B", width=2)
        draw_centered_multiline(draw, (x1, y1, x2, y2), lines, f_box_r)

    # Arrows Layer 2 -> Layer 3
    for cx in [310, 800, 1290]:
        draw_arrow(draw, (cx, 520), (cx, 575), both=True)

    # Layer 3: AI & Analytics Service Layer
    draw.rounded_rectangle([60, 575, W - 60, 760], radius=10, fill="#F8FAFC", outline="#475569", width=2)
    draw.text((85, 585), "3. ชั้นประมวลผลปัญญาประดิษฐ์และวิเคราะห์ข้อมูล (Artificial Intelligence & Analytics Layer)", font=f_layer, fill="#0F172A")

    ai_boxes = [
        (90, 630, 530, 740, ["ผู้ช่วยสนทนาอัจฉริยะ Google Gemini LLM", "Dynamic Context Injection (ดึงสต็อกจริงเรียลไทม์)", "gemini-3.5-flash-lite + Multi-Model Fallback"]),
        (580, 630, 1020, 740, ["อัลกอริทึมจัดกลุ่มลูกค้า K-Means (4 มิติ)", "ยอดซื้อรวม / ความถี่ / เฉลี่ยต่อบิล / วันล่าสุด", "แบ่ง 4 กลุ่ม: VIP, ลูกค้าทั่วไป, ลูกค้าใหม่, ห่างหาย"]),
        (1070, 630, 1510, 740, ["ระบบแนะนำสินค้าซื้อคู่กัน (Recommender)", "เมทริกซ์การเกิดร่วม (Co-occurrence Matrix)", "วิเคราะห์คู่ผักที่ถูกสั่งซื้อร่วมกันในบิลเดียว"]),
    ]
    for x1, y1, x2, y2, lines in ai_boxes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill="#FFFFFF", outline="#1E293B", width=2)
        draw_centered_multiline(draw, (x1, y1, x2, y2), lines, f_box_r)

    # Arrows Layer 3 -> Layer 4
    draw_arrow(draw, (500, 760), (500, 815), both=True)
    draw_arrow(draw, (1100, 760), (1100, 815), both=True)

    # Layer 4: Data Persistence & External Cloud Services
    draw.rounded_rectangle([60, 815, 920, 975], radius=10, fill="#F8FAFC", outline="#475569", width=2)
    draw.text((85, 825), "4. ชั้นฐานข้อมูลเชิงสัมพันธ์ (Data Persistence Layer)", font=f_layer, fill="#0F172A")
    draw.rounded_rectangle([90, 865, 890, 955], radius=8, fill="#FFFFFF", outline="#1E293B", width=2)
    draw_centered_multiline(
        draw,
        (90, 865, 890, 955),
        [
            "ฐานข้อมูล MySQL (Relational Database จำนวน 18 ตาราง)",
            "ข้อมูลผู้ใช้/ลูกค้า • แปลงปลูก/แคร่ปลูก • เตรียมดิน/เพาะกล้า/ปุ๋ยเคมี PHI/ศัตรูพืช/เก็บเกี่ยว • สต็อก/คำสั่งซื้อ • ผลลัพธ์ AI",
        ],
        f_box_r,
    )

    draw.rounded_rectangle([960, 815, W - 60, 975], radius=10, fill="#F8FAFC", outline="#475569", width=2)
    draw.text((985, 825), "5. บริการคลาวด์ภายนอก (External APIs)", font=f_layer, fill="#0F172A")
    draw.rounded_rectangle([990, 865, 1510, 955], radius=8, fill="#FFFFFF", outline="#1E293B", width=2)
    draw_centered_multiline(
        draw,
        (990, 865, 1510, 955),
        [
            "LINE Messaging API & LIFF Platform",
            "Google Generative Language API (Gemini Models)",
        ],
        f_box_r,
    )

    img.save(out_path)


# =============================================================================
# 2. ภาพที่ 3.2 แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)
# =============================================================================
def gen_fig3_2_dfd_lv0(out_path):
    W, H = 1500, 900
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    f_title = get_font(25, bold=True)
    f_proc = get_font(20, bold=True)
    f_ent = get_font(20, bold=True)
    f_flow = get_font(15, bold=False)

    draw.rectangle([20, 20, W - 20, H - 20], outline="#334155", width=2)
    draw_centered_multiline(
        draw,
        (20, 35, W - 20, 80),
        ["แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)"],
        f_title,
    )

    # Central Process 0.0
    p_box = (510, 330, 990, 570)
    draw.rounded_rectangle(p_box, radius=45, fill="#F8FAFC", outline="#0F172A", width=3)
    draw.line([(510, 395), (990, 395)], fill="#0F172A", width=2)
    draw_centered_multiline(draw, (510, 335, 990, 395), ["0.0"], f_proc)
    draw_centered_multiline(
        draw,
        (520, 400, 980, 560),
        [
            "ระบบบริหารจัดการฟาร์มผัก",
            "และสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์",
            "บน LINE Official Account",
            "(FarmGAP System)",
        ],
        f_proc,
    )

    # External Entity 1: เจ้าของฟาร์ม / ผู้ดูแลระบบ (Left)
    e1 = (60, 380, 330, 510)
    draw.rectangle(e1, fill="#FFFFFF", outline="#0F172A", width=3)
    draw_centered_multiline(draw, e1, ["เจ้าของฟาร์ม / เกษตรกร", "(Admin / Farmer)"], f_ent)

    # External Entity 2: ลูกค้า / ผู้บริโภค (Right)
    e2 = (1170, 380, 1440, 510)
    draw.rectangle(e2, fill="#FFFFFF", outline="#0F172A", width=3)
    draw_centered_multiline(draw, e2, ["ลูกค้า / ผู้บริโภค", "(LINE User / Customer)"], f_ent)

    # Flows between Farmer (e1) and System (p_box)
    # Top arrow: Farmer -> System
    draw.line([(195, 380), (195, 220), (650, 220)], fill="#1E293B", width=2)
    draw_arrow(draw, (650, 220), (650, 330))
    draw.rectangle([220, 155, 620, 245], fill="#FFFFFF", outline="#CBD5E1", width=1)
    draw_centered_multiline(
        draw,
        (220, 155, 620, 245),
        [
            "ข้อมูลแปลงปลูก/แคร่ปลูก, การเตรียมดิน, การเพาะกล้า,",
            "ปุ๋ยและสารเคมี (PHI), ศัตรูพืช, การเก็บเกี่ยวเข้าสต็อก,",
            "การปรับสถานะคำสั่งซื้อ, ข้อมูลรายรับ-รายจ่าย",
        ],
        f_flow,
    )

    # Bottom arrow: System -> Farmer
    draw.line([(650, 570), (650, 710), (195, 710)], fill="#1E293B", width=2)
    draw_arrow(draw, (195, 710), (195, 510))
    draw.rectangle([220, 665, 620, 755], fill="#FFFFFF", outline="#CBD5E1", width=1)
    draw_centered_multiline(
        draw,
        (220, 665, 620, 755),
        [
            "แดชบอร์ดภาพรวมฟาร์ม, แจ้งเตือนล็อกเก็บเกี่ยว PHI,",
            "รายงานมาตรฐาน GAP (A4 รายรอบปลูก), QR Code,",
            "ผลวิเคราะห์กลุ่มลูกค้า K-Means และสรุปบัญชีฟาร์ม",
        ],
        f_flow,
    )

    # Flows between Customer (e2) and System (p_box)
    # Top arrow: Customer -> System
    draw.line([(1305, 380), (1305, 220), (850, 220)], fill="#1E293B", width=2)
    draw_arrow(draw, (850, 220), (850, 330))
    draw.rectangle([880, 155, 1280, 245], fill="#FFFFFF", outline="#CBD5E1", width=1)
    draw_centered_multiline(
        draw,
        (880, 155, 1280, 245),
        [
            "ข้อมูลโปรไฟล์ LINE, รายการสั่งซื้อผ่านหน้าร้าน LIFF,",
            "ข้อความแชทสอบถามสต็อก/สั่งซื้อผ่าน AI Chatbot,",
            "คำขอตรวจสอบสถานะออเดอร์ และการสแกน QR Code",
        ],
        f_flow,
    )

    # Bottom arrow: System -> Customer
    draw.line([(850, 570), (850, 710), (1305, 710)], fill="#1E293B", width=2)
    draw_arrow(draw, (1305, 710), (1305, 510))
    draw.rectangle([880, 665, 1280, 755], fill="#FFFFFF", outline="#CBD5E1", width=1)
    draw_centered_multiline(
        draw,
        (880, 665, 1280, 755),
        [
            "รายการผักพร้อมขายและผักแนะนำคู่กันในหน้าร้าน LIFF,",
            "คำตอบจากผู้ช่วยอัจฉริยะ Gemini AI, การ์ดบิลและสถานะ",
            "จัดส่ง (Flex Message), ข้อมูลตรวจสอบย้อนกลับรายรอบปลูก",
        ],
        f_flow,
    )

    img.save(out_path)


# =============================================================================
# 3. ภาพที่ 3.3 แผนภาพกระแสข้อมูลระดับที่ 1 (DFD Level 1)
# =============================================================================
def gen_fig3_3_dfd_lv1(out_path):
    W, H = 1650, 1180
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    f_title = get_font(24, bold=True)
    f_proc_b = get_font(17, bold=True)
    f_proc_r = get_font(15, bold=False)
    f_ent = get_font(18, bold=True)
    f_ds_b = get_font(15, bold=True)
    f_ds_r = get_font(15, bold=False)
    f_flow = get_font(14, bold=False)

    draw.rectangle([20, 20, W - 20, H - 20], outline="#334155", width=2)
    draw_centered_multiline(
        draw,
        (20, 30, W - 20, 75),
        ["แผนภาพกระแสข้อมูลระดับที่ 1 (Data Flow Diagram Level 1)"],
        f_title,
    )

    # Draw connector lines FIRST (in background)
    draw.line([(145, 162), (145, 922)], fill="#1E293B", width=2)
    farmer_flows = [
        (162, "ข้อมูลแปลง/เตรียมดิน/เพาะกล้า/สารเคมี PHI"),
        (352, "ข้อมูลเก็บเกี่ยว/ราคาขาย/รายรับ-จ่าย"),
        (542, "ตรวจสอบและอัปเดตสถานะคำสั่งซื้อ"),
        (732, "สั่งรันวิเคราะห์กลุ่มลูกค้า K-Means"),
        (922, "ขอพิมพ์รายงาน GAP A4 และ QR Code"),
    ]
    for py, label in farmer_flows:
        draw_arrow(draw, (245 if py == 542 else 145, py), (455, py))
        draw.rectangle([155 if py != 542 else 250, py - 24, 445, py - 2], fill="#FFFFFF")
        draw_centered_multiline(draw, (155 if py != 542 else 250, py - 24, 445, py - 2), [label], f_flow)

    # Arrows between Processes (x=845) and Data Stores (x=935)
    for py in [132, 207, 327, 402, 542, 732]:
        draw_arrow(draw, (845, py), (935, py), both=True)

    # Process 3.0 updates stock D3 via gutter x=890
    draw.line([(845, 505), (890, 505), (890, 340)], fill="#1E293B", width=2)
    draw_arrow(draw, (890, 340), (935, 340))

    # Process 4.0 reads D5 via gutter x=890
    draw.line([(935, 555), (890, 555), (890, 700)], fill="#1E293B", width=2)
    draw_arrow(draw, (890, 700), (845, 700))

    # Process 5.0 reads D2 via right gutter x=1380
    draw.line([(1360, 207), (1380, 207), (1380, 900)], fill="#1E293B", width=2)
    draw_arrow(draw, (1380, 900), (845, 900))
    draw.rectangle([940, 872, 1350, 896], fill="#FFFFFF")
    draw_centered_multiline(draw, (940, 872, 1350, 896), ["ดึงประวัติการปลูกรายรอบ (planting_id) และค่า PHI"], f_flow)

    # Customer flows (Right side) to 3.0, 4.0, 5.0
    draw.line([(1505, 465), (845, 465)], fill="#1E293B", width=2)
    draw_arrow(draw, (1405, 465), (845, 465), both=True)
    draw.rectangle([960, 438, 1370, 462], fill="#FFFFFF")
    draw_centered_multiline(draw, (960, 438, 1370, 462), ["สั่งซื้อผ่าน LIFF / แจ้งเตือนการ์ด Flex Message"], f_flow)

    draw.line([(1505, 540), (1505, 955)], fill="#1E293B", width=2)
    draw_arrow(draw, (1505, 650), (845, 650), both=True)
    draw.rectangle([960, 622, 1370, 646], fill="#FFFFFF")
    draw_centered_multiline(draw, (960, 622, 1370, 646), ["สนทนาถามสต็อก-สั่งซื้อผ่านแชทบอท Gemini AI"], f_flow)

    draw_arrow(draw, (845, 955), (1505, 955), both=True)
    draw.rectangle([960, 927, 1370, 951], fill="#FFFFFF")
    draw_centered_multiline(draw, (960, 927, 1370, 951), ["สแกน QR Code ดูข้อมูลตรวจสอบย้อนกลับรายรอบปลูก"], f_flow)

    # Draw External Entities on top
    ent_farmer = (45, 490, 245, 590)
    draw.rectangle(ent_farmer, fill="#FFFFFF", outline="#0F172A", width=3)
    draw_centered_multiline(draw, ent_farmer, ["เจ้าของฟาร์ม", "(Admin / Farmer)"], f_ent)

    ent_cust = (1405, 440, 1605, 540)
    draw.rectangle(ent_cust, fill="#FFFFFF", outline="#0F172A", width=3)
    draw_centered_multiline(draw, ent_cust, ["ลูกค้า / ผู้บริโภค", "(LINE User)"], f_ent)

    # Draw 5 Main Processes on top
    processes = [
        ("1.0", ["จัดการแปลงปลูกและบันทึก", "การเพาะปลูกตามมาตรฐาน GAP", "(เตรียมดิน/เพาะกล้า/ปุ๋ย PHI/ศัตรูพืช)"], (455, 100, 845, 225)),
        ("2.0", ["จัดการการเก็บเกี่ยวผลผลิต", "คลังสินค้า และบัญชีฟาร์ม", "(ตัดรอบปลูก & เพิ่มสต็อกอัตโนมัติ)"], (455, 290, 845, 415)),
        ("3.0", ["จัดการคำสั่งซื้อออนไลน์", "ผ่าน LINE LIFF & Flex Message", "(สร้างออเดอร์ / ตัดสต็อก / แจ้งสถานะ)"], (455, 480, 845, 605)),
        ("4.0", ["ประมวลผลปัญญาประดิษฐ์ (AI)", "(Gemini Chatbot, K-Means 4 มิติ,", "และแนะนำสินค้า Co-occurrence)"], (455, 670, 845, 795)),
        ("5.0", ["ออกรายงานมาตรฐาน GAP (A4)", "และตรวจสอบย้อนกลับ QR Code", "(Per-Cycle Traceability)"], (455, 860, 845, 985)),
    ]
    for num, lines, (x1, y1, x2, y2) in processes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=18, fill="#F8FAFC", outline="#0F172A", width=2)
        draw.line([(x1, y1 + 34), (x2, y1 + 34)], fill="#0F172A", width=2)
        draw_centered_multiline(draw, (x1, y1 + 2, x2, y1 + 34), [f"กระบวนการที่ {num}"], f_proc_b)
        draw_centered_multiline(draw, (x1 + 8, y1 + 36, x2 - 8, y2 - 4), lines, f_proc_r)

    # Draw Data Stores on top
    datastores = [
        ("D1", "แปลงปลูกและแคร่ปลูก (plots, planting_beds)", (935, 105, 1360, 160)),
        ("D2", "ข้อมูลเพาะปลูก GAP (plantings, chemicals, pests)", (935, 180, 1360, 235)),
        ("D3", "ผลผลิตและสต็อกผักสด (vegetables, harvest, stock)", (935, 300, 1360, 355)),
        ("D4", "บัญชีรายรับ-รายจ่ายฟาร์ม (transactions)", (935, 375, 1360, 430)),
        ("D5", "ข้อมูลลูกค้าและคำสั่งซื้อ (users, orders, items)", (935, 515, 1360, 570)),
        ("D6", "ผลวิเคราะห์ AI (customer_segments, pair_stats)", (935, 705, 1360, 760)),
    ]
    for code, name, box in datastores:
        draw_datastore(draw, box, code, name, f_ds_b, f_ds_r)

    # Legend at bottom
    draw.rounded_rectangle([60, 1040, W - 60, 1135], radius=8, fill="#F8FAFC", outline="#94A3B8", width=1)
    draw_centered_multiline(
        draw,
        (60, 1045, W - 60, 1130),
        [
            "คำอธิบายสัญลักษณ์:  [สี่เหลี่ยมขอบหนา] = หน่วยงานภายนอก (External Entity)   |   (สี่เหลี่ยมมุมมน) = กระบวนการ (Process 1.0–5.0)",
            "[D1–D6] = แหล่งเก็บข้อมูลในฐานข้อมูล MySQL (Data Store)   |   ---> = ทิศทางกระแสข้อมูล (Data Flow)",
        ],
        f_proc_r,
    )

    img.save(out_path)


# =============================================================================
# 4. ภาพที่ 3.4 แผนภาพกรณีใช้งานของระบบ (Use Case Diagram - 13 Use Cases)
# =============================================================================
def draw_stick_actor(draw, cx, cy, label_lines, font):
    draw.ellipse([cx - 18, cy - 55, cx + 18, cy - 19], fill="#FFFFFF", outline="#0F172A", width=3)
    draw.line([(cx, cy - 19), (cx, cy + 30)], fill="#0F172A", width=3)
    draw.line([(cx - 28, cy - 2), (cx + 28, cy - 2)], fill="#0F172A", width=3)
    draw.line([(cx, cy + 30), (cx - 22, cy + 68)], fill="#0F172A", width=3)
    draw.line([(cx, cy + 30), (cx + 22, cy + 68)], fill="#0F172A", width=3)
    draw_centered_multiline(draw, (cx - 110, cy + 75, cx + 110, cy + 125), label_lines, font)


def gen_fig3_4_use_case(out_path):
    W, H = 1480, 1220
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    f_title = get_font(24, bold=True)
    f_sub = get_font(18, bold=True)
    f_uc = get_font(15, bold=False)
    f_actor = get_font(17, bold=True)

    draw.rectangle([20, 20, W - 20, H - 20], outline="#334155", width=2)
    draw_centered_multiline(
        draw,
        (20, 30, W - 20, 75),
        ["แผนภาพกรณีใช้งานของระบบ (Use Case Diagram — 13 กรณีใช้งาน)"],
        f_title,
    )

    # System Boundary Box (Single centered column of 13 Use Cases so NO lines ever cross over ellipses!)
    sys_box = (340, 88, 1140, 1175)
    draw.rectangle(sys_box, fill="#F8FAFC", outline="#0F172A", width=2)
    draw_centered_multiline(
        draw,
        (340, 95, 1140, 130),
        ["ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์ (FarmGAP System)"],
        f_sub,
    )

    # Actors
    draw_stick_actor(draw, 155, 520, ["เจ้าของฟาร์ม / แอดมิน", "(Farmer / Admin)"], f_actor)
    draw_stick_actor(draw, 1325, 920, ["ลูกค้า / ผู้บริโภค", "(Customer / LINE User)"], f_actor)

    all_ucs = [
        ("UC01: เข้าสู่ระบบและดูแดชบอร์ดภาพรวมฟาร์ม", True, False),
        ("UC02: จัดการข้อมูลชนิดพืชผัก แปลงปลูก และแคร่ปลูก (โต๊ะ 1–20)", True, False),
        ("UC03: บันทึกการเตรียมดินและการเพาะกล้า", True, False),
        ("UC04: บันทึกการย้ายกล้าลงปลูกและคำนวณอายุพืชสะสม", True, False),
        ("UC05: บันทึกปุ๋ยและสารเคมี พร้อมตรวจสอบล็อกระยะปลอดภัย (PHI)", True, False),
        ("UC06: บันทึกการสำรวจและป้องกันกำจัดศัตรูพืช", True, False),
        ("UC07: บันทึกการเก็บเกี่ยวผลผลิตเข้าคลังสินค้าอัตโนมัติ", True, False),
        ("UC08: จัดการบัญชีรายรับ-รายจ่าย และพิมพ์รายงาน GAP A4 รายรอบปลูก", True, False),
        ("UC09: วิเคราะห์กลุ่มลูกค้า K-Means 4 มิติ และแนะนำสินค้าซื้อคู่กัน", True, False),
        ("UC10: จัดการคำสั่งซื้อ ใบเสร็จ และแจ้งเตือนสถานะจัดส่ง (Flex Message)", True, True),
        ("UC11: เลือกซื้อผักสดออนไลน์และติดตามออเดอร์ผ่านหน้าร้าน LINE LIFF", False, True),
        ("UC12: สนทนาถามสต็อกและสั่งซื้ออัตโนมัติผ่านแชทบอท Google Gemini AI", False, True),
        ("UC13: สแกน QR Code ตรวจสอบย้อนกลับแหล่งที่มารายรอบการปลูก", True, True),
    ]

    start_y = 172
    step_y = 77
    for idx, (text, is_farmer, is_cust) in enumerate(all_ucs):
        cy = start_y + idx * step_y
        ex1, ey1, ex2, ey2 = 420, cy - 28, 1060, cy + 28
        if is_farmer:
            draw.line([(220, 520), (ex1, cy)], fill="#1E293B", width=2)
        if is_cust:
            draw.line([(1260, 920), (ex2, cy)], fill="#0F172A", width=2)
        draw.ellipse([ex1, ey1, ex2, ey2], fill="#FFFFFF", outline="#0F172A", width=2)
        draw_centered_multiline(draw, (ex1 + 15, ey1, ex2 - 15, ey2), [text], f_uc)

    img.save(out_path)


# =============================================================================
# 5. ภาพที่ 3.5 แผนภาพความสัมพันธ์ของข้อมูล (ER Diagram - 18 Tables)
# =============================================================================
def get_entity_box(x1, y1, w, fields):
    row_h = 22
    hdr_h = 28
    h = hdr_h + len(fields) * row_h + 6
    return (x1, y1, x1 + w, y1 + h)


def draw_entity_table(draw, x1, y1, w, title, fields, f_hdr, f_row):
    row_h = 22
    hdr_h = 28
    h = hdr_h + len(fields) * row_h + 6
    x2, y2 = x1 + w, y1 + h
    draw.rectangle([x1, y1, x2, y2], fill="#FFFFFF", outline="#0F172A", width=2)
    draw.rectangle([x1, y1, x2, y1 + hdr_h], fill="#1E293B", outline="#0F172A", width=2)
    draw_centered_multiline(draw, (x1, y1, x2, y1 + hdr_h), [title], f_hdr, fill="#FFFFFF")
    cy = y1 + hdr_h + 3
    for pk_tag, fname in fields:
        if pk_tag:
            draw.text((x1 + 8, cy), pk_tag, font=f_row, fill="#0F172A")
        draw.text((x1 + 42, cy), fname, font=f_row, fill="#1E293B")
        cy += row_h
    return (x1, y1, x2, y2)


def gen_fig3_5_er_diagram(out_path):
    W, H = 1750, 1260
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    f_title = get_font(24, bold=True)
    f_hdr = get_font(15, bold=True)
    f_row = get_font(13, bold=False)

    draw.rectangle([20, 20, W - 20, H - 20], outline="#334155", width=2)
    draw_centered_multiline(
        draw,
        (20, 30, W - 20, 75),
        ["แผนภาพความสัมพันธ์ของข้อมูล (Entity-Relationship Diagram: ER Diagram ทั้ง 18 ตาราง)"],
        f_title,
    )

    col1_tables = [
        ("1. users (ผู้ใช้งาน/ลูกค้า)", [("PK", "id"), ("", "username / role"), ("", "line_user_id"), ("", "fullname / phone")]),
        ("2. plots (แปลงปลูกหลัก)", [("PK", "id"), ("", "plot_name"), ("", "area_size / status")]),
        ("3. planting_beds (แคร่ปลูก)", [("PK", "id"), ("FK", "plot_id"), ("", "bed_name (โต๊ะ 1-20)"), ("", "status")]),
        ("4. vegetables (ชนิดพืชผัก)", [("PK", "id"), ("", "name"), ("", "growth_days"), ("", "standard_price")]),
    ]
    col2_tables = [
        ("5. soil_preparations (เตรียมดิน)", [("PK", "id"), ("FK", "plot_id / bed_id"), ("", "prep_date / method"), ("", "soil_ph / notes")]),
        ("6. seedlings (การเพาะกล้า)", [("PK", "id"), ("FK", "vegetable_id"), ("", "sow_date / quantity"), ("", "status")]),
        ("7. plantings (รอบการเพาะปลูก)", [("PK", "id"), ("FK", "plot_id / bed_id"), ("FK", "vegetable_id / seedling_id"), ("", "plant_date / expected_harvest"), ("", "status (growing/harvested)")]),
        ("8. chemical_logs (ปุ๋ย/สารเคมี PHI)", [("PK", "id"), ("FK", "planting_id / plot_id"), ("", "chemical_name / log_date"), ("", "phi_days / safe_harvest_date")]),
        ("9. pest_logs (บันทึกศัตรูพืช)", [("PK", "id"), ("FK", "planting_id / plot_id"), ("", "pest_name / severity"), ("", "control_method / log_date")]),
    ]
    col3_tables = [
        ("10. harvest_records (บันทึกเก็บเกี่ยว)", [("PK", "id"), ("FK", "planting_id / plot_id"), ("FK", "vegetable_id"), ("", "harvest_date / quantity_kg"), ("", "quality_grade")]),
        ("11. stock (คลังสินค้าผักสด)", [("PK", "id"), ("FK", "vegetable_id / planting_id"), ("", "lot_number"), ("", "quantity_available / price")]),
        ("12. orders (ใบสั่งซื้อสินค้า)", [("PK", "id"), ("FK", "user_id"), ("", "order_code / total_amount"), ("", "delivery_method / payment"), ("", "status / shipping_address")]),
        ("13. order_items (รายการสินค้าในบิล)", [("PK", "id"), ("FK", "order_id"), ("FK", "stock_id / vegetable_id"), ("", "quantity_kg / unit_price")]),
        ("14. transactions (บัญชีรายรับ-จ่าย)", [("PK", "id"), ("FK", "order_id / planting_id"), ("", "type (income/expense)"), ("", "category / amount / tx_date")]),
    ]
    col4_tables = [
        ("15. customer_segments (กลุ่ม K-Means)", [("PK", "id"), ("FK", "user_id"), ("", "cluster_id / segment_name"), ("", "total_spent / order_count"), ("", "recency_days")]),
        ("16. product_pair_stats (ซื้อคู่กัน)", [("PK", "id"), ("FK", "vegetable_a_id"), ("FK", "vegetable_b_id"), ("", "co_occurrence_count")]),
        ("17. line_chat_logs (ประวัติแชท AI)", [("PK", "id"), ("", "line_user_id"), ("", "user_message / ai_reply"), ("", "model_used / created_at")]),
        ("18. gap_audit_checklists (ตรวจ GAP)", [("PK", "id"), ("FK", "planting_id / plot_id"), ("", "category_no (หมวด 1-8)"), ("", "is_passed / auditor_note")]),
    ]

    # Pre-calculate box coordinates first
    boxes = {}
    cols_spec = [(55, col1_tables), (475, col2_tables), (905, col3_tables), (1330, col4_tables)]
    for x_pos, tbl_list in cols_spec:
        cur_y = 100
        for title, fields in tbl_list:
            key = title.split(".")[0].strip()
            b = get_entity_box(x_pos, cur_y, 365, fields)
            boxes[key] = b
            cur_y = b[3] + 38

    # Draw relationship lines in gutters BEFORE drawing the entity boxes!
    rels = [
        ("2", "3", "1:N", 0),
        ("3", "5", "1:N", 442),
        ("3", "7", "1:N", 452),
        ("4", "6", "1:N", 434),
        ("4", "7", "1:N", 452),
        ("6", "7", "1:N", 0),
        ("7", "8", "1:N", 0),
        ("7", "10", "1:N", 872),
        ("7", "11", "1:N", 882),
        ("11", "13", "1:N", 892),
        ("12", "13", "1:N", 0),
        ("13", "14", "1:N", 0),
        ("12", "15", "1:N", 1295),
        ("11", "16", "1:N", 1305),
        ("10", "18", "1:N", 1315),
    ]
    for k1, k2, card, gutter_x in rels:
        b1 = boxes[k1]
        b2 = boxes[k2]
        if b1[0] == b2[0]:
            p1 = ((b1[0] + b1[2]) // 2, b1[3])
            p2 = ((b2[0] + b2[2]) // 2, b2[1])
            draw.line([p1, p2], fill="#334155", width=2)
            draw.text((p1[0] + 6, (p1[1] + p2[1]) // 2 - 8), card, font=f_row, fill="#0F172A")
        else:
            p1 = (b1[2], (b1[1] + b1[3]) // 2)
            p2 = (b2[0], (b2[1] + b2[3]) // 2)
            gx = gutter_x if gutter_x else (p1[0] + p2[0]) // 2
            draw.line([p1, (gx, p1[1]), (gx, p2[1]), p2], fill="#334155", width=2)
            draw.text((gx + 4, (p1[1] + p2[1]) // 2 - 10), card, font=f_row, fill="#0F172A")

    # Now draw the 18 entity boxes on top so boxes are 100% clean
    for x_pos, tbl_list in cols_spec:
        cur_y = 100
        for title, fields in tbl_list:
            b = draw_entity_table(draw, x_pos, cur_y, 365, title, fields, f_hdr, f_row)
            cur_y = b[3] + 38

    # Legend at bottom
    draw.rounded_rectangle([55, 1140, W - 55, 1215], radius=8, fill="#F8FAFC", outline="#94A3B8", width=1)
    draw_centered_multiline(
        draw,
        (55, 1145, W - 55, 1210),
        [
            "คำอธิบายสัญลักษณ์:  PK (Primary Key) = คีย์หลักประจำตาราง   |   FK (Foreign Key) = คีย์นอกเชื่อมโยงตารางหลัก   |   1:N = ความสัมพันธ์แบบหนึ่งต่อกลุ่ม",
        ],
        f_hdr,
    )

    img.save(out_path)


if __name__ == "__main__":
    os.makedirs("scratch", exist_ok=True)
    gen_fig3_1_architecture("scratch/fig3_1_architecture.png")
    gen_fig3_2_dfd_lv0("scratch/fig3_2_dfd_lv0.png")
    gen_fig3_3_dfd_lv1("scratch/fig3_3_dfd_lv1.png")
    gen_fig3_4_use_case("scratch/fig3_4_use_case.png")
    gen_fig3_5_er_diagram("scratch/fig3_5_er_diagram.png")
    print("Generated all 5 Chapter 3 academic diagrams successfully!")

