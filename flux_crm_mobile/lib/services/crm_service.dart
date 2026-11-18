import 'dart:io';
import '../core/api/api_client.dart';
import '../core/api/api_endpoints.dart';
import '../models/dashboard_stats_model.dart';
import '../models/lead_model.dart';
import '../models/segment_model.dart';
import '../models/task_group_model.dart';
import '../models/work_activity_model.dart';
import '../models/communication_log_model.dart';
import '../models/report_model.dart';
import '../models/user_model.dart';

/// Central service communicating with all Flux CRM backend endpoints.
class CrmService {
  final ApiClient apiClient;

  CrmService(this.apiClient);

  // ==========================================
  // DASHBOARD & QUICK SEARCH
  // ==========================================

  Future<DashboardStats> getDashboardStats() async {
    final response = await apiClient.get(ApiEndpoints.dashboard);
    if (response.data is Map<String, dynamic>) {
      return DashboardStats.fromJson(response.data as Map<String, dynamic>);
    }
    return DashboardStats();
  }

  Future<List<CRMLead>> quickSearch(String query) async {
    if (query.trim().isEmpty) return [];
    final response = await apiClient.get(
      ApiEndpoints.quickSearch,
      queryParameters: {'q': query.trim()},
    );

    final results = <CRMLead>[];
    if (response.data is List) {
      for (final item in response.data as List) {
        if (item is Map<String, dynamic>) {
          results.add(CRMLead.fromJson(item));
        }
      }
    } else if (response.data is Map && response.data['results'] is List) {
      for (final item in response.data['results'] as List) {
        if (item is Map<String, dynamic>) {
          results.add(CRMLead.fromJson(item));
        }
      }
    }
    return results;
  }

  // ==========================================
  // LEAD MANAGEMENT
  // ==========================================

  Future<List<CRMLead>> getLeads({int? segmentId, String? status, String? search}) async {
    final Map<String, dynamic> params = {};
    if (segmentId != null) params['segment'] = segmentId;
    if (status != null && status.isNotEmpty && status != 'all') params['status'] = status;
    if (search != null && search.trim().isNotEmpty) params['search'] = search.trim();

    final response = await apiClient.get(ApiEndpoints.leads, queryParameters: params);
    final leads = <CRMLead>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        leads.add(CRMLead.fromJson(item));
      }
    }
    return leads;
  }

  Future<CRMLead> getLeadDetail(int id) async {
    final response = await apiClient.get(ApiEndpoints.leadDetail(id));
    return CRMLead.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CRMLead> createLead(Map<String, dynamic> data) async {
    final response = await apiClient.post(ApiEndpoints.leads, data: data);
    return CRMLead.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CRMLead> updateLead(int id, Map<String, dynamic> data) async {
    final response = await apiClient.put(ApiEndpoints.leadDetail(id), data: data);
    return CRMLead.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteLead(int id) async {
    await apiClient.delete(ApiEndpoints.leadDetail(id));
  }

  // ==========================================
  // EXCEL LEAD IMPORT
  // ==========================================

  Future<Map<String, dynamic>> previewLeadImport(File file) async {
    final response = await apiClient.uploadFile(
      ApiEndpoints.leadImportPreview,
      file: file,
      fileField: 'file',
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> commitLeadImport({
    required List<Map<String, dynamic>> rows,
    required Map<String, String> mapping,
    int? segmentId,
    String duplicatePolicy = 'skip',
  }) async {
    final payload = {
      'rows': rows,
      'mapping': mapping,
      if (segmentId != null) 'segment_id': segmentId,
      'duplicate_policy': duplicatePolicy,
    };
    final response = await apiClient.post(ApiEndpoints.leadImportCommit, data: payload);
    return response.data as Map<String, dynamic>;
  }

  // ==========================================
  // SEGMENT MANAGEMENT
  // ==========================================

  Future<List<CRMSegment>> getSegments() async {
    final response = await apiClient.get(ApiEndpoints.segments);
    final segments = <CRMSegment>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        segments.add(CRMSegment.fromJson(item));
      }
    }
    return segments;
  }

  Future<CRMSegment> createSegment(String name, String description) async {
    final response = await apiClient.post(
      ApiEndpoints.segments,
      data: {'name': name, 'description': description},
    );
    return CRMSegment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CRMSegment> updateSegment(int id, String name, String description) async {
    final response = await apiClient.put(
      ApiEndpoints.segmentDetail(id),
      data: {'name': name, 'description': description},
    );
    return CRMSegment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteSegment(int id) async {
    await apiClient.delete(ApiEndpoints.segmentDetail(id));
  }

  // ==========================================
  // TASK GROUP MANAGEMENT (WITH EDIT & DELETE)
  // ==========================================

  Future<List<TaskGroup>> getTaskGroups({String? status, String? priority}) async {
    final Map<String, dynamic> params = {};
    if (status != null && status.isNotEmpty && status != 'all') params['status'] = status;
    if (priority != null && priority.isNotEmpty && priority != 'all') params['priority'] = priority;

    final response = await apiClient.get(ApiEndpoints.taskGroups, queryParameters: params);
    final groups = <TaskGroup>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        groups.add(TaskGroup.fromJson(item));
      }
    }
    return groups;
  }

  Future<TaskGroup> getTaskGroupDetail(int id) async {
    final response = await apiClient.get(ApiEndpoints.taskGroupDetail(id));
    return TaskGroup.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TaskGroup> createTaskGroup(Map<String, dynamic> data) async {
    final response = await apiClient.post(ApiEndpoints.taskGroups, data: data);
    return TaskGroup.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TaskGroup> updateTaskGroup(int id, Map<String, dynamic> data) async {
    final response = await apiClient.put(ApiEndpoints.taskGroupDetail(id), data: data);
    return TaskGroup.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteTaskGroup(int id) async {
    await apiClient.delete(ApiEndpoints.taskGroupDetail(id));
  }

  // ==========================================
  // MY WORK DASHBOARD & STAFF EXECUTION
  // ==========================================

  Future<List<LeadTaskActivity>> getMyWork({String? date, String? status}) async {
    final Map<String, dynamic> params = {};
    if (date != null && date.isNotEmpty) params['date'] = date;
    if (status != null && status.isNotEmpty && status != 'all') params['status'] = status;

    final response = await apiClient.get(ApiEndpoints.myWork, queryParameters: params);
    final activities = <LeadTaskActivity>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['activities'] is List) {
      items = response.data['activities'] as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        activities.add(LeadTaskActivity.fromJson(item));
      }
    }
    return activities;
  }

  Future<LeadTaskActivity> updateActivity(
    int id, {
    required String status,
    String? notes,
    String? scheduledFollowupAt,
  }) async {
    final payload = {
      'status': status,
      if (notes != null) 'notes': notes,
      if (scheduledFollowupAt != null) 'scheduled_followup_at': scheduledFollowupAt,
    };
    final response = await apiClient.put(ApiEndpoints.myWorkActivityUpdate(id), data: payload);
    return LeadTaskActivity.fromJson(response.data as Map<String, dynamic>);
  }

  // ==========================================
  // LEAD ASSIGNMENT & HISTORY
  // ==========================================

  Future<List<CRMLead>> getUnassignedLeads() async {
    return getLeads(status: 'new');
  }

  Future<void> assignLeads({
    required List<int> leadIds,
    required int staffId,
    String? notes,
  }) async {
    final payload = {
      'lead_ids': leadIds,
      'staff_id': staffId,
      if (notes != null) 'notes': notes,
    };
    await apiClient.post(ApiEndpoints.leadAssignments, data: payload);
  }

  Future<List<dynamic>> getAssignmentHistory() async {
    final response = await apiClient.get(ApiEndpoints.leadAssignmentHistory);
    if (response.data is List) {
      return response.data as List;
    }
    return [];
  }

  // ==========================================
  // 360° TIMELINE & COMMUNICATION LOGS
  // ==========================================

  Future<List<CRMCommunicationLog>> getLeadTimeline(int leadId) async {
    final response = await apiClient.get(ApiEndpoints.leadTimeline(leadId));
    final logs = <CRMCommunicationLog>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['timeline'] is List) {
      items = response.data['timeline'] as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        logs.add(CRMCommunicationLog.fromJson(item));
      }
    }
    return logs;
  }

  Future<CRMCommunicationLog> logCommunication({
    required int leadId,
    required String channel,
    required String summary,
    String? notes,
  }) async {
    final payload = {
      'lead': leadId,
      'channel': channel,
      'summary': summary,
      if (notes != null) 'notes': notes,
    };
    final response = await apiClient.post(ApiEndpoints.communicationLogs, data: payload);
    return CRMCommunicationLog.fromJson(response.data as Map<String, dynamic>);
  }

  // ==========================================
  // PERFORMANCE REPORTS
  // ==========================================

  Future<CRMPerformanceReport> getPerformanceReport({
    String? startDate,
    String? endDate,
    int? staffId,
  }) async {
    final Map<String, dynamic> params = {};
    if (startDate != null) params['start_date'] = startDate;
    if (endDate != null) params['end_date'] = endDate;
    if (staffId != null) params['staff_id'] = staffId;

    final response = await apiClient.get(ApiEndpoints.performanceReports, queryParameters: params);
    if (response.data is Map<String, dynamic>) {
      return CRMPerformanceReport.fromJson(response.data as Map<String, dynamic>);
    }
    return CRMPerformanceReport();
  }

  // ==========================================
  // USERS & STAFF DIRECTORY (STRICTLY READ-ONLY)
  // ==========================================

  Future<List<CRMUser>> getUsers() async {
    final response = await apiClient.get(ApiEndpoints.users);
    final users = <CRMUser>[];

    List items = [];
    if (response.data is List) {
      items = response.data as List;
    } else if (response.data is Map && response.data['results'] is List) {
      items = response.data['results'] as List;
    }

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        users.add(CRMUser.fromJson(item));
      }
    }
    return users;
  }

  Future<List<CRMUser>> getStaffUsers() async {
    try {
      final response = await apiClient.get(ApiEndpoints.staffUsers);
      final staff = <CRMUser>[];
      List items = [];
      if (response.data is List) {
        items = response.data as List;
      } else if (response.data is Map && response.data['results'] is List) {
        items = response.data['results'] as List;
      }
      for (final item in items) {
        if (item is Map<String, dynamic>) {
          staff.add(CRMUser.fromJson(item));
        }
      }
      return staff;
    } catch (_) {
      // Fallback: fetch /users/ and filter active
      final all = await getUsers();
      return all.where((u) => u.isActive).toList();
    }
  }
}
