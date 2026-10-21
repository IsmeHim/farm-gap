import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib import font_manager

# Configure Thai font (Tahoma / Leelawadee UI / TH SarabunPSK)
for fname in ["Tahoma", "Leelawadee UI", "TH SarabunPSK", "Microsoft Sans Serif"]:
    if any(fname.lower() in f.name.lower() for f in font_manager.fontManager.ttflist):
        plt.rcParams["font.family"] = fname
        break

plt.rcParams["axes.unicode_minus"] = False

OUT_DIR = r"c:\forwork\Web\farmgap\farmgap\scratch"
os.makedirs(OUT_DIR, exist_ok=True)


def new_canvas(w=11, h=6.2):
    fig, ax = plt.subplots(figsize=(w, h), dpi=220)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    fig.patch.set_facecolor("#FFFFFF")
    # Outer browser/window frame
    frame = patches.FancyBboxPatch(
        (1, 1), 98, 98, boxstyle="round,pad=0.3,rounding_size=1.8",
        edgecolor="#CBD5E1", facecolor="#F8FAFC", linewidth=1.5
    )
    ax.add_patch(frame)
    # Top header bar
    top_bar = patches.FancyBboxPatch(
        (1, 90), 98, 9, boxstyle="round,pad=0.1,rounding_size=1.2",
        edgecolor="#166534", facecolor="#166534", linewidth=1.0
    )
    ax.add_patch(top_bar)
    ax.text(4, 94.5, "FarmGAP — ระบบบริหารจัดการฟาร์มผักตามมาตรฐาน GAP และสั่งซื้อออนไลน์บน LINE OA",
            color="white", fontsize=11, fontweight="bold", va="center")
    return fig, ax


def draw_sidebar(ax, active_idx=0):
    sb = patches.Rectangle((1, 1), 19, 89, facecolor="#1E293B", edgecolor="#CBD5E1", linewidth=0.8)
    ax.add_patch(sb)
    menus = [
        "1. แดชบอร์ดภาพรวม",
        "2. แปลงปลูก & เตรียมดิน",
        "3. เพาะกล้า & รอบปลูก",
        "4. ปุ๋ย/สารเคมี (PHI)",
        "5. เก็บเกี่ยว & Lot",
        "6. รายงาน GAP (A4)",
        "7. วิเคราะห์ลูกค้า AI",
    ]
    for i, m in enumerate(menus):
        y = 82 - i * 10
        bg = "#16A34A" if i == active_idx else "#334155"
        box = patches.FancyBboxPatch(
            (2.2, y - 3.2), 16.6, 6.4, boxstyle="round,pad=0.1,rounding_size=0.8",
            edgecolor="none", facecolor=bg
        )
        ax.add_patch(box)
        ax.text(3.2, y, m, color="white", fontsize=8.5, fontweight="bold" if i == active_idx else "normal", va="center")


def draw_card(ax, x, y, w, h, title="", bg="#FFFFFF", border="#CBD5E1", title_color="#0F172A"):
    card = patches.FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.2,rounding_size=1.2",
        edgecolor=border, facecolor=bg, linewidth=1.1
    )
    ax.add_patch(card)
    if title:
        ax.text(x + 2, y + h - 4.2, title, color=title_color, fontsize=9.5, fontweight="bold", va="center")


# ==============================================================================
# Fig 4.1: Dashboard
# ==============================================================================
def gen_fig4_1():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=0)
    ax.text(23, 85, "หน้าจอแดชบอร์ดภาพรวมฟาร์มและสถิติสำคัญ (Farm Overview Dashboard)", fontsize=11, fontweight="bold", color="#0F172A")

    kpis = [
        ("รายได้รวมเดือนนี้", "48,520 บาท", "+18.4% จากเดือนก่อน", "#DCFCE7", "#166534"),
        ("รอบการปลูกที่กำลังดำเนินการ", "12 รอบปลูก", "พร้อมเก็บเกี่ยว 4 รอบ", "#DBEAFE", "#1E40AF"),
        ("สถานะติดระยะปลอดภัย (PHI)", "2 รอบปลูก", "ล็อกการเก็บเกี่ยวอัตโนมัติ", "#FEE2E2", "#991B1B"),
        ("คำสั่งซื้อผ่าน LINE OA วันนี้", "27 รายการ", "รอจัดส่ง 5 รายการ", "#FEF3C7", "#92400E"),
    ]
    for idx, (label, val, sub, bg, col) in enumerate(kpis):
        x = 23 + idx * 18.5
        draw_card(ax, x, 64, 17.2, 17, bg=bg, border=col)
        ax.text(x + 1.5, 76.5, label, fontsize=8, color=col, fontweight="bold")
        ax.text(x + 1.5, 70.5, val, fontsize=11.5, color=col, fontweight="bold")
        ax.text(x + 1.5, 66.2, sub, fontsize=7.5, color="#334155")

    # Left bottom: Active plantings status table
    draw_card(ax, 23, 6, 45, 54, title="สถานะรอบการปลูกและความพร้อมเก็บเกี่ยว (Real-time Planting Status)")
    headers = ["รหัสรอบปลูก", "ชื่อผัก", "แปลง/แคร่", "อายุสะสม", "สถานะ PHI"]
    xs = [24.5, 34, 44.5, 53, 60]
    for hx, ht in zip(xs, headers):
        ax.text(hx, 50, ht, fontsize=8, fontweight="bold", color="#334155")
    ax.plot([24, 67], [48, 48], color="#CBD5E1", lw=1)

    rows = [
        ("PLT-2026-014", "คะน้าฮ่องกง", "แปลง A / แคร่ 1", "45 / 45 วัน", "ปลอดภัย (พร้อมเก็บ)"),
        ("PLT-2026-015", "ผักบุ้งจีน", "แปลง A / แคร่ 2", "22 / 25 วัน", "ปลอดภัย (อีก 3 วัน)"),
        ("PLT-2026-016", "กวางตุ้งไต้หวัน", "แปลง B / แคร่ 1", "31 / 35 วัน", "ติด PHI (รอ 4 วัน)"),
        ("PLT-2026-017", "ผักสลัดกรีนโอ๊ค", "โรงเรือน C / 1", "38 / 40 วัน", "ปลอดภัย (อีก 2 วัน)"),
        ("PLT-2026-018", "ผักชีไทย", "แปลง B / แคร่ 3", "40 / 40 วัน", "ปลอดภัย (พร้อมเก็บ)"),
    ]
    for r_i, r in enumerate(rows):
        y = 43 - r_i * 7
        for hx, val in zip(xs, r):
            col = "#991B1B" if "ติด PHI" in val else ("#166534" if "พร้อมเก็บ" in val else "#1E293B")
            ax.text(hx, y, val, fontsize=7.8, color=col, fontweight="bold" if col != "#1E293B" else "normal")

    # Right bottom: Stock & AI Alerts
    draw_card(ax, 70, 6, 27, 54, title="แจ้งเตือนคลังสินค้า & AI")
    alerts = [
        ("คลังสินค้า: คะน้าฮ่องกง", "คงเหลือ 28.5 กก. (Lot #LOT-089)", "#DCFCE7"),
        ("คลังสินค้า: ผักสลัดกรีนโอ๊ค", "คงเหลือ 14.0 กก. (Lot #LOT-090)", "#DCFCE7"),
        ("แจ้งเตือน PHI: แปลง B แคร่ 1", "ห้ามเก็บเกี่ยวก่อน 24 ต.ค. 2569", "#FEE2E2"),
        ("Gemini AI Bot (LINE OA)", "ตอบกลับอัตโนมัติสำเร็จ 100%", "#DBEAFE"),
    ]
    for a_i, (t1, t2, bg) in enumerate(alerts):
        y = 43 - a_i * 10.5
        draw_card(ax, 71.5, y - 3, 24, 8.5, bg=bg, border="#94A3B8")
        ax.text(72.8, y + 2, t1, fontsize=8, fontweight="bold", color="#0F172A")
        ax.text(72.8, y - 1, t2, fontsize=7.5, color="#334155")

    fig.savefig(os.path.join(OUT_DIR, "fig4_1_dashboard.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.2: Plots, Beds, and Soil Preparation
# ==============================================================================
def gen_fig4_2():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=1)
    ax.text(23, 85, "หน้าจอจัดการแปลงปลูก แคร่ปลูก และการบันทึกการเตรียมดิน (Plots, Beds & Soil Prep)", fontsize=10.5, fontweight="bold", color="#0F172A")

    draw_card(ax, 23, 46, 74, 35, title="โครงสร้างแปลงปลูก (Plots) และแคร่ปลูกย่อย (Planting Beds)")
    plots = [
        ("แปลง A (กลางแจ้ง)", "ขนาด 1.5 ไร่ | แหล่งน้ำบาดาลผ่านเกณฑ์ GAP", "แคร่ A1: กำลังปลูกคะน้า", "แคร่ A2: กำลังปลูกผักบุ้ง", "#DCFCE7"),
        ("แปลง B (กางมุ้งตาข่าย)", "ขนาด 1.0 ไร่ | ระบบน้ำหยดอัตโนมัติ", "แคร่ B1: กำลังปลูกกวางตุ้ง", "แคร่ B2: อยู่ระหว่างตากดิน", "#DBEAFE"),
        ("โรงเรือน C (ปลูกบนแคร่ยกสูง)", "ขนาด 0.5 ไร่ | ควบคุมความชื้นและแสง", "แคร่ C1: ผักสลัดกรีนโอ๊ค", "แคร่ C2: พร้อมลงกล้าใหม่", "#FEF3C7"),
    ]
    for idx, (pname, pdesc, b1, b2, bg) in enumerate(plots):
        x = 25 + idx * 24
        draw_card(ax, x, 49, 22, 25, bg=bg, border="#64748B")
        ax.text(x + 1.5, 70, pname, fontsize=8.8, fontweight="bold", color="#0F172A")
        ax.text(x + 1.5, 65.5, pdesc, fontsize=7.3, color="#334155")
        ax.text(x + 1.5, 59, "• " + b1, fontsize=7.8, color="#166534", fontweight="bold")
        ax.text(x + 1.5, 53.5, "• " + b2, fontsize=7.8, color="#1E40AF", fontweight="bold")

    draw_card(ax, 23, 6, 74, 37, title="ประวัติการบันทึกการเตรียมดินและปรับปรุงบำรุงดิน (Soil Preparation Logs)")
    headers = ["รหัสเตรียมดิน", "แปลง / แคร่ปลูก", "วิธีการเตรียมดินและวัสดุที่ใช้", "วันที่เริ่ม - สิ้นสุด", "ผู้บันทึก"]
    xs = [25, 36, 50, 77, 89]
    for hx, ht in zip(xs, headers):
        ax.text(hx, 33, ht, fontsize=8, fontweight="bold", color="#334155")
    ax.plot([24.5, 95], [31, 31], color="#CBD5E1", lw=1)

    rows = [
        ("SOIL-2026-01", "แปลง A / แคร่ A1", "ไถพรวนตากดิน 7 วัน + ผสมปุ๋ยหมักชีวภาพ 50 กก. + ปูนขาววัด pH 6.5", "01/09/69 - 07/09/69", "อับดุลรอฮีม"),
        ("SOIL-2026-02", "แปลง A / แคร่ A2", "ยกร่องแปลงใหม่ + ใส่ปุ๋ยคอกมูลวัวแห้งผ่านการหมักสมบูรณ์ 40 กก.", "10/09/69 - 15/09/69", "อับดุลรอฮีม"),
        ("SOIL-2026-03", "แปลง B / แคร่ B1", "ตากดินฆ่าเชื้อ 5 วัน + เติมเชื้อไตรโคเดอร์มาป้องกันโรคเน่าคอดิน", "18/09/69 - 22/09/69", "อับดุลรอฮีม"),
    ]
    for r_i, r in enumerate(rows):
        y = 26 - r_i * 6.8
        for hx, val in zip(xs, r):
            ax.text(hx, y, val, fontsize=7.6, color="#1E293B")

    fig.savefig(os.path.join(OUT_DIR, "fig4_2_plots_soil.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.3: Nursery, Planting & Cumulative Crop Age
# ==============================================================================
def gen_fig4_3():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=2)
    ax.text(23, 85, "หน้าจอบันทึกการเพาะกล้า การย้ายลงปลูก และการคำนวณอายุพืชสะสมอัตโนมัติ", fontsize=10.5, fontweight="bold", color="#0F172A")

    draw_card(ax, 23, 52, 74, 30, title="สมการคำนวณอายุพืชสะสมต่อเนื่อง (Nursery Days + Field Planting Days)")
    ax.text(25, 71, "หลักการคำนวณของระบบ FarmGAP: นับอายุตั้งแต่วันเพาะเมล็ดในถาดหลุม (Nursery) ต่อเนื่องกับวันย้ายกล้าลงแคร่ปลูกจริง", fontsize=8.5, color="#1E293B")
    formula_box = patches.FancyBboxPatch((25, 55), 70, 13, boxstyle="round,pad=0.2,rounding_size=1.0", edgecolor="#16A34A", facecolor="#F0FDF4", linewidth=1.2)
    ax.add_patch(formula_box)
    ax.text(60, 63, "อายุพืชสะสมรวม (Total Crop Age) = อายุเพาะกล้า (15 วัน) + อายุหลังย้ายลงแปลง (30 วัน) = 45 วัน (ครบกำหนดเก็บเกี่ยว)",
            fontsize=9, fontweight="bold", color="#166534", ha="center")
    ax.text(60, 57.8, "ระบบคำนวณวันคาดการณ์เก็บเกี่ยว (Expected Harvest Date) อัตโนมัติจากค่า harvest_days ในข้อมูลหลักของพืชผักแต่ละชนิด",
            fontsize=8, color="#334155", ha="center")

    draw_card(ax, 23, 6, 74, 43, title="รายการรอบการปลูกและการติดตามอายุพืชสะสมรายแคร่ (Active Planting Cycles)")
    headers = ["รหัสรอบปลูก", "ชนิดผัก (มาตรฐานอายุ)", "วันเพาะกล้า", "วันย้ายลงแคร่", "อายุกล้า+แปลง", "ความคืบหน้าอายุพืช"]
    xs = [24.5, 36, 52, 62, 72, 83]
    for hx, ht in zip(xs, headers):
        ax.text(hx, 38, ht, fontsize=7.8, fontweight="bold", color="#334155")
    ax.plot([24, 95.5], [36, 36], color="#CBD5E1", lw=1)

    rows = [
        ("PLT-2026-014", "คะน้าฮ่องกง (45 วัน)", "05/09/2569", "20/09/2569", "15 + 30 = 45 วัน", "100% (ครบอายุ)"),
        ("PLT-2026-015", "ผักบุ้งจีน (25 วัน)", "28/09/2569", "ปลูกเมล็ดตรง", "0 + 22 = 22 วัน", "88% (เหลือ 3 วัน)"),
        ("PLT-2026-016", "กวางตุ้งไต้หวัน (35 วัน)", "19/09/2569", "01/10/2569", "12 + 19 = 31 วัน", "89% (เหลือ 4 วัน)"),
        ("PLT-2026-017", "สลัดกรีนโอ๊ค (40 วัน)", "12/09/2569", "26/09/2569", "14 + 24 = 38 วัน", "95% (เหลือ 2 วัน)"),
    ]
    for r_i, r in enumerate(rows):
        y = 30.5 - r_i * 6.8
        for hx, val in zip(xs, r):
            col = "#166534" if "100%" in val else "#1E293B"
            ax.text(hx, y, val, fontsize=7.6, color=col, fontweight="bold" if col == "#166534" else "normal")

    fig.savefig(os.path.join(OUT_DIR, "fig4_3_nursery_planting.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.4: Chemical/Fertilizer Usage & PHI Safety Lock
# ==============================================================================
def gen_fig4_4():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=3)
    ax.text(23, 85, "หน้าจอบันทึกการใช้ปุ๋ย/สารเคมี และระบบล็อกการเก็บเกี่ยวตามระยะปลอดภัย (PHI Lock)", fontsize=10.2, fontweight="bold", color="#0F172A")

    # Alert Banner for PHI Lock
    banner = patches.FancyBboxPatch((23, 62), 74, 19, boxstyle="round,pad=0.2,rounding_size=1.2", edgecolor="#DC2626", facecolor="#FEF2F2", linewidth=1.5)
    ax.add_patch(banner)
    ax.text(25, 76, "แจ้งเตือนระบบควบคุมความปลอดภัย GAP (Pre-Harvest Interval: PHI Safety Enforcement)", fontsize=9.5, fontweight="bold", color="#991B1B")
    ax.text(25, 70.5, "• รอบการปลูก PLT-2026-016 (กวางตุ้งไต้หวัน - แปลง B แคร่ 1) มีการฉีดพ่นสารชีวภัณฑ์อะบาเมกติน (ค่า PHI = 7 วัน) เมื่อวันที่ 17/10/2569", fontsize=8.2, color="#7F1D1D")
    ax.text(25, 65, "• วันที่ปลอดภัยในการเก็บเกี่ยว (Safe Harvest Date) = 17/10/2569 + 7 วัน = 24/10/2569 (สถานะปัจจุบัน: ล็อกปุ่มบันทึกเก็บเกี่ยว)", fontsize=8.2, fontweight="bold", color="#991B1B")

    draw_card(ax, 23, 6, 74, 52, title="ตารางประวัติการให้ปุ๋ยและสารป้องกันกำจัดศัตรูพืช (Chemical & Fertilizer Logs)")
    headers = ["รหัสรอบปลูก", "ชื่อปุ๋ย / สารเคมี", "อัตราที่ใช้", "วันที่ใช้สาร", "ค่า PHI", "วันปลอดภัย", "ปุ่มดำเนินการเก็บเกี่ยว"]
    xs = [24.2, 34.5, 49.5, 58, 66.5, 73.5, 83]
    for hx, ht in zip(xs, headers):
        ax.text(hx, 46, ht, fontsize=7.6, fontweight="bold", color="#334155")
    ax.plot([24, 95.5], [44, 44], color="#CBD5E1", lw=1)

    rows = [
        ("PLT-2026-014", "ปุ๋ยหมักชีวภาพสูตรขยายหัว", "20 กก./แคร่", "05/10/2569", "0 วัน", "05/10/2569", "[ บันทึกเก็บเกี่ยวได้ ]"),
        ("PLT-2026-014", "น้ำหมักสะเดาไล่แมลง", "50 ซีซี/น้ำ 20L", "12/10/2569", "3 วัน", "15/10/2569", "[ บันทึกเก็บเกี่ยวได้ ]"),
        ("PLT-2026-016", "สารอะบาเมกติน 1.8% EC", "20 ซีซี/น้ำ 20L", "17/10/2569", "7 วัน", "24/10/2569", "[ ล็อก PHI (รอ 4 วัน) ]"),
        ("PLT-2026-017", "แคลเซียมโบรอนทางใบ", "15 ซีซี/น้ำ 20L", "15/10/2569", "3 วัน", "18/10/2569", "[ บันทึกเก็บเกี่ยวได้ ]"),
    ]
    for r_i, r in enumerate(rows):
        y = 38 - r_i * 8
        for hx, val in zip(xs, r):
            is_lock = "ล็อก PHI" in val
            is_ok = "บันทึกเก็บเกี่ยวได้" in val
            col = "#DC2626" if is_lock else ("#16A34A" if is_ok else "#1E293B")
            ax.text(hx, y, val, fontsize=7.5, color=col, fontweight="bold" if (is_lock or is_ok) else "normal")

    fig.savefig(os.path.join(OUT_DIR, "fig4_4_chemical_phi.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.5: Harvest to Inventory & Lot Generation
# ==============================================================================
def gen_fig4_5():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=4)
    ax.text(23, 85, "หน้าจอบันทึกการเก็บเกี่ยวผลผลิตเข้าคลังสินค้าและการสร้างรหัส Lot อัตโนมัติ", fontsize=10.5, fontweight="bold", color="#0F172A")

    draw_card(ax, 23, 52, 74, 29, title="ฟอร์มบันทึกการเก็บเกี่ยวผลผลิตที่ผ่านเกณฑ์อายุพืชและพ้นระยะปลอดภัย PHI")
    ax.text(25, 71, "เลือกรอบการปลูก: [ PLT-2026-014 | คะน้าฮ่องกง | แปลง A แคร่ 1 | สถานะ PHI: ปลอดภัย 100% ]", fontsize=8.5, fontweight="bold", color="#166534")
    ax.text(25, 64, "วันที่เก็บเกี่ยว: 20/10/2569    |   ปริมาณที่เก็บเกี่ยวได้จริง: 35.0 กิโลกรัม    |   เกรดคุณภาพ: เกรด A (มาตรฐาน GAP)", fontsize=8.2, color="#1E293B")
    ax.text(25, 57, "ผลการทำงานอัตโนมัติ: สร้างรหัสล็อต #LOT-20261020-014 -> เพิ่มสต็อกสินค้า +35.0 กก. -> สร้าง QR Code ตรวจสอบย้อนกลับ", fontsize=8.2, fontweight="bold", color="#1E40AF")

    draw_card(ax, 23, 6, 74, 42, title="รายการล็อตผลผลิตในคลังสินค้าพร้อม QR Code ตรวจสอบย้อนกลับ (Harvest Lots & Stock)")
    headers = ["รหัสล็อตผลผลิต (Lot ID)", "รหัสรอบปลูก", "ชื่อสินค้าผัก", "วันที่เก็บเกี่ยว", "ปริมาณรับเข้า", "คงเหลือขาย", "QR Code"]
    xs = [24.2, 39, 49, 60.5, 70.5, 79.5, 88]
    for hx, ht in zip(xs, headers):
        ax.text(hx, 37, ht, fontsize=7.6, fontweight="bold", color="#334155")
    ax.plot([24, 95.5], [35, 35], color="#CBD5E1", lw=1)

    rows = [
        ("LOT-20261020-014", "PLT-2026-014", "คะน้าฮ่องกง", "20/10/2569", "35.0 กก.", "28.5 กก.", "[ พิมพ์ QR ]"),
        ("LOT-20261018-012", "PLT-2026-012", "ผักสลัดกรีนโอ๊ค", "18/10/2569", "20.0 กก.", "14.0 กก.", "[ พิมพ์ QR ]"),
        ("LOT-20261016-011", "PLT-2026-011", "ผักบุ้งจีนปลอดสาร", "16/10/2569", "40.0 กก.", "11.5 กก.", "[ พิมพ์ QR ]"),
    ]
    for r_i, r in enumerate(rows):
        y = 29 - r_i * 7.5
        for hx, val in zip(xs, r):
            col = "#1E40AF" if "พิมพ์ QR" in val else "#1E293B"
            ax.text(hx, y, val, fontsize=7.6, color=col, fontweight="bold" if col == "#1E40AF" else "normal")

    fig.savefig(os.path.join(OUT_DIR, "fig4_5_harvest_lot.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.6: GAP A4 Report Per Planting Cycle
# ==============================================================================
def gen_fig4_6():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=5)
    ax.text(23, 85, "ตัวอย่างรายงานมาตรฐาน GAP รูปแบบเอกสาร A4 แยกรายรอบการปลูก (มกษ. 9001)", fontsize=10.5, fontweight="bold", color="#0F172A")

    # A4 paper preview box
    a4 = patches.FancyBboxPatch((25, 5), 70, 76, boxstyle="round,pad=0.2,rounding_size=0.8", edgecolor="#475569", facecolor="#FFFFFF", linewidth=1.5)
    ax.add_patch(a4)

    ax.text(60, 76.5, "แบบบันทึกข้อมูลการปฏิบัติทางการเกษตรที่ดีสำหรับพืชอาหาร (GAP มกษ. 9001)", fontsize=9.5, fontweight="bold", color="#0F172A", ha="center")
    ax.text(60, 72, "รหัสรอบการปลูก: PLT-2026-014  |  ชนิดพืช: คะน้าฮ่องกง  |  แปลง A แคร่ที่ 1  |  ผู้รับผิดชอบ: อับดุลรอฮีม จิเตะ", fontsize=8, color="#334155", ha="center")
    ax.plot([28, 92], [69.5, 69.5], color="#94A3B8", lw=1)

    sections = [
        ("ส่วนที่ 1 ข้อมูลการเตรียมดินและเพาะกล้า:", "ไถพรวนตากดิน 7 วัน (01-07 ก.ย. 69) ผสมปุ๋ยหมักชีวภาพ 50 กก. เพาะกล้า 05/09/69 ย้ายปลูก 20/09/69"),
        ("ส่วนที่ 2 ประวัติการให้น้ำและปุ๋ยบำรุงดิน:", "ใช้น้ำบาดาลผ่านการตรวจคุณภาพ | ให้ปุ๋ยหมักชีวภาพ 20 กก. เมื่อ 05/10/69 (PHI = 0 วัน)"),
        ("ส่วนที่ 3 การป้องกันกำจัดศัตรูพืชและค่า PHI:", "ฉีดพ่นน้ำหมักสะเดาชีวภาพ 12/10/69 (ค่า PHI = 3 วัน, วันครบกำหนดปลอดภัย = 15/10/69)"),
        ("ส่วนที่ 4 บันทึกการเก็บเกี่ยวและรหัส Lot:", "เก็บเกี่ยววันที่ 20/10/69 (อายุสะสม 45 วัน, พ้นระยะ PHI แล้ว 5 วัน) ปริมาณ 35.0 กก. รหัส LOT-20261020-014"),
    ]
    for s_i, (stitle, sdesc) in enumerate(sections):
        y = 63 - s_i * 12.5
        ax.text(28, y, stitle, fontsize=8.2, fontweight="bold", color="#166534")
        ax.text(28, y - 4.8, sdesc, fontsize=7.8, color="#1E293B")

    ax.text(42, 11, "ลงชื่อ................................................เกษตรกรผู้บันทึก", fontsize=8, color="#334155", ha="center")
    ax.text(78, 11, "ลงชื่อ................................................ผู้ตรวจประเมิน GAP", fontsize=8, color="#334155", ha="center")

    fig.savefig(os.path.join(OUT_DIR, "fig4_6_gap_report.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.7: LINE LIFF Online Store & Ordering
# ==============================================================================
def gen_fig4_7():
    fig, ax = new_canvas()
    ax.text(50, 84, "หน้าจอร้านค้าผักสดออนไลน์ผ่าน LINE LIFF และการสั่งซื้อพร้อมอัปโหลดสลิปชำระเงิน", fontsize=11, fontweight="bold", color="#0F172A", ha="center")

    # Mobile screen 1: Product catalog
    draw_card(ax, 6, 6, 27, 74, title="1. เลือกซื้อผักสดปลอดสาร (LIFF)", bg="#FFFFFF", border="#16A34A", title_color="#166534")
    items = [
        ("คะน้าฮ่องกง GAP (Lot #014)", "65 บาท / กก. | คงเหลือ 28.5 กก.", "[ + เพิ่มลงตะกร้า 2 กก. ]"),
        ("สลัดกรีนโอ๊ค GAP (Lot #012)", "120 บาท / กก. | คงเหลือ 14.0 กก.", "[ + เพิ่มลงตะกร้า 1 กก. ]"),
        ("ผักบุ้งจีนปลอดสาร (Lot #011)", "45 บาท / กก. | คงเหลือ 11.5 กก.", "[ + เพิ่มลงตะกร้า ]"),
    ]
    for i, (n, p, b) in enumerate(items):
        y = 58 - i * 19
        draw_card(ax, 8, y, 23, 16, bg="#F0FDF4", border="#86EFAC")
        ax.text(9.5, y + 11.5, n, fontsize=7.8, fontweight="bold", color="#0F172A")
        ax.text(9.5, y + 7, p, fontsize=7.2, color="#334155")
        ax.text(9.5, y + 2.5, b, fontsize=7.5, fontweight="bold", color="#166534")

    # Mobile screen 2: AI Cross-sell & Cart
    draw_card(ax, 36.5, 6, 27, 74, title="2. ตะกร้าสินค้า & แนะนำสินค้าคู่กัน", bg="#FFFFFF", border="#2563EB", title_color="#1E40AF")
    ax.text(38.5, 68, "รายการในตะกร้า (2 รายการ):", fontsize=8, fontweight="bold", color="#0F172A")
    ax.text(38.5, 62.5, "• คะน้าฮ่องกง GAP x 2 กก. = 130 ฿", fontsize=7.6, color="#334155")
    ax.text(38.5, 57.5, "• สลัดกรีนโอ๊ค GAP x 1 กก. = 120 ฿", fontsize=7.6, color="#334155")
    draw_card(ax, 38.5, 34, 23, 20, bg="#EFF6FF", border="#93C5FD")
    ax.text(40, 49, "AI แนะนำสินค้าที่มักซื้อคู่กัน:", fontsize=7.8, fontweight="bold", color="#1E40AF")
    ax.text(40, 43.5, "ลูกค้าที่ซื้อคะน้า 78% มักซื้อคู่กับ:", fontsize=7.2, color="#334155")
    ax.text(40, 38, "+ ผักชีไทยปลอดสาร (20 บาท/ขีด)", fontsize=7.5, fontweight="bold", color="#16A34A")
    ax.text(38.5, 25, "ยอดชำระสุทธิ: 250.00 บาท", fontsize=9, fontweight="bold", color="#0F172A")

    # Mobile screen 3: Payment & Slip upload
    draw_card(ax, 67, 6, 27, 74, title="3. ชำระเงินและแนบสลิปโอนเงิน", bg="#FFFFFF", border="#0D9488", title_color="#0F766E")
    ax.text(69, 67, "วิธีรับสินค้า: [ จัดส่งถึงบ้าน (Delivery) ]", fontsize=7.8, fontweight="bold", color="#0F172A")
    ax.text(69, 60.5, "วิธีชำระเงิน: [ โอนเงินผ่านบัญชีธนาคาร ]", fontsize=7.8, color="#334155")
    draw_card(ax, 69, 36, 23, 21, bg="#F8FAFC", border="#94A3B8")
    ax.text(80.5, 49, "อัปโหลดสลิปโอนเงินสำเร็จ", fontsize=8, fontweight="bold", color="#166534", ha="center")
    ax.text(80.5, 43, "slip_20261020_250THB.jpg", fontsize=7.5, color="#475569", ha="center")
    btn = patches.FancyBboxPatch((69, 12), 23, 9, boxstyle="round,pad=0.1,rounding_size=1.0", edgecolor="none", facecolor="#16A34A")
    ax.add_patch(btn)
    ax.text(80.5, 16.5, "ยืนยันคำสั่งซื้อ (#ORD-2026-089)", fontsize=8, fontweight="bold", color="white", ha="center", va="center")

    fig.savefig(os.path.join(OUT_DIR, "fig4_7_liff_shop.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.8: LINE Flex Message Order Status Notification
# ==============================================================================
def gen_fig4_8():
    fig, ax = new_canvas()
    ax.text(50, 84, "การ์ดแจ้งเตือนสถานะคำสั่งซื้อและการตรวจสอบสถานะจัดส่งผ่าน LINE Flex Message", fontsize=11, fontweight="bold", color="#0F172A", ha="center")

    cards = [
        ("สถานะที่ 1: ยืนยันรับคำสั่งซื้อ", "#EFF6FF", "#2563EB", "รหัสคำสั่งซื้อ #ORD-2026-089",
         ["• คะน้าฮ่องกง GAP x 2 กก. (130 ฿)", "• สลัดกรีนโอ๊ค GAP x 1 กก. (120 ฿)", "• ยอดชำระสุทธิ: 250.00 บาท", "• สถานะ: ตรวจสอบสลิปเรียบร้อย"]),
        ("สถานะที่ 2: กำลังคัดแยกและจัดส่ง", "#FEF3C7", "#D97706", "รหัสคำสั่งซื้อ #ORD-2026-089",
         ["• ตัดสต็อกจาก Lot #LOT-20261020-014", "• บรรจุถุงสุญญากาศติด QR Code GAP", "• พนักงานกำลังนำส่งพื้นที่ อ.เมืองยะลา", "• เวลาจัดส่งโดยประมาณ: 14:30 น."]),
        ("สถานะที่ 3: จัดส่งสำเร็จ & ใบเสร็จ", "#DCFCE7", "#16A34A", "รหัสคำสั่งซื้อ #ORD-2026-089",
         ["• สถานะ: ลูกค้ารับสินค้าเรียบร้อยแล้ว", "• บันทึกรายรับเข้าบัญชีฟาร์มอัตโนมัติ", "• สแกน QR บนถุงผักเพื่อดูประวัติ GAP", "[ ปุ่มดูใบเสร็จอิเล็กทรอนิกส์ ]"]),
    ]
    for idx, (title, bg, col, oid, lines) in enumerate(cards):
        x = 6 + idx * 30.5
        draw_card(ax, x, 8, 27.5, 70, title=title, bg=bg, border=col, title_color=col)
        ax.text(x + 2, 66, oid, fontsize=8.5, fontweight="bold", color="#0F172A")
        ax.plot([x + 1.5, x + 26], [63.5, 63.5], color=col, lw=1)
        for l_i, line in enumerate(lines):
            ax.text(x + 2, 56 - l_i * 9.5, line, fontsize=7.6, color="#1E293B", fontweight="bold" if "[" in line else "normal")

    fig.savefig(os.path.join(OUT_DIR, "fig4_8_flex_status.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.9: QR Code Traceability Page
# ==============================================================================
def gen_fig4_9():
    fig, ax = new_canvas()
    ax.text(50, 84, "หน้าจอตรวจสอบย้อนกลับแหล่งที่มาของผลผลิตผ่านการสแกน QR Code (GAP Traceability)", fontsize=10.8, fontweight="bold", color="#0F172A", ha="center")

    draw_card(ax, 8, 6, 84, 74, title="ข้อมูลตรวจสอบย้อนกลับผลผลิตเกษตรปลอดภัย (รหัสล็อต: LOT-20261020-014)", bg="#FFFFFF", border="#16A34A", title_color="#166534")

    timeline = [
        ("1. ข้อมูลแปลงปลูกและการเตรียมดิน", "แปลง A แคร่ที่ 1 | ไถพรวนตากดิน 7 วัน ผสมปุ๋ยหมักชีวภาพและตรวจวัดค่า pH ดิน 6.5 (01/09/2569)"),
        ("2. การเพาะกล้าและย้ายลงแคร่ปลูก", "เพาะเมล็ดคะน้าฮ่องกงวันที่ 05/09/2569 (15 วัน) และย้ายลงแคร่ปลูกวันที่ 20/09/2569 (ดูแลต่อ 30 วัน)"),
        ("3. ประวัติการให้ปุ๋ยและการควบคุมค่า PHI", "ปุ๋ยหมักชีวภาพ (05/10/69) | น้ำหมักสะเดาไล่แมลง (12/10/69, PHI = 3 วัน, ปลอดภัยตั้งแต่ 15/10/69)"),
        ("4. การเก็บเกี่ยวและรับรองความปลอดภัย", "เก็บเกี่ยววันที่ 20/10/2569 (อายุสะสม 45 วัน) ผ่านเกณฑ์ระยะปลอดภัย PHI 100% ตามมาตรฐาน GAP มกษ. 9001"),
    ]
    for idx, (step_t, step_d) in enumerate(timeline):
        y = 58 - idx * 13.5
        box = patches.FancyBboxPatch((12, y - 4), 76, 10.5, boxstyle="round,pad=0.15,rounding_size=0.9", edgecolor="#86EFAC", facecolor="#F0FDF4")
        ax.add_patch(box)
        ax.text(14, y + 2.2, step_t, fontsize=8.5, fontweight="bold", color="#166534")
        ax.text(14, y - 1.8, step_d, fontsize=7.8, color="#1E293B")

    fig.savefig(os.path.join(OUT_DIR, "fig4_9_qr_traceability.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.10: K-Means Clustering & Market Basket Analysis
# ==============================================================================
def gen_fig4_10():
    fig, ax = new_canvas()
    draw_sidebar(ax, active_idx=6)
    ax.text(23, 85, "หน้าจอวิเคราะห์กลุ่มลูกค้าด้วย K-Means Clustering และการแนะนำสินค้าคู่กัน", fontsize=10.5, fontweight="bold", color="#0F172A")

    draw_card(ax, 23, 45, 74, 36, title="ผลการจัดกลุ่มพฤติกรรมลูกค้าอัตโนมัติด้วยอัลกอริทึม K-Means Clustering (K = 3)")
    clusters = [
        ("กลุ่มที่ 1: ลูกค้าประจำยอดซื้อสูง (VIP)", "ความถี่เฉลี่ย: 6.4 ครั้ง/เดือน\nยอดซื้อเฉลี่ย: 890 บาท/คำสั่งซื้อ\nกลยุทธ์: ส่งโปรโมชันเซตผักรายสัปดาห์", "#DCFCE7", "#166534"),
        ("กลุ่มที่ 2: ลูกค้าทั่วไปซื้อสม่ำเสมอ", "ความถี่เฉลี่ย: 2.8 ครั้ง/เดือน\nยอดซื้อเฉลี่ย: 310 บาท/คำสั่งซื้อ\nกลยุทธ์: แนะนำสินค้าขายคู่เพิ่มยอดตะกร้า", "#DBEAFE", "#1E40AF"),
        ("กลุ่มที่ 3: ลูกค้าใหม่ / เริ่มห่างหาย", "ความถี่เฉลี่ย: 1.0 ครั้ง/เดือน\nยอดซื้อเฉลี่ย: 125 บาท/คำสั่งซื้อ\nกลยุทธ์: ส่งคูปองส่วนลดกระตุ้นการซื้อซ้ำ", "#FEF3C7", "#92400E"),
    ]
    for idx, (ctitle, cdesc, bg, col) in enumerate(clusters):
        x = 25 + idx * 24
        draw_card(ax, x, 48, 22, 26, bg=bg, border=col)
        ax.text(x + 1.5, 69, ctitle, fontsize=8, fontweight="bold", color=col)
        ax.text(x + 1.5, 57, cdesc, fontsize=7.5, color="#1E293B", va="center")

    draw_card(ax, 23, 6, 74, 36, title="ผลการวิเคราะห์ตะกร้าสินค้า (Co-occurrence Market Basket Analysis)")
    rules = [
        ("คู่สินค้าอันดับ 1: คะน้าฮ่องกง GAP  +  ผักบุ้งจีนปลอดสาร", "ค่าความเชื่อมั่น (Confidence) = 78.5%  |  แสดงในหน้าตะกร้า LIFF อัตโนมัติ"),
        ("คู่สินค้าอันดับ 2: ผักสลัดกรีนโอ๊ค  +  เรดโอ๊คไฮโดรโปนิกส์", "ค่าความเชื่อมั่น (Confidence) = 74.2%  |  จัดเซตคู่สลัดเพื่อสุขภาพ"),
        ("คู่สินค้าอันดับ 3: กวางตุ้งไต้หวัน  +  ผักชีไทยปลอดสาร", "ค่าความเชื่อมั่น (Confidence) = 66.0%  |  แนะนำเพิ่มเมื่อลูกค้าสั่งผ่านแชทบอท"),
    ]
    for r_i, (r1, r2) in enumerate(rules):
        y = 30 - r_i * 8.5
        ax.text(25.5, y, "• " + r1, fontsize=8.2, fontweight="bold", color="#1E40AF")
        ax.text(58, y, r2, fontsize=7.8, color="#334155")

    fig.savefig(os.path.join(OUT_DIR, "fig4_10_kmeans_ai.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


# ==============================================================================
# Fig 4.11: Google Gemini AI Chatbot on LINE OA
# ==============================================================================
def gen_fig4_11():
    fig, ax = new_canvas()
    ax.text(50, 84, "การสนทนาและรับคำสั่งซื้ออัตโนมัติด้วย Google Gemini AI บน LINE Official Account", fontsize=10.8, fontweight="bold", color="#0F172A", ha="center")

    draw_card(ax, 8, 6, 54, 74, title="หน้าจอแชท LINE OA (ผสานโมเดลภาษา Google Gemini + ข้อมูลสต็อกจริง)", bg="#E2E8F0", border="#475569")

    msgs = [
        ("ลูกค้า:", "สวัสดีครับ วันนี้มีผักอะไรพร้อมส่งบ้าง และคะน้าปลอดสารไหมครับ?", True, 66),
        ("Gemini AI:", "สวัสดีค่ะ! วันนี้ฟาร์มมีผักสดมาตรฐาน GAP พร้อมจัดส่ง 3 รายการค่ะ:\n1. คะน้าฮ่องกง GAP (65 ฿/กก. คงเหลือ 28.5 กก.)\n2. สลัดกรีนโอ๊ค (120 ฿/กก. คงเหลือ 14.0 กก.)\n3. ผักบุ้งจีน (45 ฿/กก.) คะน้าของเราพ้นระยะปลอดภัย PHI 100% ค่ะ", False, 50),
        ("ลูกค้า:", "ขอสั่งคะน้าฮ่องกง 2 กิโล และสลัดกรีนโอ๊ค 1 กิโลครับ", True, 34),
        ("Gemini AI:", "รับรายการสั่งซื้อเรียบร้อยค่ะ! สรุปยอดคะน้า 2 กก. (130 ฿) + กรีนโอ๊ค 1 กก. (120 ฿)\nรวมทั้งสิ้น 250 บาท กดปุ่มในการ์ดด้านล่างเพื่อแจ้งที่อยู่และแนบสลิปได้เลยค่ะ", False, 18),
    ]
    for sender, text, is_user, y in msgs:
        bx = 24 if is_user else 10
        bw = 36 if is_user else 44
        bh = 9 if is_user else 13.5
        bg = "#DCFCE7" if is_user else "#FFFFFF"
        b = patches.FancyBboxPatch((bx, y), bw, bh, boxstyle="round,pad=0.15,rounding_size=1.0", edgecolor="#94A3B8", facecolor=bg)
        ax.add_patch(b)
        ax.text(bx + 1.5, y + bh - 2.8, sender, fontsize=7.5, fontweight="bold", color="#166534" if is_user else "#1E40AF")
        ax.text(bx + 1.5, y + bh - 6.8, text, fontsize=7.2, color="#0F172A", va="center")

    draw_card(ax, 65, 6, 27, 74, title="กลไกเบื้องหลัง (AI Pipeline)", bg="#FFFFFF", border="#2563EB", title_color="#1E40AF")
    steps = [
        ("1. Dynamic Context Injection", "ดึงรายการผัก สต็อกคงเหลือ และสถานะ PHI ล่าสุดจาก MySQL แทรกใน System Prompt"),
        ("2. Multi-Model Fallback", "เรียกใช้ gemini-2.5-flash -> สลับไป 2.0-flash อัตโนมัติหากโควตาเต็ม"),
        ("3. Order Intent Extraction", "สกัดชื่อสินค้าและจำนวนจากข้อความธรรมชาติเพื่อสร้างตะกร้าอัตโนมัติ"),
    ]
    for s_i, (st, sd) in enumerate(steps):
        y = 54 - s_i * 21
        draw_card(ax, 67, y, 23, 17, bg="#EFF6FF", border="#93C5FD")
        ax.text(68.5, y + 12.5, st, fontsize=7.8, fontweight="bold", color="#1E40AF")
        ax.text(68.5, y + 5.5, sd, fontsize=7.1, color="#334155", va="center")

    fig.savefig(os.path.join(OUT_DIR, "fig4_11_gemini_chat.png"), bbox_inches="tight", dpi=220)
    plt.close(fig)


if __name__ == "__main__":
    gen_fig4_1()
    gen_fig4_2()
    gen_fig4_3()
    gen_fig4_4()
    gen_fig4_5()
    gen_fig4_6()
    gen_fig4_7()
    gen_fig4_8()
    gen_fig4_9()
    gen_fig4_10()
    gen_fig4_11()
    print("Successfully generated all 11 Chapter 4 figures in scratch/")
