import os
import xml.etree.ElementTree as ET

OUT_DRAWIO = r"c:\forwork\Web\farmgap\farmgap\erdiagram.drawio"


def build_drawio_er():
    mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")
    diagram = ET.SubElement(mxfile, "diagram", id="farmgap-er-real-schema", name="FarmGAP ER Diagram (18 Tables from schema.sql)")
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        dx="1850",
        dy="1280",
        grid="1",
        gridSize="10",
        guides="1",
        tooltips="1",
        connect="1",
        arrows="1",
        fold="1",
        page="1",
        pageScale="1",
        pageWidth="1750",
        pageHeight="1320",
        background="#FFFFFF",
        math="0",
        shadow="0",
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")

    # Domain color palettes (Header fill, Header stroke, Body fill, Header font color)
    palettes = {
        "core": ("#166534", "#14532D", "#F0FDF4", "#FFFFFF"),     # Green: Farm Users, Crops, Plots, Batches, Activities
        "gap": ("#0F766E", "#115E59", "#F0FDFA", "#FFFFFF"),      # Teal: GAP Logs (Chemicals, Pests, Harvests, Storage, Costs, Audit)
        "shop": ("#1E40AF", "#1E3A8A", "#EFF6FF", "#FFFFFF"),     # Blue: E-Commerce (Products, Orders, Order Items, Recommendations)
        "ai": ("#6B21A8", "#581C87", "#FAF5FF", "#FFFFFF"),       # Purple: LINE OA & AI (Customers, Customer Clusters, LINE Chat Sessions)
    }

    # Exact 18 Tables from backend/db/schema.sql & README.md
    # Format: (table_id, title, domain, x, y, fields[(key_type, field_name, data_type)])
    tables = [
        # ==================== COLUMN 1: Users, Crops, Audit, Costs, Storage (x = 40) ====================
        (
            "tbl_users",
            "1. users (ผู้ใช้งานระบบฟาร์ม)",
            "core",
            40,
            40,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "email", "VARCHAR(255)"),
                ("", "password_hash", "VARCHAR(255)"),
                ("", "display_name", "VARCHAR(255)"),
                ("", "farm_name", "VARCHAR(255)"),
                ("", "role", "ENUM('owner','worker')"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "tbl_crops",
            "2. crops (คลังข้อมูลชนิดผัก)",
            "core",
            40,
            280,
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
            "tbl_cost_logs",
            "17. cost_logs (บัญชีต้นทุนการเกษตร)",
            "gap",
            40,
            580,
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
            "tbl_storage_logs",
            "16. storage_logs (การจัดเก็บและขนส่ง)",
            "gap",
            40,
            820,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "harvest_id", "INT"),
                ("", "log_date", "DATE NOT NULL"),
                ("", "storage_location", "VARCHAR(255)"),
                ("", "shipped_to / buyer", "VARCHAR(255)"),
                ("", "vehicle", "VARCHAR(255)"),
                ("", "vehicle_clean_status", "BOOLEAN"),
                ("", "delivery_condition", "VARCHAR(50)"),
            ],
        ),
        (
            "tbl_audit_logs",
            "18. audit_logs (ประวัติแก้ไขข้อมูล)",
            "gap",
            40,
            1080,
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

        # ==================== COLUMN 2: Plots, Planting Batches, Crop Activities, Pest Logs (x = 470) ====================
        (
            "tbl_plots",
            "3. plots (แปลงปลูกและแคร่ปลูก)",
            "core",
            470,
            40,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("", "plot_number", "INT DEFAULT 1"),
                ("", "name", "VARCHAR(255)"),
                ("", "dimension", "VARCHAR(100)"),
                ("", "soil_recipe", "TEXT"),
                ("", "soil_prep_date", "DATE"),
                ("", "seed_prep_date", "DATE"),
                ("", "seed_crop_id", "INT"),
                ("", "crop_name", "VARCHAR(255)"),
                ("", "area_sqm", "DECIMAL(10,2)"),
                ("", "planting_date", "DATE"),
                ("", "expected_harvest_date", "DATE"),
                ("", "field_safety_status", "VARCHAR(50)"),
                ("", "status", "VARCHAR(50)"),
                ("", "current_batch_id", "INT NULL"),
            ],
        ),
        (
            "tbl_planting_batches",
            "4. planting_batches (รอบการปลูกพืช)",
            "core",
            470,
            470,
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
            "tbl_crop_activities",
            "5. crop_activities (กิจกรรมในแปลง)",
            "core",
            470,
            840,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
                ("FK", "batch_id", "INT NULL"),
                ("", "activity_date", "DATE NOT NULL"),
                ("", "stage", "VARCHAR(50)"),
                ("", "title", "VARCHAR(255)"),
                ("", "materials_used", "TEXT"),
                ("", "operator_name", "VARCHAR(255)"),
                ("", "source_type / source_id", "VARCHAR / INT"),
            ],
        ),
        (
            "tbl_pest_logs",
            "7. pest_logs (สำรวจโรคและแมลง)",
            "gap",
            470,
            1120,
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

        # ==================== COLUMN 3: Chemical Logs, Harvest Logs, Products, Recommendations, Order Items (x = 920) ====================
        (
            "tbl_chemical_logs",
            "6. chemical_logs (ปุ๋ย/สารเคมี & PHI)",
            "gap",
            920,
            40,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "user_id", "INT NOT NULL"),
                ("FK", "plot_id", "INT NOT NULL"),
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
            "tbl_harvest_logs",
            "8. harvest_logs (บันทึกเก็บเกี่ยว & Lot)",
            "gap",
            920,
            340,
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
            "tbl_products",
            "9. products (สินค้าและสต็อกพร้อมขาย)",
            "shop",
            920,
            690,
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
            "tbl_product_recommendations",
            "14. product_recommendations (แนะนำคู่กัน)",
            "shop",
            920,
            950,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "product_id", "INT NOT NULL"),
                ("FK", "recommended_product_id", "INT NOT NULL"),
                ("", "score", "DECIMAL(5,4)"),
                ("", "reason", "VARCHAR(255)"),
            ],
        ),
        (
            "tbl_order_items",
            "13. order_items (รายการสินค้าในออเดอร์)",
            "shop",
            920,
            1140,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("FK", "order_id", "INT NOT NULL"),
                ("FK", "product_id", "INT NOT NULL"),
                ("", "quantity", "DECIMAL(10,2)"),
                ("", "unit_price", "DECIMAL(10,2)"),
                ("", "subtotal", "DECIMAL(10,2)"),
            ],
        ),

        # ==================== COLUMN 4: Customer Clusters, Customers, Orders, LINE Chat Sessions (x = 1370) ====================
        (
            "tbl_customer_clusters",
            "11. customer_clusters (กลุ่มลูกค้า K-Means)",
            "ai",
            1370,
            80,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("", "cluster_name", "VARCHAR(100)"),
                ("", "description", "TEXT"),
                ("", "preferred_crops", "JSON"),
                ("", "created_at", "TIMESTAMP"),
            ],
        ),
        (
            "tbl_customers",
            "10. customers (ข้อมูลลูกค้าสมาชิก LINE)",
            "ai",
            1370,
            300,
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
            "tbl_orders",
            "12. orders (คำสั่งซื้อสินค้าออนไลน์)",
            "shop",
            1370,
            580,
            [
                ("PK", "id", "INT AUTO_INCREMENT"),
                ("UK", "order_code", "VARCHAR(50)"),
                ("FK", "customer_id", "INT NOT NULL"),
                ("", "total_amount", "DECIMAL(12,2)"),
                ("", "status", "VARCHAR(50)"),
                ("", "delivery_type", "VARCHAR(50)"),
                ("", "payment_method", "VARCHAR(50)"),
                ("", "delivery_date", "DATE"),
                ("", "slip_image_url", "LONGTEXT"),
                ("", "tracking_number", "VARCHAR(100)"),
                ("", "notes", "TEXT"),
            ],
        ),
        (
            "tbl_line_chat_sessions",
            "15. line_chat_sessions (เซสชันแชท LINE)",
            "ai",
            1370,
            940,
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
    ]

    TABLE_W = 320
    HDR_H = 30
    ROW_H = 21

    for tbl_id, title, dom, x, y, fields in tables:
        hdr_fill, stroke_col, body_fill, hdr_font = palettes[dom]
        total_h = HDR_H + len(fields) * ROW_H

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
            row_id = f"{tbl_id}_r{idx}"
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

    # Relationships matching backend/db/schema.sql & README.md
    edges = [
        ("e_u_plots", "tbl_users", "tbl_plots", "1", "0.3", "0", "0.15"),
        ("e_u_crops", "tbl_users", "tbl_crops", "0.5", "1", "0.5", "0"),
        ("e_u_batches", "tbl_users", "tbl_planting_batches", "1", "0.7", "0", "0.15"),
        ("e_u_costs", "tbl_users", "tbl_cost_logs", "0.2", "1", "0.2", "0"),
        ("e_u_storage", "tbl_users", "tbl_storage_logs", "0.1", "1", "0.1", "0"),
        ("e_crops_batches", "tbl_crops", "tbl_planting_batches", "1", "0.6", "0", "0.35"),
        ("e_plots_batches", "tbl_plots", "tbl_planting_batches", "0.5", "1", "0.5", "0"),
        ("e_plots_act", "tbl_plots", "tbl_crop_activities", "0.2", "1", "0.2", "0"),
        ("e_batches_act", "tbl_planting_batches", "tbl_crop_activities", "0.5", "1", "0.5", "0"),
        ("e_batches_pests", "tbl_planting_batches", "tbl_pest_logs", "0.8", "1", "0.8", "0"),
        ("e_plots_chem", "tbl_plots", "tbl_chemical_logs", "1", "0.25", "0", "0.3"),
        ("e_plots_harvest", "tbl_plots", "tbl_harvest_logs", "1", "0.65", "0", "0.25"),
        ("e_batches_harvest", "tbl_planting_batches", "tbl_harvest_logs", "1", "0.3", "0", "0.5"),
        ("e_harvest_storage", "tbl_harvest_logs", "tbl_storage_logs", "0", "0.8", "1", "0.3"),
        ("e_plots_costs", "tbl_plots", "tbl_cost_logs", "0", "0.85", "1", "0.3"),
        ("e_plots_products", "tbl_plots", "tbl_products", "1", "0.9", "0", "0.25"),
        ("e_harvest_products", "tbl_harvest_logs", "tbl_products", "0.5", "1", "0.5", "0"),
        ("e_prod_rec", "tbl_products", "tbl_product_recommendations", "0.5", "1", "0.5", "0"),
        ("e_prod_items", "tbl_products", "tbl_order_items", "0.8", "1", "0.8", "0"),
        ("e_clust_cust", "tbl_customer_clusters", "tbl_customers", "0.5", "1", "0.5", "0"),
        ("e_cust_orders", "tbl_customers", "tbl_orders", "0.5", "1", "0.5", "0"),
        ("e_orders_items", "tbl_orders", "tbl_order_items", "0", "0.85", "1", "0.5"),
        ("e_orders_chat", "tbl_orders", "tbl_line_chat_sessions", "0.5", "1", "0.5", "0"),
    ]

    for eid, src, tgt, ex, ey, enx, eny in edges:
        estyle = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
            f"exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={enx};entryY={eny};entryDx=0;entryDy=0;"
            f"startArrow=ERmandOne;startFill=0;endArrow=ERmany;endFill=0;"
            f"strokeColor=#334155;strokeWidth=1.4;"
        )
        ecell = ET.SubElement(
            root,
            "mxCell",
            id=eid,
            value="",
            style=estyle,
            edge="1",
            parent="1",
            source=src,
            target=tgt,
        )
        ET.SubElement(ecell, "mxGeometry", relative="1", **{"as": "geometry"})

    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ")
    tree.write(OUT_DRAWIO, encoding="utf-8", xml_declaration=True)
    print(f"Successfully updated {OUT_DRAWIO} with exact 18 tables from backend/db/schema.sql!")


if __name__ == "__main__":
    build_drawio_er()
