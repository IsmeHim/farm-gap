import os
import xml.etree.ElementTree as ET

OUT_DRAWIO = r"c:\forwork\Web\farmgap\farmgap\erdiagram.drawio"


def build_drawio_er():
    mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")
    diagram = ET.SubElement(
        mxfile,
        "diagram",
        id="farmgap-er-clean-lanes",
        name="FarmGAP ER Diagram (Row-to-Row Clean Routing)",
    )
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        dx="2100",
        dy="1500",
        grid="1",
        gridSize="10",
        guides="1",
        tooltips="1",
        connect="1",
        arrows="1",
        fold="1",
        page="1",
        pageScale="1",
        pageWidth="2060",
        pageHeight="1480",
        background="#FFFFFF",
        math="0",
        shadow="0",
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")

    palettes = {
        "core": ("#166534", "#14532D", "#F0FDF4", "#FFFFFF"),     # Green: Farm Users, Crops, Plots, Batches, Activities
        "gap": ("#0F766E", "#115E59", "#F0FDFA", "#FFFFFF"),      # Teal: GAP Logs (Chemicals, Pests, Harvests, Storage, Costs, Audit)
        "shop": ("#1E40AF", "#1E3A8A", "#EFF6FF", "#FFFFFF"),     # Blue: E-Commerce (Products, Orders, Order Items, Recommendations)
        "ai": ("#6B21A8", "#581C87", "#FAF5FF", "#FFFFFF"),       # Purple: LINE OA & AI (Customers, Customer Clusters, LINE Chat Sessions)
    }

    TABLE_W = 310
    HDR_H = 30
    ROW_H = 22

    # 4 Columns with wide 170px vertical routing corridors between them:
    # Col 1: x = 60..370   | Corridor 1: x = 370..540
    # Col 2: x = 540..850  | Corridor 2: x = 850..1040
    # Col 3: x = 1040..1350| Corridor 3: x = 1350..1540
    # Col 4: x = 1540..1850
    tables = [
        # ==================== COLUMN 1 (x = 60) ====================
        (
            "users",
            "1. users (ผู้ใช้งานระบบฟาร์ม)",
            "core",
            60,
            60,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "email", "VARCHAR(255)"),
                ("UK", "username", "VARCHAR(100)"),
                ("", "password_hash", "VARCHAR(255)"),
                ("", "display_name", "VARCHAR(255)"),
                ("", "farm_name", "VARCHAR(255)"),
                ("", "phone", "VARCHAR(50)"),
                ("", "role", "ENUM('owner','worker','user')"),
                ("", "bank_name / account_no", "VARCHAR(100/50)"),
                ("", "promptpay_number", "VARCHAR(50)"),
                ("", "line_user_id", "VARCHAR(255)"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "crops",
            "2. crops (คลังข้อมูลชนิดผัก)",
            "core",
            60,
            390,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NULL"),
                ("", "name", "VARCHAR(100)"),
                ("", "scientific_name", "VARCHAR(150)"),
                ("", "category", "VARCHAR(50)"),
                ("", "growth_days", "INT DEFAULT 30"),
                ("", "nursery_days", "INT DEFAULT 14"),
                ("", "harvest_unit", "VARCHAR(50)"),
                ("", "default_bag_size", "VARCHAR(100)"),
                ("", "default_price", "DECIMAL(10,2)"),
            ],
        ),
        (
            "cost_logs",
            "17. cost_logs (บัญชีต้นทุนการเกษตร)",
            "gap",
            60,
            690,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NULL"),
                ("", "log_date", "DATE NOT NULL"),
                ("", "category", "VARCHAR(100)"),
                ("", "description", "TEXT"),
                ("", "amount", "DECIMAL(12,2)"),
                ("", "created_by", "VARCHAR(255)"),
            ],
        ),
        (
            "audit_logs",
            "18. audit_logs (ประวัติแก้ไขข้อมูล)",
            "gap",
            60,
            950,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("", "table_name", "VARCHAR(255)"),
                ("", "record_id", "INT"),
                ("", "action", "VARCHAR(50)"),
                ("", "user_email", "VARCHAR(255)"),
                ("", "old_values", "JSON"),
                ("", "new_values", "JSON"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),

        # ==================== COLUMN 2 (x = 540) ====================
        (
            "plots",
            "3. plots (แปลงปลูกและแคร่ปลูก)",
            "core",
            540,
            60,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("", "plot_number", "INT DEFAULT 1"),
                ("", "name", "VARCHAR(255)"),
                ("", "dimension", "VARCHAR(100)"),
                ("", "soil_recipe", "TEXT"),
                ("", "soil_prep_date", "DATE NULL"),
                ("", "seed_prep_date", "DATE NULL"),
                ("", "seed_crop_id", "INT NULL"),
                ("", "crop_name", "VARCHAR(255)"),
                ("", "area_sqm", "DECIMAL(10,2)"),
                ("", "planting_date", "DATE NULL"),
                ("", "expected_harvest_date", "DATE NULL"),
                ("", "field_safety_status", "VARCHAR(50)"),
                ("", "status", "VARCHAR(50)"),
                ("", "current_batch_id", "INT NULL"),
            ],
        ),
        (
            "planting_batches",
            "4. planting_batches (รอบการปลูกพืช)",
            "core",
            540,
            490,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "crop_id", "INT NOT NULL"),
                ("", "batch_code", "VARCHAR(50)"),
                ("", "start_date", "DATE NOT NULL"),
                ("", "expected_harvest_date", "DATE NOT NULL"),
                ("", "actual_harvest_date", "DATE NULL"),
                ("", "total_damaged_count", "INT DEFAULT 0"),
                ("", "total_harvested_count", "INT DEFAULT 0"),
                ("", "seed_prep_date", "DATE NULL"),
                ("", "soil_recipe", "TEXT NULL"),
                ("", "soil_prep_date", "DATE NULL"),
                ("", "status", "VARCHAR(50)"),
            ],
        ),
        (
            "crop_activities",
            "5. crop_activities (กิจกรรมในแปลง)",
            "core",
            540,
            870,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "batch_id", "INT NULL"),
                ("", "activity_date", "DATE NOT NULL"),
                ("", "stage", "VARCHAR(50)"),
                ("", "title", "VARCHAR(255)"),
                ("", "materials_used", "TEXT NULL"),
                ("", "details", "TEXT NULL"),
                ("", "operator_name", "VARCHAR(255)"),
                ("", "source_type / source_id", "VARCHAR / INT"),
            ],
        ),
        (
            "pest_logs",
            "7. pest_logs (สำรวจโรคและแมลง)",
            "gap",
            540,
            1180,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "batch_id", "INT NULL"),
                ("", "log_date", "DATE NOT NULL"),
                ("", "pest_or_disease", "VARCHAR(255)"),
                ("", "damaged_count", "INT DEFAULT 0"),
                ("", "severity", "VARCHAR(50)"),
                ("", "treatment_method", "TEXT"),
            ],
        ),

        # ==================== COLUMN 3 (x = 1040) ====================
        (
            "chemical_logs",
            "6. chemical_logs (ปุ๋ย/สารเคมี & PHI)",
            "gap",
            1040,
            60,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "batch_id", "INT NULL"),
                ("", "log_date", "DATE NOT NULL"),
                ("", "chem_type", "VARCHAR(100)"),
                ("", "product_name", "VARCHAR(255)"),
                ("", "amount / unit", "DECIMAL / VARCHAR"),
                ("", "reason", "TEXT"),
                ("", "safety_ppe", "BOOLEAN"),
                ("", "phi_days", "INT DEFAULT 0"),
                ("", "worker_name", "VARCHAR(255)"),
            ],
        ),
        (
            "harvest_logs",
            "8. harvest_logs (บันทึกเก็บเกี่ยว & Lot)",
            "gap",
            1040,
            390,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "batch_id", "INT NULL"),
                ("FK", "product_id", "INT NULL"),
                ("", "harvest_date", "DATE NOT NULL"),
                ("", "quantity / unit", "DECIMAL / VARCHAR"),
                ("", "lot_code", "VARCHAR(100)"),
                ("", "stocked_quantity", "INT DEFAULT 0"),
                ("", "stock_status", "VARCHAR(50)"),
                ("", "quality_grade", "VARCHAR(50)"),
                ("", "harvest_hygiene", "VARCHAR(50)"),
                ("", "revenue", "DECIMAL(12,2)"),
            ],
        ),
        (
            "products",
            "9. products (สินค้าและสต็อกพร้อมขาย)",
            "shop",
            1040,
            750,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "plot_id", "INT NULL"),
                ("", "name", "VARCHAR(255)"),
                ("", "category", "VARCHAR(100)"),
                ("", "price", "DECIMAL(10,2)"),
                ("", "unit", "VARCHAR(50)"),
                ("", "stock_quantity", "DECIMAL(10,2)"),
                ("", "image_url", "TEXT"),
                ("", "status", "VARCHAR(50)"),
            ],
        ),
        (
            "product_recommendations",
            "14. product_recommendations (แนะนำคู่กัน)",
            "shop",
            1040,
            1020,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "product_id", "INT NOT NULL"),
                ("FK", "recommended_product_id", "INT NOT NULL"),
                ("", "score", "DECIMAL(5,4)"),
                ("", "reason", "VARCHAR(255)"),
            ],
        ),
        (
            "order_items",
            "13. order_items (รายการสินค้าในออเดอร์)",
            "shop",
            1040,
            1210,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "order_id", "INT NOT NULL"),
                ("FK", "product_id", "INT NOT NULL"),
                ("", "quantity", "DECIMAL(10,2)"),
                ("", "unit_price", "DECIMAL(10,2)"),
                ("", "subtotal", "DECIMAL(10,2)"),
                ("", "harvest_date", "DATE NULL"),
                ("", "lot_code", "VARCHAR(100) NULL"),
            ],
        ),

        # ==================== COLUMN 4 (x = 1540) ====================
        (
            "customer_clusters",
            "11. customer_clusters (กลุ่มลูกค้า K-Means)",
            "ai",
            1540,
            60,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("", "cluster_name", "VARCHAR(100)"),
                ("", "description", "TEXT"),
                ("", "preferred_crops", "JSON"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "customers",
            "10. customers (ข้อมูลลูกค้าสมาชิก LINE)",
            "ai",
            1540,
            270,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "line_user_id", "VARCHAR(255)"),
                ("FK", "cluster_id", "INT NULL"),
                ("", "display_name", "VARCHAR(255)"),
                ("", "picture_url", "TEXT"),
                ("", "phone", "VARCHAR(50)"),
                ("", "address", "TEXT"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "orders",
            "12. orders (คำสั่งซื้อสินค้าออนไลน์)",
            "shop",
            1540,
            540,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "order_code", "VARCHAR(50)"),
                ("FK", "customer_id", "INT NOT NULL"),
                ("", "total_amount", "DECIMAL(12,2)"),
                ("", "status", "VARCHAR(50)"),
                ("", "delivery_type", "VARCHAR(50)"),
                ("", "payment_method", "VARCHAR(50)"),
                ("", "slip_image_url", "LONGTEXT"),
                ("", "recipient_name", "VARCHAR(255)"),
                ("", "recipient_phone", "VARCHAR(50)"),
                ("", "recipient_address", "TEXT"),
                ("", "notes", "TEXT"),
            ],
        ),
        (
            "line_chat_sessions",
            "15. line_chat_sessions (เซสชันแชท LINE)",
            "ai",
            1540,
            900,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "line_user_id", "VARCHAR(255)"),
                ("FK", "order_id", "INT NULL"),
                ("", "state", "VARCHAR(50)"),
                ("", "draft_data", "JSON NULL"),
                ("", "updated_at", "TIMESTAMP"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "storage_logs",
            "16. storage_logs (การจัดเก็บและขนส่ง)",
            "gap",
            1540,
            1150,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "order_id", "INT NULL"),
                ("", "log_date", "DATE NOT NULL"),
                ("", "storage_location", "VARCHAR(255)"),
                ("", "shipped_to / buyer", "VARCHAR(255)"),
                ("", "vehicle", "VARCHAR(255)"),
                ("", "vehicle_clean_status", "BOOLEAN"),
                ("", "delivery_condition", "VARCHAR(50)"),
            ],
        ),
    ]

    # Store row center Y coordinates and cell IDs so edges connect to the EXACT row!
    row_cell_map = {}   # (table_name, field_name) -> cell_id
    row_y_map = {}      # (table_name, field_name) -> absolute_center_y
    table_x_map = {}    # table_name -> (left_x, right_x)

    for tbl_name, title, dom, x, y, fields in tables:
        hdr_fill, stroke_col, body_fill, hdr_font = palettes[dom]
        total_h = HDR_H + len(fields) * ROW_H
        table_x_map[tbl_name] = (x, x + TABLE_W)

        tbl_id = f"tbl_{tbl_name}"
        tbl_style = (
            f"swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize={HDR_H};"
            f"horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;"
            f"marginBottom=0;whiteSpace=wrap;html=1;fillColor={hdr_fill};strokeColor={stroke_col};"
            f"fontColor={hdr_font};fontFamily=Tahoma;fontSize=12;swimlaneFillColor={body_fill};"
            f"rounded=1;arcSize=4;strokeWidth=1.5;"
        )
        tbl_cell = ET.SubElement(
            root,
            "mxCell",
            id=tbl_id,
            value=title,
            style=tbl_style,
            vertex="1",
            parent="1",
        )
        ET.SubElement(
            tbl_cell,
            "mxGeometry",
            x=str(x),
            y=str(y),
            width=str(TABLE_W),
            height=str(total_h),
            **{"as": "geometry"},
        )

        for idx, (ktype, fname, dtype) in enumerate(fields):
            row_id = f"{tbl_id}__{fname.split()[0]}"
            row_cell_map[(tbl_name, fname)] = row_id
            row_y_map[(tbl_name, fname)] = y + HDR_H + idx * ROW_H + (ROW_H // 2)

            prefix = f"[{ktype}] " if ktype else "        "
            label = f"{prefix}{fname} : {dtype}"
            is_pk = ktype == "PK"
            is_fk = ktype in ("FK", "UK")
            font_style = "1" if is_pk else ("2" if is_fk else "0")
            txt_color = "#991B1B" if is_pk else ("#1E40AF" if is_fk else "#1E293B")
            row_style = (
                f"text;strokeColor={stroke_col};fillColor=none;spacingLeft=8;spacingRight=6;"
                f"overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
                f"fontFamily=Tahoma;fontSize=11;fontStyle={font_style};fontColor={txt_color};"
                f"whiteSpace=wrap;html=1;"
            )
            row_cell = ET.SubElement(
                root,
                "mxCell",
                id=row_id,
                value=label,
                style=row_style,
                vertex="1",
                parent=tbl_id,
            )
            ET.SubElement(
                row_cell,
                "mxGeometry",
                y=str(HDR_H + idx * ROW_H),
                width=str(TABLE_W),
                height=str(ROW_H),
                **{"as": "geometry"},
            )

    def add_row_edge(eid, src_tbl, src_field, tgt_tbl, tgt_field, src_side, tgt_side, lane_x, color="#334155"):
        """
        Connects EXACT row (src_tbl.src_field) to EXACT row (tgt_tbl.tgt_field),
        exiting horizontally from src_side ('left' or 'right'), traveling vertically
        along the dedicated empty corridor at x = lane_x, and entering tgt_side ('left' or 'right').
        Never crosses through any table box!
        """
        src_cid = row_cell_map[(src_tbl, src_field)]
        tgt_cid = row_cell_map[(tgt_tbl, tgt_field)]
        sy = row_y_map[(src_tbl, src_field)]
        ty = row_y_map[(tgt_tbl, tgt_field)]

        ex = "1" if src_side == "right" else "0"
        enx = "1" if tgt_side == "right" else "0"

        estyle = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
            f"exitX={ex};exitY=0.5;exitDx=0;exitDy=0;entryX={enx};entryY=0.5;entryDx=0;entryDy=0;"
            f"startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;"
            f"strokeColor={color};strokeWidth=1.5;"
        )
        ecell = ET.SubElement(
            root,
            "mxCell",
            id=eid,
            value="",
            style=estyle,
            edge="1",
            parent="1",
            source=src_cid,
            target=tgt_cid,
        )
        geom = ET.SubElement(ecell, "mxGeometry", relative="1", **{"as": "geometry"})
        arr = ET.SubElement(geom, "Array", **{"as": "points"})
        if isinstance(lane_x, list):
            for pt_x, pt_y in lane_x:
                ET.SubElement(arr, "mxPoint", x=str(pt_x), y=str(pt_y))
        else:
            ET.SubElement(arr, "mxPoint", x=str(lane_x), y=str(sy))
            ET.SubElement(arr, "mxPoint", x=str(lane_x), y=str(ty))

    # =========================================================================
    # Exact Row-to-Row Foreign Key Relationships in Dedicated Vertical Lanes
    # =========================================================================
    # 1. Left Margin Lanes (x = 20..45) for users.id -> Col 1 tables
    add_row_edge("fk_u_crops", "users", "id", "crops", "user_id", "left", "left", lane_x=35, color="#166534")
    add_row_edge("fk_u_costs", "users", "id", "cost_logs", "user_id", "left", "left", lane_x=20, color="#166534")

    # 2. Corridor 1 Lanes (x = 390..525, between Col 1 [370] and Col 2 [540])
    add_row_edge("fk_u_plots", "users", "id", "plots", "user_id", "right", "left", lane_x=400, color="#166534")
    add_row_edge("fk_u_batches", "users", "id", "planting_batches", "user_id", "right", "left", lane_x=415, color="#166534")
    add_row_edge("fk_crops_batches", "crops", "id", "planting_batches", "crop_id", "right", "left", lane_x=435, color="#166534")
    add_row_edge("fk_plots_costs", "plots", "id", "cost_logs", "plot_id", "left", "right", lane_x=455, color="#0F766E")
    add_row_edge("fk_plots_batches", "plots", "id", "planting_batches", "plot_id", "left", "left", lane_x=480, color="#166534")
    add_row_edge("fk_plots_act", "plots", "id", "crop_activities", "plot_id", "left", "left", lane_x=495, color="#166534")
    add_row_edge("fk_batches_act", "planting_batches", "id", "crop_activities", "batch_id", "left", "left", lane_x=510, color="#166534")
    add_row_edge("fk_batches_pests", "planting_batches", "id", "pest_logs", "batch_id", "left", "left", lane_x=522, color="#0F766E")

    # 3. Corridor 2 Lanes (x = 865..1015, between Col 2 [850] and Col 3 [1040])
    add_row_edge("fk_plots_chem", "plots", "id", "chemical_logs", "plot_id", "right", "left", lane_x=880, color="#0F766E")
    add_row_edge("fk_plots_harvest", "plots", "id", "harvest_logs", "plot_id", "right", "left", lane_x=900, color="#0F766E")
    add_row_edge("fk_plots_products", "plots", "id", "products", "plot_id", "right", "left", lane_x=920, color="#1E40AF")
    add_row_edge("fk_plots_pests", "plots", "id", "pest_logs", "plot_id", "right", "right", lane_x=865, color="#0F766E")
    add_row_edge("fk_batches_chem", "planting_batches", "id", "chemical_logs", "batch_id", "right", "left", lane_x=932, color="#0F766E")
    add_row_edge("fk_batches_harvest", "planting_batches", "id", "harvest_logs", "batch_id", "right", "left", lane_x=945, color="#0F766E")
    add_row_edge("fk_products_harvest", "products", "id", "harvest_logs", "product_id", "left", "left", lane_x=960, color="#1E40AF")
    add_row_edge("fk_products_rec1", "products", "id", "product_recommendations", "product_id", "left", "left", lane_x=980, color="#1E40AF")
    add_row_edge("fk_products_rec2", "products", "id", "product_recommendations", "recommended_product_id", "left", "left", lane_x=995, color="#1E40AF")
    add_row_edge("fk_products_items", "products", "id", "order_items", "product_id", "left", "left", lane_x=1012, color="#1E40AF")

    # 4. Corridor 3 Lanes (x = 1380..1510, between Col 3 [1350] and Col 4 [1540])
    add_row_edge("fk_clusters_cust", "customer_clusters", "id", "customers", "cluster_id", "left", "left", lane_x=1490, color="#6B21A8")
    add_row_edge("fk_cust_orders", "customers", "id", "orders", "customer_id", "left", "left", lane_x=1470, color="#1E40AF")
    add_row_edge("fk_orders_chat", "orders", "id", "line_chat_sessions", "order_id", "left", "left", lane_x=1450, color="#6B21A8")
    add_row_edge("fk_orders_storage", "orders", "id", "storage_logs", "order_id", "left", "left", lane_x=1430, color="#0F766E")
    add_row_edge("fk_orders_items", "orders", "id", "order_items", "order_id", "left", "right", lane_x=1395, color="#1E40AF")

    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ")
    tree.write(OUT_DRAWIO, encoding="utf-8", xml_declaration=True)
    print(f"Successfully updated {OUT_DRAWIO} with cleaned schema and row-to-row connections!")


if __name__ == "__main__":
    build_drawio_er()
