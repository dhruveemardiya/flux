/// Central repository of all verified Django REST Framework endpoints for Flux CRM.
class ApiEndpoints {
  // 1. Authentication & Identity
  static const String login = '/login/';
  static const String logout = '/logout/';
  static const String currentUser = '/users/me/';
  static const String currentStaff = '/crm/my-staff/';

  // 2. CRM Dashboard & Analytics
  static const String dashboard = '/crm/dashboard/';
  static const String quickSearch = '/crm/quick-search/';
  static const String performanceReports = '/crm/reports/';

  // 3. User & Role Management
  static const String users = '/users/';
  static String userDetail(int id) => '/users/$id/';
  static const String roles = '/roles/';
  static const String staffUsers = '/crm/staff-users/';

  // 4. Segment Management
  static const String segments = '/crm/segments/';
  static String segmentDetail(int id) => '/crm/segments/$id/';

  // 5. Lead Management & Excel Import
  static const String leads = '/crm/leads/';
  static String leadDetail(int id) => '/crm/leads/$id/';
  static const String leadImportPreview = '/crm/leads/import/preview/';
  static const String leadImportCommit = '/crm/leads/import/commit/';

  // 6. Lead Assignment & History
  static const String leadAssignments = '/crm/assignments/';
  static const String leadAssignmentHistory = '/crm/assignments/history/';

  // 7. Task Management (Task Groups & Activities)
  static const String taskGroups = '/crm/task-groups/';
  static String taskGroupDetail(int id) => '/crm/task-groups/$id/';
  static const String taskActivities = '/crm/task-activities/';
  static String taskActivityDetail(int id) => '/crm/task-activities/$id/';

  // 8. My Work Dashboard & Staff Execution
  static const String myWork = '/crm/my-work/';
  static const String myWorkActivities = '/crm/my-work/activities/';
  static String myWorkActivityUpdate(int id) => '/crm/my-work/activities/$id/';

  // 9. Lead 360° Timeline & Communication History
  static String leadTimeline(int leadId) => '/crm/leads/$leadId/timeline/';
  static const String communicationLogs = '/crm/communication-logs/';
  static String communicationLogDetail(int id) => '/crm/communication-logs/$id/';

  // 10. Preserved Backend Modules (Hidden in UI)
  static const String accessRequests = '/crm/access-requests/';
  static const String accessLogs = '/crm/access-logs/';
}
