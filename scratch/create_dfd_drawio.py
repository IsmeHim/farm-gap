import os
import xml.etree.ElementTree as ET

OUT_DFD0 = r"c:\forwork\Web\farmgap\farmgap\dfd-lv0.drawio"
OUT_DFD1 = r"c:\forwork\Web\farmgap\farmgap\dfd-lv1.drawio"


def create_base_mxfile(diag_id, diag_name, page_w="1400", page_h="950"):
    mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")
    diagram = ET.SubElement(mxfile, "diagram", id=diag_id, name=diag_name)
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        dx="1450",
        dy="950",
        grid="1",
        gridSize="10",
        guides="1",
        tooltips="1",
        connect="1",
        arrows="1",
        fold="1",
        page="1",
        pageScale="1",
        pageWidth=page_w,
        pageHeight=page_h,
        background="#FFFFFF",
        math="0",
        shadow="0",
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")
    return mxfile, root


def add_external_entity(root, cid, title, subtitle, x, y, w=230, h=95, fill="#EFF6FF", stroke="#1E40AF"):
    val = f"<b>{title}</b><br/><font style='font-size:11px;color:#334155;'>{subtitle}</font>"
    style = (
        f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
        f"strokeWidth=2;fontFamily=Tahoma;fontSize=13;fontColor=#0F172A;align=center;verticalAlign=middle;"
    )
    c = ET.SubElement(root, "mxCell", id=cid, value=val, style=style, vertex="1", parent="1")
    ET.SubElement(c, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h), **{"as": "geometry"})


def add_gand_process(root, cid, proc_num, proc_title, proc_sub, x, y, w=250, h=110, hdr_fill="#166534", body_fill="#F0FDF4", stroke="#14532D"):
    style = (
        f"swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=28;"
        f"horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=1;collapsible=0;"
        f"marginBottom=0;whiteSpace=wrap;html=1;fillColor={hdr_fill};strokeColor={stroke};"
        f"fontColor=#FFFFFF;fontFamily=Tahoma;fontSize=12;swimlaneFillColor={body_fill};"
        f"rounded=1;arcSize=12;strokeWidth=2;"
    )
    c = ET.SubElement(root, "mxCell", id=cid, value=f"Process {proc_num}", style=style, vertex="1", parent="1")
    ET.SubElement(c, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h), **{"as": "geometry"})

    body_val = f"<b>{proc_title}</b><br/><font style='font-size:11px;color:#334155;'>{proc_sub}</font>"
    body_style = (
        f"text;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;"
        f"spacingLeft=8;spacingRight=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];"
        f"portConstraint=eastwest;fontFamily=Tahoma;fontSize=12;fontColor=#0F172A;whiteSpace=wrap;html=1;"
    )
    b = ET.SubElement(root, "mxCell", id=f"{cid}_body", value=body_val, style=body_style, vertex="1", parent=cid)
    ET.SubElement(b, "mxGeometry", y="28", width=str(w), height=str(h - 28), **{"as": "geometry"})


def add_data_store(root, cid, ds_code, ds_name, x, y, w=235, h=48, fill="#FEFCE8", stroke="#B45309"):
    val = f"<b>{ds_code}</b>  |  {ds_name}"
    style = (
        f"shape=partialRectangle;whiteSpace=wrap;html=1;right=0;top=1;bottom=1;left=1;"
        f"fillColor={fill};strokeColor={stroke};strokeWidth=1.8;fontFamily=Tahoma;fontSize=11;"
        f"fontColor=#0F172A;align=left;spacingLeft=10;verticalAlign=middle;"
    )
    c = ET.SubElement(root, "mxCell", id=cid, value=val, style=style, vertex="1", parent="1")
    ET.SubElement(c, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h), **{"as": "geometry"})


def add_flow_edge(root, eid, src, tgt, label, ex, ey, enx, eny, stroke="#1E293B", waypoints=None):
    style = (
        f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
        f"exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={enx};entryY={eny};entryDx=0;entryDy=0;"
        f"endArrow=block;endFill=1;strokeColor={stroke};strokeWidth=1.6;"
        f"fontFamily=Tahoma;fontSize=10.5;fontColor=#0F172A;labelBackgroundColor=#FFFFFF;"
    )
    ecell = ET.SubElement(root, "mxCell", id=eid, value=label, style=style, edge="1", parent="1", source=src, target=tgt)
    geom = ET.SubElement(ecell, "mxGeometry", relative="1", **{"as": "geometry"})
    if waypoints:
        arr = ET.SubElement(geom, "Array", **{"as": "points"})
        for wx, wy in waypoints:
            ET.SubElement(arr, "mxPoint", x=str(wx), y=str(wy))


def build_dfd_lv0():
    mxfile, root = create_base_mxfile("farmgap-dfd-lv0", "Context Diagram (DFD Level 0)", page_w="1300", page_h="820")

    add_gand_process(
        root,
        "proc_0",
        "0",
        "ระบบบริหารจัดการฟาร์มผักและสั่งซื้อออนไลน์<br/>ด้วยปัญญาประดิษฐ์บน LINE Official Account",
        "(FarmGAP System)",
        x=470,
        y=310,
        w=360,
        h=160,
        hdr_fill="#166534",
        body_fill="#F0FDF4",
        stroke="#14532D",
    )

    add_external_entity(
        root,
        "ext_owner",
        "เจ้าของฟาร์ม / ผู้ดูแลระบบ",
        "(role = 'owner')",
        x=70,
        y=110,
        w=250,
        h=100,
        fill="#DCFCE7",
        stroke="#166534",
    )
    add_external_entity(
        root,
        "ext_farmer",
        "คนงาน / พนักงานฟาร์ม",
        "(role = 'worker')",
        x=70,
        y=550,
        w=250,
        h=100,
        fill="#FEF3C7",
        stroke="#B45309",
    )
    add_external_entity(
        root,
        "ext_customer",
        "ลูกค้าสมาชิก LINE OA",
        "(customers / LINE LIFF &amp; Chatbot)",
        x=980,
        y=335,
        w=250,
        h=110,
        fill="#DBEAFE",
        stroke="#1E40AF",
    )

    add_flow_edge(
        root,
        "f_o1",
        "ext_owner",
        "proc_0",
        "ข้อมูลแปลง/แคร่ (plots), ชนิดผัก (crops), อนุมัติคำสั่งซื้อ, บันทึกต้นทุน (cost_logs)",
        ex="1",
        ey="0.3",
        enx="0.25",
        eny="0",
        stroke="#166534",
        waypoints=[(560, 140)],
    )
    add_flow_edge(
        root,
        "f_o2",
        "proc_0",
        "ext_owner",
        "แดชบอร์ดสถิติ, รายงาน GAP มกษ. 9001 (แยกตาม batch_id), กลุ่มลูกค้า K-Means",
        ex="0",
        ey="0.25",
        enx="0.5",
        eny="1",
        stroke="#0F766E",
        waypoints=[(195, 350)],
    )

    add_flow_edge(
        root,
        "f_f1",
        "ext_farmer",
        "proc_0",
        "เตรียมดิน/เพาะกล้า (crop_activities), ปุ๋ย/สารเคมี (chemical_logs), โรคแมลง (pest_logs), เก็บเกี่ยว (harvest_logs)",
        ex="1",
        ey="0.7",
        enx="0.25",
        eny="1",
        stroke="#B45309",
        waypoints=[(560, 620)],
    )
    add_flow_edge(
        root,
        "f_f2",
        "proc_0",
        "ext_farmer",
        "รหัสรอบปลูก (batch_code), แจ้งเตือนล็อกเก็บเกี่ยว (phi_days), รหัสล็อต (lot_code) &amp; QR Code",
        ex="0",
        ey="0.75",
        enx="0.5",
        eny="0",
        stroke="#B45309",
        waypoints=[(195, 430)],
    )

    add_flow_edge(
        root,
        "f_c1",
        "ext_customer",
        "proc_0",
        "สั่งซื้อผ่าน LINE LIFF / In-Chat, สลิปโอนเงิน (slip_image_url), ข้อความแชท AI, สแกน QR (/trace/:lot)",
        ex="0",
        ey="0.25",
        enx="1",
        eny="0.3",
        stroke="#1E40AF",
    )
    add_flow_edge(
        root,
        "f_c2",
        "proc_0",
        "ext_customer",
        "รายการผัก/แนะนำคู่กัน (product_recommendations), การ์ดสถานะ Flex Message, คำตอบ Gemini AI, ข้อมูล Traceability",
        ex="1",
        ey="0.75",
        enx="0",
        eny="0.75",
        stroke="#1E40AF",
    )

    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ")
    tree.write(OUT_DFD0, encoding="utf-8", xml_declaration=True)
    print(f"Successfully updated DFD Level 0 at: {OUT_DFD0}")


def build_dfd_lv1():
    mxfile, root = create_base_mxfile("farmgap-dfd-lv1", "DFD Level 1 (Aligned with 18 Tables in schema.sql)", page_w="1650", page_h="1180")

    add_external_entity(
        root,
        "ext_owner",
        "เจ้าของฟาร์ม (Owner)",
        "(users.role = 'owner')",
        x=40,
        y=80,
        w=220,
        h=90,
        fill="#DCFCE7",
        stroke="#166534",
    )
    add_external_entity(
        root,
        "ext_farmer",
        "คนงานฟาร์ม (Worker)",
        "(users.role = 'worker')",
        x=40,
        y=330,
        w=220,
        h=90,
        fill="#FEF3C7",
        stroke="#B45309",
    )
    add_external_entity(
        root,
        "ext_customer",
        "ลูกค้าสมาชิก LINE OA",
        "(customers / LINE User)",
        x=40,
        y=740,
        w=220,
        h=100,
        fill="#DBEAFE",
        stroke="#1E40AF",
    )

    processes = [
        (
            "p1",
            "1.0",
            "จัดการผู้ใช้ ชนิดผัก และแปลง/แคร่ปลูก",
            "ตั้งค่าแปลง/แคร่ (plots), คลังชนิดผัก (crops), เริ่มรอบปลูกใหม่ (planting_batches)",
            55,
            "#166534",
            "#F0FDF4",
        ),
        (
            "p2",
            "2.0",
            "บันทึกกิจกรรมเพาะปลูกและควบคุมค่า PHI",
            "เตรียมดิน/เพาะกล้า (crop_activities), พ่นสาร/ปุ๋ย (chemical_logs &amp; PHI Lock), สำรวจแมลง (pest_logs)",
            235,
            "#166534",
            "#F0FDF4",
        ),
        (
            "p3",
            "3.0",
            "เก็บเกี่ยว นำเข้าสต็อกอัตโนมัติ และออกรายงาน GAP",
            "เก็บเกี่ยว (harvest_logs), ซิงก์สต็อก (products), ขนส่ง (storage_logs), รายงาน GAP &amp; QR (/trace/:lot)",
            415,
            "#0F766E",
            "#F0FDFA",
        ),
        (
            "p4",
            "4.0",
            "จัดการคำสั่งซื้อ LINE OA &amp; แจ้งเตือน Flex Message",
            "สั่งซื้อผ่าน LIFF/In-Chat (orders, order_items), ตรวจสลิป, แจ้งสถานะจัดส่งในแชท LINE",
            595,
            "#1E40AF",
            "#EFF6FF",
        ),
        (
            "p5",
            "5.0",
            "วิเคราะห์กลุ่มลูกค้า K-Means &amp; ผู้ช่วยแชทบอท Gemini AI",
            "จัดกลุ่ม 4 มิติ (customer_clusters), แนะนำผักคู่กัน (product_recommendations), บอท Gemini (line_chat_sessions)",
            775,
            "#6B21A8",
            "#FAF5FF",
        ),
        (
            "p6",
            "6.0",
            "จัดการบัญชีต้นทุนฟาร์มและตรวจสอบประวัติระบบ",
            "บันทึกต้นทุนการผลิต (cost_logs), คำนวณรายได้-กำไรสุทธิ, บันทึกประวัติแก้ไขข้อมูล (audit_logs)",
            955,
            "#1E40AF",
            "#EFF6FF",
        ),
    ]
    for pid, pnum, ptitle, psub, py, hfill, bfill in processes:
        add_gand_process(root, pid, pnum, ptitle, psub, x=500, y=py, w=350, h=110, hdr_fill=hfill, body_fill=bfill, stroke=hfill)

    # Data Stores D1 to D8 mapped directly to the exact 18 table names in schema.sql
    datastores = [
        ("d1", "D1: users & crops", "ตาราง users, crops", 60),
        ("d2", "D2: plots & planting_batches", "ตาราง plots, planting_batches", 150),
        ("d3", "D3: gap_activity_logs", "ตาราง crop_activities, chemical_logs, pest_logs", 275),
        ("d4", "D4: harvest & storage", "ตาราง harvest_logs, storage_logs", 415),
        ("d5", "D5: products & recommendations", "ตาราง products, product_recommendations", 510),
        ("d6", "D6: customers & orders", "ตาราง customers, orders, order_items", 635),
        ("d7", "D7: ai_clusters & chat_sessions", "ตาราง customer_clusters, line_chat_sessions", 805),
        ("d8", "D8: cost_logs & audit_logs", "ตาราง cost_logs, audit_logs", 980),
    ]
    for did, dcode, dname, dy in datastores:
        add_data_store(root, did, dcode, dname, x=1140, y=dy, w=450, h=52)

    # Flows: External Entities <-> Processes
    add_flow_edge(root, "e_o_p1", "ext_owner", "p1", "ตั้งค่าแปลง/แคร่, ชนิดผัก, เริ่มรอบปลูก", "1", "0.35", "0", "0.5", "#166534")
    add_flow_edge(root, "e_o_p6", "ext_owner", "p6", "บันทึกต้นทุนการเกษตร (cost_logs)", "0.3", "1", "0", "0.5", "#166534", waypoints=[(105, 1010)])
    add_flow_edge(root, "e_p3_o", "p3", "ext_owner", "รายงานตรวจประเมิน GAP (มกษ. 9001)", "0", "0.25", "0.7", "1", "#0F766E", waypoints=[(400, 442), (195, 442)])
    add_flow_edge(root, "e_p6_o", "p6", "ext_owner", "สรุปต้นทุน-กำไร &amp; ประวัติ Audit", "0", "0.8", "0.15", "1", "#1E40AF", waypoints=[(75, 1043)])

    add_flow_edge(root, "e_f_p2", "ext_farmer", "p2", "บันทึกเตรียมดิน, เพาะกล้า, สารเคมี (PHI), โรคแมลง", "1", "0.3", "0", "0.5", "#B45309")
    add_flow_edge(root, "e_p2_f", "p2", "ext_farmer", "วันเก็บเกี่ยวปลอดภัย &amp; สถานะล็อก PHI", "0", "0.8", "1", "0.65", "#B45309")
    add_flow_edge(root, "e_f_p3", "ext_farmer", "p3", "บันทึกเก็บเกี่ยวผลผลิตและนำเข้าสต็อก", "1", "0.85", "0", "0.6", "#0F766E")

    add_flow_edge(root, "e_c_p3", "ext_customer", "p3", "สแกน QR Code (/trace/:lot)", "0.5", "0", "0", "0.85", "#0F766E", waypoints=[(150, 508)])
    add_flow_edge(root, "e_c_p4", "ext_customer", "p4", "สั่งซื้อผักสด LIFF/In-Chat &amp; แนบสลิป", "1", "0.25", "0", "0.5", "#1E40AF")
    add_flow_edge(root, "e_p4_c", "p4", "ext_customer", "การ์ดสถานะจัดส่ง Flex Message", "0", "0.8", "1", "0.55", "#1E40AF")
    add_flow_edge(root, "e_c_p5", "ext_customer", "p5", "แชทถามสต็อก/วันเก็บเกี่ยว &amp; สั่งซื้อ", "1", "0.8", "0", "0.4", "#6B21A8")
    add_flow_edge(root, "e_p5_c", "p5", "ext_customer", "คำตอบ Gemini AI &amp; แนะนำผักซื้อคู่กัน", "0", "0.75", "0.5", "1", "#6B21A8", waypoints=[(150, 857)])

    # Flows: Processes <-> Data Stores
    add_flow_edge(root, "ds_p1_d1", "p1", "d1", "ข้อมูลผู้ใช้และคลังชนิดผัก", "1", "0.3", "0", "0.5", "#334155")
    add_flow_edge(root, "ds_p1_d2", "p1", "d2", "สร้างแปลง/แคร่ และรหัสรอบปลูก (batch_code)", "1", "0.8", "0", "0.5", "#334155")
    add_flow_edge(root, "ds_d2_p2", "d2", "p2", "ข้อมูลแปลงและรอบปลูกปัจจุบัน", "0", "0.8", "1", "0.25", "#334155")
    add_flow_edge(root, "ds_p2_d3", "p2", "d3", "บันทึกกิจกรรมแปลง, ค่า phi_days, สำรวจโรคแมลง", "1", "0.6", "0", "0.5", "#334155")
    add_flow_edge(root, "ds_d3_p3", "d3", "p3", "ตรวจสอบวันปลอดภัย PHI &amp; ดึงข้อมูลออกรายงาน GAP", "0", "0.85", "1", "0.2", "#0F766E")
    add_flow_edge(root, "ds_p3_d4", "p3", "d4", "บันทึกล็อตเก็บเกี่ยว (lot_code) &amp; การขนส่ง", "1", "0.45", "0", "0.5", "#0F766E")
    add_flow_edge(root, "ds_p3_d5", "p3", "d5", "ซิงก์จำนวนสต็อกสินค้าอัตโนมัติ (stocked_quantity)", "1", "0.8", "0", "0.5", "#0F766E")
    add_flow_edge(root, "ds_d5_p4", "d5", "p4", "ดึงรายการผักพร้อมขายและตัดสต็อก", "0", "0.85", "1", "0.25", "#1E40AF")
    add_flow_edge(root, "ds_p4_d6", "p4", "d6", "บันทึกข้อมูลลูกค้า คำสั่งซื้อ และสลิปโอนเงิน", "1", "0.65", "0", "0.5", "#1E40AF")
    add_flow_edge(root, "ds_d5_p5", "d5", "p5", "ดึงสต็อกจริงเข้าบริบท Gemini &amp; บันทึกคู่ผักแนะนำ", "0.5", "1", "1", "0.25", "#6B21A8", waypoints=[(1060, 580), (1060, 802)])
    add_flow_edge(root, "ds_d6_p5", "d6", "p5", "ประวัติคำสั่งซื้อเพื่อจัดกลุ่ม K-Means 4 มิติ", "0", "0.85", "1", "0.45", "#6B21A8")
    add_flow_edge(root, "ds_p5_d7", "p5", "d7", "บันทึกกลุ่มลูกค้า &amp; สถานะเซสชันแชท LINE", "1", "0.7", "0", "0.5", "#6B21A8")
    add_flow_edge(root, "ds_d6_p6", "d6", "p6", "ข้อมูลยอดขายจากคำสั่งซื้อ", "0.5", "1", "1", "0.25", "#1E40AF", waypoints=[(1090, 720), (1090, 982)])
    add_flow_edge(root, "ds_p6_d8", "p6", "d8", "บันทึกต้นทุนฟาร์มและประวัติการแก้ไขข้อมูล", "1", "0.65", "0", "0.5", "#1E40AF")

    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ")
    tree.write(OUT_DFD1, encoding="utf-8", xml_declaration=True)
    print(f"Successfully updated DFD Level 1 at: {OUT_DFD1}")


if __name__ == "__main__":
    build_dfd_lv0()
    build_dfd_lv1()
