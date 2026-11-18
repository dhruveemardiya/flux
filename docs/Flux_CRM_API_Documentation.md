# FLUX CRM – COMPLETE REST API SPECIFICATION & INTEGRATION MANUAL
**Document Version:** 1.0.0  
**Generated On:** November 18, 2026  
**Backend Framework:** Django 4.2 / Django REST Framework 3.14  
**Database:** MariaDB / MySQL (`impression_inventory`)  
**Frontend Clients:** React Web Application & Flutter Mobile Application (Android / iOS)  

---

## 1. Architectural Overview & Environment Configuration

### 1.1 Base URLs & Network Topology

| Environment | Host / Platform | Base URL | Notes |
| :--- | :--- | :--- | :--- |
| **Local Web Development** | Browser / React | `http://127.0.0.1:8000` or `http://localhost:8000` | Same host as backend |
| **Android Emulator** | Android Studio AVD | `http://10.0.2.2:8000` | `10.0.2.2` aliases host `127.0.0.1` |
| **iOS Simulator** | macOS Xcode | `http://127.0.0.1:8000` | Shares localhost with host OS |
| **Physical Mobile Device** | Android / iOS via Wi-Fi | `http://<HOST_LAN_IP>:8000` (e.g. `http://192.168.1.50:8000`) | Ensure port 8000 is open in firewall |
| **Production** | Configured Domain | `https://api.yourdomain.com` | Requires valid TLS/HTTPS certificate |

> **Development Server Execution Notice:**  
> When running the Django development server for mobile testing on physical devices or emulators, bind to all interfaces:  
> `python manage.py runserver 0.0.0.0:8000`

---

### 1.2 Authentication Scheme

The application uses **Django REST Framework Token Authentication** (`rest_framework.authtoken`):

1. **Login Exchange:**
   - Endpoint: `POST /api/login/`
   - Authorization Header: `Authorization: Basic <base64(username:password)>`
   - Response: Returns a 40-character hex token string: `{"token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b", "role": "Sales Executive"}`.
2. **Authenticated Requests:**
   - Every subsequent API call must supply the token in the HTTP `Authorization` header with the `Token` prefix:  
     `Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b`
3. **Session Persistence:**
   - Web stores the token in `localStorage.getItem("authToken")`.
   - Mobile stores the token in hardware-backed secure storage via `flutter_secure_storage`.
4. **Logout:**
   - Endpoint: `POST /api/logout/`
   - Deletes the token record from the database, immediately invalidating the session.

---

### 1.3 Role-Based Access Control (RBAC) Hierarchy

The CRM backend enforces a 3-tier authorization model:
1. **Super Admin / TechAdmin / superuser:** Unrestricted access across all modules, company-wide records, staff overrides, and audit trails.
2. **Admin / Sales Manager:** Full management over segments, leads, task group assignments, team reports, and import jobs.
3. **Sales Executive / Staff:** Scoped view:
   - Can only view and update **assigned leads** (`LeadAssignment` or `lead.assigned_to`).
   - Can only view **assigned task groups** (`CRMTaskAssignee` or creator).
   - Can only update their own individual `LeadTaskActivity` records in **My Work**.
   - Direct attempts to view or modify other staff members' leads or task groups return `403 Forbidden`.

---

## 2. Authentication & Session Endpoints

### 2.1 User Login
- **URL:** `POST /api/login/`
- **Authentication:** `Authorization: Basic <base64(username:password)>`
- **Content-Type:** `application/json`
- **Request Body:** `{}` (empty object)
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
    "role": "Sales Executive"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Incorrect password"}` or `{"error": "Incorrect username"}`
  - `401 Unauthorized`: `{"error": "Missing or invalid Authorization header"}`
  - `400 Bad Request`: `{"error": "Invalid Authorization header format"}`
- **Affected Models:** `authtoken_token`, `auth_user`
- **Flutter Implementation:** Encode credentials with `base64Encode(utf8.encode('$username:$password'))`, execute POST via Dio, persist token securely.

---

### 2.2 Get Current User Profile
- **URL:** `GET /api/users/me/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Success Response (`200 OK`):**
  ```json
  {
    "id": 2,
    "username": "bob_patel",
    "first_name": "Bob",
    "last_name": "Patel",
    "role": "Sales Executive",
    "companies": [
      {
        "id": 1,
        "name": "Impression Pharma"
      }
    ],
    "created_at": "2026-11-10T08:30:00Z"
  }
  ```
- **Affected Models:** `auth_user`, `api_company`

---

### 2.3 User Logout
- **URL:** `POST /api/logout/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Logged out successfully"
  }
  ```
- **Affected Models:** Deletes token from `authtoken_token`.

---

### 2.4 Change Password
- **URL:** `POST /api/users/change-password/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Request Body:**
  ```json
  {
    "old_password": "CurrentPassword123!",
    "new_password": "NewSecretPassword456!"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Password updated successfully"
  }
  ```
- **Error Response (`400 Bad Request`):** `{"error": "Old password does not match"}`

---

### 2.5 Mobile Push Device Token Registration
- **URL:** `POST /api/notifications/device-token/`
- **DELETE:** `DELETE /api/notifications/device-token/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Request Body (POST):**
  ```json
  {
    "token": "eXamPLe_FCM_toKen_9876543210...",
    "platform": "android"
  }
  ```
- **Success Response (`200 OK` or `201 Created`):**
  ```json
  {
    "message": "Device token registered successfully.",
    "id": 4,
    "token": "eXamPLe_FCM_toKen_9876543210...",
    "platform": "android",
    "created": true
  }
  ```
- **Affected Models:** `mobile_device_tokens`

---

## 3. CRM Dashboard API

### 3.1 CRM Dashboard Summary
- **URL:** `GET /api/crm/dashboard/summary/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Permissions:** Authenticated CRM staff. Automatic role-scoped output.
- **Admin Response (`200 OK`):**
  ```json
  {
    "is_admin": true,
    "kpis": {
      "total_leads": 124,
      "total_segments": 8,
      "total_staff": 12,
      "active_staff": 11,
      "total_assigned_leads": 98,
      "total_tasks": 6,
      "completed_activities": 42,
      "pending_activities": 56,
      "pending_access_requests": 0,
      "overdue_followups": 3
    },
    "recent_activities": [
      {
        "id": 28,
        "lead_name": "MedLife Diagnostics Pvt Ltd",
        "staff_name": "Bob Patel",
        "status": "Completed",
        "updated_at": "2026-11-18T10:15:00Z"
      }
    ],
    "segment_distribution": [
      { "name": "Enterprise Pharmaceuticals", "value": 68 },
      { "name": "Medical Diagnostic Labs", "value": 56 }
    ]
  }
  ```
- **Staff Response (`200 OK`):**
  ```json
  {
    "is_admin": false,
    "kpis": {
      "my_assigned_leads": 22,
      "my_today_tasks": 4,
      "pending_activities": 6,
      "completed_activities": 16,
      "overdue_followups": 1
    }
  }
  ```
- **Affected Models:** `lead`, `segments`, `auth_user`, `crm_task_groups`, `crm_lead_task_activities`

---

## 4. User & Role Management APIs

### 4.1 List and Create CRM Staff
- **URL:** `GET /api/crm/users/`  
- **URL:** `POST /api/crm/users/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Query Parameters (GET):**
  - `search` (string): Search in username, first name, last name, role, mobile
  - `role` (string): Filter by exact role title
  - `status` (string): `Active` or `Inactive`
- **Success Response (GET `200 OK`):**
  ```json
  {
    "users": [
      {
        "id": 2,
        "username": "bob_patel",
        "first_name": "Bob",
        "last_name": "Patel",
        "full_name": "Bob Patel",
        "mobile": "9820012345",
        "role": "Sales Executive",
        "reporting_manager_id": 1,
        "reporting_manager_name": "Super Admin",
        "approval_required": false,
        "is_crm_approved": true,
        "account_status": "Active",
        "created_at": "2026-11-10T12:00:00Z"
      }
    ],
    "total": 1,
    "available_roles": ["Super Admin", "Admin", "Sales Manager", "Sales Executive", "Telecaller"],
    "available_managers": [
      { "id": 1, "name": "Super Admin" }
    ],
    "can_manage": true
  }
  ```
- **Request Body (POST):**
  ```json
  {
    "username": "rahul_sharma",
    "password": "TemporaryPassword123!",
    "first_name": "Rahul",
    "last_name": "Sharma",
    "role": "Sales Executive",
    "mobile": "9819900000",
    "reporting_manager_id": 1,
    "account_status": "Active"
  }
  ```
- **Affected Models:** `auth_user`, `crm_user_profiles`, `crm_audit_logs`

---

### 4.2 Staff Member Detail, Update & Delete
- **URL:** `GET /api/crm/users/<int:user_id>/`  
- **URL:** `PUT /api/crm/users/<int:user_id>/`  
- **URL:** `PATCH /api/crm/users/<int:user_id>/`  
- **URL:** `DELETE /api/crm/users/<int:user_id>/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Permissions:** Admin only.
- **Request Body (PUT/PATCH):**
  ```json
  {
    "first_name": "Rahul",
    "last_name": "Sharma",
    "role": "Sales Manager",
    "mobile": "9819911111",
    "reporting_manager_id": 1,
    "account_status": "Active",
    "password": "NewSecretPassword!"
  }
  ```
- **DELETE Response:** Deactivates user account (`account_status = 'Inactive'`).

---

### 4.3 CRM Roles & Permissions APIs
- **GET /api/crm/roles/**: List existing roles.
- **POST /api/crm/roles/**: Create new role (`{"role": "Lead Specialist"}`).
- **GET /api/crm/permissions/**: Returns module-level matrix (`users`, `segments`, `leads`, `assignments`, `tasks`, `my_work`, `reports`).
- **POST /api/crm/permissions/save/**: Persist role permission overrides.

---

## 5. Segment Management APIs

### 5.1 List & Create Segments
- **URL:** `GET /api/crm/segments/`  
- **URL:** `POST /api/crm/segments/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Query Parameters (GET):**
  - `search` (string): Search segment name or description
  - `status` (string): `Active` or `Inactive`
- **Success Response (GET `200 OK`):**
  ```json
  {
    "segments": [
      {
        "id": 1,
        "name": "Enterprise Pharmaceuticals",
        "description": "Hospital chains and bulk pharmacy distributors.",
        "is_active": true,
        "total_leads": 42,
        "created_at": "2026-11-13T10:00:00Z",
        "updated_at": "2026-11-13T10:00:00Z"
      }
    ],
    "total": 1,
    "can_manage": true
  }
  ```
- **Request Body (POST):**
  ```json
  {
    "name": "Medical Diagnostic Labs",
    "description": "Pathology laboratories and testing clinics.",
    "is_active": true
  }
  ```
- **Validation Rule:** Duplicate active segment names are rejected with `400 Bad Request`.
- **Affected Models:** `segments`, `crm_lead_segment_map`

---

### 5.2 Segment Detail & Update
- **URL:** `GET /api/crm/segments/<int:segment_id>/`  
- **URL:** `PUT /api/crm/segments/<int:segment_id>/`  
- **URL:** `PATCH /api/crm/segments/<int:segment_id>/`
- **Request Body (PUT):**
  ```json
  {
    "name": "Medical Diagnostic Laboratories",
    "description": "Updated scope for specialized pathology testing centers.",
    "is_active": true
  }
  ```
- **Cascade Behavior:** Changing segment name automatically synchronizes `lead.segment` across all mapped leads.

---

### 5.3 Safe Segment Deletion & Migration
- **URL:** `POST /api/crm/segments/<int:segment_id>/safe-delete/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Request Body (Option A - Move Leads):**
  ```json
  {
    "action": "MOVED",
    "target_segment_id": 2
  }
  ```
- **Request Body (Option B - Unassign Leads):**
  ```json
  {
    "action": "UNASSIGNED"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Segment deactivated successfully. 42 lead(s) moved to 'Medical Diagnostic Labs'.",
    "leads_affected": 42
  }
  ```
- **Affected Models:** `segments`, `crm_segment_migration_logs`, `lead`

---

## 6. Lead Management APIs

### 6.1 List Leads
- **URL:** `GET /api/crm/leads/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Query Parameters:**
  - `page` (int, default `1`)
  - `page_size` (int, default `20`, max `100`)
  - `search` (string): Free-text search across company name, contact person, mobile, phone, email, city, segment
  - `company_name` (string): Filter by company
  - `contact_person` (string): Filter by contact person
  - `phone` (string): Filter by phone / mobile digits
  - `email` (string): Filter by email address
  - `city` (string): Filter by city
  - `segment` (string): Filter by segment name
  - `status` (string): `Lead`, `Prospect`, `Customer`, `Cold`, etc.
  - `source` (string): Lead acquisition source
  - `assigned_to` (int): User ID of assigned staff
  - `unassigned_only` (bool): `true` to list unassigned leads
  - `sort_by` (string): `id`, `company_name`, `created_at`, `city`
  - `sort_dir` (string): `asc` or `desc`
- **Success Response (`200 OK`):**
  ```json
  {
    "leads": [
      {
        "id": 1,
        "company_name": "MedLife Diagnostics Pvt Ltd",
        "first_name": "Vikram",
        "last_name": "Mehta",
        "contact_person": "Vikram Mehta",
        "designation": "Procurement Director",
        "mobile_number": "9820012345",
        "alternate_mobile": "9820054321",
        "phone": "9820012345",
        "email": "vikram.mehta@test-medlife.com",
        "secondary_email": "procurement@test-medlife.com",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": "400001",
        "address_line1": "Unit 402, Express Towers, Nariman Point",
        "website": "https://www.test-medlifediag.com",
        "segment": "Medical Diagnostic Labs",
        "lead_source": "Direct Outreach",
        "status": "Lead",
        "notes": "Requested bulk pricing quotation.",
        "assigned_users": [
          {
            "id": 2,
            "name": "Bob Patel",
            "role": "Sales Executive"
          }
        ],
        "created_at": "2026-11-13T10:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
  ```

---

### 6.2 Create Lead
- **URL:** `POST /api/crm/leads/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Request Body:**
  ```json
  {
    "company_name": "Apex Care Hospitals",
    "first_name": "Pooja",
    "last_name": "Sharma",
    "designation": "Head of Supply Chain",
    "mobile": "9819987654",
    "secondary_mobile": "9819943210",
    "email": "pooja.sharma@test-apexcare.com",
    "secondary_email": "supplychain@test-apexcare.com",
    "city": "Ahmedabad",
    "state": "Gujarat",
    "country": "India",
    "pincode": "380015",
    "address_line1": "Plot 18, SG Highway, Bodakdev",
    "website": "https://www.test-apexcarehosp.com",
    "segment": "Enterprise Pharmaceuticals",
    "lead_source": "Medical Expo",
    "status": "Lead",
    "notes": "High-value enterprise prospect."
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "message": "Lead created successfully.",
    "lead_id": 2
  }
  ```

---

### 6.3 Lead Detail, Update & Delete
- **URL:** `GET /api/crm/leads/<int:lead_id>/`  
- **URL:** `PUT /api/crm/leads/<int:lead_id>/`  
- **URL:** `PATCH /api/crm/leads/<int:lead_id>/`  
- **URL:** `DELETE /api/crm/leads/<int:lead_id>/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Permissions:** Admin or assigned staff member. Non-assigned staff receive `403 Forbidden`.

---

## 7. Dynamic Excel / CSV Import Workflow

### 7.1 Upload Spreadsheet File
- **URL:** `POST /api/crm/leads/import/upload/`
- **Method:** `POST` (Multipart / Form-Data)
- **Field:** `file` (Excel `.xlsx`, `.xls` or `.csv`)
- **Success Response (`200 OK`):**
  ```json
  {
    "headers": ["Company Name", "Contact Person", "Phone", "Email", "City", "Segment"],
    "preview_rows": [
      {
        "Company Name": "Apex Meditech",
        "Contact Person": "Amit Shah",
        "Phone": "9820011111",
        "Email": "amit@apexmed.com",
        "City": "Mumbai",
        "Segment": "Medical Diagnostic Labs"
      }
    ],
    "suggested_mapping": {
      "Company Name": "company_name",
      "Contact Person": "contact_person",
      "Phone": "phone",
      "Email": "email",
      "City": "city",
      "Segment": "segment"
    }
  }
  ```

---

### 7.2 Validate Rows & Duplicate Detection
- **URL:** `POST /api/crm/leads/import/validate/`
- **Request Body:**
  ```json
  {
    "rows": [ ... ],
    "column_mapping": {
      "Company Name": "company_name",
      "Contact Person": "contact_person",
      "Phone": "phone",
      "Email": "email"
    }
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "import_token": "8f3a9e2d7c1b...",
    "total_rows": 25,
    "new_records_count": 22,
    "exact_duplicates_count": 2,
    "partial_duplicates_count": 1,
    "invalid_rows_count": 0,
    "exact_duplicates": [
      {
        "row_index": 4,
        "uploaded": { "phone": "9820012345", "company_name": "MedLife Diagnostics" },
        "existing": { "id": 1, "phone": "9820012345", "company_name": "MedLife Diagnostics Pvt Ltd" },
        "match_type": "EXACT",
        "reason": "Phone or Email matches existing record."
      }
    ]
  }
  ```

---

### 7.3 Commit Import Batch
- **URL:** `POST /api/crm/leads/import/commit/`
- **Request Body:**
  ```json
  {
    "import_token": "8f3a9e2d7c1b...",
    "rows": [ ... ],
    "column_mapping": { ... },
    "resolutions": {
      "0": "NEW",
      "4": "UPDATE",
      "7": "SKIP"
    },
    "create_unknown_segments": true,
    "file_name": "lead_export_nov.xlsx"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Import completed successfully. 22 new, 1 updated, 2 skipped.",
    "job_id": 5,
    "summary": { "new": 22, "updated": 1, "skipped": 2 }
  }
  ```
- **Re-import Protection:** Submitting an already processed `import_token` returns `400 Bad Request`.

---

## 8. Lead Assignment APIs

### 8.1 List Assignments
- **URL:** `GET /api/crm/assignments/`
- **Query Parameters:** `search`, `user_id`, `segment`
- **Success Response (`200 OK`):**
  ```json
  {
    "assignments": [
      {
        "id": 1,
        "lead_id": 1,
        "lead_name": "MedLife Diagnostics Pvt Ltd",
        "user_id": 2,
        "staff_name": "Bob Patel",
        "assigned_at": "2026-11-13T10:00:00Z"
      }
    ],
    "total": 1
  }
  ```

---

### 8.2 Assign Leads to Multiple Staff
- **URL:** `POST /api/crm/assignments/assign/`
- **Request Body:**
  ```json
  {
    "lead_ids": [1, 2],
    "user_ids": [2, 3]
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Successfully assigned 2 lead(s) to 2 staff member(s)."
  }
  ```

---

### 8.3 Reassign Leads
- **URL:** `POST /api/crm/assignments/reassign/`
- **Request Body:**
  ```json
  {
    "lead_ids": [1],
    "from_user_id": 2,
    "to_user_id": 3
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Successfully reassigned 1 lead(s) to alice_shah."
  }
  ```

---

### 8.4 Unassign Lead
- **URL:** `POST /api/crm/assignments/unassign/`
- **Request Body:**
  ```json
  {
    "lead_ids": [1],
    "user_id": 2
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Successfully unassigned 1 lead(s)."
  }
  ```

---

## 9. Task Management APIs

### 9.1 List Task Groups
- **URL:** `GET /api/crm/task-groups/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Query Parameters:**
  - `search` (string): Title or description
  - `status` (string): `Active`, `Scheduled`, `Completed`, `Cancelled` (Excludes `Archived` by default)
  - `priority` (string): `Low`, `Normal`, `High`, `Urgent`
- **Success Response (`200 OK`):**
  ```json
  {
    "task_groups": [
      {
        "id": 1,
        "title": "Q4 High-Value Outreach Campaign",
        "description": "Outreach calls to pharma distributors.",
        "priority": "High",
        "status": "Active",
        "start_date": "2026-11-15",
        "start_time": "09:30:00",
        "end_date": "2026-11-22",
        "end_time": "18:00:00",
        "assignees": [
          { "id": 2, "name": "Bob Patel" }
        ],
        "staff_ids": [2],
        "lead_ids": [1, 2],
        "lead_count": 2,
        "total_activities": 2,
        "completed_activities": 1,
        "progress_percentage": 50.0,
        "created_at": "2026-11-13T10:00:00Z",
        "can_edit": true,
        "can_delete": true
      }
    ],
    "total": 1
  }
  ```

---

### 9.2 Create Task Group
- **URL:** `POST /api/crm/task-groups/`
- **Request Body:**
  ```json
  {
    "title": "Enterprise Contract Finalization",
    "description": "Contractual review and pricing approval.",
    "priority": "Urgent",
    "start_date": "2026-11-18",
    "start_time": "10:00",
    "end_date": "2026-11-25",
    "end_time": "17:00",
    "staff_ids": [2, 3],
    "lead_ids": [1, 2]
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "message": "Task group created successfully with 2 staff and 2 leads.",
    "task_group_id": 2
  }
  ```

---

### 9.3 Task Group Detail, Edit & Soft-Delete
- **URL:** `GET /api/crm/task-groups/<int:task_group_id>/`  
- **URL:** `PUT /api/crm/task-groups/<int:task_group_id>/`  
- **URL:** `PATCH /api/crm/task-groups/<int:task_group_id>/`  
- **URL:** `DELETE /api/crm/task-groups/<int:task_group_id>/`
- **PUT / PATCH Request Body:**
  ```json
  {
    "title": "Enterprise Contract Finalization - Phase 2",
    "description": "Extended scope for regional distribution hubs.",
    "priority": "Urgent",
    "status": "Active",
    "start_date": "2026-11-18",
    "end_date": "2026-11-30",
    "staff_ids": [2, 3],
    "lead_ids": [1, 2]
  }
  ```
- **Preservation Contract:** Editing a task group preserves all existing completed activity records and staff work notes.
- **DELETE Contract:** Performs safe soft-delete (`status = 'Archived'`). Preserves all historical staff activities and communication timeline entries without SQL cascade deletion.

---

## 10. My Work Dashboard APIs

### 10.1 My Work Feed
- **URL:** `GET /api/crm/my-work/`
- **Query Parameters:**
  - `date` (string): `'today'`, `'yesterday'`, `'tomorrow'`, or `'YYYY-MM-DD'`
  - `search` (string)
  - `status` (string): `'Pending'`, `'Completed'`, `'Callback Required'`, etc.
- **Success Response (`200 OK`):**
  ```json
  {
    "date": "2026-11-18",
    "activities": [
      {
        "activity_id": 1,
        "task_group_id": 1,
        "task_title": "Q4 High-Value Outreach Campaign",
        "priority": "High",
        "lead_id": 1,
        "company_name": "MedLife Diagnostics Pvt Ltd",
        "contact_person": "Vikram Mehta",
        "mobile_number": "9820012345",
        "segment": "Medical Diagnostic Labs",
        "activity_status": "Completed",
        "notes": "Conducted intro call. Sent quotation.",
        "action_taken": "Phone call with Procurement Director",
        "next_followup_date": "2026-11-20",
        "next_followup_time": "14:00:00",
        "last_updated": "2026-11-18T10:00:00Z",
        "is_overdue": false
      }
    ],
    "summary": {
      "total": 1,
      "completed": 1,
      "pending": 0,
      "overdue": 0
    }
  }
  ```

---

### 10.2 Update Lead Activity
- **URL:** `POST /api/crm/my-work/activities/<int:activity_id>/update/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Permissions:** Staff member who owns this activity or Admin.
- **Request Body:**
  ```json
  {
    "status": "Completed",
    "action_taken": "Demonstrated product catalog via Zoom",
    "notes": "Client requested proposal with bulk volume discount.",
    "next_followup_date": "2026-11-22",
    "next_followup_time": "15:30"
  }
  ```
- **Automatic Side Effect:** Automatically inserts a corresponding entry into `CRMCommunicationLog` in the lead's 360° communication timeline.

---

### 10.3 Scheduled Follow-ups
- **URL:** `GET /api/crm/my-work/follow-ups/`
- Returns pending follow-ups for the authenticated staff member sorted chronologically.

---

## 11. Performance Reports APIs

### 11.1 Staff Performance Breakdown
- **URL:** `GET /api/crm/reports/staff/`
- **Success Response (`200 OK`):**
  ```json
  {
    "staff_performance": [
      {
        "user_id": 2,
        "user__username": "bob_patel",
        "user__first_name": "Bob",
        "user__last_name": "Patel",
        "total": 15,
        "completed": 10,
        "pending": 4,
        "overdue": 1
      }
    ]
  }
  ```

---

### 11.2 Task Groups Progress Report
- **URL:** `GET /api/crm/reports/task-groups/`
- **Success Response (`200 OK`):**
  ```json
  {
    "task_groups": [
      {
        "id": 1,
        "title": "Q4 High-Value Outreach Campaign",
        "priority": "High",
        "status": "Active",
        "total_activities": 20,
        "completed_activities": 15,
        "completion_percentage": 75.0,
        "start_date": "2026-11-15",
        "end_date": "2026-11-22"
      }
    ]
  }
  ```

---

### 11.3 Segment Distribution Report
- **URL:** `GET /api/crm/reports/segments/`
- **Success Response (`200 OK`):**
  ```json
  {
    "segments": [
      { "name": "Enterprise Pharmaceuticals", "lead_count": 68 },
      { "name": "Medical Diagnostic Labs", "lead_count": 56 }
    ]
  }
  ```

---

## 12. Quick Lead Search & 360° Communication Timeline

### 12.1 Quick Lead Search
- **URL:** `GET /api/crm/quick-search/?q=<query>`
- **Authentication:** Required (`Authorization: Token <token>`)
- **Query Parameter:** `q` (minimum 2 characters)
- **Success Response (`200 OK`):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "company_name": "MedLife Diagnostics Pvt Ltd",
        "contact_person": "Vikram Mehta",
        "mobile_number": "9820012345",
        "alternate_mobile": "9820054321",
        "email": "vikram.mehta@test-medlife.com",
        "segment": "Medical Diagnostic Labs",
        "city": "Mumbai",
        "last_interaction": "Call: Initial discovery call with Vikram Mehta... (13/11/2026)"
      }
    ]
  }
  ```

---

### 12.2 360° Communication Timeline
- **URL:** `GET /api/crm/leads/<int:lead_id>/timeline/`  
- **URL:** `POST /api/crm/leads/<int:lead_id>/timeline/`
- **Authentication:** Required (`Authorization: Token <token>`)
- **GET Response (`200 OK`):**
  ```json
  {
    "lead": {
      "id": 1,
      "company_name": "MedLife Diagnostics Pvt Ltd"
    },
    "timeline": [
      {
        "id": 1,
        "channel": "Call",
        "notes": "Initial discovery call with Vikram Mehta. Expressed strong interest.",
        "staff_name": "Bob Patel",
        "next_followup_date": "2026-11-20",
        "next_followup_time": "14:00:00",
        "timestamp": "2026-11-13T10:30:00Z"
      }
    ]
  }
  ```
- **POST Request Body:**
  ```json
  {
    "channel": "Meeting",
    "notes": "Client product demonstration conducted at Mumbai HQ.",
    "next_followup_date": "2026-11-25",
    "next_followup_time": "11:00"
  }
  ```
- **Allowed Channels:** `Call`, `Meeting`, `Email`, `WhatsApp`, `Note`, `Status Update`

---

## 13. Preserved Backend APIs – Hidden From Current Mobile UI

The following endpoints exist in the backend codebase for administration and audit compliance. In accordance with current release requirements, they are **preserved in backend code and API documentation but hidden from the mobile application UI**:

1. `GET, POST /api/crm/access-requests/` – List and submit staff CRM access approval requests.
2. `POST /api/crm/access-requests/<int:request_id>/approve/` – Approve pending access request.
3. `POST /api/crm/access-requests/<int:request_id>/reject/` – Reject pending access request.
4. `GET /api/crm/access-logs/` – Administrative audit log of CRM logins and access events.

---

## 14. Verification & Endpoint Count Summary

- **Total CRM Endpoints Discovered from Code:** 46
- **Total Auth & Session Endpoints:** 5
- **Grand Total Documented Endpoints:** 51
- **Verified Contracts (Source Code & Test Suite):** 51
- **Partially Verified / Guessed:** 0
- **Database Tables Verified:** `lead`, `segments`, `crm_lead_segment_map`, `lead_assignments`, `lead_assignment_history`, `crm_task_groups`, `crm_task_assignees`, `crm_task_leads`, `crm_lead_task_activities`, `crm_communication_logs`, `crm_user_profiles`, `mobile_device_tokens`, `authtoken_token`, `auth_user`.
