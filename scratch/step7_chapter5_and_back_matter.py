import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT

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
from step5_chapter3 import (
    append_chapter3,
    add_figure_with_caption,
    build_styled_table,
)
from step6_chapter4 import append_chapter4


def add_bib_entry(doc, raw_text):
    """
    ย่อหน้าบรรณานุกรมแบบ Hanging Indent (บรรทัดแรกชิดซ้าย บรรทัดถัดไปเยื้อง 0.5 นิ้ว)
    จัดชิดซ้าย (Left-aligned) ตามมาตรฐานสากล APA 7th Edition และเกณฑ์คู่มือ มรย.
    แก้ไขปัญหาตัวอักษรและคำเว้นระยะห่างผิดปกติ (Character Stretching) ที่เกิดจากการจัดกระจายแบบไทย (Thai Justify)
    พร้อมรองรับการจัดตัวเอียง (*text*) สำหรับชื่อเอกสาร วารสาร และการประชุมวิชาการ
    """
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.first_line_indent = Inches(-0.5)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15

    parts = raw_text.split("*")
    for idx, part in enumerate(parts):
        if not part:
            continue
        is_italic = (idx % 2 == 1)
        r = p.add_run(thai_word_wrap(part))
        set_run_thai_font(r, "TH SarabunPSK", size_pt=16, bold=False, italic=is_italic)


def append_chapter5(doc):
    sec_ch5 = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_ch5)
    configure_chapter_section_page_numbering(sec_ch5, start_page=None)

    add_chapter_heading(doc, "บทที่ 5", "อภิปรายผล สรุปผล และข้อเสนอแนะ")

    add_body_paragraph(
        doc,
        "การวิจัยและพัฒนาระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account (FarmGAP) มีจุดมุ่งหมายเพื่อยกระดับกระบวนการจัดการข้อมูลแปลงปลูกผักปลอดสารพิษตามมาตรฐานการปฏิบัติทางการเกษตรที่ดี (GAP มกษ. 9001) เชื่อมโยงเข้ากับช่องทางการจัดจำหน่ายออนไลน์และการตรวจสอบย้อนกลับผ่านแพลตฟอร์ม LINE Official Account ตลอดจนประยุกต์ใช้เทคนิคการเรียนรู้ของเครื่องและโมเดลภาษาขนาดใหญ่เพื่อช่วยวิเคราะห์ข้อมูลลูกค้าและตอบคำถามอัตโนมัติ โดยในบทนี้นำเสนอสรุปผลการวิจัยตามวัตถุประสงค์ การอภิปรายผลการวิจัย ข้อจำกัดของระบบที่พัฒนา และข้อเสนอแนะสำหรับการพัฒนาต่อยอดในอนาคต ดังรายละเอียดต่อไปนี้",
    )

    # =========================================================================
    # 5.1 สรุปผลการวิจัยตามวัตถุประสงค์
    # =========================================================================
    add_section_heading(doc, "5.1 สรุปผลการวิจัยตามวัตถุประสงค์")

    add_body_paragraph(
        doc,
        "จากการดำเนินงานวิจัย ออกแบบ พัฒนา และทดสอบระบบ FarmGAP สามารถสรุปผลการวิจัยตามวัตถุประสงค์ของการวิจัยทั้ง 4 ข้อ ได้ดังนี้",
    )

    add_numbered_item(
        doc,
        "5.1.1",
        "ผลการพัฒนาระบบบริหารจัดการข้อมูลการเพาะปลูกผักตามมาตรฐาน GAP (มกษ. 9001) พบว่าระบบเว็บแอปพลิเคชันที่พัฒนาด้วย React.js, Node.js และฐานข้อมูล MySQL จำนวน 18 ตาราง สามารถบริหารจัดการข้อมูลการเพาะปลูกแบบแยกตามรหัสรอบการปลูก (planting_id) ได้อย่างครบวงจร ตั้งแต่การกำหนดค่าคลังชนิดพืชผัก (Crops Master Data) การจัดการแปลงปลูกหลักและแคร่ปลูกย่อย การบันทึกการเตรียมดิน การเพาะกล้าในถาดหลุม การย้ายลงปลูกจริงพร้อมคำนวณอายุพืชสะสมต่อเนื่อง การบันทึกการให้น้ำ ปุ๋ย และสารป้องกันกำจัดศัตรูพืช การคำนวณระยะปลอดภัยก่อนการเก็บเกี่ยว (PHI) เพื่อล็อกปุ่มบันทึกการเก็บเกี่ยวอัตโนมัติเมื่อยังไม่พ้นระยะปลอดภัย ไปจนถึงการจัดพิมพ์รายงานมาตรฐาน GAP รูปแบบเอกสาร A4 แยกรายรอบการปลูกได้ทันที",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.1.2",
        "ผลการพัฒนาระบบสั่งซื้อผักสดออนไลน์และตรวจสอบย้อนกลับผ่าน LINE Official Account พบว่าระบบร้านค้าออนไลน์ที่พัฒนาบนเทคโนโลยี LINE LIFF ช่วยให้ผู้บริโภคสามารถเลือกชมรายการผักสดที่มีสต็อกพร้อมจำหน่ายจากล็อตที่ผ่านเกณฑ์ความปลอดภัย GAP สั่งซื้อและอัปโหลดสลิปโอนเงินได้โดยไม่ต้องติดตั้งแอปพลิเคชันเพิ่มเติม พร้อมรับการแจ้งเตือนสถานะคำสั่งซื้อและใบเสร็จรับเงินอิเล็กทรอนิกส์แบบเรียลไทม์ผ่านการ์ดข้อความ LINE Flex Message อีกทั้งผู้บริโภคยังสามารถสแกนคิวอาร์โค้ด (QR Code) ประจำล็อตการผลิตเพื่อตรวจสอบย้อนกลับประวัติการเพาะปลูกและสถานะความปลอดภัย PHI ได้อย่างโปร่งใส",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.1.3",
        "ผลการประยุกต์ใช้ปัญญาประดิษฐ์และการเรียนรู้ของเครื่อง พบว่าโมดูลวิเคราะห์ข้อมูลสามารถจัดกลุ่มพฤติกรรมลูกค้าด้วยอัลกอริทึม K-Means Clustering ออกเป็น 3 กลุ่มตามคุณลักษณะ 4 มิติ ได้แก่ กลุ่มสลัดเลิฟเวอร์ (Salad Lovers) กลุ่มลูกค้าประจำเพื่อสุขภาพ (Health Regulars) และกลุ่มร้านอาหารและค้าส่ง (Bulk & B2B) เพื่อนำไปใช้ในการยิงแจ้งเตือนสินค้าพร้อมเก็บเกี่ยวและโปรโมชันเฉพาะกลุ่มเป้าหมาย (Targeted LINE Push Notification) ผ่านแผง AI แดชบอร์ดและโมดูลเก็บเกี่ยวเข้าสู่ LINE OA ของลูกค้าได้อย่างตรงกลุ่ม พร้อมวิเคราะห์ความสัมพันธ์ของสินค้าที่มักซื้อคู่กัน (Co-occurrence Market Basket Analysis) เพื่อนำไปแสดงผลแนะนำสินค้าขายคู่ในหน้าตะกร้าสินค้า LINE LIFF ได้อย่างอัตโนมัติ ในขณะที่โมดูลผู้ช่วยสนทนาอัจฉริยะ Google Gemini AI ที่ใช้เทคนิคการแทรกบริบทข้อมูลสต็อกจริงแบบไดนามิก (Dynamic Context Injection) ร่วมกับกลไกสลับโมเดลสำรองอัตโนมัติ (Multi-Model Fallback) สามารถตอบคำถามเกี่ยวกับรายการผัก ราคา สต็อกคงเหลือ และสกัดคำสั่งซื้อจากข้อความสนทนาภาษาธรรมชาติของลูกค้าบน LINE OA ได้อย่างแม่นยำและต่อเนื่อง",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.1.4",
        "ผลการทดสอบการทำงานและประเมินคุณภาพของระบบ พบว่าจากการทดสอบการทำงานเชิงหน้าที่ (Functional Testing) ตามกรณีใช้งานทั้ง 13 กรณี ระบบสามารถทำงานได้ถูกต้องครบถ้วนร้อยละ 100 และได้จัดเตรียมเครื่องมือประเมินคุณภาพของระบบสำหรับผู้เชี่ยวชาญจำนวน 3 ท่าน (แบบประเมิน วค-4) และผู้ใช้งานทั่วไปจำนวน 3 ท่าน (แบบประเมิน วค-5) เพื่อวัดผลด้านฟังก์ชันการทำงาน ความง่ายต่อการใช้งาน ความมั่นคงปลอดภัย และประสิทธิภาพของระบบตามเกณฑ์มาตรฐานของหลักสูตร",
        bold_prefix=True,
    )

    # =========================================================================
    # 5.2 การอภิปรายผลการวิจัย
    # =========================================================================
    add_section_heading(doc, "5.2 การอภิปรายผลการวิจัย")

    add_body_paragraph(
        doc,
        "จากผลการวิจัยและพัฒนาระบบ FarmGAP ผู้วิจัยสามารถอภิปรายผลการวิจัยเชื่อมโยงกับแนวคิด ทฤษฎี และงานวิจัยที่เกี่ยวข้องที่ได้ศึกษาไว้ในบทที่ 2 ในประเด็นสำคัญดังนี้",
    )

    add_numbered_item(
        doc,
        "5.2.1",
        "การผูกความสัมพันธ์ข้อมูลด้วยรหัสรอบการปลูก (planting_id) และการควบคุมค่า PHI อัตโนมัติ ช่วยแก้ไขจุดอ่อนของการจดบันทึกข้อมูลลงสมุดกระดาษแบบดั้งเดิมที่ข้อมูลมักกระจัดกระจายและเสี่ยงต่อการเก็บเกี่ยวผลผลิตก่อนครบกำหนดระยะปลอดภัย ซึ่งสอดคล้องกับแนวทางการปฏิบัติทางการเกษตรที่ดีสำหรับพืชอาหาร (มกษ. 9001-2564) ของสำนักงานมาตรฐานสินค้าเกษตรและอาหารแห่งชาติ และสอดคล้องกับงานวิจัยของ สิทธิศักดิ์ และคณะ (2562) ที่พบว่าการนำระบบฐานข้อมูลสารสนเทศมาควบคุมมาตรฐานการผลิตผักปลอดภัยช่วยลดความผิดพลาดของเกษตรกรและลดภาระเวลาในการจัดทำเอกสารรับรองมาตรฐานได้อย่างมีนัยสำคัญ",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.2.2",
        "การเชื่อมโยงระบบตรวจสอบย้อนกลับด้วย QR Code เข้ากับระบบร้านค้าออนไลน์บน LINE LIFF และระบบการแจ้งเตือนและการจัดการคำสั่งซื้อแบบสองทิศทางผ่าน LINE Flex Message ทั้งฝั่งลูกค้าและฝั่งเจ้าของฟาร์ม ช่วยสร้างความเชื่อมั่นให้แก่ผู้บริโภคที่ใส่ใจสุขภาพ ลดอุปสรรคในการเข้าถึงระบบดิจิทัล และช่วยให้เจ้าของฟาร์มสามารถบริหารจัดการออเดอร์ กดยืนยันการจัดส่ง และตัดสต็อกสินค้าตามเกณฑ์ GAP ข้อ 6 ได้ทันทีผ่านห้องแชท LINE บนสมาร์ตโฟนโดยไม่ต้องเปิดคอมพิวเตอร์ ซึ่งสอดคล้องกับผลการศึกษาของ ศุภชัย และดารณี (2561) และ ณัฐกร และคณะ (2567) ที่ระบุว่าการแสดงประวัติแหล่งเพาะปลูกผ่านการสแกน QR Code ร่วมกับการนำแพลตฟอร์ม LINE Official Account มาใช้เป็นช่องทางการจำหน่าย ช่วยเพิ่มความมั่นใจในการบริโภคสินค้าเกษตรปลอดภัยและช่วยลดขั้นตอนการสื่อสารที่ซ้ำซ้อนของร้านค้าชุมชนได้อย่างมีประสิทธิภาพ",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.2.3",
        "การบูรณาการอัลกอริทึม K-Means Clustering จัดกลุ่มลูกค้า 3 กลุ่มสำหรับการยิงแจ้งเตือน LINE เฉพาะกลุ่ม การวิเคราะห์ตะกร้าสินค้า และโมเดลภาษา Google Gemini AI แบบแทรกบริบทข้อมูลจริง (Dynamic Context Injection) ช่วยยกระดับระบบจากเครื่องมือบันทึกข้อมูลทั่วไปให้เป็นระบบสนับสนุนการตัดสินใจทางการตลาดและการขายอัตโนมัติ โดยการแจ้งเตือนตรงกลุ่มช่วยให้ลูกค้าได้รับข้อความที่ไม่รบกวนและตรงความต้องการ การแนบข้อมูลสต็อกคงเหลือจริงเข้าสู่ System Prompt ช่วยป้องกันปัญหาการสร้างข้อมูลเท็จของโมเดลภาษา (Hallucination) และกลไก Multi-Model Fallback ช่วยรับประกันความเสถียรของบริการแชทบอท ซึ่งสอดคล้องกับผลการศึกษาของ Kijwattanaphokin & Lhaochot (2024), ภูมิภัทร และคณะ (2568) และ Lewis et al. (2020) ที่ชี้ให้เห็นว่าการแบ่งกลุ่มลูกค้าด้วยเคมีนร่วมกับตัวแปรพฤติกรรมการซื้อ และการนำเทคโนโลยีปัญญาประดิษฐ์และแชทบอทมาผสานกับฐานข้อมูลจริง ช่วยเพิ่มประสิทธิภาพในการให้บริการลูกค้าและการตัดสินใจทางการตลาดในยุคพาณิชย์อิเล็กทรอนิกส์ได้อย่างแม่นยำและน่าเชื่อถือ",
        bold_prefix=True,
    )

    # =========================================================================
    # 5.3 ข้อจำกัดของระบบที่พัฒนา
    # =========================================================================
    add_section_heading(doc, "5.3 ข้อจำกัดของระบบที่พัฒนา")

    add_numbered_item(
        doc,
        "5.3.1",
        "ระบบบริหารจัดการฟาร์มและร้านค้าออนไลน์บน LINE Official Account จำเป็นต้องทำงานผ่านการเชื่อมต่อเครือข่ายอินเทอร์เน็ต (Online Mode) จึงอาจมีข้อจำกัดหากเกษตรกรนำไปใช้งานในพื้นที่แปลงปลูกห่างไกลที่สัญญาณอินเทอร์เน็ตไม่เสถียร",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.3.2",
        "การตรวจสอบหลักฐานการโอนเงิน (สลิปธนาคาร) ในระบบปัจจุบันยังใช้รูปแบบให้ลูกค้าอัปโหลดภาพสลิปเพื่อให้เจ้าของฟาร์มตรวจสอบและกดยืนยันในระบบหลังบ้าน ยังไม่ได้เชื่อมต่อกับระบบตรวจสอบสลิปอัตโนมัติผ่านรหัสคิวอาร์ของธนาคาร (Slip Verification API)",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.3.3",
        "การบันทึกข้อมูลสภาพแวดล้อมและการให้น้ำในแปลงปลูกยังเป็นการบันทึกโดยเกษตรกรผ่านหน้าจอเว็บแอปพลิเคชัน ยังไม่ได้เชื่อมต่อกับอุปกรณ์ตรวจวัดสภาพแวดล้อมอัตโนมัติหรืออินเทอร์เน็ตของสรรพสิ่ง (Internet of Things: IoT Sensors)",
        bold_prefix=True,
    )

    # =========================================================================
    # 5.4 ข้อเสนอแนะในการนำระบบไปใช้งานและการพัฒนาต่อยอด
    # =========================================================================
    add_section_heading(doc, "5.4 ข้อเสนอแนะในการนำระบบไปใช้งานและการพัฒนาต่อยอด")

    add_numbered_item(
        doc,
        "5.4.1",
        "ควรพัฒนาต่อยอดให้ระบบเชื่อมต่อกับอุปกรณ์เซ็นเซอร์ IoT ในแปลงปลูก เช่น เซ็นเซอร์วัดความชื้นในดิน วัดค่าความเป็นกรด-ด่าง (pH) และระบบควบคุมวาล์วน้ำอัตโนมัติ เพื่อให้ระบบสามารถบันทึกประวัติการให้น้ำและสภาพแวดล้อมเข้าสู่รายงานมาตรฐาน GAP ได้โดยอัตโนมัติ",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.4.2",
        "ควรเชื่อมต่อระบบชำระเงินเข้ากับบริการสร้าง QR PromptPay แบบระบุยอดเงินอัตโนมัติ และระบบตรวจสอบสลิปโอนเงินอัตโนมัติ (Slip Verification API) เพื่อลดภาระของเจ้าของฟาร์มในการตรวจสอบสลิปและทำให้การยืนยันคำสั่งซื้อเกิดขึ้นได้ทันที",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.4.3",
        "ควรเพิ่มความสามารถด้านการประมวลผลภาพด้วยปัญญาประดิษฐ์ (Computer Vision / Multimodal AI) บน LINE Official Account เพื่อให้เกษตรกรสามารถถ่ายภาพใบผักที่มีอาการผิดปกติส่งเข้าห้องแชท แล้วให้โมเดล Gemini Vision ช่วยวิเคราะห์โรคพืชหรือแมลงศัตรูพืชเบื้องต้นพร้อมแนะนำวิธีจัดการตามมาตรฐาน GAP",
        bold_prefix=True,
    )
    add_numbered_item(
        doc,
        "5.4.4",
        "ควรพัฒนาโหมดการทำงานแบบออฟไลน์ชั่วคราว (Progressive Web App: PWA Offline Caching) เพื่อให้เกษตรกรสามารถบันทึกข้อมูลกิจกรรมในแปลงปลูกผ่านสมาร์ตโฟนได้แม้ในจุดที่อับสัญญาณอินเทอร์เน็ต และซิงค์ข้อมูลเข้าสู่ฐานข้อมูลหลักเมื่อกลับมาเชื่อมต่อเครือข่าย",
        bold_prefix=True,
    )


def append_bibliography(doc):
    sec_bib = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_bib)
    configure_chapter_section_page_numbering(sec_bib, start_page=None)

    add_centered_line(doc, "บรรณานุกรม", size_pt=20, bold=True, space_before_pt=0, space_after_pt=12)

    bib_items = [
        "กรมวิชาการเกษตร. (2565). *คู่มือการตรวจประเมินแหล่งผลิตพืชตามมาตรฐานการปฏิบัติทางการเกษตรที่ดีสำหรับพืชอาหาร (มกษ. 9001-2564)*. กรุงเทพฯ: กระทรวงเกษตรและสหกรณ์.",
        "ณัฐกร สีถา, ภาสกร ธนศิระธรรม และดุษฎี เสนฤทธิ์. (2567). การพัฒนาช่องทางการขายสินค้าผลิตภัณฑ์เนื้อสัตว์แปรรูปด้วยแพลตฟอร์มแอปพลิเคชันไลน์. *วารสารการประยุกต์ใช้เทคโนโลยีสารสนเทศ*, *10*(1), 143-152. https://ph02.tci-thaijo.org/index.php/project-journal/article/view/253456",
        "ภูมิภัทร รัตนประภา, ธนศักดิ์ วหาวิศาล และอรรถพล อารยเขมกุล. (2568). บทบาทของปัญญาประดิษฐ์ (AI) และแชทบอท ในการยกระดับการให้บริการลูกค้า และการสนับสนุนนักขาย. *วารสารโพธิศาสตร์ปริทัศน์*, *5*(2), 125-136. https://so09.tci-thaijo.org/index.php/BRJ",
        "ศุภชัย สุขเจริญพงษ์ และดารณี ธรรมศิริ. (2561). การพัฒนาระบบตรวจสอบย้อนกลับด้วยเทคโนโลยีคิวอาร์โค้ดและบรรจุภัณฑ์ค้าปลีกสำหรับส้มโอในจังหวัดนครปฐม. *วารสารวิทยาการจัดการ มหาวิทยาลัยราชภัฏนครปฐม*, *5*(1), 67-78. https://doi.org/10.14456/jmsnpru.2018.6",
        "สิทธิศักดิ์ อรรจนานนท์, เพ็ญศรี ปักกะสีนัง และดาเรศ วีระพันธ์. (2562). การพัฒนาระบบฐานข้อมูลควบคุมมาตรฐานเกษตรปลอดภัยผักเบอร์ 8 จังหวัดฉะเชิงเทรา. *วารสารการประยุกต์ใช้เทคโนโลยีสารสนเทศ*, *4*(2), 74-82. https://ph02.tci-thaijo.org/index.php/project-journal/article/view/184528",
        "สำนักงานมาตรฐานสินค้าเกษตรและอาหารแห่งชาติ. (2564). *มาตรฐานสินค้าเกษตร เรื่อง การปฏิบัติทางการเกษตรที่ดีสำหรับพืชอาหาร (มกษ. 9001-2564)*. กรุงเทพฯ: กระทรวงเกษตรและสหกรณ์.",
        "Agrawal, R., Imieliński, T., & Swami, A. (1993). Mining association rules between sets of items in large databases. In *Proceedings of the 1993 ACM SIGMOD International Conference on Management of Data* (pp. 207-216). Washington, D.C.: ACM. https://doi.org/10.1145/170035.170072",
        "Google DeepMind. (2024). Gemini: A family of highly capable multimodal models. *arXiv preprint arXiv:2312.11805*. https://arxiv.org/abs/2312.11805",
        "Google LLC. (2024). *Google AI Studio and Gemini REST API Reference*. Google for Developers. Retrieved from https://ai.google.dev/api/rest",
        "Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)*. RFC 7519, Internet Engineering Task Force (IETF). https://doi.org/10.17487/RFC7519",
        "Kijwattanaphokin, S., & Lhaochot, L. (2024). Customer segmentation using a hybrid approach of K-Means clustering and RFM: An online retail case study. *Journal of Liberal Arts and Social Sciences*, *12*(2). https://doi.org/10.53848/jlsco.v12i2.299053",
        "Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., ... & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems (NeurIPS)* (Vol. 33, pp. 9459-9474).",
        "LINE Corporation. (2024). *LINE Messaging API and LINE Front-end Framework (LIFF) Official Documentation*. Retrieved from https://developers.line.biz/en/docs/",
        "MacQueen, J. (1967). Some methods for classification and analysis of multivariate observations. In *Proceedings of the Fifth Berkeley Symposium on Mathematical Statistics and Probability* (Vol. 1, pp. 281-297). Oakland, CA: University of California Press.",
        "Meta Open Source. (2024). *React: A JavaScript library for building user interfaces*. Retrieved from https://react.dev/",
        "OpenJS Foundation. (2024a). *Express: Fast, unopinionated, minimalist web framework for Node.js*. Retrieved from https://expressjs.com/",
        "OpenJS Foundation. (2024b). *Node.js: JavaScript runtime environment*. Retrieved from https://nodejs.org/",
        "Oracle Corporation. (2024). *MySQL 8.0 Reference Manual*. Oracle Corporation. Retrieved from https://dev.mysql.com/doc/refman/8.0/en/",
        "Pressman, R. S., & Maxim, B. R. (2020). *Software engineering: A practitioner's approach* (9th ed.). New York, NY: McGraw-Hill Education.",
        "Provos, N., & Mazières, D. (1999). A future-adaptable password scheme. In *Proceedings of the FREENIX Track: 1999 USENIX Annual Technical Conference* (pp. 81-91). Monterey, CA: USENIX Association.",
        "Tailwind Labs. (2024). *Tailwind CSS: A utility-first CSS framework*. Retrieved from https://tailwindcss.com/",
    ]
    for item in bib_items:
        add_bib_entry(doc, item)


def append_appendices(doc):
    # =========================================================================
    # ภาคผนวก ก รายการข้อกำหนด แผนภาพระบบ และพจนานุกรมข้อมูล
    # =========================================================================
    sec_app_a = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_a)
    configure_chapter_section_page_numbering(sec_app_a, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ก", "รายการข้อกำหนด แผนภาพระบบ และพจนานุกรมข้อมูล")

    add_section_heading(doc, "ก.1 ตารางความต้องการเชิงหน้าที่ (Functional Requirements)")
    add_table_caption(doc, "ตาราง Functional Requirements ของระบบ FarmGAP")
    fr_headers = ["รหัส", "ชื่อฟังก์ชันการทำงาน", "รายละเอียดความต้องการเชิงหน้าที่ของระบบ"]
    fr_rows = [
        ("FR-01", "การจัดการผู้ใช้และสิทธิ์เข้าถึง", "รองรับการเข้าสู่ระบบด้วย JWT และการเชื่อมโยงบัญชี LINE User ID แยกตามบทบาทผู้ใช้"),
        ("FR-02", "การจัดการแปลงและแคร่ปลูก", "สามารถเพิ่ม แก้ไข ลบข้อมูลแปลงปลูกหลัก แคร่ปลูกย่อย และบันทึกประวัติการเตรียมดินได้"),
        ("FR-03", "การบันทึกเพาะกล้าและรอบปลูก", "บันทึกวันเพาะเมล็ด วันย้ายลงแคร่ปลูก และคำนวณอายุพืชสะสมรวมอัตโนมัติ"),
        ("FR-04", "การควบคุมระยะปลอดภัย PHI", "บันทึกการให้ปุ๋ย/สารเคมี คำนวณวันปลอดภัย และล็อกการเก็บเกี่ยวอัตโนมัติเมื่อติดค่า PHI"),
        ("FR-05", "การเก็บเกี่ยวและสร้างรหัส Lot", "บันทึกผลผลิตเข้าคลังสินค้า สร้างรหัส Lot อัตโนมัติ และสร้าง QR Code ประจำล็อต"),
        ("FR-06", "การออกรายงานมาตรฐาน GAP", "จัดพิมพ์รายงานประวัติการเพาะปลูกรายรอบการปลูกในรูปแบบเอกสารมาตรฐาน A4"),
        ("FR-07", "ระบบร้านค้าออนไลน์ LINE LIFF", "แสดงรายการผักสดที่มีสต็อกจริง แนะนำสินค้าคู่กัน รับคำสั่งซื้อ และอัปโหลดสลิปโอนเงิน"),
        ("FR-08", "การแจ้งเตือนและการจัดการผ่าน Flex Message", "ส่งการ์ดแจ้งสถานะคำสั่งซื้อแก่ลูกค้า และแจ้งเตือนออเดอร์ใหม่พร้อมสลิปเข้า LINE เจ้าของฟาร์มเพื่อกดยืนยันจัดส่ง ตัดสต็อก GAP และพิมพ์ใบเสร็จผ่าน LINE ได้ทันที"),
        ("FR-09", "การตรวจสอบย้อนกลับ QR Code", "แสดงหน้าเว็บไทม์ไลน์ประวัติการเพาะปลูกและสถานะความปลอดภัย PHI เมื่อสแกน QR Code"),
        ("FR-10", "การจัดกลุ่มลูกค้า K-Means & แจ้งเตือน LINE", "จัดกลุ่มลูกค้าออกเป็น 3 กลุ่มตามคุณลักษณะ 4 มิติด้วย K-Means และยิงแจ้งเตือน LINE Flex Message ตรงกลุ่มเป้าหมาย"),
        ("FR-11", "ผู้ช่วยสนทนา Google Gemini AI", "ตอบคำถามจากข้อมูลสต็อกจริงแบบไดนามิก สกัดคำสั่งซื้อจากแชท และสลับโมเดลสำรองอัตโนมัติ"),
        ("FR-12", "ระบบบัญชีรายรับ-รายจ่ายฟาร์ม", "บันทึกรายรับจากการขายอัตโนมัติ บันทึกต้นทุนการผลิต และสรุปงบกำไรขาดทุนรายเดือน"),
    ]
    build_styled_table(doc, fr_headers, fr_rows, col_widths=[0.65, 1.85, 3.25], center_cols={0}, font_size_pt=14)

    add_section_heading(doc, "ก.2 ตารางความต้องการไม่เชิงหน้าที่ (Non-Functional Requirements)")
    add_table_caption(doc, "ตาราง Non-Functional Requirements ของระบบ FarmGAP")
    nfr_headers = ["รหัส", "ด้านคุณลักษณะคุณภาพ", "รายละเอียดข้อกำหนดไม่เชิงหน้าที่"]
    nfr_rows = [
        ("NFR-01", "ด้านความถูกต้องแม่นยำ (Accuracy)", "คำนวณอายุพืชสะสมและวันที่ครบกำหนดระยะปลอดภัย (PHI) ได้ถูกต้อง 100% ตามสูตรวันปฏิทิน"),
        ("NFR-02", "ด้านความมั่นคงปลอดภัย (Security)", "เข้ารหัสรหัสผ่านด้วย bcrypt ตรวจสอบสิทธิ์ด้วย JWT และป้องกันการแก้ไขข้อมูลข้ามสิทธิ์"),
        ("NFR-03", "ด้านความพร้อมใช้งาน (Availability)", "มีกลไก Multi-Model Fallback สลับโมเดล Gemini สำรองอัตโนมัติเมื่อเกิดปัญหาโควตา API"),
        ("NFR-04", "ด้านความง่ายต่อการใช้งาน (Usability)", "รองรับการแสดงผลแบบ Responsive Web บนคอมพิวเตอร์และสมาร์ตโฟนผ่าน LINE LIFF"),
        ("NFR-05", "ด้านประสิทธิภาพ (Performance)", "ประมวลผลคำสั่งซื้อและส่งการ์ดแจ้งเตือน LINE Flex Message ภายในเวลาไม่เกิน 3 วินาที"),
    ]
    build_styled_table(doc, nfr_headers, nfr_rows, col_widths=[0.75, 1.85, 3.15], center_cols={0}, font_size_pt=14)

    add_section_heading(doc, "ก.3 พจนานุกรมข้อมูล (Data Dictionary) ทั้ง 18 ตาราง")
    add_body_paragraph(
        doc,
        "โครงสร้างพจนานุกรมข้อมูล (Data Dictionary) ของฐานข้อมูลเชิงสัมพันธ์ MySQL ในระบบ FarmGAP ประกอบด้วยตารางข้อมูลจำนวน 18 ตาราง ดังรายละเอียดต่อไปนี้",
    )
    add_table_caption(doc, "ตารางพจนานุกรมข้อมูล (Data Dictionary) ทั้ง 18 ตารางของระบบ FarmGAP")

    dd_headers = ["ลำดับ", "ชื่อตาราง (Table Name)", "คีย์หลัก (PK) / คีย์นอก (FK)", "แอตทริบิวต์สำคัญและคำอธิบายโครงสร้างข้อมูล (จาก schema.sql)"]
    dd_rows = [
        ("1", "users", "PK: id\nUK: email, username", "email, username, password_hash, display_name, farm_name, phone, role, bank_name, bank_account_no, promptpay_number, line_user_id"),
        ("2", "crops", "PK: id\nFK: user_id", "name, scientific_name, category, growth_days, nursery_days, harvest_unit, default_bag_size, default_price"),
        ("3", "plots", "PK: id\nFK: user_id", "plot_number, name, dimension, soil_recipe, soil_prep_date, seed_prep_date, seed_crop_id, crop_name, area_sqm, planting_date, expected_harvest_date, field_safety_status, status, current_batch_id"),
        ("4", "planting_batches", "PK: id\nFK: user_id, plot_id, crop_id", "batch_code, start_date, expected_harvest_date, actual_harvest_date, total_damaged_count, total_harvested_count, seed_prep_date, soil_recipe, soil_prep_date, status"),
        ("5", "crop_activities", "PK: id\nFK: user_id, plot_id, batch_id", "activity_date, stage (soil_prep/seeding/planting/fertilizing/harvest), title, materials_used, details, operator_name, source_type, source_id"),
        ("6", "chemical_logs", "PK: id\nFK: user_id, plot_id, batch_id", "log_date, chem_type, product_name, amount, unit, reason, application_method, safety_ppe, phi_days, worker_name"),
        ("7", "pest_logs", "PK: id\nFK: user_id, plot_id, batch_id", "log_date, pest_or_disease, damaged_count, damage_cause, severity, treatment_method, worker_name"),
        ("8", "harvest_logs", "PK: id\nFK: user_id, plot_id, batch_id, product_id", "harvest_date, quantity, unit, lot_code, destination, total_packs, stocked_quantity, stock_status, quality_grade, revenue, harvest_hygiene"),
        ("9", "products", "PK: id\nFK: plot_id", "name, category, price, unit, stock_quantity, image_url, status (available/out_of_stock), updated_at"),
        ("10", "customers", "PK: id\nUK: line_user_id\nFK: cluster_id", "line_user_id, display_name, picture_url, phone, address, cluster_id, created_at"),
        ("11", "customer_clusters", "PK: id", "cluster_name (Salad Lovers / Health Regulars / Bulk & B2B), description, preferred_crops (JSON), created_at"),
        ("12", "orders", "PK: id\nUK: order_code\nFK: customer_id", "order_code, customer_id, total_amount, status, delivery_type, payment_method, slip_image_url, recipient_name, recipient_phone, recipient_address, notes"),
        ("13", "order_items", "PK: id\nFK: order_id, product_id", "order_id, product_id, quantity, unit_price, subtotal, harvest_date, lot_code (รายการสินค้าและรหัสล็อตในคำสั่งซื้อ)"),
        ("14", "product_recommendations", "PK: id\nFK: product_id, recommended_product_id", "product_id, recommended_product_id, score DECIMAL(5,4), reason (คู่สินค้าแนะนำจาก Co-occurrence Matrix)"),
        ("15", "line_chat_sessions", "PK: id\nUK: line_user_id\nFK: order_id", "line_user_id, state (IDLE/SELECTING_QTY/AWAITING_CONTACT/AWAITING_PAYMENT), order_id, draft_data (JSON), updated_at"),
        ("16", "storage_logs", "PK: id\nFK: user_id, order_id", "log_date, storage_location, shipped_to, buyer, vehicle, vehicle_clean_status, storage_conditions, delivery_condition"),
        ("17", "cost_logs", "PK: id\nFK: user_id, plot_id", "log_date, category, description, amount DECIMAL(12,2), created_by (บันทึกบัญชีต้นทุนการเกษตร)"),
        ("18", "audit_logs", "PK: id", "table_name, record_id, action (CREATE/UPDATE/DELETE), user_email, old_values (JSON), new_values (JSON), created_at"),
    ]
    build_styled_table(doc, dd_headers, dd_rows, col_widths=[0.45, 1.40, 1.30, 2.60], center_cols={0}, font_size_pt=13.5)

    # =========================================================================
    # ภาคผนวก ข คู่มือการใช้งานระบบและตัวอย่างรายงานมาตรฐาน GAP
    # =========================================================================
    sec_app_b = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_b)
    configure_chapter_section_page_numbering(sec_app_b, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ข", "คู่มือการใช้งานระบบและตัวอย่างรายงานมาตรฐาน GAP")

    add_section_heading(doc, "ข.1 ขั้นตอนการใช้งานระบบสำหรับเจ้าของฟาร์มและเกษตรกร (Web Admin)")
    add_numbered_item(doc, "1.", "เข้าสู่ระบบผ่านเว็บเบราว์เซอร์ด้วยชื่อผู้ใช้งานและรหัสผ่านของผู้ดูแลฟาร์ม ระบบจะแสดงหน้าจอแดชบอร์ดภาพรวมฟาร์ม สถานะแคร่ปลูก และการแจ้งเตือนระยะปลอดภัย PHI", bold_prefix=True)
    add_numbered_item(doc, "2.", "กำหนดค่าข้อมูลหลักที่เมนู 'คลังชนิดพืชผัก' (Crops Master Data) โดยระบุชื่อสายพันธุ์ ระยะเวลาเพาะกล้า (Nursery Days) ระยะเวลาเก็บเกี่ยวเป้าหมาย (Growth Days) ราคา และขนาดบรรจุภัณฑ์มาตรฐาน เพื่อเป็นฐานข้อมูลอ้างอิงในการคำนวณอัตโนมัติ", bold_prefix=True)
    add_numbered_item(doc, "3.", "ตั้งค่าโครงสร้างฟาร์มที่เมนู 'จัดการแปลงปลูกและแคร่ปลูก' พร้อมบันทึกประวัติการเตรียมดิน การปรับสภาพความเป็นกรด-ด่าง (pH) และสารปรับปรุงดินก่อนเริ่มรอบการปลูก", bold_prefix=True)
    add_numbered_item(doc, "4.", "บันทึกการเพาะเมล็ดในถาดหลุมที่เมนู 'บันทึกการเพาะกล้า' โดยเลือกชนิดพืชจากคลัง และเมื่อต้นกล้าพร้อมย้ายปลูกให้กดปุ่ม 'ย้ายลงแคร่ปลูก' ระบบจะสร้างรหัสรอบการปลูก (planting_id) และเริ่มคำนวณอายุพืชสะสมต่อเนื่อง (อายุเพาะกล้า + อายุบนแปลง)", bold_prefix=True)
    add_numbered_item(doc, "5.", "ในระหว่างดูแลแปลงปลูก ให้บันทึกประวัติการให้น้ำ การใส่ปุ๋ยหมัก หรือการใช้สารชีวภัณฑ์ป้องกันศัตรูพืช หากสารที่ใช้มีค่าระยะปลอดภัย (PHI > 0 วัน) ระบบจะคำนวณวันปลอดภัย (Safe Harvest Date) และล็อกการเก็บเกี่ยวอัตโนมัติ", bold_prefix=True)
    add_numbered_item(doc, "6.", "เมื่อพืชมีอายุครบกำหนดและพ้นระยะปลอดภัย PHI แล้ว ให้กดปุ่ม 'บันทึกการเก็บเกี่ยว' เพื่อระบุน้ำหนักผลผลิตและผลสุ่มตรวจสารตกค้าง (MRL) ระบบจะตัดรอบการปลูก สร้างรหัสรุ่น (Lot ID) เพิ่มสต็อกสินค้าพร้อมขาย และสร้าง Lot QR Code สำหรับติดบรรจุภัณฑ์", bold_prefix=True)
    add_numbered_item(doc, "7.", "สามารถกดปุ่ม 'พิมพ์รายงาน GAP (A4)' เพื่อออกเอกสารบันทึกการปฏิบัติงานทางการ (บธ.-02 และ บธ.-04) ตามมาตรฐาน มกษ. 9001 หรือบริหารจัดการคำสั่งซื้อของลูกค้าผ่านระบบหลังบ้านและผ่านการแจ้งเตือน LINE Notifier ได้ทันที", bold_prefix=True)

    add_section_heading(doc, "ข.2 ขั้นตอนการใช้งานสำหรับลูกค้าและผู้บริโภคบน LINE Official Account")
    add_numbered_item(doc, "1.", "เพิ่มเพื่อนกับบัญชีทางการ LINE Official Account ของฟาร์มผัก จากนั้นสามารถเลือกสั่งซื้อได้ 2 ช่องทาง คือ กดปุ่มร้านค้าออนไลน์บน Rich Menu (LINE LIFF) หรือพิมพ์สนทนาสั่งซื้อกับบอทอัจฉริยะ Google Gemini AI ในห้องแชทโดยตรง", bold_prefix=True)
    add_numbered_item(doc, "2.", "ในหน้าร้านค้า LINE LIFF ลูกค้าสามารถเลือกผักสดลงตะกร้า ดูคำแนะนำสินค้าที่มักซื้อคู่กัน เลือกวิธีจัดส่ง และอัปโหลดภาพสลิปโอนเงินเพื่อยืนยันคำสั่งซื้อ", bold_prefix=True)
    add_numbered_item(doc, "3.", "ระบบจะส่งการ์ดข้อความ LINE Flex Message แจ้งสถานะคำสั่งซื้อ การจัดส่ง และใบเสร็จรับเงินอิเล็กทรอนิกส์เข้าสู่ห้องแชทอัตโนมัติ", bold_prefix=True)
    add_numbered_item(doc, "4.", "เมื่อได้รับผักสดแล้ว ลูกค้าสามารถสแกน QR Code บนถุงผักเพื่อเปิดดูหน้าเว็บตรวจสอบย้อนกลับประวัติการเพาะปลูกและสถานะปลอดสารเคมีตกค้าง (PHI) ของผักล็อตนั้นได้ทันที", bold_prefix=True)

    # =========================================================================
    # ภาคผนวก ค แบบฟอร์มเสนอโครงงาน (แบบ วค-1)
    # =========================================================================
    sec_app_c = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_c)
    configure_chapter_section_page_numbering(sec_app_c, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ค", "แบบฟอร์มเสนอโครงงาน (แบบ วค-1)")
    add_body_paragraph(
        doc,
        "เอกสารแบบฟอร์มเสนอหัวข้อโครงงานทางวิทยาการคอมพิวเตอร์และเทคโนโลยีดิจิทัล (แบบ วค-1) รายวิชาโครงงานวิทยาการคอมพิวเตอร์และเทคโนโลยีดิจิทัล (141114026) คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร มหาวิทยาลัยราชภัฏยะลา",
    )
    vk1_rows = [
        ("ชื่อโครงงาน (ภาษาไทย)", "ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account"),
        ("ชื่อโครงงาน (ภาษาอังกฤษ)", "A Vegetable Farm Management and Online Ordering System Using Artificial Intelligence on LINE Official Account"),
        ("ผู้จัดทำโครงงาน", "นายอับดุลรอฮีม จิเตะ  รหัสนักศึกษา 406659018"),
        ("หลักสูตรและสาขาวิชา", "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์"),
        ("อาจารย์ที่ปรึกษาโครงงาน", "ผู้ช่วยศาสตราจารย์อิสมาแอ ล่าเตะเกะ"),
        ("อาจารย์ประจำวิชา", "อาจารย์สุลัยมาน เภอโส๊ะ"),
        ("ปีการศึกษา", "2569"),
        ("สถานะการอนุมัติหัวข้อ", "[ แนบเอกสารแบบฟอร์ม วค-1 ฉบับลงนามอนุมัติจริง ]"),
    ]
    build_styled_table(doc, ["รายการข้อมูล", "รายละเอียดตามแบบเสนอโครงงาน (แบบ วค-1)"], vk1_rows, col_widths=[2.0, 3.75], font_size_pt=15)

    # =========================================================================
    # ภาคผนวก ง แบบฟอร์มขอสอบโครงงาน (แบบ วค-2)
    # =========================================================================
    sec_app_d = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_d)
    configure_chapter_section_page_numbering(sec_app_d, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ง", "แบบฟอร์มขอสอบโครงงาน (แบบ วค-2)")
    add_body_paragraph(
        doc,
        "เอกสารแบบฟอร์มขออนุมัติสอบโครงงานทางวิทยาการคอมพิวเตอร์และเทคโนโลยีดิจิทัล (แบบ วค-2) เมื่อดำเนินการพัฒนาระบบและจัดทำเล่มรายงานวิจัยเสร็จสมบูรณ์ตามแผนการดำเนินงาน",
    )
    vk2_rows = [
        ("ชื่อโครงงาน", "ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account"),
        ("ผู้ขอสอบโครงงาน", "นายอับดุลรอฮีม จิเตะ  รหัสนักศึกษา 406659018"),
        ("อาจารย์ที่ปรึกษาโครงงาน", "ผู้ช่วยศาสตราจารย์อิสมาแอ ล่าเตะเกะ"),
        ("ความเห็นอาจารย์ที่ปรึกษา", "เห็นสมควรอนุมัติให้เข้าสอบโครงงานได้"),
        ("เอกสารแนบ", "[ แนบเอกสารแบบฟอร์ม วค-2 ฉบับลงนามอนุมัติจริง ]"),
    ]
    build_styled_table(doc, ["รายการข้อมูล", "รายละเอียดตามแบบขอสอบโครงงาน (แบบ วค-2)"], vk2_rows, col_widths=[2.0, 3.75], font_size_pt=15)

    # =========================================================================
    # ภาคผนวก จ แบบรายงานความก้าวหน้า (แบบ วค-3)
    # =========================================================================
    sec_app_e = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_e)
    configure_chapter_section_page_numbering(sec_app_e, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก จ", "แบบรายงานความก้าวหน้า (แบบ วค-3)")
    add_body_paragraph(
        doc,
        "สรุปบันทึกการเข้าพบอาจารย์ที่ปรึกษาโครงงานเพื่อรายงานความก้าวหน้าในการดำเนินงานวิจัยและพัฒนาระบบ (แบบ วค-3) ตลอดภาคการศึกษา",
    )
    vk3_headers = ["ครั้งที่", "หัวข้อการดำเนินงานและรายงานความก้าวหน้า", "ผลการตรวจสอบของอาจารย์ที่ปรึกษา"]
    vk3_rows = [
        ("1", "ศึกษาปัญหาการจัดการฟาร์มผักตามมาตรฐาน GAP และนำเสนอขอบเขตโครงงาน", "อนุมัติขอบเขตและให้ปรับปรุงนิยามศัพท์เฉพาะ"),
        ("2", "ออกแบบแผนภาพ DFD ระดับ 0-1, Use Case 13 กรณี และโครงสร้างฐานข้อมูล 18 ตาราง", "ตรวจสอบความสัมพันธ์ของตาราง plantings และค่า PHI ผ่าน"),
        ("3", "พัฒนาระบบบริหารจัดการฟาร์มฝั่งเจ้าของฟาร์มและรายงานมาตรฐาน GAP รูปแบบ A4", "ระบบคำนวณอายุพืชสะสมและล็อกการเก็บเกี่ยวตามค่า PHI ได้ถูกต้อง"),
        ("4", "พัฒนาระบบร้านค้าออนไลน์ LINE LIFF, Flex Message และหน้าตรวจสอบย้อนกลับ QR Code", "เชื่อมต่อ LINE OA และแสดงไทม์ไลน์ตรวจสอบย้อนกลับได้ครบถ้วน"),
        ("5", "พัฒนาโมดูลวิเคราะห์กลุ่มลูกค้า K-Means และผู้ช่วยสนทนา Google Gemini AI", "ทดสอบการตอบแชทตามสต็อกจริงและกลไกสลับโมเดลสำรองผ่าน"),
        ("6", "ตรวจทานเล่มรายงานวิจัยฉบับสมบูรณ์ บทที่ 1-5 และภาคผนวกเพื่อเตรียมสอบ", "อนุมัติให้ยื่นขอสอบโครงงานได้ [แนบแบบ วค-3 ฉบับลงนามจริง]"),
    ]
    build_styled_table(doc, vk3_headers, vk3_rows, col_widths=[0.6, 2.95, 2.2], center_cols={0}, font_size_pt=14.5)

    # =========================================================================
    # ภาคผนวก ฉ แบบประเมินโครงงานโดยผู้เชี่ยวชาญ (แบบ วค-4)
    # =========================================================================
    sec_app_f = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_f)
    configure_chapter_section_page_numbering(sec_app_f, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ฉ", "แบบประเมินโครงงานโดยผู้เชี่ยวชาญ (แบบ วค-4)")
    add_body_paragraph(
        doc,
        "โครงสร้างรายการประเมินคุณภาพของระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account สำหรับผู้เชี่ยวชาญจำนวน 3 ท่าน (แบบ วค-4) แบ่งออกเป็น 4 ด้าน ด้านละ 25 คะแนน รวม 100 คะแนน ดังนี้",
    )
    vk4_headers = ["หมวดการประเมิน (แบบ วค-4)", "รายละเอียดประเด็นการตรวจสอบโดยผู้เชี่ยวชาญ", "คะแนนเต็ม"]
    vk4_rows = [
        ("1. ด้านฟังก์ชันการทำงานของระบบ\n(Functionality)", "ความครบถ้วนของระบบจัดการฟาร์ม GAP การคำนวณอายุพืชสะสม การล็อกค่า PHI ระบบสั่งซื้อ LINE LIFF และการตอบคำถามด้วย Gemini AI", "25"),
        ("2. ด้านความง่ายต่อการใช้งานระบบ\n(Usability)", "ความเหมาะสมของการจัดวางเมนู สีสัน ขนาดตัวอักษร ความสะดวกในการใช้งานผ่านเว็บและ LINE OA และการสแกน QR Code", "25"),
        ("3. ด้านความมั่นคงปลอดภัยของข้อมูล\n(Security)", "การกำหนดสิทธิ์ผู้ใช้งานด้วย JWT การเข้ารหัสรหัสผ่าน การป้องกันการแก้ไขข้อมูลข้ามบทบาท และความถูกต้องของการผูกข้อมูลรายล็อต", "25"),
        ("4. ด้านประสิทธิภาพของระบบ\n(Performance)", "ความเร็วในการประมวลผลฐานข้อมูล ความแม่นยำของ K-Means และความต่อเนื่องของระบบแชทบอทผ่านกลไก Multi-Model Fallback", "25"),
        ("รวมคะแนนทั้งสิ้น", "[ แนบเอกสารแบบประเมิน วค-4 ของผู้เชี่ยวชาญทั้ง 3 ท่าน ฉบับลงนามจริง ]", "100"),
    ]
    build_styled_table(doc, vk4_headers, vk4_rows, col_widths=[1.8, 3.15, 0.8], center_cols={2}, font_size_pt=14.5)

    # =========================================================================
    # ภาคผนวก ช แบบประเมินโครงงานโดยผู้ใช้งาน (แบบ วค-5)
    # =========================================================================
    sec_app_g = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_g)
    configure_chapter_section_page_numbering(sec_app_g, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ช", "แบบประเมินโครงงานโดยผู้ใช้งาน (แบบ วค-5)")
    add_body_paragraph(
        doc,
        "โครงสร้างรายการประเมินความพึงพอใจและคุณภาพของระบบสำหรับผู้ใช้งานจริงจำนวน 3 ท่าน (แบบ วค-5) แบ่งออกเป็น 4 ด้าน ด้านละ 25 คะแนน รวม 100 คะแนน ดังนี้",
    )
    vk5_headers = ["หมวดการประเมิน (แบบ วค-5)", "รายละเอียดประเด็นการประเมินโดยผู้ใช้งานทั่วไป", "คะแนนเต็ม"]
    vk5_rows = [
        ("1. ด้านความต้องการใช้งานของระบบ\n(Requirement)", "ระบบสามารถตอบสนองความต้องการของเจ้าของฟาร์มในการจัดการข้อมูล GAP และตอบสนองลูกค้าในการสั่งซื้อผักสดออนไลน์ได้ตรงตามความต้องการ", "25"),
        ("2. ด้านฟังก์ชันการทำงานของระบบ\n(Functionality)", "ความถูกต้องของการแสดงสต็อกสินค้า การสั่งซื้อผ่าน LINE LIFF การรับแจ้งเตือน Flex Message และการดูข้อมูลตรวจสอบย้อนกลับผ่าน QR Code", "25"),
        ("3. ด้านความง่ายต่อการใช้งานระบบ\n(Usability)", "ความง่ายในการเรียนรู้ใช้งาน ความชัดเจนของข้อความและปุ่มกด และการสั่งซื้อผ่านการพูดคุยกับแชทบอท AI บน LINE", "25"),
        ("4. ด้านความมั่นคงปลอดภัยของข้อมูล\n(Security)", "ความน่าเชื่อถือของข้อมูลประวัติการเพาะปลูกและระยะปลอดภัย PHI ที่แสดงผลเมื่อสแกน QR Code และความปลอดภัยของข้อมูลการสั่งซื้อ", "25"),
        ("รวมคะแนนทั้งสิ้น", "[ แนบเอกสารแบบประเมิน วค-5 ของผู้ใช้งานทั้ง 3 ท่าน ฉบับลงนามจริง ]", "100"),
    ]
    build_styled_table(doc, vk5_headers, vk5_rows, col_widths=[1.8, 3.15, 0.8], center_cols={2}, font_size_pt=14.5)

    # =========================================================================
    # ภาคผนวก ซ ประวัติผู้จัดทำโครงงาน
    # =========================================================================
    sec_app_h = doc.add_section(WD_SECTION.NEW_PAGE)
    set_section_margins(sec_app_h)
    configure_chapter_section_page_numbering(sec_app_h, start_page=None)

    add_chapter_heading(doc, "ภาคผนวก ซ", "ประวัติผู้จัดทำโครงงาน")

    bio_rows = [
        ("ชื่อ - นามสกุล (ภาษาไทย)", "นายอับดุลรอฮีม จิเตะ"),
        ("ชื่อ - นามสกุล (ภาษาอังกฤษ)", "Mr. Abdulrohim Jiteh"),
        ("รหัสนักศึกษา", "406659018"),
        ("หลักสูตร", "วิทยาศาสตรบัณฑิต (วท.บ.)"),
        ("สาขาวิชา", "วิทยาการคอมพิวเตอร์"),
        ("คณะ", "คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร"),
        ("สถาบันการศึกษา", "มหาวิทยาลัยราชภัฏยะลา"),
        ("ปีการศึกษาที่สำเร็จการศึกษา", "2569"),
        ("หัวข้อโครงงานวิจัย", "ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์ด้วยปัญญาประดิษฐ์บน LINE Official Account"),
        ("ความเชี่ยวชาญและทักษะทางเทคนิค", "Full-Stack Web Development (React.js, Node.js, Express.js, MySQL), LINE Official Account (Messaging API, LIFF, Flex Message), Machine Learning & Generative AI Integration (K-Means Clustering, Google Gemini API)"),
    ]
    build_styled_table(doc, ["หัวข้อประวัติ", "รายละเอียดผู้จัดทำโครงงานวิจัย"], bio_rows, col_widths=[2.0, 3.75], font_size_pt=15)


def build_complete_thesis():
    output_path = r"c:\forwork\Web\farmgap\farmgap\Research-Paper.docx"
    logo_path = r"c:\forwork\Web\farmgap\farmgap\scratch\yru_logo_0.png"
    scratch_dir = r"c:\forwork\Web\farmgap\farmgap\scratch"

    build_front_matter(output_path=output_path, logo_path=logo_path)
    doc = Document(output_path)
    append_chapter1(doc)
    append_chapter2(doc)
    append_chapter3(doc, scratch_dir=scratch_dir)
    append_chapter4(doc, scratch_dir=scratch_dir)
    append_chapter5(doc)
    append_bibliography(doc)
    append_appendices(doc)
    doc.save(output_path)
    print(f"Successfully generated COMPLETE Research Paper (Step 1 to Step 7) in: {output_path}")


if __name__ == "__main__":
    build_complete_thesis()
