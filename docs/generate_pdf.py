# Pure Python PDF 1.4 Generator for Flux CRM API Documentation
import os
import sys

class PDFDocument:
    def __init__(self):
        self.objects = []
        self.pages = []
        self.page_contents = []
        self.current_content = []
        self.page_width = 595.28  # A4
        self.page_height = 841.89 # A4
        self.margin_left = 50.0
        self.margin_right = 50.0
        self.margin_top = 50.0
        self.margin_bottom = 50.0
        self.cursor_y = self.page_height - self.margin_top
        self.content_width = self.page_width - self.margin_left - self.margin_right
        self.new_page()

    def new_page(self):
        if self.current_content:
            self.page_contents.append("".join(self.current_content))
            self.current_content = []
        self.cursor_y = self.page_height - self.margin_top - 20
        # Draw header on subsequent pages
        page_num = len(self.page_contents) + 1
        if page_num > 1:
            self.draw_page_header(page_num)

    def draw_page_header(self, page_num):
        header = (
            f"q 0.12 0.23 0.54 rg 0 0 0 RG 0.5 w "
            f"{self.margin_left} {self.page_height - 35} m {self.page_width - self.margin_right} {self.page_height - 35} l S "
            f"BT /F1 8 Tf {self.margin_left} {self.page_height - 30} Td (FLUX CRM - REST API SPECIFICATION) Tj ET "
            f"BT /F1 8 Tf {self.page_width - self.margin_right - 60} {self.page_height - 30} Td (Page {page_num}) Tj ET Q\n"
        )
        self.current_content.append(header)

    def draw_page_footer(self, page_num, total_pages):
        footer = (
            f"q 0.5 0.5 0.5 rg 0.7 0.7 0.7 RG 0.5 w "
            f"{self.margin_left} 40 m {self.page_width - self.margin_right} 40 l S "
            f"BT /F1 8 Tf {self.margin_left} 28 Td (Confidential - For Internal & Mobile Development Use Only) Tj ET "
            f"BT /F1 8 Tf {self.page_width - self.margin_right - 60} 28 Td (Page {page_num} of {total_pages}) Tj ET Q\n"
        )
        return footer

    def check_space(self, height_needed):
        if self.cursor_y - height_needed < self.margin_bottom + 30:
            self.new_page()

    def add_title_page(self):
        # Draw decorative banner
        self.current_content.append(
            f"q 0.08 0.18 0.45 rg {self.margin_left} {self.page_height - 220} {self.content_width} 160 re f Q\n"
        )
        # Title text inside banner
        self.current_content.append(
            f"q 1 1 1 rg BT /F2 26 Tf {self.margin_left + 25} {self.page_height - 110} Td (FLUX CRM) Tj ET "
            f"BT /F2 16 Tf {self.margin_left + 25} {self.page_height - 145} Td (REST API Reference & Mobile Manual) Tj ET "
            f"BT /F1 10 Tf {self.margin_left + 25} {self.page_height - 180} Td (Verified Django REST Framework Backend Contract | Version 1.0.0) Tj ET Q\n"
        )
        self.cursor_y = self.page_height - 250

        # Metadata box
        meta_y = self.cursor_y - 120
        self.current_content.append(
            f"q 0.96 0.97 0.99 rg {self.margin_left} {meta_y} {self.content_width} 110 re f "
            f"0.8 0.85 0.92 RG 1 w {self.margin_left} {meta_y} {self.content_width} 110 re S "
            f"0.15 0.25 0.4 rg "
            f"BT /F2 11 Tf {self.margin_left + 15} {meta_y + 85} Td (SYSTEM SPECIFICATIONS) Tj ET "
            f"BT /F1 9 Tf {self.margin_left + 15} {meta_y + 65} Td (Backend Engine: Django 4.2 / Django REST Framework 3.14) Tj ET "
            f"BT /F1 9 Tf {self.margin_left + 15} {meta_y + 48} Td (Database Engine: MariaDB / MySQL \\(impression_inventory\\)) Tj ET "
            f"BT /F1 9 Tf {self.margin_left + 15} {meta_y + 31} Td (Authentication: DRF Token Authentication \\(Basic Auth exchange at /api/login/\\)) Tj ET "
            f"BT /F1 9 Tf {self.margin_left + 15} {meta_y + 14} Td (Target Mobile Clients: Flutter \\(Android API 21+ / iOS 13+\\)) Tj ET Q\n"
        )
        self.cursor_y = meta_y - 30

        # Executive overview
        self.add_heading("1. Executive Summary & Architecture", level=1)
        self.add_paragraph(
            "This document is the authoritative, source-code-verified API specification for the Flux CRM module. "
            "All endpoints documented herein are verified against active Django views and tested for strict parity "
            "between the existing React web application and the new Flutter mobile application."
        )
        self.add_paragraph(
            "The mobile application connects directly to the existing backend without database duplication or schema modification. "
            "All existing CRM leads, segments, assignments, task groups, individual staff work activities, and chronological "
            "communication history are shared seamlessly across web and mobile interfaces."
        )
        self.new_page()

    def add_heading(self, text, level=1):
        if level == 1:
            self.check_space(50)
            self.cursor_y -= 15
            # Draw section marker
            self.current_content.append(
                f"q 0.12 0.23 0.54 rg {self.margin_left} {self.cursor_y - 4} 4 18 re f Q\n"
            )
            clean_text = self.escape_text(text)
            self.current_content.append(
                f"BT /F2 14 Tf 0.1 0.15 0.35 rg {self.margin_left + 12} {self.cursor_y} Td ({clean_text}) Tj ET\n"
            )
            self.cursor_y -= 22
        elif level == 2:
            self.check_space(35)
            self.cursor_y -= 10
            clean_text = self.escape_text(text)
            self.current_content.append(
                f"BT /F2 11 Tf 0.15 0.25 0.5 rg {self.margin_left} {self.cursor_y} Td ({clean_text}) Tj ET\n"
            )
            self.cursor_y -= 16
        else:
            self.check_space(25)
            clean_text = self.escape_text(text)
            self.current_content.append(
                f"BT /F2 9.5 Tf 0.2 0.2 0.2 rg {self.margin_left} {self.cursor_y} Td ({clean_text}) Tj ET\n"
            )
            self.cursor_y -= 14

    def add_paragraph(self, text):
        clean_text = self.escape_text(text)
        words = clean_text.split()
        lines = []
        cur_line = []
        for word in words:
            cur_line.append(word)
            if len(" ".join(cur_line)) > 95:
                lines.append(" ".join(cur_line[:-1]))
                cur_line = [word]
        if cur_line:
            lines.append(" ".join(cur_line))

        self.check_space(len(lines) * 12 + 6)
        for line in lines:
            self.current_content.append(
                f"BT /F1 8.5 Tf 0.15 0.15 0.15 rg {self.margin_left} {self.cursor_y} Td ({line}) Tj ET\n"
            )
            self.cursor_y -= 12
        self.cursor_y -= 4

    def add_endpoint_card(self, method, url, title, auth, desc, req_body=None, resp_body=None):
        card_est_height = 80 + (25 if req_body else 0) + (35 if resp_body else 0)
        self.check_space(card_est_height)

        top_y = self.cursor_y
        method_colors = {
            'GET': (0.1, 0.5, 0.2),      # Green
            'POST': (0.12, 0.35, 0.8),   # Blue
            'PUT': (0.8, 0.45, 0.1),     # Orange
            'PATCH': (0.6, 0.3, 0.7),    # Purple
            'DELETE': (0.8, 0.15, 0.15), # Red
        }
        mc = method_colors.get(method.upper(), (0.3, 0.3, 0.3))

        # Endpoint title & badge
        self.current_content.append(
            f"q {mc[0]} {mc[1]} {mc[2]} rg {self.margin_left} {self.cursor_y - 2} 48 14 re f Q "
            f"q 1 1 1 rg BT /F2 8 Tf {self.margin_left + 8} {self.cursor_y + 2} Td ({method}) Tj ET Q "
            f"q 0.1 0.1 0.1 rg BT /F2 9.5 Tf {self.margin_left + 55} {self.cursor_y + 2} Td ({self.escape_text(url)}) Tj ET Q\n"
        )
        self.cursor_y -= 18

        # Details table
        auth_badge = "Required (Token <token>)" if auth else "Public (Basic Auth)"
        self.current_content.append(
            f"BT /F2 8 Tf 0.3 0.3 0.3 rg {self.margin_left + 10} {self.cursor_y} Td (Function:) Tj ET "
            f"BT /F1 8 Tf 0.1 0.1 0.1 rg {self.margin_left + 70} {self.cursor_y} Td ({self.escape_text(title)}) Tj ET "
            f"BT /F2 8 Tf 0.3 0.3 0.3 rg {self.margin_left + 300} {self.cursor_y} Td (Auth:) Tj ET "
            f"BT /F1 8 Tf 0.1 0.1 0.1 rg {self.margin_left + 335} {self.cursor_y} Td ({self.escape_text(auth_badge)}) Tj ET\n"
        )
        self.cursor_y -= 13

        if desc:
            self.current_content.append(
                f"BT /F2 8 Tf 0.3 0.3 0.3 rg {self.margin_left + 10} {self.cursor_y} Td (Details:) Tj ET "
                f"BT /F1 8 Tf 0.15 0.15 0.15 rg {self.margin_left + 70} {self.cursor_y} Td ({self.escape_text(desc[:85])}) Tj ET\n"
            )
            self.cursor_y -= 14

        # Request / Response snippets in Courier font
        if req_body:
            self.check_space(25)
            self.current_content.append(
                f"q 0.95 0.96 0.98 rg {self.margin_left + 10} {self.cursor_y - 4} {self.content_width - 20} 14 re f Q "
                f"BT /F3 7.5 Tf 0.1 0.2 0.5 rg {self.margin_left + 15} {self.cursor_y} Td (Payload: {self.escape_text(req_body[:90])}) Tj ET\n"
            )
            self.cursor_y -= 18

        if resp_body:
            self.check_space(25)
            self.current_content.append(
                f"q 0.95 0.98 0.95 rg {self.margin_left + 10} {self.cursor_y - 4} {self.content_width - 20} 14 re f Q "
                f"BT /F3 7.5 Tf 0.05 0.45 0.15 rg {self.margin_left + 15} {self.cursor_y} Td (200 OK: {self.escape_text(resp_body[:90])}) Tj ET\n"
            )
            self.cursor_y -= 18

        self.cursor_y -= 6

    def escape_text(self, s):
        if not s:
            return ""
        replacements = {
            '\u2013': '-',
            '\u2014': '--',
            '\u2018': "'",
            '\u2019': "'",
            '\u201c': '"',
            '\u201d': '"',
            '\u2026': '...',
            '\xa0': ' ',
            '\u2022': '*',
            '°': ' deg',
        }
        res = str(s)
        for k, v in replacements.items():
            res = res.replace(k, v)
        res = res.encode('ascii', errors='replace').decode('ascii')
        return res.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace("\r", " ").replace("\n", " ")

    def build(self, output_path):
        if self.current_content:
            self.page_contents.append("".join(self.current_content))
            self.current_content = []

        total_pages = len(self.page_contents)
        # Append footers to each page
        final_page_streams = []
        for i, stream in enumerate(self.page_contents):
            footer = self.draw_page_footer(i + 1, total_pages)
            final_page_streams.append(stream + footer)

        # Build PDF structure
        # Object 1: Catalog
        # Object 2: Outlines
        # Object 3: Pages
        # Object 4: Font F1 (Helvetica)
        # Object 5: Font F2 (Helvetica-Bold)
        # Object 6: Font F3 (Courier)
        # Subsequent objects: Page and Content stream pairs
        objs = []
        catalog = "<< /Type /Catalog /Pages 3 0 R >>"
        outlines = "<< /Type /Outlines /Count 0 >>"
        font_f1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        font_f2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
        font_f3 = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"

        objs.append(catalog)  # 1
        objs.append(outlines) # 2
        objs.append(None)     # 3 (Pages, filled below)
        objs.append(font_f1)  # 4
        objs.append(font_f2)  # 5
        objs.append(font_f3)  # 6

        page_obj_ids = []
        content_obj_ids = []

        next_id = 7
        for _ in range(total_pages):
            page_id = next_id
            content_id = next_id + 1
            page_obj_ids.append(page_id)
            content_obj_ids.append(content_id)
            next_id += 2

        # Fill Pages object (3)
        kids_str = " ".join([f"{pid} 0 R" for pid in page_obj_ids])
        pages_obj = f"<< /Type /Pages /Kids [{kids_str}] /Count {total_pages} >>"
        objs[2] = pages_obj

        # Add Page and Content objects
        for i in range(total_pages):
            content_stream = final_page_streams[i]
            stream_len = len(content_stream.encode('latin1', errors='replace'))
            page_obj = (
                f"<< /Type /Page /Parent 3 0 R /MediaBox [0 0 {self.page_width:.2f} {self.page_height:.2f}] "
                f"/Contents {content_obj_ids[i]} 0 R "
                f"/Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> >>"
            )
            content_obj = f"<< /Length {stream_len} >>\nstream\n{content_stream}endstream"
            objs.append(page_obj)
            objs.append(content_obj)

        # Compile PDF bytes and xref
        output = []
        output.append("%PDF-1.4\n")
        output.append("%\xe2\xe3\xcf\xd3\n")

        offsets = []
        cur_offset = sum(len(x.encode('latin1')) for x in output)

        for i, obj_content in enumerate(objs):
            obj_num = i + 1
            offsets.append(cur_offset)
            s = f"{obj_num} 0 obj\n{obj_content}\nendobj\n"
            output.append(s)
            cur_offset += len(s.encode('latin1', errors='replace'))

        xref_offset = cur_offset
        xref_str = f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n"
        for off in offsets:
            xref_str += f"{off:010d} 00000 n \n"
        output.append(xref_str)

        trailer = (
            f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        output.append(trailer)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            for item in output:
                f.write(item.encode('latin1', errors='replace'))
        print(f"Successfully generated PDF: {output_path} ({total_pages} pages, {cur_offset} bytes)")


def generate_crm_documentation_pdf(output_file):
    doc = PDFDocument()

    # Cover & Executive Summary
    doc.add_title_page()

    # SECTION 2: Authentication
    doc.add_heading("2. Authentication & Session APIs", level=1)
    doc.add_paragraph("Endpoints controlling user session initiation, credentials verification, profile resolution, and token revocation.")
    doc.add_endpoint_card("POST", "/api/login/", "Authenticate CRM User & Obtain Token", False,
                          "Verifies credentials via HTTP Basic Auth. Returns DRF Token and role.",
                          req_body='Header Authorization: Basic base64(username:password)',
                          resp_body='{"token": "9944b09199c...", "role": "Sales Executive"}')
    doc.add_endpoint_card("GET", "/api/users/me/", "Current Logged-in Staff Context", True,
                          "Returns authenticated staff profile, company affiliations, and role.",
                          resp_body='{"id": 2, "username": "bob_patel", "role": "Sales Executive", "companies": [...]}')
    doc.add_endpoint_card("POST", "/api/logout/", "Invalidate Current Session Token", True,
                          "Destroys token in database, terminating active authenticated session.",
                          resp_body='{"message": "Logged out successfully"}')
    doc.add_endpoint_card("POST", "/api/users/change-password/", "Authenticated Password Reset", True,
                          "Updates password for currently authenticated user.",
                          req_body='{"old_password": "...", "new_password": "..."}',
                          resp_body='{"message": "Password updated successfully"}')
    doc.add_endpoint_card("POST", "/api/notifications/device-token/", "Register Push Notification Token", True,
                          "Registers FCM / APNS token for mobile background notifications.",
                          req_body='{"token": "fcm_token_...", "platform": "android"}',
                          resp_body='{"message": "Device token registered successfully."}')

    # SECTION 3: Dashboard Summary
    doc.add_heading("3. CRM Dashboard Summary API", level=1)
    doc.add_paragraph("Primary landing feed providing real-time computed KPIs, activity feeds, and segment distributions.")
    doc.add_endpoint_card("GET", "/api/crm/dashboard/summary/", "Role-Scoped CRM KPI Summary", True,
                          "Returns leads count, tasks, activities, overdue follow-ups, and recent feed.",
                          resp_body='{"is_admin": true, "kpis": {"total_leads": 124, "total_tasks": 6, "completed_activities": 42}}')

    # SECTION 4: User & Role Management
    doc.add_heading("4. User & Role Management APIs", level=1)
    doc.add_paragraph("Comprehensive staff administration, role assignments, and granular RBAC permissions matrix.")
    doc.add_endpoint_card("GET", "/api/crm/users/", "List CRM Staff Members", True,
                          "Filters by search, role, and active status. Returns reporting manager details.",
                          resp_body='{"users": [{"id": 2, "full_name": "Bob Patel", "role": "Sales Executive"}], "total": 1}')
    doc.add_endpoint_card("POST", "/api/crm/users/", "Create CRM Staff Member", True,
                          "Creates User and isolated CRMUserProfile without touching base auth tables.",
                          req_body='{"username": "rahul_s", "password": "...", "role": "Sales Executive", "mobile": "9819..."}',
                          resp_body='{"message": "User created successfully.", "user": {"id": 3, "username": "rahul_s"}}')
    doc.add_endpoint_card("GET", "/api/crm/users/{id}/", "Get Staff Details", True,
                          "Retrieves full staff profile, contact number, and reporting hierarchy.",
                          resp_body='{"id": 2, "username": "bob_patel", "role": "Sales Executive", "account_status": "Active"}')
    doc.add_endpoint_card("PUT", "/api/crm/users/{id}/", "Update Staff Member Details", True,
                          "Modifies role, mobile, reporting manager, password, or active status.",
                          req_body='{"role": "Sales Manager", "mobile": "9819922222", "account_status": "Active"}',
                          resp_body='{"message": "User updated successfully."}')
    doc.add_endpoint_card("DELETE", "/api/crm/users/{id}/", "Deactivate Staff Member", True,
                          "Sets account_status to Inactive, preventing CRM access while preserving historical work.",
                          resp_body='{"message": "User deactivated successfully."}')
    doc.add_endpoint_card("GET", "/api/crm/roles/", "List CRM Roles", True,
                          "Returns distinct roles available for staff assignment.",
                          resp_body='{"roles": [{"id": 1, "role": "Sales Manager"}, {"id": 2, "role": "Sales Executive"}]}')
    doc.add_endpoint_card("GET", "/api/crm/permissions/", "Permissions Matrix", True,
                          "Returns RBAC matrix mapping modules (leads, tasks, reports) to actions.",
                          resp_body='{"modules": ["leads", "tasks", "my_work", "reports"], "matrix": {...}}')
    doc.add_endpoint_card("POST", "/api/crm/permissions/save/", "Save Permission Overrides", True,
                          "Persists role-level or user-specific permission overrides.",
                          req_body='{"role": "Sales Executive", "module": "reports", "action": "view", "allow": true}',
                          resp_body='{"message": "Permissions updated successfully."}')

    # SECTION 5: Segment Management
    doc.add_heading("5. Segment Management APIs", level=1)
    doc.add_paragraph("Classification taxonomies for grouping enterprise accounts and target market verticals.")
    doc.add_endpoint_card("GET", "/api/crm/segments/", "List All Segments", True,
                          "Returns all active segments with real-time lead counts and descriptions.",
                          resp_body='{"segments": [{"id": 1, "name": "Enterprise Pharmaceuticals", "total_leads": 42}]}')
    doc.add_endpoint_card("POST", "/api/crm/segments/", "Create Segment", True,
                          "Creates unique business segment. Prevents active duplicate names.",
                          req_body='{"name": "Medical Diagnostic Labs", "description": "Pathology centers", "is_active": true}',
                          resp_body='{"message": "Segment created successfully.", "segment": {"id": 2}}')
    doc.add_endpoint_card("PUT", "/api/crm/segments/{id}/", "Update Segment Details", True,
                          "Updates segment name and auto-syncs lead.segment across all mapped leads.",
                          req_body='{"name": "Diagnostic Laboratories", "description": "Updated scope", "is_active": true}',
                          resp_body='{"message": "Segment updated successfully."}')
    doc.add_endpoint_card("POST", "/api/crm/segments/{id}/safe-delete/", "Safe Deactivate & Migrate Leads", True,
                          "Deactivates segment safely and migrates associated leads to target or unassigned.",
                          req_body='{"action": "MOVED", "target_segment_id": 2}',
                          resp_body='{"message": "Segment deactivated successfully. 42 leads moved."}')

    # SECTION 6: Lead Management
    doc.add_heading("6. Lead Management APIs", level=1)
    doc.add_paragraph("Core prospect management, detailed company profiles, contacts, and column-wise filters.")
    doc.add_endpoint_card("GET", "/api/crm/leads/", "List Leads (Paginated & Filtered)", True,
                          "Full query support: search, company_name, contact, phone, email, city, segment, status.",
                          resp_body='{"leads": [{"id": 1, "company_name": "MedLife", "mobile_number": "9820012345"}], "total": 1}')
    doc.add_endpoint_card("POST", "/api/crm/leads/", "Create New Lead Record", True,
                          "Creates lead profile with designations, dual mobiles, emails, and address.",
                          req_body='{"company_name": "Apex Care Hospitals", "mobile": "9819987654", "city": "Ahmedabad"}',
                          resp_body='{"message": "Lead created successfully.", "lead_id": 2}')
    doc.add_endpoint_card("GET", "/api/crm/leads/{id}/", "Get Lead Detail", True,
                          "Returns complete 360-degree lead profile, assigned staff, and interaction counts.",
                          resp_body='{"id": 1, "company_name": "MedLife Diagnostics", "assigned_users": [{"id": 2, "name": "Bob"}]}')
    doc.add_endpoint_card("PUT", "/api/crm/leads/{id}/", "Update Lead Profile", True,
                          "Atomically updates company, contact, segment, and custom fields.",
                          req_body='{"company_name": "MedLife Diagnostics Pvt Ltd", "notes": "Requested volume quotation"}',
                          resp_body='{"message": "Lead updated successfully."}')
    doc.add_endpoint_card("DELETE", "/api/crm/leads/{id}/", "Delete Lead Record", True,
                          "Removes lead record if authorized. Protected by role permissions.",
                          resp_body='{"message": "Lead deleted successfully."}')

    # SECTION 7: Dynamic Excel/CSV Importer
    doc.add_heading("7. Dynamic Excel / CSV Import APIs", level=1)
    doc.add_paragraph("7-step dynamic importer with header auto-mapping, exact/partial duplicate matching, and atomic commit.")
    doc.add_endpoint_card("POST", "/api/crm/leads/import/upload/", "Upload File & Detect Columns", True,
                          "Multipart upload of .xlsx, .xls, or .csv. Returns detected headers and sample rows.",
                          req_body='Multipart Form Data: file=<binary_data>',
                          resp_body='{"headers": ["Company", "Phone", "Email"], "suggested_mapping": {"Company": "company_name"}}')
    doc.add_endpoint_card("POST", "/api/crm/leads/import/validate/", "Perform Duplicate Comparison", True,
                          "Validates mappings and detects exact phone/email duplicates or partial company matches.",
                          req_body='{"rows": [...], "column_mapping": {"Company": "company_name", "Phone": "phone"}}',
                          resp_body='{"import_token": "8f3a9e2...", "exact_duplicates": [...], "new_records_count": 22}')
    doc.add_endpoint_card("POST", "/api/crm/leads/import/commit/", "Commit Import Batch", True,
                          "Executes atomic import applying row resolutions (NEW, UPDATE, MERGE, SKIP).",
                          req_body='{"import_token": "8f3a9e2...", "rows": [...], "resolutions": {"0": "NEW", "4": "SKIP"}}',
                          resp_body='{"message": "Import completed successfully. 22 new, 1 updated, 2 skipped.", "job_id": 5}')
    doc.add_endpoint_card("GET", "/api/crm/leads/import/{job_id}/preview/", "Preview Imported Rows", True,
                          "Returns row-by-row audit details of completed import batch.",
                          resp_body='{"preview_rows": [{"row_index": 0, "company_name": "MedLife", "resolution": "NEW"}]}')
    doc.add_endpoint_card("GET", "/api/crm/leads/import/{job_id}/failed-rows/", "Get Skipped/Failed Rows", True,
                          "Returns list of skipped rows with reasons for CSV export.",
                          resp_body='{"failed_rows": [{"row_index": 4, "reason": "Duplicate phone number"}]}')

    # SECTION 8: Lead Assignment
    doc.add_heading("8. Lead Assignment APIs", level=1)
    doc.add_paragraph("Multi-to-multi lead assignments, team reassignments, and complete historical audit trails.")
    doc.add_endpoint_card("GET", "/api/crm/assignments/", "List Active Assignments", True,
                          "Returns active lead-to-staff mappings with assignment timestamps.",
                          resp_body='{"assignments": [{"id": 1, "lead_name": "MedLife", "staff_name": "Bob Patel"}]}')
    doc.add_endpoint_card("POST", "/api/crm/assignments/assign/", "Assign Leads to Staff", True,
                          "Multi-lead to multi-staff dispatch. Synchronizes both LeadAssignment and lead.assigned_to.",
                          req_body='{"lead_ids": [1, 2], "user_ids": [2, 3]}',
                          resp_body='{"message": "Successfully assigned 2 lead(s) to 2 staff member(s)."}')
    doc.add_endpoint_card("POST", "/api/crm/assignments/reassign/", "Reassign Leads with History", True,
                          "Transfers leads from one staff member to another and logs LeadAssignmentHistory.",
                          req_body='{"lead_ids": [1], "from_user_id": 2, "to_user_id": 3}',
                          resp_body='{"message": "Successfully reassigned 1 lead(s) to alice_shah."}')
    doc.add_endpoint_card("POST", "/api/crm/assignments/unassign/", "Unassign Leads", True,
                          "Removes staff association from specified leads.",
                          req_body='{"lead_ids": [1], "user_id": 2}',
                          resp_body='{"message": "Successfully unassigned 1 lead(s)."}')

    # SECTION 9: Task Management
    doc.add_heading("9. Task Management APIs", level=1)
    doc.add_paragraph("Team task group campaigns, auto-generated independent staff activities, safe editing, and soft-delete archiving.")
    doc.add_endpoint_card("GET", "/api/crm/task-groups/", "List Task Groups", True,
                          "Returns active task groups with progress percentage and assignees. Excludes Archived.",
                          resp_body='{"task_groups": [{"id": 1, "title": "Q4 Outreach", "priority": "High", "progress": 50.0}]}')
    doc.add_endpoint_card("POST", "/api/crm/task-groups/", "Create Task Group", True,
                          "Creates task group and auto-generates N x M independent activities for each staff per lead.",
                          req_body='{"title": "Q4 Outreach", "priority": "High", "staff_ids": [2, 3], "lead_ids": [1, 2]}',
                          resp_body='{"message": "Task group created successfully.", "task_group_id": 1}')
    doc.add_endpoint_card("GET", "/api/crm/task-groups/{id}/", "Get Task Group Detail", True,
                          "Returns title, dates, priority, status, assigned staff IDs, and associated lead IDs.",
                          resp_body='{"id": 1, "title": "Q4 Outreach", "staff_ids": [2], "lead_ids": [1, 2], "status": "Active"}')
    doc.add_endpoint_card("PUT", "/api/crm/task-groups/{id}/", "Edit Task Group (Preserving History)", True,
                          "Atomically updates title, dates, assignees, and leads. 100% preserves completed activities.",
                          req_body='{"title": "Q4 Outreach Extended", "priority": "Urgent", "staff_ids": [2, 4]}',
                          resp_body='{"message": "Task group updated successfully."}')
    doc.add_endpoint_card("DELETE", "/api/crm/task-groups/{id}/", "Soft-Delete Task Group", True,
                          "Sets status to 'Archived'. Guarantees zero cascade data loss for staff activities and timeline.",
                          resp_body='{"message": "Task group deleted successfully."}')

    # SECTION 10: My Work Dashboard
    doc.add_heading("10. My Work Dashboard APIs", level=1)
    doc.add_paragraph("Personalized daily execution dashboard for sales executives, follow-up scheduling, and activity logging.")
    doc.add_endpoint_card("GET", "/api/crm/my-work/", "Daily Staff Work Queue", True,
                          "Filters activities for logged-in user by date (today, yesterday, tomorrow, YYYY-MM-DD).",
                          resp_body='{"date": "2026-11-18", "activities": [{"activity_id": 1, "company_name": "MedLife"}], "summary": {...}}')
    doc.add_endpoint_card("POST", "/api/crm/my-work/activities/{id}/update/", "Update Activity & Log Timeline", True,
                          "Updates status, notes, action taken, and next follow-up. Automatically logs to 360 timeline.",
                          req_body='{"status": "Completed", "action_taken": "Call with CEO", "notes": "Approved pricing"}',
                          resp_body='{"message": "Activity updated successfully.", "activity_status": "Completed"}')
    doc.add_endpoint_card("GET", "/api/crm/my-work/follow-ups/", "List Upcoming Follow-ups", True,
                          "Returns upcoming pending follow-ups ordered by scheduled date and time.",
                          resp_body='{"followups": [{"activity_id": 1, "company_name": "MedLife", "followup_date": "2026-11-20"}]}')

    # SECTION 11: Performance Reports
    doc.add_heading("11. Performance Reports APIs", level=1)
    doc.add_paragraph("Aggregated analytics, staff performance breakdowns, task completion rates, and visual distributions.")
    doc.add_endpoint_card("GET", "/api/crm/reports/performance/", "Overall Performance Metrics", True,
                          "Completion percentage calculated as (Completed Activities / Total Activities) * 100.",
                          resp_body='{"completion_percentage": 75.0, "total_activities": 120, "completed": 90}')
    doc.add_endpoint_card("GET", "/api/crm/reports/staff/", "Staff Member Breakdown", True,
                          "Aggregates total, completed, pending, and overdue activities per staff member.",
                          resp_body='{"staff_performance": [{"user_id": 2, "user__username": "bob_patel", "completed": 10}]}')
    doc.add_endpoint_card("GET", "/api/crm/reports/task-groups/", "Task Groups Completion Report", True,
                          "Reports progress percentage for all active task groups.",
                          resp_body='{"task_groups": [{"id": 1, "title": "Q4 Outreach", "completion_percentage": 50.0}]}')
    doc.add_endpoint_card("GET", "/api/crm/reports/segments/", "Segment Distribution Analytics", True,
                          "Returns active lead counts across all business segments for chart visualization.",
                          resp_body='{"segments": [{"name": "Enterprise Pharmaceuticals", "lead_count": 68}]}')

    # SECTION 12: Quick Search & Communication Timeline
    doc.add_heading("12. Quick Lead Search & 360 Communication Timeline", level=1)
    doc.add_paragraph("High-speed indexed lead search and full chronological customer communication history.")
    doc.add_endpoint_card("GET", "/api/crm/quick-search/", "Debounced Quick Search", True,
                          "Fast indexed search matching company, contact, mobile, phone, and email.",
                          resp_body='{"results": [{"id": 1, "company_name": "MedLife", "last_interaction": "Call: Sent quote..."}]}')
    doc.add_endpoint_card("GET", "/api/crm/leads/{id}/timeline/", "360 Communication Timeline", True,
                          "Chronological log of calls, meetings, emails, WhatsApp notes, and status updates.",
                          resp_body='{"lead": {"id": 1}, "timeline": [{"id": 1, "channel": "Call", "notes": "Initial call..."}]}')
    doc.add_endpoint_card("POST", "/api/crm/leads/{id}/timeline/", "Log New Communication Event", True,
                          "Adds interaction note and optionally schedules next follow-up date and time.",
                          req_body='{"channel": "Meeting", "notes": "Product demonstration at client office", "next_followup_date": "2026-11-25"}',
                          resp_body='{"message": "Communication logged successfully.", "log_id": 15}')

    # SECTION 13: Preserved Backend APIs
    doc.add_heading("13. Preserved Backend APIs (Hidden From Mobile UI)", level=1)
    doc.add_paragraph(
        "In accordance with project requirements, the following administrative approval and access auditing endpoints "
        "remain fully implemented in the Django backend but are excluded from the mobile user interface."
    )
    doc.add_endpoint_card("GET", "/api/crm/access-requests/", "List Pending Access Requests", True,
                          "Administrative queue of staff awaiting CRM access clearance.",
                          resp_body='{"requests": []}')
    doc.add_endpoint_card("POST", "/api/crm/access-requests/{id}/approve/", "Approve CRM Access", True,
                          "Grants staff access clearance.",
                          resp_body='{"message": "Approved"}')
    doc.add_endpoint_card("POST", "/api/crm/access-requests/{id}/reject/", "Reject CRM Access", True,
                          "Denies staff access clearance.",
                          resp_body='{"message": "Rejected"}')
    doc.add_endpoint_card("GET", "/api/crm/access-logs/", "Staff Access Audit Trail", True,
                          "Read-only security log recording staff logins and administrative access events.",
                          resp_body='{"logs": []}')

    # SECTION 14: Mobile Development & Security
    doc.add_heading("14. Mobile App Integration Guidelines & Security", level=1)
    doc.add_paragraph(
        "1. Token Security: Never persist user authentication tokens in SharedPreferences or NSUserDefaults. "
        "Use flutter_secure_storage with KeyStore on Android and Keychain on iOS."
    )
    doc.add_paragraph(
        "2. Interceptor Strategy: Configure Dio interceptor to automatically attach Authorization: Token <token> "
        "to every outgoing request. If a 401 Unauthorized response is received, clear local credentials and route to LoginScreen."
    )
    doc.add_paragraph(
        "3. Networking in Development: For Android Emulators use 10.0.2.2:8000; for iOS Simulators use 127.0.0.1:8000; "
        "for physical testing devices connect to the local Wi-Fi IP (e.g. 192.168.1.X:8000). Ensure AndroidManifest.xml "
        "includes usesCleartextTraffic='true' for local development."
    )
    doc.add_paragraph(
        "4. Offline & State Management: Use Riverpod or Provider with immutable state models. Implement pull-to-refresh "
        "and debounced search listeners (350ms) to conserve mobile network bandwidth and device battery."
    )

    doc.build(output_file)

if __name__ == '__main__':
    out = os.path.abspath("f:/Flux/Flux/docs/Flux_CRM_API_Documentation.pdf")
    generate_crm_documentation_pdf(out)
