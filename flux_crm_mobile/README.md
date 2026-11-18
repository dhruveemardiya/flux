# Flux CRM Mobile Application

Enterprise mobile client for the **Flux CRM** system built with Flutter 3.x, connecting directly to the existing **Django REST Framework (DRF)** backend and the live **MariaDB database (`impression_inventory`)**.

---

## 📱 Architecture & Highlights

- **100% Shared Backend & Database**: Operates against the exact same Django backend as the React web application (`impression_backend` on `http://127.0.0.1:8000`). Zero duplicate models or secondary databases.
- **Enterprise Clean Architecture**:
  - `lib/core/`: Network clients (Dio), DRF token auth interceptor, exception handling, secure token persistence, and Material 3 design system.
  - `lib/models/`: Strongly-typed data models matching Django serializer schemas.
  - `lib/services/`: Centralized `CrmService` repository invoking all 51 backend endpoints.
  - `lib/features/`: Feature modules including Dashboard, Leads, Tasks, My Work, Reports, Users, Segments, Assignments, Quick Search, and 360° Timeline.
  - `lib/app/`: Declarative routing (`GoRouter`) with authentication redirect guards.
- **Strict Compliance with Business & Security Directives**:
  - **Identical Login Flow**: DRF Basic Auth handshake (`Authorization: Basic <base64(username:password)>` at `POST /api/login/`), storing the returned token and authenticating all subsequent requests via `Authorization: Token <token>`.
  - **User & Role Safety**: User & Role directory is **strictly read-only** on mobile to prevent accidental account changes.
  - **Hidden Module Preserved**: "Login Approval & Access Logs" is hidden from mobile navigation, matching web UI directives, while preserving backend endpoints.
  - **Full Task Group Management**: Complete support for creating, viewing, **EDITING**, and **DELETING** task groups while safeguarding historical activity logs.

---

## 🛠️ Prerequisites & Setup

1. **Flutter SDK**: Flutter 3.10+ / Dart 3.0+
2. **Django Backend**: Running at `http://127.0.0.1:8000` (MariaDB running).

### Installation

```bash
cd f:\Flux\Flux\flux_crm_mobile
flutter pub get
```

---

## 🌐 Network Configuration (Local Development)

By default, the app is pre-configured to communicate with the local Django server:

| Target Platform | Default API Base URL | Notes |
|---|---|---|
| **Android Emulator** | `http://10.0.2.2:8000/api` | Pre-configured as default |
| **iOS Simulator / Desktop** | `http://127.0.0.1:8000/api` | Standard loopback |
| **Physical Phone (Wi-Fi)** | `http://<YOUR_PC_IP>:8000/api` | Example: `http://192.168.1.100:8000/api` |

### In-App Server Settings
You do **not** need to recompile the app to change the server address!
- On the **Login Screen**: Tap the ⚙️ **Settings icon** in the top-right corner.
- In the **Main App**: Open the navigation drawer and tap **"Server Configuration"**.
- Enter your computer's LAN IP or backend domain and tap **Save**. It persists instantly in secure storage.

---

## 🚀 Running the Mobile Application

### Debug Mode (Connected Device / Emulator)

```bash
flutter run
```

### Run Unit Tests

```bash
flutter test
```

### Build Android APK

```bash
flutter build apk --release
```
The output APK will be generated at:
`build/app/outputs/flutter-apk/app-release.apk`

---

## 📂 Modules Implemented

1. **Authentication (`/login`)**:
   - DRF Basic Auth exchange.
   - Dynamic server URL switcher.
   - Error banners for invalid credentials or connection issues.
2. **CRM Dashboard (`/dashboard`)**:
   - Top greeting and role indicator.
   - 4 KPI cards: Total Leads, Active Tasks, Pending Activities, Completed Activities.
   - Quick Action shortcuts: New Lead, New Task, My Work, Excel Import.
   - Live segment lead distribution counters.
   - Recent work activity stream with status badges.
3. **Lead Management (`/leads`)**:
   - Searchable, segment-filterable, and status-chip-filterable lead list.
   - Lead detail view with direct Phone Call (`tel:`) and Email (`mailto:`) launcher.
   - Lead creation & editing form with validation.
   - Soft-delete lead confirmation dialog.
4. **Excel Lead Import (`/leads/import`)**:
   - Excel (`.xlsx`, `.xls`) and `.csv` file picker.
   - Server-side preview of parsed headers and sample rows.
   - Visual column mapping dropdowns.
   - Duplicate policy selection (Skip vs. Overwrite).
   - Bulk commit with progress and result metrics.
5. **Task Group Management (`/tasks`)**:
   - Status tabs (All, Active, Completed, Pending).
   - Progress bar showing completed vs. total activities with percentage.
   - Task detail screen with assigned staff and linked leads.
   - **Edit Task Group**: Modifies title, description, dates, priority, status, assigned staff, and leads.
   - **Delete Task Group**: Safe deletion modal preserving historical staff activity logs.
6. **My Work Dashboard (`/my-work`)**:
   - Daily execution view for staff members.
   - Quick date selector (Today, Yesterday, Tomorrow, Custom Calendar Picker).
   - Quick counters (Total, Pending, Completed).
   - Tap-to-update modal sheet: Update status (Pending, Contacted, In Progress, Qualified, Completed, Cancelled), record interaction notes, and schedule the next follow-up date/time.
7. **Performance Reports (`/reports`)**:
   - Date range picker.
   - Summary metric cards.
   - Staff productivity leaderboard table (Staff name, Total Assigned, Completed, Pending, Completion %).
8. **User & Role Directory (`/users`)**:
   - Read-only list displaying all CRM users, roles (Admin, Manager, Staff), and active status.
9. **Segment Management (`/segments`)**:
   - Segment list with lead counters.
   - Modal dialogs for adding, editing, and deleting segments.
10. **Lead Assignment (`/assignments`)**:
    - Unassigned leads tab with multi-select checkboxes.
    - Bulk assignment to selected staff member with optional instructions.
    - Assignment history timeline.
11. **Quick Search (`/quick-search`)**:
    - Real-time debounced search across company name, contact, phone, and email.
    - Direct tap-to-navigate to lead details.
12. **360° Communication Timeline (`/leads/:id/timeline`)**:
    - Chronological activity stream (Calls, Emails, Meetings, WhatsApp).
    - Channel filter chips.
    - "Log Interaction" modal with channel selector, summary, and notes.

---

## 🔒 Security & Data Integrity

- Cleartext traffic is enabled in Android Manifest specifically for local development servers (`http://...`).
- Tokens are stored using platform-encrypted keystore (`flutter_secure_storage`).
- Global 401 handling gracefully prompts for re-authentication without app crash.
- Strict read-only enforcement on User Management prevents accidental data disruption.
