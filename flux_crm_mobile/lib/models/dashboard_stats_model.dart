import 'work_activity_model.dart';

/// Aggregated dashboard metrics matching GET /api/crm/dashboard/.
class DashboardStats {
  final int totalLeads;
  final int activeTasks;
  final int pendingActivities;
  final int completedActivities;
  final int totalSegments;
  final Map<String, int> segmentDistribution;
  final List<LeadTaskActivity> recentActivities;

  DashboardStats({
    this.totalLeads = 0,
    this.activeTasks = 0,
    this.pendingActivities = 0,
    this.completedActivities = 0,
    this.totalSegments = 0,
    this.segmentDistribution = const {},
    this.recentActivities = const [],
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    final Map<String, int> segments = {};
    if (json['segment_distribution'] is Map) {
      json['segment_distribution'].forEach((k, v) {
        segments[k.toString()] = v is int ? v : int.tryParse(v.toString()) ?? 0;
      });
    } else if (json['segments'] is List) {
      for (final s in json['segments']) {
        if (s is Map && s['name'] != null) {
          segments[s['name'].toString()] = s['lead_count'] is int ? s['lead_count'] : 0;
        }
      }
    }

    final activities = <LeadTaskActivity>[];
    if (json['recent_activities'] is List) {
      for (final a in json['recent_activities']) {
        if (a is Map<String, dynamic>) {
          activities.add(LeadTaskActivity.fromJson(a));
        }
      }
    }

    return DashboardStats(
      totalLeads: json['total_leads'] is int
          ? json['total_leads']
          : int.tryParse(json['total_leads']?.toString() ?? '0') ?? 0,
      activeTasks: json['active_tasks'] is int
          ? json['active_tasks']
          : int.tryParse(json['active_tasks']?.toString() ?? '0') ?? 0,
      pendingActivities: json['pending_activities'] is int
          ? json['pending_activities']
          : int.tryParse(json['pending_activities']?.toString() ?? '0') ?? 0,
      completedActivities: json['completed_activities'] is int
          ? json['completed_activities']
          : int.tryParse(json['completed_activities']?.toString() ?? '0') ?? 0,
      totalSegments: json['total_segments'] is int
          ? json['total_segments']
          : int.tryParse(json['total_segments']?.toString() ?? '0') ?? segments.length,
      segmentDistribution: segments,
      recentActivities: activities,
    );
  }
}
