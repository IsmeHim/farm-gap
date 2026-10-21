import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from data_dictionary_tables import DATA_DICTIONARY_TABLES
from step2_front_matter import (
    build_front_matter,
    set_run_thai_font,
    set_section_margins,
    thai_word_wrap,
    add_centered_line,
    add_body_paragraph,
)
from step3_chapter1 import (
    append_chapter1,
    configure_chapter_section_page_numbering,
    add_chapter_heading,
    add_section_heading,
    add_numbered_item,
)
from step4_chapter2 import (
    append_chapter2,
    add_subsection_heading,
    add_formula_line,
    format_academic_table,
    add_table_caption,
)


def add_figure_with_caption(doc, img_path, caption_text, width_in=5.75, max_height_in=7.4):
    """
    แทรกรูปภาพจัดกึ่งกลาง พร้อมชื่อภาพใต้ภาพ (ตามเกณฑ์คู่มือ มรย. ข้อ 10: ชื่อภาพจะวางไว้ใต้ภาพ)
    ปรับขนาดอัตโนมัติไม่ให้ภาพสูงเกินหน้ากระดาษ A4
    """
    try:
        from PIL import Image
        with Image.open(img_path) as im:
            w_px, h_px = im.size
            if w_px > 0 and h_px > 0:
                calc_h = width_in * (h_px / w_px)
                if calc_h > max_height_in:
                    width_in = max_height_in * (w_px / h_px)
    except Exception:
        pass

    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(8)
    p_img.paragraph_format.space_after = Pt(4)
    p_img.paragraph_format.line_spacing = 1.0
    p_img.paragraph_format.keep_with_next = True
    run_img = p_img.add_run()
    run_img.add_picture(img_path, width=Inches(width_in))

    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(2)
    p_cap.paragraph_format.space_after = Pt(10)
    p_cap.paragraph_format.line_spacing = 1.15
    run_cap = p_cap.add_run(thai_word_wrap(caption_text))
    set_run_thai_font(run_cap, "TH SarabunPSK", size_pt=16, bold=False)


def build_styled_table(doc, headers, rows_data, col_widths, center_cols=None, font_size_pt=14, header_center=True):
    if center_cols is None:
        center_cols = set()
    table = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    format_academic_table(table)

    # Repeat header row across pages and prevent splitting across page break
    hdr_tr = table.rows[0]._tr.get_or_add_trPr()
    hdr_tr.append(OxmlElement("w:tblHeader"))
    hdr_tr.append(OxmlElement("w:cantSplit"))

    hdr_cells = table.rows[0].cells
    for idx, text in enumerate(headers):
        hdr_cells[idx].width = Inches(col_widths[idx])
        p = hdr_cells[idx].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if header_center else (WD_ALIGN_PARAGRAPH.CENTER if idx in center_cols else WD_ALIGN_PARAGRAPH.LEFT)
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.0
        r = p.add_run(thai_word_wrap(text))
        set_run_thai_font(r, "TH SarabunPSK", size_pt=font_size_pt, bold=True)

    for r_idx, row_vals in enumerate(rows_data):
        row = table.rows[r_idx + 1]
        trPr = row._tr.get_or_add_trPr()
        trPr.append(OxmlElement("w:cantSplit"))

        row_cells = row.cells
        for c_idx, val in enumerate(row_vals):
            row_cells[c_idx].width = Inches(col_widths[c_idx])
            p = row_cells[c_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if c_idx in center_cols else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(thai_word_wrap(val))
            set_run_thai_font(r, "TH SarabunPSK", size_pt=font_size_pt, bold=False)

    return table


def append_chapter3(doc, scratch_dir):
    sec_ch3 = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_ch3)
    configure_chapter_section_page_numbering(sec_ch3, start_page=None)

    add_chapter_heading(doc, "บทที่ 3", "วิธีดำเนินการวิจัย การออกแบบ และการพัฒนาระบบ")

    add_body_paragraph(
        doc,
        "การวิจัยและพัฒนาระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account (FarmGAP) ดำเนินการตามระเบียบวิธีวิจัยและพัฒนาซอฟต์แวร์เชิงประยุกต์ โดยให้ความสำคัญกับการเชื่อมโยงข้อมูลการปฏิบัติงานในแปลงปลูกตามมาตรฐาน GAP (มกษ. 9001) เข้ากับระบบการควบคุมระยะปลอดภัยของสารเคมี (PHI) ระบบการตรวจสอบย้อนกลับรายรอบการปลูก และโมดูลปัญญาประดิษฐ์บนแพลตฟอร์ม LINE Official Account ซึ่งมีรายละเอียดขั้นตอนการดำเนินงาน การวิเคราะห์ระบบ การออกแบบสถาปัตยกรรมและฐานข้อมูล ตลอดจนเกณฑ์การประเมินผล ดังต่อไปนี้",
    )

    # =========================================================================
    # 3.1 แนวทางการดำเนินการวิจัยและพัฒนา
    # =========================================================================
    add_section_heading(doc, "3.1 แนวทางการดำเนินการวิจัยและพัฒนา")

    add_body_paragraph(
        doc,
        "ผู้วิจัยแบ่งขั้นตอนการดำเนินงานออกเป็น 5 ขั้นตอนตามวงจรการพัฒนาระบบซอฟต์แวร์ (Software Development Life Cycle: SDLC) เพื่อให้การพัฒนาระบบครอบคลุมความต้องการของผู้ใช้งานและสามารถตรวจสอบความถูกต้องได้ในทุกขั้นตอน ดังนี้",
    )

    add_numbered_item(
        doc,
        "3.1.1",
        "การศึกษาและวิเคราะห์ความต้องการของระบบ (Requirement Analysis) ศึกษากระบวนการบันทึกข้อมูลการเพาะปลูกพืชผักตามมาตรฐาน GAP (มกษ. 9001) เงื่อนไขการคำนวณอายุพืชสะสม การล็อกการเก็บเกี่ยวตามค่าระยะปลอดภัยของสารเคมี (PHI) และกระบวนการสั่งซื้อผักสดออนไลน์ผ่าน LINE Official Account เพื่อกำหนดความต้องการเชิงหน้าที่ (Functional Requirements) และความต้องการไม่เชิงหน้าที่ (Non-Functional Requirements)",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "3.1.2",
        "การออกแบบระบบและฐานข้อมูล (System & Database Design) ออกแบบแผนภาพกรณีใช้งาน (Use Case Diagram) ทั้ง 13 กรณี สถาปัตยกรรมของระบบแบบแยกชั้น (Layered Architecture) แผนภาพกระแสข้อมูล (Context Diagram และ DFD ระดับ 1) และออกแบบโครงสร้างฐานข้อมูลเชิงสัมพันธ์ MySQL จำนวน 18 ตารางที่ผูกความสัมพันธ์ด้วยรหัสรอบการปลูก (planting_id)",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "3.1.3",
        "การพัฒนาระบบและบูรณาการปัญญาประดิษฐ์ (Implementation & AI Integration) พัฒนาส่วนติดต่อผู้ใช้ฝั่งเจ้าของฟาร์มและหน้าเว็บ LIFF ด้วย React.js พัฒนาเซิร์ฟเวอร์ประมวลผลด้วย Node.js และ Express.js เชื่อมต่อ LINE Messaging API และพัฒนาโมดูลปัญญาประดิษฐ์ 3 ส่วน ได้แก่ อัลกอริทึม K-Means Clustering แบ่งกลุ่มลูกค้า 3 กลุ่มสำหรับการยิงแจ้งเตือน LINE เฉพาะกลุ่ม, เมทริกซ์การเกิดร่วม (Co-occurrence Matrix) สำหรับแนะนำผักที่มักซื้อคู่กัน และผู้ช่วยสนทนา Google Gemini AI พร้อมกลไกสลับโมเดลสำรองอัตโนมัติ (Multi-Model Fallback)",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "3.1.4",
        "การทดสอบการทำงานของระบบ (System Testing) ดำเนินการทดสอบความถูกต้องของฟังก์ชันการทำงานแบบ Black-box Testing ตามกรณีใช้งานทั้ง 13 กรณี เพื่อตรวจสอบความถูกต้องของการคำนวณวันเก็บเกี่ยว การล็อก PHI การตัดสต็อก การออกรายงาน GAP A4 และการตอบกลับของแชทบอท AI",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "3.1.5",
        "การประเมินคุณภาพและความพึงพอใจ (System Evaluation) นำระบบที่พัฒนาเสร็จสมบูรณ์ไปรับการประเมินความเหมาะสมโดยผู้เชี่ยวชาญด้านวิทยาการคอมพิวเตอร์และระบบสารสนเทศจำนวน 3 ท่าน (แบบประเมิน วค-4) และประเมินความพึงพอใจในการใช้งานจริงโดยผู้ใช้งานจำนวน 3 ท่าน (แบบประเมิน วค-5)",
        bold_prefix=True,
    )

    # =========================================================================
    # 3.2 การวิเคราะห์ความต้องการของระบบและกรณีใช้งาน (Use Cases)
    # =========================================================================
    add_section_heading(doc, "3.2 การวิเคราะห์ความต้องการของระบบและกรณีใช้งาน (Use Cases)")

    add_body_paragraph(
        doc,
        "จากการวิเคราะห์ความต้องการของระบบ สามารถจำแนกผู้ใช้งานภายนอก (Actors) ออกเป็น 2 กลุ่มหลัก ได้แก่ (1) เจ้าของฟาร์มหรือผู้ดูแลระบบ (Admin/Farmer) ซึ่งรับผิดชอบการบันทึกข้อมูลการเพาะปลูกตามมาตรฐาน GAP การจัดการคลังสินค้า การจัดการคำสั่งซื้อ (ทั้งผ่านหน้าจอ Web Dashboard และผ่านปุ่มคำสั่งลัด Postback Action บน LINE Official Account) และการดูรายงานวิเคราะห์ AI และ (2) ลูกค้าหรือผู้บริโภค (Customer/LINE User) ซึ่งใช้งานผ่านแอปพลิเคชัน LINE เพื่อเลือกซื้อสินค้าผ่านหน้าร้าน LIFF สนทนาสั่งซื้อกับ AI Chatbot ติดตามสถานะการจัดส่ง และสแกน QR Code เพื่อตรวจสอบย้อนกลับ โดยมีรายละเอียดกรณีใช้งานทั้ง 13 กรณี ดังแสดงในตารางที่ 3.1 และภาพที่ 3.1",
    )

    add_table_caption(doc, "ตารางที่ 3.1  รายการกรณีใช้งาน (Use Cases) ทั้ง 13 กรณีของระบบ FarmGAP")

    uc_headers = ["รหัส", "ชื่อกรณีใช้งาน (Use Case)", "ผู้ใช้งาน", "รายละเอียดและผลลัพธ์ของการทำงาน"]
    uc_rows = [
        ["UC01", "เข้าสู่ระบบและดูแดชบอร์ดภาพรวมฟาร์ม", "เจ้าของฟาร์ม", "ตรวจสอบสิทธิ์ด้วย JWT และแสดงสรุปแปลงปลูก สต็อก ยอดขาย และแจ้งเตือนสำคัญ"],
        ["UC02", "จัดการข้อมูลชนิดพืชผัก แปลงปลูก และแคร่ปลูก", "เจ้าของฟาร์ม", "เพิ่ม แก้ไข ลบข้อมูลชนิดผัก อายุเก็บเกี่ยวมาตรฐาน แปลงปลูก และโต๊ะปลูกที่ 1–20"],
        ["UC03", "บันทึกการเตรียมดินและการเพาะกล้า", "เจ้าของฟาร์ม", "บันทึกวิธีเตรียมดิน ค่า pH และบันทึกการเพาะเมล็ดในถาดเพาะพร้อมจำนวนต้นกล้า"],
        ["UC04", "บันทึกการย้ายกล้าลงปลูกและคำนวณอายุพืชสะสม", "เจ้าของฟาร์ม", "เปิดรอบการปลูกใหม่บนแคร่ปลูก โดยนำวันเพาะกล้ามานับรวมเป็นอายุพืชสะสมอัตโนมัติ"],
        ["UC05", "บันทึกปุ๋ย/สารเคมี และล็อกระยะปลอดภัย (PHI)", "เจ้าของฟาร์ม", "บันทึกการใช้ปุ๋ย/สารเคมี คำนวณวันปลอดภัย และล็อกการเก็บเกี่ยวหากยังไม่ครบค่า PHI"],
        ["UC06", "บันทึกการสำรวจและป้องกันกำจัดศัตรูพืช", "เจ้าของฟาร์ม", "บันทึกชนิดศัตรูพืช ระดับความรุนแรง และวิธีการป้องกันกำจัดในแต่ละรอบการปลูก"],
        ["UC07", "บันทึกการเก็บเกี่ยวผลผลิตเข้าคลังสินค้า", "เจ้าของฟาร์ม", "ตรวจสอบเงื่อนไข PHI บันทึกน้ำหนักเก็บเกี่ยว ปิดรอบการปลูก และเพิ่มสต็อกพร้อมรหัส Lot"],
        ["UC08", "จัดการบัญชีฟาร์ม และพิมพ์รายงาน GAP A4", "เจ้าของฟาร์ม", "บันทึกรายรับ-รายจ่าย และออกรายงานมาตรฐาน GAP รูปแบบ A4 แยกรายรอบการปลูก"],
        ["UC09", "วิเคราะห์กลุ่มลูกค้า K-Means และยิงแจ้งเตือน LINE", "เจ้าของฟาร์ม", "ประมวลผลจัดกลุ่มลูกค้า 3 กลุ่มด้วย K-Means สำหรับยิงแจ้งเตือน LINE เฉพาะกลุ่ม และคำนวณคู่สินค้าด้วย Co-occurrence Matrix"],
        ["UC10", "จัดการคำสั่งซื้อผ่านเว็บและ LINE ของเจ้าของฟาร์ม", "เจ้าของฟาร์ม, ลูกค้า", "แจ้งเตือนออเดอร์ใหม่พร้อมสลิปเข้า LINE เจ้าของฟาร์ม ให้กดยืนยันจัดส่ง ตัดสต็อก GAP และพิมพ์ใบเสร็จผ่าน LINE ได้ทันที"],
        ["UC11", "เลือกซื้อผักสดออนไลน์ผ่านหน้าร้าน LINE LIFF", "ลูกค้า", "เปิดหน้าร้านผ่าน LINE LIFF ดูผักแนะนำ เลือกผักลงตะกร้า และยืนยันคำสั่งซื้อ"],
        ["UC12", "สนทนาถามสต็อกและสั่งซื้อผ่านแชทบอท Gemini AI", "ลูกค้า", "พิมพ์สอบถามสต็อกหรือสั่งซื้อด้วยภาษาไทยธรรมชาติผ่าน Google Gemini AI อ้างอิงสต็อกจริง"],
        ["UC13", "สแกน QR Code ตรวจสอบย้อนกลับรายรอบปลูก", "เจ้าของฟาร์ม, ลูกค้า", "สแกน QR Code ผูกรหัส planting_id เพื่อดูประวัติการเพาะปลูกและค่าความปลอดภัย PHI"],
    ]
    build_styled_table(
        doc,
        uc_headers,
        uc_rows,
        col_widths=[0.55, 1.85, 0.90, 2.47],
        center_cols={0, 2},
        font_size_pt=14,
    )

    images_dir = r"c:\forwork\Web\farmgap\farmgap\images"
    add_figure_with_caption(
        doc,
        os.path.join(images_dir, "use_case_diagram_farmgap.drawio.png"),
        "ภาพที่ 3.1  แผนภาพกรณีใช้งานของระบบ (Use Case Diagram)",
        width_in=5.65,
    )

    # =========================================================================
    # 3.3 สถาปัตยกรรมของระบบ (System Architecture)
    # =========================================================================
    add_section_heading(doc, "3.3 สถาปัตยกรรมของระบบ (System Architecture)")

    add_body_paragraph(
        doc,
        "สถาปัตยกรรมของระบบ FarmGAP ได้รับการออกแบบในรูปแบบแยกชั้นความรับผิดชอบ (Layered & Modular Architecture) เพื่อให้ส่วนติดต่อผู้ใช้งาน ส่วนประมวลผลตรรกะทางธุรกิจ ส่วนวิเคราะห์ปัญญาประดิษฐ์ และส่วนจัดการฐานข้อมูลทำงานแยกจากกันอย่างเป็นระบบ ดังแสดงในภาพที่ 3.2",
    )

    add_figure_with_caption(
        doc,
        os.path.join(scratch_dir, "fig3_1_architecture.png"),
        "ภาพที่ 3.2  สถาปัตยกรรมของระบบ FarmGAP (System Architecture)",
        width_in=5.75,
    )

    add_body_paragraph(
        doc,
        "จากภาพที่ 3.2 โครงสร้างการทำงานของระบบแบ่งออกเป็น 5 ส่วนหลัก ได้แก่ (1) ชั้นส่วนติดต่อผู้ใช้งาน (Presentation Layer) ประกอบด้วยเว็บแอปพลิเคชันที่พัฒนาด้วย React (Meta Open Source, 2024) ร่วมกับ Tailwind CSS (Tailwind Labs, 2024) สำหรับเจ้าของฟาร์ม หน้าร้านค้าออนไลน์ LINE LIFF (LINE Corporation, 2024) สำหรับลูกค้า และหน้าเว็บตรวจสอบย้อนกลับสาธารณะ (2) ชั้นประมวลผลตรรกะทางธุรกิจ (Business Logic Layer) พัฒนาด้วย Node.js (OpenJS Foundation, 2024b) และ Express.js (OpenJS Foundation, 2024a) ทำหน้าที่ควบคุมกฎการเพาะปลูกตามมาตรฐาน GAP การคำนวณอายุพืชสะสม การล็อกการเก็บเกี่ยวตามค่า PHI การตัดสต็อกสินค้า และการจัดการ Webhook ของ LINE Messaging API โดยมีระบบความปลอดภัยด้วย JWT (Jones et al., 2015) และการแฮชรหัสผ่านด้วย Bcrypt (Provos & Mazières, 1999) (3) ชั้นประมวลผลปัญญาประดิษฐ์ (AI & Analytics Layer) ประกอบด้วยโมดูล Google Gemini LLM (Google DeepMind, 2024) เชื่อมต่อผ่าน Google Gemini REST API บนแพลตฟอร์ม Google AI Studio (Google LLC, 2024), โมดูลจัดกลุ่มลูกค้า K-Means 3 กลุ่มเพื่อยิงแจ้งเตือน LINE เฉพาะกลุ่ม (MacQueen, 1967) และโมดูลแนะนำสินค้า Co-occurrence Matrix (Agrawal et al., 1993) (4) ชั้นฐานข้อมูลเชิงสัมพันธ์ MySQL 8.0 (Oracle Corporation, 2024) จำนวน 18 ตาราง และ (5) บริการคลาวด์ภายนอก ได้แก่ LINE Platform และ Google Generative Language API",
    )

    # =========================================================================
    # 3.4 แผนภาพกระแสข้อมูล (Data Flow Diagram: DFD ระดับ 0 และระดับ 1)
    # =========================================================================
    add_section_heading(doc, "3.4 แผนภาพกระแสข้อมูล (Data Flow Diagram: DFD ระดับ 0 และระดับ 1)")

    add_body_paragraph(
        doc,
        "การออกแบบแผนภาพกระแสข้อมูล (Data Flow Diagram: DFD) ของระบบ FarmGAP แบ่งออกเป็น 2 ระดับ ได้แก่ แผนภาพบริบท (Context Diagram หรือ DFD ระดับ 0) ซึ่งแสดงภาพรวมการรับและส่งข้อมูลระหว่างระบบกับผู้ใช้งานภายนอกทั้ง 2 กลุ่ม ดังแสดงในภาพที่ 3.3 และแผนภาพกระแสข้อมูลระดับที่ 1 (DFD Level 1) ซึ่งจำแนกการทำงานภายในระบบออกเป็น 5 กระบวนการหลัก (Processes 1.0 ถึง 5.0) และแหล่งเก็บข้อมูล 6 กลุ่ม (Data Stores D1 ถึง D6) ดังแสดงในภาพที่ 3.4 และสรุปรายละเอียดกระบวนการย่อยในตารางที่ 3.2",
    )

    add_figure_with_caption(
        doc,
        os.path.join(images_dir, "dfd-lv0.drawio.png"),
        "ภาพที่ 3.3  แผนภาพบริบทของระบบ (Context Diagram / DFD ระดับ 0)",
        width_in=5.70,
    )

    add_figure_with_caption(
        doc,
        os.path.join(images_dir, "dfd-lv1.drawio.png"),
        "ภาพที่ 3.4  แผนภาพกระแสข้อมูลระดับที่ 1 (Data Flow Diagram Level 1)",
        width_in=5.75,
    )

    add_table_caption(doc, "ตารางที่ 3.2  รายละเอียดการแตกกระบวนการย่อย (Process Decomposition) ของ DFD ระดับที่ 1")

    dfd_headers = ["กระบวนการหลัก", "กระบวนการย่อย (Subprocesses)", "ข้อมูลขาเข้าและขาออกหลัก (Data Flows & Data Stores)"]
    dfd_rows = [
        [
            "1.0 จัดการแปลงปลูกและบันทึกการเพาะปลูก GAP",
            "1.1 จัดการแปลงและแคร่ปลูก (โต๊ะ 1–20); 1.2 บันทึกเตรียมดินและเพาะกล้า; 1.3 บันทึกย้ายกล้าและคำนวณอายุพืชสะสม; 1.4 บันทึกปุ๋ย/สารเคมีและคำนวณค่า PHI; 1.5 บันทึกศัตรูพืช",
            "รับข้อมูลกิจกรรมฟาร์มจากเจ้าของฟาร์ม ตรวจสอบสถานะแคร่ปลูกใน D1 และบันทึกประวัติการเพาะปลูกรายรอบลงใน D2",
        ],
        [
            "2.0 จัดการการเก็บเกี่ยว คลังสินค้า และบัญชีฟาร์ม",
            "2.1 ตรวจสอบเงื่อนไขล็อกเก็บเกี่ยว (PHI Lock); 2.2 บันทึกผลเก็บเกี่ยวและปิดรอบปลูก; 2.3 เพิ่มสต็อกผักสดและสร้างรหัส Lot; 2.4 บันทึกบัญชีรายรับ-รายจ่าย",
            "อ่านวันครบกำหนด PHI จาก D2 บันทึกการเก็บเกี่ยวและอัปเดตสต็อกพร้อมขายใน D3 พร้อมบันทึกรายการทางบัญชีใน D4",
        ],
        [
            "3.0 จัดการคำสั่งซื้อออนไลน์ผ่าน LINE LIFF & Flex",
            "3.1 แสดงรายการผักพร้อมขายใน LIFF; 3.2 สร้างคำสั่งซื้อและตัดสต็อกอัตโนมัติ; 3.3 อัปเดตสถานะออเดอร์และออกใบเสร็จ; 3.4 ส่งการ์ดแจ้งเตือนผ่าน LINE Flex Message",
            "รับคำสั่งซื้อจากลูกค้า LINE ตรวจสอบและตัดสต็อกใน D3 บันทึกใบสั่งซื้อใน D5 และส่งการ์ดแจ้งสถานะให้ลูกค้า",
        ],
        [
            "4.0 ประมวลผลปัญญาประดิษฐ์ (AI Modules)",
            "4.1 สนทนาตอบคำถามและรับออเดอร์ด้วย Gemini AI; 4.2 จัดกลุ่มลูกค้า 3 กลุ่มด้วย K-Means สำหรับยิงแจ้งเตือน LINE; 4.3 วิเคราะห์สินค้าซื้อคู่กันด้วย Co-occurrence Matrix",
            "ดึงสต็อกจริงจาก D3 แทรกใน Prompt ส่งให้ Gemini API ดึงประวัติการซื้อจาก D5 มาจัดกลุ่มลูกค้าและบันทึกผลลงใน D6",
        ],
        [
            "5.0 ออกรายงานมาตรฐาน GAP A4 & QR Traceability",
            "5.1 รวบรวมประวัติการปลูกรายรอบ (planting_id); 5.2 สร้างรายงานมาตรฐาน GAP รูปแบบเอกสาร A4; 5.3 สร้างและแสดงผลหน้าเว็บตรวจสอบย้อนกลับผ่าน QR Code",
            "ดึงข้อมูลแปลงปลูกจาก D1 และประวัติการเพาะปลูก/สารเคมี PHI จาก D2 มาแสดงเป็นรายงาน GAP A4 และหน้าเว็บ Traceability",
        ],
    ]
    build_styled_table(
        doc,
        dfd_headers,
        dfd_rows,
        col_widths=[1.45, 2.15, 2.17],
        center_cols=set(),
        font_size_pt=14,
    )

    # =========================================================================
    # 3.5 การออกแบบฐานข้อมูลและแผนภาพความสัมพันธ์ข้อมูล (ER Diagram)
    # =========================================================================
    add_section_heading(doc, "3.5 การออกแบบฐานข้อมูลและแผนภาพความสัมพันธ์ข้อมูล (ER Diagram)")

    add_body_paragraph(
        doc,
        "ระบบ FarmGAP ใช้ระบบจัดการฐานข้อมูลเชิงสัมพันธ์ MySQL โดยออกแบบโครงสร้างตารางข้อมูลทั้งหมด 18 ตาราง ตามโครงสร้างฐานข้อมูลจริงในไฟล์ schema.sql ให้มีความสัมพันธ์กันผ่านคีย์หลัก (Primary Key: PK) และคีย์นอก (Foreign Key: FK) จุดเด่นสำคัญของการออกแบบฐานข้อมูลในงานวิจัยนี้คือ การใช้รหัสรอบการเพาะปลูก (batch_id ในตาราง planting_batches) ร่วมกับรหัสแปลง/แคร่ปลูก (plot_id ในตาราง plots) เป็นตัวเชื่อมโยงหลักระหว่างตารางกิจกรรมในแปลง (crop_activities) ตารางการใช้ปุ๋ยและสารเคมี (chemical_logs) ตารางสำรวจโรคแมลง (pest_logs) ตารางการเก็บเกี่ยว (harvest_logs) และตารางสินค้าพร้อมขาย (products) ทำให้ระบบสามารถแยกประวัติการเพาะปลูกและการตรวจสอบย้อนกลับของแต่ละรอบการปลูกออกจากกันได้อย่างสมบูรณ์ แม้ว่าจะใช้แคร่ปลูกเดิมซ้ำในรอบถัดไป ดังสรุปรายชื่อตารางทั้ง 18 ตารางในตารางที่ 3.3 และแผนภาพ ER Diagram ในภาพที่ 3.5 (รายละเอียดพจนานุกรมข้อมูลทั้ง 18 ตารางแสดงอยู่ในภาคผนวก ก)",
    )

    add_table_caption(doc, "ตารางที่ 3.3  รายชื่อตารางข้อมูลทั้ง 18 ตารางในฐานข้อมูลระบบ FarmGAP")

    tbl_headers = ["ลำดับ", "ชื่อตาราง (Table Name)", "คีย์หลัก / คีย์นอกสำคัญ", "หน้าที่และการจัดเก็บข้อมูล"]
    tbl_rows = [
        ["1", "users", "PK: id, UK: email", "เก็บข้อมูลบัญชีผู้ใช้งานระบบฟาร์ม ชื่อฟาร์ม และบทบาทหน้าที่ (role: owner / worker)"],
        ["2", "crops", "PK: id, FK: user_id", "เก็บคลังข้อมูลชนิดผัก อายุเพาะกล้า (nursery_days) อายุเก็บเกี่ยว (growth_days) และราคาตั้งต้น"],
        ["3", "plots", "PK: id, FK: user_id", "เก็บข้อมูลแปลงปลูกและแคร่ปลูก สูตรดิน วันเตรียมดิน วันเพาะเมล็ด วันปลูก และสถานะความปลอดภัย"],
        ["4", "planting_batches", "PK: id, FK: user_id, plot_id, crop_id", "เก็บข้อมูลรอบการปลูก (batch_code) วันเริ่มปลูก วันคาดการณ์เก็บเกี่ยว และจำนวนต้นที่เก็บเกี่ยว"],
        ["5", "crop_activities", "PK: id, FK: user_id, plot_id, batch_id", "เก็บประวัติกิจกรรมและพัฒนาการในแปลงแยกตามรอบปลูก (เตรียมดิน เพาะกล้า ย้ายปลูก ดูแลรักษา)"],
        ["6", "chemical_logs", "PK: id, FK: user_id, plot_id, batch_id", "เก็บประวัติการใช้ปุ๋ยและสารเคมี การสวมใส่อุปกรณ์ PPE และระยะเวลาปลอดภัยก่อนเก็บเกี่ยว (phi_days)"],
        ["7", "pest_logs", "PK: id, FK: user_id, plot_id, batch_id", "เก็บประวัติการสำรวจพบโรคและแมลงศัตรูพืช ระดับความรุนแรง จำนวนต้นที่เสียหาย และวิธีบำบัดรักษา"],
        ["8", "harvest_logs", "PK: id, FK: user_id, plot_id, batch_id, product_id", "เก็บข้อมูลการตัดเก็บเกี่ยว รหัสล็อต (lot_code) จำนวนที่นำเข้าสต็อก เกรดคุณภาพ และสุขอนามัย GAP"],
        ["9", "products", "PK: id, FK: plot_id", "เก็บข้อมูลสินค้าผักสดและจำนวนคงเหลือในสต็อกพร้อมขาย (stock_quantity) บนหน้าร้าน LINE"],
        ["10", "customers", "PK: id, UK: line_user_id, FK: cluster_id", "เก็บข้อมูลลูกค้าสมาชิก LINE OA ชื่อโปรไฟล์ เบอร์โทรศัพท์ ที่อยู่จัดส่ง และกลุ่มลูกค้า AI"],
        ["11", "customer_clusters", "PK: id", "เก็บข้อมูลกลุ่มลูกค้าจากการวิเคราะห์ด้วยอัลกอริทึม K-Means Clustering และรายการผักที่กลุ่มนิยมซื้อ"],
        ["12", "orders", "PK: id, UK: order_code, FK: customer_id", "เก็บข้อมูลคำสั่งซื้อสินค้า ยอดรวม รูปแบบจัดส่ง วิธีชำระเงิน ลิงก์ภาพสลิปโอนเงิน และข้อมูลผู้รับ"],
        ["13", "order_items", "PK: id, FK: order_id, product_id", "เก็บรายการสินค้าแต่ละชิ้นในคำสั่งซื้อ จำนวนที่สั่ง ราคาต่อหน่วย และราคารวมย่อย"],
        ["14", "product_recommendations", "PK: id, FK: product_id, recommended_product_id", "เก็บคู่สินค้าแนะนำให้ซื้อคู่กันจากค่าความสัมพันธ์ Co-occurrence Matrix ในการวิเคราะห์ตะกร้าสินค้า"],
        ["15", "line_chat_sessions", "PK: id, UK: line_user_id, FK: order_id", "เก็บสถานะบทสนทนา (State Machine) และข้อมูลตะกร้าชั่วคราว (draft_data) ของแชทบอท LINE OA"],
        ["16", "storage_logs", "PK: id, FK: user_id, order_id", "เก็บประวัติสถานที่จัดเก็บผลผลิต การขนส่ง ความสะอาดของยานพาหนะ และสภาพสินค้าขณะส่งมอบ"],
        ["17", "cost_logs", "PK: id, FK: user_id, plot_id", "เก็บข้อมูลบัญชีต้นทุนและค่าใช้จ่ายทางการเกษตรแยกตามหมวดหมู่และแปลงปลูกเพื่อคำนวณกำไรสุทธิ"],
        ["18", "audit_logs", "PK: id", "เก็บประวัติการเพิ่ม แก้ไข หรือลบข้อมูลสำคัญในฐานข้อมูล (old_values / new_values) เพื่อการตรวจสอบ"],
    ]
    build_styled_table(
        doc,
        tbl_headers,
        tbl_rows,
        col_widths=[0.45, 1.40, 1.45, 2.47],
        center_cols={0},
        font_size_pt=14,
    )

    add_figure_with_caption(
        doc,
        os.path.join(images_dir, "erdiagram.drawio.png"),
        "ภาพที่ 3.5  แผนภาพความสัมพันธ์ของข้อมูล (Entity-Relationship Diagram: ER Diagram ทั้ง 18 ตาราง)",
        width_in=5.75,
    )

    add_body_paragraph(
        doc,
        "จากการออกแบบสถาปัตยกรรมฐานข้อมูลเชิงสัมพันธ์ MySQL ข้างต้น ผู้วิจัยได้จัดทำพจนานุกรมข้อมูล (Data Dictionary) เพื่ออธิบายรายละเอียดโครงสร้างของแต่ละแอตทริบิวต์ในทั้ง 18 ตารางอย่างสมบูรณ์ ประกอบด้วย คีย์หลัก คีย์นอก ชื่อฟิลด์ ชนิดข้อมูล ขนาด และคำอธิบายหน้าที่การจัดเก็บข้อมูล ตรงตามโครงสร้างฐานข้อมูลจริงในระบบ ดังแสดงในตารางที่ 3.4 ถึง ตารางที่ 3.21 ดังต่อไปนี้",
    )

    for idx, tbl_def in enumerate(DATA_DICTIONARY_TABLES):
        table_num = idx + 4
        add_table_caption(doc, f"ตารางที่ 3.{table_num}  {tbl_def['caption']}")
        build_styled_table(
            doc,
            headers=["คีย์", "ชื่อฟิลด์", "ชนิดข้อมูล", "ขนาด", "คำอธิบาย"],
            rows_data=tbl_def["fields"],
            col_widths=[0.55, 1.35, 1.05, 0.55, 2.27],
            center_cols={0, 3},
            font_size_pt=13.5,
            header_center=True,
        )

    # =========================================================================
    # 3.6 การออกแบบอัลกอริทึมสำคัญและกลไกปัญญาประดิษฐ์ในระบบ
    # =========================================================================
    add_section_heading(doc, "3.6 การออกแบบอัลกอริทึมสำคัญและกลไกปัญญาประดิษฐ์ในระบบ")

    add_subsection_heading(doc, "3.6.1 อัลกอริทึมการคำนวณอายุพืชสะสมรวมวันเพาะกล้า")
    add_body_paragraph(
        doc,
        "ในระบบ FarmGAP เมื่อเจ้าของฟาร์มบันทึกการย้ายต้นกล้าจากถาดเพาะกล้า (ตาราง seedlings) ลงสู่แคร่ปลูกเพื่อเริ่มรอบการเพาะปลูกใหม่ (ตาราง plantings) ระบบจะคำนวณจำนวนวันที่ต้นกล้าเติบโตอยู่ในถาดเพาะกล้าตั้งแต่วันเพาะเมล็ด (sow_date) จนถึงวันย้ายลงปลูก (plant_date) แล้วนำมารวมกับจำนวนวันหลังย้ายลงปลูก เพื่อหักลบออกจากอายุเก็บเกี่ยวมาตรฐานของพืชชนิดนั้น (growth_days) ทำให้ได้วันคาดการณ์เก็บเกี่ยว (expected_harvest_date) ที่ตรงกับความเป็นจริงทางเกษตรกรรม",
    )

    add_subsection_heading(doc, "3.6.2 อัลกอริทึมการล็อกการเก็บเกี่ยวตามระยะปลอดภัยของสารเคมี (Automated PHI Lock)")
    add_body_paragraph(
        doc,
        "เพื่อป้องกันไม่ให้มีการเก็บเกี่ยวผลผลิตที่มีสารเคมีตกค้างเกินมาตรฐาน GAP ระบบได้กำหนดขั้นตอนการตรวจสอบสองชั้น ได้แก่ (1) ในหน้าบันทึกปุ๋ยและสารเคมี ระบบจะอนุญาตให้เลือกเฉพาะแคร่ปลูกที่มีสถานะกำลังเพาะปลูกอยู่เท่านั้น (ล็อกแคร่ปลูกว่าง) และ (2) เมื่อมีการบันทึกสารเคมีที่มีค่า phi_days > 0 ระบบจะคำนวณวันปลอดภัย (safe_harvest_date = log_date + phi_days) และตรวจสอบทุกครั้งก่อนการเก็บเกี่ยว หากวันที่ปัจจุบันยังไม่ถึงวันปลอดภัยสูงสุดของรอบการปลูกนั้น ระบบจะระงับการบันทึกเก็บเกี่ยวทั้งในระดับส่วนติดต่อผู้ใช้ (Frontend) และระดับเซิร์ฟเวอร์ (Backend API)",
    )

    add_subsection_heading(doc, "3.6.3 อัลกอริทึมการจัดกลุ่มลูกค้า K-Means 3 กลุ่มสำหรับการยิงแจ้งเตือน LINE และการแนะนำสินค้า")
    add_body_paragraph(
        doc,
        "โมดูลวิเคราะห์พฤติกรรมลูกค้าดึงข้อมูลประวัติการสั่งซื้อที่สำเร็จจากตาราง orders และ order_items มาสกัดคุณลักษณะเชิงปริมาณ 4 มิติของลูกค้าแต่ละราย ได้แก่ (1) จำนวนครั้งที่สั่งซื้อสำเร็จ (order_count) (2) ยอดซื้อสะสมรวมทั้งหมด (total_spend) (3) มูลค่าเฉลี่ยต่อคำสั่งซื้อ (avg_order_value) และ (4) ปริมาณสินค้าที่สั่งซื้อรวม (total_items) จากนั้นทำการปรับสเกลข้อมูลให้อยู่ในช่วง 0 ถึง 1 ด้วยวิธี Min-Max Normalization และประมวลผลจัดกลุ่มด้วยอัลกอริทึม K-Means กำหนดจำนวนกลุ่ม K = 3 ตามลักษณะพฤติกรรมการบริโภคผักจริงของฟาร์ม ได้แก่ (1) กลุ่มสลัดเลิฟเวอร์ (Salad Lovers) ชื่นชอบผักสลัดกลุ่มกรีนโอ๊ค เรดโอ๊ค คอส และบัตเตอร์เฮด (2) กลุ่มลูกค้าประจำเพื่อสุขภาพ (Health Regulars) ชื่นชอบผักเพื่อสุขภาพ เช่น เคล กวางตุ้ง ผักบุ้ง และซื้อน้ำสลัดควบคู่ และ (3) กลุ่มร้านอาหารและค้าส่ง (Bulk & B2B) ที่สั่งซื้อผักสดในปริมาณมากและมีมูลค่าบิลสูง",
    )
    add_body_paragraph(
        doc,
        "ผลลัพธ์การจัดกลุ่มจะถูกบันทึกเชื่อมโยงกับรหัสลูกค้า (customers.cluster_id) เพื่อนำไปใช้งานใน 2 รูปแบบสำคัญ ได้แก่ (1) การยิงแจ้งเตือนผ่านแผงควบคุม AI บนแดชบอร์ด โดยมีปุ่ม 'ยิงแจ้งเตือน LINE' เปิดหน้าต่างเลือกกลุ่มลูกค้าเป้าหมาย ชนิดผัก และข้อความ เพื่อส่งการ์ดแจ้งเตือน LINE Flex Message ไปยัง LINE OA ของลูกค้าเฉพาะกลุ่มเป้าหมายโดยตรง และ (2) การแจ้งเตือนอัตโนมัติเมื่อเก็บเกี่ยวผลผลิตเข้าสต็อก ควบคู่กับการสร้างเมทริกซ์การเกิดร่วม (Co-occurrence Matrix) จากตาราง order_items เพื่อค้นหาคู่ชนิดผักที่มีความถี่ในการถูกสั่งซื้อร่วมกันสูงสุดสำหรับนำไปแสดงผลแนะนำสินค้าในหน้าร้าน LINE LIFF และเป็นบริบทให้แชทบอท Gemini AI แนะนำสินค้าเพิ่มเติม",
    )

    add_subsection_heading(doc, "3.6.4 กลไกผู้ช่วยสนทนา Google Gemini AI แบบ Dynamic Context Injection และ Multi-Model Fallback")
    add_body_paragraph(
        doc,
        "เมื่อลูกค้าส่งข้อความเข้ามาทาง LINE Official Account เซิร์ฟเวอร์จะตรวจสอบข้อความผ่านตัวกรองคำสั่งด่วนและส่งต่อไปยังบริการ Google Gemini AI โดยระบบจะดึงข้อมูลสต็อกผักคงเหลือจริงจากตาราง stock ณ ขณะนั้นมาประกอบเป็น System Prompt (Dynamic Context Injection) เพื่อบังคับให้โมเดลตอบเฉพาะข้อมูลที่มีอยู่จริงและสกัดคำสั่งซื้อออกมาในโครงสร้าง JSON ที่พร้อมตัดสต็อกอัตโนมัติ ทั้งนี้ เพื่อป้องกันปัญหาการหยุดทำงานเมื่อโมเดลหลักติดข้อจำกัดโควตา (HTTP 429 Resource Exhausted) ระบบจึงจัดเรียงลำดับโมเดลสำรอง (Candidate Models) จำนวน 5 รุ่นในไฟล์บริการ gemini.js ดังแสดงในตารางที่ 3.22",
    )

    add_table_caption(doc, "ตารางที่ 3.22  ลำดับโมเดลภาษา Google Gemini ในกลไกสลับโมเดลสำรองอัตโนมัติ (Multi-Model Fallback)")

    gem_headers = ["ลำดับ", "ชื่อรหัสโมเดล (Model ID)", "บทบาทในระบบ", "คุณลักษณะและเงื่อนไขการสลับใช้งาน"]
    gem_rows = [
        ["1", "gemini-3.5-flash-lite", "โมเดลหลัก (Primary Model)", "ความเร็วตอบสนองสูงสุด โควตาใช้งานฟรีสูง เหมาะกับงานแชทบอทและสกัด JSON"],
        ["2", "gemini-2.5-flash-lite", "โมเดลสำรองลำดับที่ 1", "สลับใช้งานอัตโนมัติทันทีเมื่อโมเดลหลักคืนค่ารหัส HTTP 429 หรือ 503"],
        ["3", "gemini-3-flash", "โมเดลสำรองลำดับที่ 2", "โมเดลสมรรถนะสูง รองรับการวิเคราะห์ประโยคภาษาไทยที่มีความซับซ้อน"],
        ["4", "gemini-2.5-flash", "โมเดลสำรองลำดับที่ 3", "โมเดลเสถียรภาพสูง ใช้เป็นตัวสำรองเมื่อตระกูล Flash-Lite โควตาเต็ม"],
        ["5", "gemini-1.5-flash", "โมเดลสำรองลำดับสุดท้าย", "โมเดลพื้นฐานความเสถียรสูง ใช้รับประกันความต่อเนื่องของการตอบแชท"],
    ]
    build_styled_table(
        doc,
        gem_headers,
        gem_rows,
        col_widths=[0.55, 1.55, 1.35, 2.32],
        center_cols={0},
        font_size_pt=14,
    )

    # =========================================================================
    # 3.7 การสร้างเครื่องมือและการเก็บรวบรวมข้อมูลประเมินผล
    # =========================================================================
    add_section_heading(doc, "3.7 การสร้างเครื่องมือและการเก็บรวบรวมข้อมูลประเมินผล")

    add_body_paragraph(
        doc,
        "เครื่องมือที่ใช้ในการประเมินคุณภาพของโครงงานแบ่งออกเป็น 2 ฉบับตามแบบฟอร์มมาตรฐานของสาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร มหาวิทยาลัยราชภัฏยะลา ได้แก่",
    )

    add_numbered_item(
        doc,
        "3.7.1",
        "แบบประเมินโครงงานสำหรับผู้เชี่ยวชาญ (แบบ วค-4) ใช้ประเมินความเหมาะสมและความถูกต้องทางวิชาการของระบบโดยผู้เชี่ยวชาญจำนวน 3 ท่าน แบ่งเกณฑ์การประเมินออกเป็น 4 ด้าน ด้านละ 5 ข้อ รวม 20 ข้อ ได้แก่ (ก) ด้านเอกสารประกอบโครงงาน (ข) ด้านการวิเคราะห์ระบบ (ค) ขั้นตอนการออกแบบ Input, Output, Database และ Process และ (ง) ขั้นตอนการพัฒนา การติดตั้ง และการประเมินผลระบบ",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "3.7.2",
        "แบบประเมินโครงงานสำหรับผู้ใช้งาน (แบบ วค-5) ใช้ประเมินประสิทธิภาพและความพึงพอใจในการใช้งานระบบจริงโดยผู้ใช้งานจำนวน 3 ท่าน แบ่งเกณฑ์การประเมินออกเป็น 4 ด้าน ด้านละ 5 ข้อ รวม 20 ข้อ ได้แก่ (ก) ด้านความง่ายในการใช้งานระบบ (ข) ด้านการจัดการข้อมูลฟาร์มและการสั่งซื้อสินค้า (ค) ด้านการแสดงผลรายงานและการแจ้งเตือน และ (ง) ด้านประสิทธิภาพและความพึงพอใจในภาพรวม",
        bold_prefix=True,
    )

    # =========================================================================
    # 3.8 สถิติที่ใช้ในการวิเคราะห์ข้อมูลและเกณฑ์การแปลผล
    # =========================================================================
    add_section_heading(doc, "3.8 สถิติที่ใช้ในการวิเคราะห์ข้อมูลและเกณฑ์การแปลผล")

    add_body_paragraph(
        doc,
        "ในการให้คะแนนตามแบบประเมิน วค-4 และ วค-5 กำหนดระดับคะแนนดิบในแต่ละข้อย่อยเป็นมาตราส่วนประมาณค่า 5 ระดับ คือ 4 (ดีมาก), 3 (ดี), 2 (ปานกลาง), 1 (พอใช้) และ 0 (ปรับปรุง) จากนั้นนำคะแนนดิบของแต่ละข้อมาคูณด้วย 1.25 เพื่อแปลงเป็นคะแนนเต็มข้อละ 5 คะแนน ทำให้แต่ละด้าน (5 ข้อย่อย) มีคะแนนเต็ม 25 คะแนน และรวมทั้ง 4 ด้าน (20 ข้อย่อย) มีคะแนนเต็ม 100 คะแนนต่อผู้ประเมิน 1 ท่าน โดยวิเคราะห์ข้อมูลด้วยสถิติค่าเฉลี่ยเลขคณิต (Arithmetic Mean) ตามสมการดังนี้",
    )

    add_formula_line(doc, "ค่าเฉลี่ย (X̄) = ( Σ X_i ) / N   เมื่อ N = จำนวนผู้ประเมิน (3 ท่าน)")

    add_body_paragraph(
        doc,
        "สำหรับเกณฑ์การแปลผลระดับคุณภาพและความพึงพอใจจากคะแนนรวมเฉลี่ย (คะแนนเต็ม 100 คะแนน) และคะแนนเฉลี่ยรายด้าน (คะแนนเต็ม 25 คะแนน) แสดงดังตารางที่ 3.23",
    )

    add_table_caption(doc, "ตารางที่ 3.23  เกณฑ์การให้คะแนนและการแปลผลระดับคุณภาพของระบบ")

    crit_headers = ["ระดับคะแนนดิบรายข้อ", "คะแนนแปลงรายข้อ (×1.25)", "ช่วงคะแนนเฉลี่ยรายด้าน (เต็ม 25)", "ช่วงคะแนนเฉลี่ยรวม (เต็ม 100)", "การแปลผลระดับคุณภาพ"]
    crit_rows = [
        ["4", "5.00 คะแนน", "21.88 – 25.00", "87.50 – 100.00", "ดีมาก (Excellent)"],
        ["3", "3.75 คะแนน", "15.63 – 21.87", "62.50 – 87.49", "ดี (Good)"],
        ["2", "2.50 คะแนน", "9.38 – 15.62", "37.50 – 62.49", "ปานกลาง (Fair)"],
        ["1", "1.25 คะแนน", "3.13 – 9.37", "12.50 – 37.49", "พอใช้ (Poor)"],
        ["0", "0.00 คะแนน", "0.00 – 3.12", "0.00 – 12.49", "ควรปรับปรุง (Needs Improvement)"],
    ]
    build_styled_table(
        doc,
        crit_headers,
        crit_rows,
        col_widths=[1.05, 1.15, 1.25, 1.20, 1.12],
        center_cols={0, 1, 2, 3, 4},
        font_size_pt=14,
    )


if __name__ == "__main__":
    output_docx = r"c:\forwork\Web\farmgap\farmgap\Research-Paper.docx"
    logo_png = r"c:\forwork\Web\farmgap\farmgap\scratch\yru_logo_0.png"
    scratch_dir = r"c:\forwork\Web\farmgap\farmgap\scratch"

    build_front_matter(output_docx, logo_png)
    doc = Document(output_docx)
    append_chapter1(doc)
    append_chapter2(doc)
    append_chapter3(doc, scratch_dir)
    doc.save(output_docx)
    print(f"Successfully generated Step 1 to Step 5 (Chapter 3 with 5 diagrams) in: {output_docx}")
