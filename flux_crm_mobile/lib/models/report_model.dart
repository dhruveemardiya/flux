/// Represents staff member performance metrics in CRM reports.
class StaffPerformanceMetric {
  final int staffId;
  final String staffName;
  final int totalAssigned;
  final int completed;
  final int pending;

  StaffPerformanceMetric({
    required this.staffId,
    required this.staffName,
    required this.totalAssigned,
    required this.completed,
    required this.pending,
  });

  double get completionRate =>
      totalAssigned > 0 ? (completed / totalAssigned) : 0.0;

  int get completionPercent => (completionRate * 100).round();

  factory StaffPerformanceMetric.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceMetric(
      staffId: json['staff_id'] is int ? json['staff_id'] : int.tryParse(json['staff_id']?.toString() ?? '0') ?? 0,
      staffName: json['staff_name']?.toString() ?? json['username']?.toString() ?? 'Staff',
      totalAssigned: json['total_assigned'] is int ? json['total_assigned'] : int.tryParse(json['total_assigned']?.toString() ?? '0') ?? 0,
      completed: json['completed'] is int ? json['completed'] : int.tryParse(json['completed']?.toString() ?? '0') ?? 0,
      pending: json['pending'] is int ? json['pending'] : int.tryParse(json['pending']?.toString() ?? '0') ?? 0,
    );
  }
}

/// Overall CRM Performance Report model matching GET /api/crm/reports/.
class CRMPerformanceReport {
  final int totalActivities;
  final int completedActivities;
  final int pendingActivities;
  final double overallCompletionRate;
  final List<StaffPerformanceMetric> staffMetrics;

  CRMPerformanceReport({
    this.totalActivities = 0,
    this.completedActivities = 0,
    this.pendingActivities = 0,
    this.overallCompletionRate = 0.0,
    this.staffMetrics = const [],
  });

  factory CRMPerformanceReport.fromJson(Map<String, dynamic> json) {
    final staffList = <StaffPerformanceMetric>[];
    if (json['staff_metrics'] is List) {
      for (final s in json['staff_metrics']) {
        if (s is Map<String, dynamic>) {
          staffList.add(StaffPerformanceMetric.fromJson(s));
        }
      }
    } else if (json['staff_performance'] is List) {
      for (final s in json['staff_performance']) {
        if (s is Map<String, dynamic>) {
          staffList.add(StaffPerformanceMetric.fromJson(s));
        }
      }
    }

    final total = json['total_activities'] is int ? json['total_activities'] : 0;
    final completed = json['completed_activities'] is int ? json['completed_activities'] : 0;
    final pending = json['pending_activities'] is int ? json['pending_activities'] : 0;

    return CRMPerformanceReport(
      totalActivities: total,
      completedActivities: completed,
      pendingActivities: pending,
      overallCompletionRate: total > 0 ? (completed / total) : 0.0,
      staffMetrics: staffList,
    );
  }
}
