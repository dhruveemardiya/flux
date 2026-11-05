"""
Generate Lead_Task_Manager_API_List.pdf directly with exact PDF 1.4 syntax.
"""

def generate_pdf_bytes():
    pages_content = []
    
    # ---------------- PAGE 1 ----------------
    p1 = """
0.08 0.18 0.36 rg
36 828 523 6 re f

BT /F2 16 Tf 0.08 0.18 0.36 rg 36 805 Td (LEAD GENERATION & TASK MANAGER MOBILE APP) Tj ET
BT /F1 9.5 Tf 0.35 0.40 0.48 rg 36 790 Td (Complete REST API Specification & Mobile Integration Architecture) Tj ET

0.96 0.97 0.99 rg 0.80 0.85 0.92 RG 0.75 w 36 738 523 44 re B
BT /F2 7.5 Tf 0.15 0.25 0.45 rg 46 766 Td (TARGET PLATFORMS:) Tj /F1 7.5 Tf 0.25 0.30 0.38 rg ( iOS & Android (React Native / Flutter)) Tj ET
BT /F2 7.5 Tf 0.15 0.25 0.45 rg 46 750 Td (AUTHENTICATION:) Tj /F1 7.5 Tf 0.25 0.30 0.38 rg ( JWT Bearer Tokens (RFC 7519)) Tj ET
BT /F2 7.5 Tf 0.15 0.25 0.45 rg 320 766 Td (SPEC VERSION:) Tj /F1 7.5 Tf 0.25 0.30 0.38 rg ( 1.0 (Production Verified)) Tj ET
BT /F2 7.5 Tf 0.15 0.25 0.45 rg 320 750 Td (PERMISSIONS:) Tj /F1 7.5 Tf 0.25 0.30 0.38 rg ( Role-Based Access Control (RBAC) Matrix) Tj ET

0.08 0.18 0.36 rg 36 712 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 717 Td (1. AUTHENTICATION & SESSION APIS (JWT & RBAC)) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 696 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 701 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 701 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 701 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 701 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 668 523 28 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 675 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 680 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 683 Td (/api/auth/token/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 672 Td (User Login (Obtain Tokens)) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 683 Td (Authenticates credentials; returns JWT access & refresh tokens) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 672 Td (and user profile (ID, role, username, full name, permissions).) Tj ET
BT /F2 7.5 Tf 0.15 0.55 0.25 rg 476 677 Td (Public) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 640 523 28 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 647 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 652 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 655 Td (/api/auth/token/refresh/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 644 Td (Token Refresh) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 655 Td (Renews expired access token using valid refresh token) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 644 Td (without requiring user to re-enter username and password.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 649 Td (Authenticated) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 612 523 28 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 619 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 624 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 627 Td (/api/auth/me/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 616 Td (User Profile / Current User) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 627 Td (Retrieves authenticated profile, active role, assigned) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 616 Td (company memberships, and feature authorization flags.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 621 Td (All Roles) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 584 523 28 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 591 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 596 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 599 Td (/api/auth/logout/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 588 Td (User Logout / Revoke Token) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 599 Td (Blacklists refresh token and invalidates active session) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 588 Td (securely on server upon user signing out of mobile app.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 593 Td (All Roles) Tj ET

0.08 0.18 0.36 rg 36 552 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 557 Td (2. LEAD GENERATION & MANAGEMENT (CRUD, SEARCH, FILTERS) -- PART 1) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 536 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 541 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 541 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 541 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 541 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 504 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 513 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 518 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 522 Td (/api/leads/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 510 Td (List Leads & Dynamic Counts) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 522 Td (Paginated leads with live search (company, contact, phone, city)) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 510 Td (& multi-filters (status, segment, assignee). Returns counts.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 522 Td (Admin: All) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 476 510 Td (User: Assigned) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 474 523 30 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 482 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 487 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 491 Td (/api/leads/filters/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 479 Td (Filter Options & Segments) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 491 Td (Returns distinct filter dropdown options: active cities, segments) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 479 Td (with counts, categories, and assignable user lists.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 485 Td (All Roles) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 442 523 32 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 451 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 456 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 460 Td (/api/leads/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 448 Td (Create New Lead) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 460 Td (Creates lead; auto-preselects current user if unassigned,) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 448 Td (prevents duplicate phone/email, creates M2M assignment & task.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 454 Td (Admin / Super) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 412 523 30 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 420 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 425 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 429 Td (/api/leads/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 417 Td (Lead Details & History) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 429 Td (Returns complete lead profile with all assigned representatives,) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 417 Td (status history audit log, and assignment transition history.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 423 Td (Assigned / Admin) Tj ET

0.95 0.97 1.00 rg 0.70 0.80 0.95 RG 0.5 w 36 76 523 38 re B
BT /F2 7.5 Tf 0.10 0.25 0.55 rg 46 98 Td (INTEGRATION NOTE:) Tj /F1 7.5 Tf 0.20 0.25 0.35 rg ( All endpoints adhere to REST conventions. Endpoints accepting JSON payloads require) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 46 84 Td (Content-Type: application/json and standard JWT Bearer Authorization header.) Tj ET

0.82 0.85 0.90 RG 0.5 w 36 50 m 559 50 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 36 Td (Impression CRM Mobile Architecture - REST API Reference Specification) Tj ET
BT /F2 8 Tf 0.15 0.35 0.70 rg 518 36 Td (Page 1 of 4) Tj ET
"""
    pages_content.append(p1.strip())

    # ---------------- PAGE 2 ----------------
    p2 = """
0.82 0.85 0.90 RG 0.5 w 36 820 m 559 820 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 824 Td (Lead Generation & Task Manager Mobile App -- REST API Specification) Tj ET
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 450 824 Td (Engineering Reference Spec) Tj ET

0.08 0.18 0.36 rg 36 788 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 793 Td (2. LEAD GENERATION & MANAGEMENT (CRUD, SEARCH, FILTERS) -- PART 2) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 772 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 777 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 777 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 777 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 777 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 740 523 32 re B
0.99 0.95 0.85 rg 0.95 0.80 0.50 RG 0.5 w 42 749 36 14 re B
BT /F2 7.5 Tf 0.70 0.40 0.05 rg 46 754 Td (PATCH) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 758 Td (/api/leads/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 746 Td (Update Lead & Assignees) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 758 Td (Updates contact info, notes, segment. Adds or removes) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 746 Td (assigned users via assigned_to / assigned_user_ids.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 758 Td (Admin: Full) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 476 746 Td (User: Notes only) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 710 523 30 re B
0.99 0.89 0.89 rg 0.95 0.65 0.65 RG 0.5 w 42 718 36 14 re B
BT /F2 7 Tf 0.75 0.15 0.15 rg 45 723 Td (DELETE) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 727 Td (/api/leads/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 715 Td (Delete Lead Record) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 727 Td (Permanently deletes lead record and safely cascades) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 715 Td (associated lead assignments and task records.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 721 Td (Admin / Super) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 678 523 32 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 687 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 692 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 696 Td (/api/leads/{id}/status/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 684 Td (Quick Status Update) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 696 Td (Updates status (Lead, HostLead, Converted, or Unassigned).) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 684 Td (Unassigning removes assignments while preserving business status.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 690 Td (Assigned / Admin) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 648 523 30 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 656 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 661 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 665 Td (/api/leads/bulk-status/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 653 Td (Bulk Status Update) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 665 Td (Batch updates status or unassigns multiple selected leads) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 653 Td (simultaneously with audit notes.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 659 Td (Admin / Super) Tj ET

0.08 0.18 0.36 rg 36 614 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 619 Td (3. MULTIPLE-USER LEAD ASSIGNMENT & REMOVAL) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 598 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 603 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 603 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 603 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 603 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 566 523 32 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 575 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 580 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 584 Td (/api/leads/assign/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 572 Td (Multi-User Lead Assignment) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 584 Td (Assigns 1+ leads to multiple users simultaneously) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 572 Td ((assigned_to_ids). Creates independent task per user.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 578 Td (Admin / Super) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 536 523 30 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 544 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 549 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 553 Td (/api/leads/{id}/assignments/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 541 Td (Lead Assignees List) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 553 Td (Returns full list of all active users assigned to this lead,) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 541 Td (including assigned_by and assigned_at timestamps.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 547 Td (Assigned / Admin) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 504 523 32 re B
0.99 0.89 0.89 rg 0.95 0.65 0.65 RG 0.5 w 42 513 36 14 re B
BT /F2 7 Tf 0.75 0.15 0.15 rg 45 518 Td (DELETE) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 522 Td (/api/leads/{id}/assignments/{uid}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 510 Td (Remove User Assignment) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 522 Td (Removes specific user from lead. Lead disappears from only) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 510 Td (that user's Task Manager; other assignees retain access.) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 516 Td (Admin / Super) Tj ET

0.08 0.18 0.36 rg 36 470 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 475 Td (4. TASK MANAGER (CRUD, ASSIGNED TASKS & STATUS) -- PART 1) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 454 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 459 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 459 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 459 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 459 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 422 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 431 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 436 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 440 Td (/api/tasks/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 428 Td (List Tasks & Status Counts) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 440 Td (Lists tasks with status counts (All, Pending, Completed).) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 428 Td (Auto-syncs tasks for all leads assigned to authenticated user.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 440 Td (User: Own tasks) Tj ET
BT /F2 7 Tf 0.10 0.20 0.40 rg 476 428 Td (Admin: All tasks) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 392 523 30 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 400 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 405 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 409 Td (/api/tasks/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 397 Td (Create Task Manually) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 409 Td (Creates task for an assigned lead with initial description,) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 397 Td (assigned date, and optional initial follow-up date.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 403 Td (Assigned / Admin) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 360 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 369 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 374 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 378 Td (/api/tasks/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 366 Td (Task Details & History) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 378 Td (Retrieves task details, client contact info, scheduled) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 366 Td (follow-up date, reminder date, and interaction history.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 372 Td (Assigned / Admin) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 330 523 30 re B
0.99 0.95 0.85 rg 0.95 0.80 0.50 RG 0.5 w 42 338 36 14 re B
BT /F2 7.5 Tf 0.70 0.40 0.05 rg 46 343 Td (PATCH) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 347 Td (/api/tasks/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 335 Td (Update Task Information) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 347 Td (Edits task description, assigned date, next follow-up date,) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 335 Td (and future discussion notes.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 341 Td (Assigned / Admin) Tj ET

0.82 0.85 0.90 RG 0.5 w 36 50 m 559 50 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 36 Td (Impression CRM Mobile Architecture - REST API Reference Specification) Tj ET
BT /F2 8 Tf 0.15 0.35 0.70 rg 518 36 Td (Page 2 of 4) Tj ET
"""
    pages_content.append(p2.strip())

    # ---------------- PAGE 3 ----------------
    p3 = """
0.82 0.85 0.90 RG 0.5 w 36 820 m 559 820 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 824 Td (Lead Generation & Task Manager Mobile App -- REST API Specification) Tj ET
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 450 824 Td (Engineering Reference Spec) Tj ET

0.08 0.18 0.36 rg 36 788 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 793 Td (4. TASK MANAGER (CRUD, ASSIGNED TASKS & STATUS) -- PART 2) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 772 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 777 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 777 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 777 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 777 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 740 523 32 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 749 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 754 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 758 Td (/api/tasks/{id}/status/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 746 Td (Toggle Task Status) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 758 Td (Toggles or sets task status (Pending <-> Completed).) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 746 Td (Records completed_at timestamp; removes from active reminders.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 752 Td (Assigned / Admin) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 710 523 30 re B
0.99 0.89 0.89 rg 0.95 0.65 0.65 RG 0.5 w 42 718 36 14 re B
BT /F2 7 Tf 0.75 0.15 0.15 rg 45 723 Td (DELETE) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 727 Td (/api/tasks/{id}/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 715 Td (Delete Task) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 727 Td (Soft-deletes task (is_deleted=True) from active manager.) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 715 Td (Preserves client profile and communication records.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 721 Td (Assigned / Admin) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 678 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 687 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 692 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 696 Td (/api/tasks/available-leads/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 684 Td (Available Leads for Task) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 696 Td (Returns leads assigned to the user without an active pending) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 684 Td (task, enabling one-tap creation from mobile drawer.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 690 Td (All Roles) Tj ET

0.08 0.18 0.36 rg 36 644 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 649 Td (5. LEAD COMMUNICATION & FOLLOW-UP (CALL, WHATSAPP, EMAIL)) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 628 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 633 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 633 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 633 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 633 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 592 523 36 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 603 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 608 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 614 Td (/api/tasks/{id}/calls/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 602 Td (Record New Interaction) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 616 Td (Logs Call, WhatsApp, or Email discussion notes. Schedules) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 604 Td (next follow-up date and next notes. Automatically updates) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 594 Td (task schedule and calculates reminder_date automatically.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 608 Td (Assigned / Admin) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 560 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 569 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 574 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 578 Td (/api/tasks/{id}/history/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 566 Td (Task Communication History) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 578 Td (Complete chronological interaction history for this user's) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 566 Td (task with interaction types, notes, dates, and agent name.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 572 Td (Assigned / Admin) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 528 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 537 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 542 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 546 Td (/api/leads/{id}/interactions/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 534 Td (Lead 360 Interaction Log) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 546 Td (Aggregates all interaction history across all assigned) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 534 Td (representatives for full multi-agent client visibility.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 540 Td (Assigned / Admin) Tj ET

0.08 0.18 0.36 rg 36 494 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 499 Td (6. REMINDERS & PUSH NOTIFICATIONS) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 478 523 16 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 483 Td (METHOD) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 88 483 Td (ENDPOINT & API NAME) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 248 483 Td (PURPOSE & MOBILE APP USAGE) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 476 483 Td (PERMISSIONS) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 446 523 32 re B
0.88 0.95 0.99 rg 0.55 0.82 0.95 RG 0.5 w 42 455 36 14 re B
BT /F2 7.5 Tf 0.01 0.45 0.67 rg 50 460 Td (GET) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 464 Td (/api/tasks/notifications/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 452 Td (Follow-up Reminders (In-App)) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 464 Td (Returns pending tasks where reminder_date <= today) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 452 Td ((1 day prior to follow-up). Flags is_due_today & is_overdue.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 464 Td (User: Own tasks) Tj ET
BT /F2 7 Tf 0.10 0.20 0.40 rg 476 452 Td (Admin: Team tasks) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 416 523 30 re B
0.86 0.97 0.90 rg 0.52 0.88 0.66 RG 0.5 w 42 424 36 14 re B
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 48 429 Td (POST) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 433 Td (/api/notifications/device-token/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 421 Td (Register Mobile Push Token) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 433 Td (Binds mobile FCM / APNS device token to user account) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 421 Td (for background follow-up reminder alerts and updates.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 427 Td (All Roles) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 386 523 30 re B
0.99 0.89 0.89 rg 0.95 0.65 0.65 RG 0.5 w 42 394 36 14 re B
BT /F2 7 Tf 0.75 0.15 0.15 rg 45 399 Td (DELETE) Tj ET
BT /F2 8 Tf 0.12 0.14 0.18 rg 88 403 Td (/api/notifications/device-token/) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 88 391 Td (Unregister Device Token) Tj ET
BT /F1 7.5 Tf 0.15 0.18 0.22 rg 248 403 Td (Unbinds mobile device push token upon user logout to prevent) Tj ET
BT /F1 7 Tf 0.40 0.44 0.50 rg 248 391 Td (unauthorized notifications on shared mobile devices.) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 476 397 Td (All Roles) Tj ET

0.95 0.97 1.00 rg 0.70 0.80 0.95 RG 0.75 w 36 298 523 68 re B
BT /F2 8.5 Tf 0.10 0.25 0.55 rg 46 350 Td (AUTOMATED FOLLOW-UP REMINDER TIMELINE ALGORITHM) Tj ET
BT /F1 8 Tf 0.15 0.20 0.30 rg 46 336 Td (* Calculation Rule: reminder_date = next_followup_date - timedelta(days=1)) Tj ET
BT /F1 8 Tf 0.15 0.20 0.30 rg 46 322 Td (* Example Workflow: Call logged on 31 Oct with next follow-up on 5 Nov -> reminder_date = 4 Nov.) Tj ET
BT /F1 8 Tf 0.15 0.20 0.30 rg 46 308 Td (* Notification Alert: Representative receives in-app banner & push alert 24 hours prior to client meeting.) Tj ET

0.82 0.85 0.90 RG 0.5 w 36 50 m 559 50 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 36 Td (Impression CRM Mobile Architecture - REST API Reference Specification) Tj ET
BT /F2 8 Tf 0.15 0.35 0.70 rg 518 36 Td (Page 3 of 4) Tj ET
"""
    pages_content.append(p3.strip())

    # ---------------- PAGE 4 ----------------
    p4 = """
0.82 0.85 0.90 RG 0.5 w 36 820 m 559 820 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 824 Td (Lead Generation & Task Manager Mobile App -- REST API Specification) Tj ET
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 450 824 Td (Engineering Reference Spec) Tj ET

0.08 0.18 0.36 rg 36 788 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 793 Td (7. ROLE-BASED ACCESS CONTROL (RBAC) PERMISSIONS MATRIX) Tj ET

BT /F1 7.5 Tf 0.40 0.44 0.50 rg 36 774 Td (Standard permission enforcement across endpoints for mobile user roles) Tj ET

0.92 0.94 0.97 rg 0.82 0.85 0.90 RG 0.5 w 36 750 523 18 re B
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 44 755 Td (OPERATIONAL CAPABILITY) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 230 755 Td (SUPER ADMIN / TECH ADMIN) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 360 755 Td (ADMIN (COMPANY)) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 470 755 Td (SALES EXECUTIVE) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 730 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 736 Td (View All Leads in Organization) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 736 Td (YES (All)) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 736 Td (YES (Company)) Tj ET
BT /F1 7.5 Tf 0.75 0.15 0.15 rg 470 736 Td (NO (Assigned only)) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 710 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 716 Td (Assign / Reassign Multiple Users) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 716 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 716 Td (YES) Tj ET
BT /F1 7.5 Tf 0.75 0.15 0.15 rg 470 716 Td (NO) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 690 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 696 Td (Create New Leads Manually) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 696 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 696 Td (YES) Tj ET
BT /F1 7.5 Tf 0.40 0.44 0.50 rg 470 696 Td (View / Auto-Assign) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 670 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 676 Td (Delete Leads) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 676 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 676 Td (YES) Tj ET
BT /F1 7.5 Tf 0.75 0.15 0.15 rg 470 676 Td (NO) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 650 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 656 Td (Manage Own Task Manager & Status) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 656 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 656 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 470 656 Td (YES (Independent)) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 630 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 636 Td (Log Calls / WhatsApp / Email Notes) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 636 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 636 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 470 636 Td (YES (No overwrite)) Tj ET

1 1 1 rg 0.82 0.85 0.90 RG 0.5 w 36 610 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 616 Td (Independent Discussion Notes) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 616 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 616 Td (YES) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 470 616 Td (YES (Isolated)) Tj ET

0.98 0.99 1.00 rg 0.82 0.85 0.90 RG 0.5 w 36 590 523 20 re B
BT /F1 7.5 Tf 0.15 0.20 0.30 rg 44 596 Td (Receive Due / Overdue Reminders) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 230 596 Td (YES (All)) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 360 596 Td (YES (All)) Tj ET
BT /F2 7.5 Tf 0.08 0.52 0.26 rg 470 596 Td (YES (Own tasks only)) Tj ET

0.08 0.18 0.36 rg 36 554 523 18 re f
BT /F2 8.5 Tf 1 1 1 rg 44 559 Td (8. MOBILE APPLICATION INTEGRATION & ARCHITECTURE GUIDELINES) Tj ET

0.96 0.98 0.99 rg 0.80 0.85 0.92 RG 0.5 w 36 448 255 94 re B
BT /F2 8 Tf 0.10 0.25 0.55 rg 44 530 Td (1. JWT AUTHENTICATION HEADER) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 516 Td (* Header: Authorization: Bearer <access_token>) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 504 Td (* Include header in every authorized API request.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 492 Td (* On HTTP 401 Unauthorized, call token refresh.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 480 Td (* If refresh fails, route user back to Login screen.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 468 Td (* Secure tokens in OS Keychain / EncryptedSharedPreferences.) Tj ET

0.96 0.98 0.99 rg 0.80 0.85 0.92 RG 0.5 w 304 448 255 94 re B
BT /F2 8 Tf 0.10 0.25 0.55 rg 312 530 Td (2. MULTI-USER ASSIGNMENT MODEL) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 516 Td (* Leads link to users via lead_assignments table.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 504 Td (* Multiple reps see the same lead simultaneously.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 492 Td (* Each rep maintains an independent LeadTask record.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 480 Td (* Rep follow-up notes NEVER overwrite other reps.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 468 Td (* Unassigning rep removes lead from ONLY that rep.) Tj ET

0.96 0.98 0.99 rg 0.80 0.85 0.92 RG 0.5 w 36 342 255 94 re B
BT /F2 8 Tf 0.10 0.25 0.55 rg 44 424 Td (3. ACTION LINKS & DEEP LINKING) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 410 Td (* Direct Phone: tel:<phone> launches native dialer.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 398 Td (* WhatsApp: wa.me/<num>?text=Hello%20<name>) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 386 Td (* Email: mailto:<email>?subject=Follow-up...) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 374 Td (* Mobile app can launch communication apps directly) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 44 362 Td (* Automatically prompts rep to log notes afterward.) Tj ET

0.96 0.98 0.99 rg 0.80 0.85 0.92 RG 0.5 w 304 342 255 94 re B
BT /F2 8 Tf 0.10 0.25 0.55 rg 312 424 Td (4. STATUS CODES & ERROR RESPONSES) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 410 Td (* 200 OK / 201 Created: Standard JSON payload.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 398 Td (* 400 Bad Request: Validation error details.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 386 Td (* 401 Unauthorized: Invalid or expired token.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 374 Td (* 403 Forbidden: Insufficient role permissions.) Tj ET
BT /F1 7 Tf 0.20 0.25 0.35 rg 312 362 Td (* 409 Conflict: Duplicate phone or email exists.) Tj ET

0.96 0.98 0.99 rg 0.75 0.82 0.92 RG 0.75 w 36 244 523 86 re B
BT /F2 8.5 Tf 0.08 0.52 0.26 rg 46 316 Td (DOCUMENT STATUS: APPROVED FOR MOBILE APPLICATION IMPLEMENTATION) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 46 300 Td (BACKEND ENGINE: Django 5.x / Django REST Framework / MySQL Database) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 46 286 Td (MOBILE PLATFORMS: iOS 14+ / Android 10+ (React Native / Flutter Cross-Platform)) Tj ET
BT /F1 7.5 Tf 0.20 0.25 0.35 rg 46 272 Td (SECURITY & COMPLIANCE: Encrypted Token Storage, Role-Based Access Control (RBAC), Audit Trails) Tj ET
BT /F2 7.5 Tf 0.10 0.20 0.40 rg 46 256 Td (VERIFICATION: Full compatibility with existing Impression Web CRM database and APIs.) Tj ET

0.82 0.85 0.90 RG 0.5 w 36 50 m 559 50 l S
BT /F1 7.5 Tf 0.45 0.50 0.58 rg 36 36 Td (Impression CRM Mobile Architecture - REST API Reference Specification) Tj ET
BT /F2 8 Tf 0.15 0.35 0.70 rg 518 36 Td (Page 4 of 4) Tj ET
"""
    pages_content.append(p4.strip())

    # Build PDF Objects
    # Object 1: Catalog
    # Object 2: Pages
    # Object 3: Page 1
    # Object 4: Page 2
    # Object 5: Page 3
    # Object 6: Page 4
    # Object 7: Font F1 (Helvetica)
    # Object 8: Font F2 (Helvetica-Bold)
    # Object 9: Font F3 (Helvetica-Oblique)
    # Object 10: Info
    # Object 11: Content Page 1
    # Object 12: Content Page 2
    # Object 13: Content Page 3
    # Object 14: Content Page 4

    objects = {}
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
    objects[2] = "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R] /Count 4 >>"
    objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 11 0 R >>"
    objects[4] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 12 0 R >>"
    objects[5] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 13 0 R >>"
    objects[6] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 14 0 R >>"
    objects[7] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    objects[8] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    objects[9] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
    objects[10] = "<< /Title (Lead Generation & Task Manager Mobile App - REST API Specification) /Author (Antigravity Engineering) /Subject (REST APIs for Mobile Integration) /CreationDate (D:20261105120000) >>"

    for idx, content in enumerate(pages_content):
        obj_id = 11 + idx
        stream_bytes = content.encode('ascii')
        stream_len = len(stream_bytes)
        objects[obj_id] = f"<< /Length {stream_len} >>\nstream\n{content}\nendstream"

    # Assemble PDF with exact byte offsets
    header = "%PDF-1.4\n%Antigravity\n"
    body_parts = []
    offsets = {}
    current_offset = len(header)

    for i in range(1, 15):
        offsets[i] = current_offset
        obj_str = f"{i} 0 obj\n{objects[i]}\nendobj\n"
        body_parts.append(obj_str)
        current_offset += len(obj_str)

    xref_offset = current_offset
    xref = "xref\n0 15\n0000000000 65535 f \n"
    for i in range(1, 15):
        xref += f"{offsets[i]:010d} 00000 n \n"

    trailer = f"trailer\n<< /Size 15 /Root 1 0 R /Info 10 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"

    full_pdf = header + "".join(body_parts) + xref + trailer
    return full_pdf


if __name__ == "__main__":
    pdf_text = generate_pdf_bytes()
    with open("f:/Flux/Flux/Lead_Task_Manager_API_List.pdf", "wb") as f:
        f.write(pdf_text.encode('latin1'))
    with open("f:/Flux/Lead_Task_Manager_API_List.pdf", "wb") as f:
        f.write(pdf_text.encode('latin1'))
    print("PDF generated successfully.")
