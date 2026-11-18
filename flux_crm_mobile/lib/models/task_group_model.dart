import 'user_model.dart';
import 'lead_model.dart';

/// Represents a collaborative Task Group coordinating staff and leads.
class TaskGroup {
  final int id;
  final String title;
  final String description;
  final String startDate; // YYYY-MM-DD
  final String endDate;   // YYYY-MM-DD
  final String priority;  // 'low', 'medium', 'high', 'urgent'
  final String status;    // 'pending', 'active', 'completed', 'cancelled'
  final List<int> assignedStaffIds;
  final List<CRMUser> assignedStaff;
  final List<int> leadIds;
  final List<CRMLead> leads;
  final int totalActivities;
  final int completedActivities;
  final String? createdAt;

  TaskGroup({
    required this.id,
    required this.title,
    this.description = '',
    required this.startDate,
    required this.endDate,
    this.priority = 'medium',
    this.status = 'active',
    this.assignedStaffIds = const [],
    this.assignedStaff = const [],
    this.leadIds = const [],
    this.leads = const [],
    this.totalActivities = 0,
    this.completedActivities = 0,
    this.createdAt,
  });

  double get progress {
    if (totalActivities == 0) return 0.0;
    return (completedActivities / totalActivities).clamp(0.0, 1.0);
  }

  int get progressPercent => (progress * 100).round();

  factory TaskGroup.fromJson(Map<String, dynamic> json) {
    // Parse assigned staff
    final staffList = <CRMUser>[];
    final staffIds = <int>[];
    if (json['assigned_staff'] is List) {
      for (final item in json['assigned_staff']) {
        if (item is Map<String, dynamic>) {
          final u = CRMUser.fromJson(item);
          staffList.add(u);
          staffIds.add(u.id);
        } else if (item is int) {
          staffIds.add(item);
        }
      }
    }

    // Parse leads
    final leadList = <CRMLead>[];
    final leadIdList = <int>[];
    if (json['leads'] is List) {
      for (final item in json['leads']) {
        if (item is Map<String, dynamic>) {
          final l = CRMLead.fromJson(item);
          leadList.add(l);
          leadIdList.add(l.id);
        } else if (item is int) {
          leadIdList.add(item);
        }
      }
    }

    return TaskGroup(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      title: json['title']?.toString() ?? 'Untitled Task',
      description: json['description']?.toString() ?? '',
      startDate: json['start_date']?.toString() ?? '',
      endDate: json['end_date']?.toString() ?? '',
      priority: json['priority']?.toString().toLowerCase() ?? 'medium',
      status: json['status']?.toString().toLowerCase() ?? 'active',
      assignedStaffIds: staffIds,
      assignedStaff: staffList,
      leadIds: leadIdList,
      leads: leadList,
      totalActivities: json['activities_count'] is int
          ? json['activities_count']
          : (json['total_activities'] is int ? json['total_activities'] : 0),
      completedActivities: json['completed_activities'] is int
          ? json['completed_activities']
          : (json['completed_count'] is int ? json['completed_count'] : 0),
      createdAt: json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'start_date': startDate,
      'end_date': endDate,
      'priority': priority,
      'status': status,
      'assigned_staff_ids': assignedStaffIds,
      'lead_ids': leadIds,
    };
  }
}
