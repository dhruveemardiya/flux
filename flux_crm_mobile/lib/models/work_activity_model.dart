/// Represents an actionable staff task activity for a specific lead.
class LeadTaskActivity {
  final int id;
  final int taskGroupId;
  final String taskTitle;
  final int leadId;
  final String leadCompany;
  final String leadContact;
  final String leadPhone;
  final int? assignedToId;
  final String assignedToName;
  final String status;
  final String notes;
  final String? scheduledFollowupAt;
  final String? updatedAt;

  LeadTaskActivity({
    required this.id,
    required this.taskGroupId,
    required this.taskTitle,
    required this.leadId,
    required this.leadCompany,
    this.leadContact = '',
    this.leadPhone = '',
    this.assignedToId,
    this.assignedToName = '',
    this.status = 'pending',
    this.notes = '',
    this.scheduledFollowupAt,
    this.updatedAt,
  });

  bool get isCompleted => status.toLowerCase() == 'completed' || status.toLowerCase() == 'closed_won';

  factory LeadTaskActivity.fromJson(Map<String, dynamic> json) {
    return LeadTaskActivity(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      taskGroupId: json['task_group'] is int
          ? json['task_group']
          : (json['task_group'] is Map ? json['task_group']['id'] : int.tryParse(json['task_group_id']?.toString() ?? '0') ?? 0),
      taskTitle: json['task_title']?.toString() ??
          (json['task_group'] is Map ? json['task_group']['title']?.toString() : 'Task Activity'),
      leadId: json['lead'] is int
          ? json['lead']
          : (json['lead'] is Map ? json['lead']['id'] : int.tryParse(json['lead_id']?.toString() ?? '0') ?? 0),
      leadCompany: json['lead_company']?.toString() ??
          (json['lead'] is Map ? json['lead']['company_name']?.toString() : 'Company'),
      leadContact: json['lead_contact']?.toString() ??
          (json['lead'] is Map ? json['lead']['contact_person']?.toString() : ''),
      leadPhone: json['lead_phone']?.toString() ??
          (json['lead'] is Map ? json['lead']['phone']?.toString() : ''),
      assignedToId: json['assigned_to'] is int
          ? json['assigned_to']
          : (json['assigned_to'] is Map ? json['assigned_to']['id'] : int.tryParse(json['assigned_to_id']?.toString() ?? '')),
      assignedToName: json['assigned_to_name']?.toString() ??
          (json['assigned_to'] is Map ? json['assigned_to']['username']?.toString() : ''),
      status: json['status']?.toString().toLowerCase() ?? 'pending',
      notes: json['notes']?.toString() ?? '',
      scheduledFollowupAt: json['scheduled_followup_at']?.toString() ?? json['followup_date']?.toString(),
      updatedAt: json['updated_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'notes': notes,
      if (scheduledFollowupAt != null) 'scheduled_followup_at': scheduledFollowupAt,
    };
  }
}
