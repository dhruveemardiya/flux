/// Represents a communication interaction log for 360° lead timeline.
class CRMCommunicationLog {
  final int id;
  final int leadId;
  final String leadCompany;
  final String channel; // 'call', 'email', 'meeting', 'whatsapp', 'sms', 'other'
  final String summary;
  final String notes;
  final int? loggedById;
  final String loggedByName;
  final String createdAt;

  CRMCommunicationLog({
    required this.id,
    required this.leadId,
    this.leadCompany = '',
    required this.channel,
    required this.summary,
    this.notes = '',
    this.loggedById,
    this.loggedByName = '',
    required this.createdAt,
  });

  factory CRMCommunicationLog.fromJson(Map<String, dynamic> json) {
    return CRMCommunicationLog(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      leadId: json['lead'] is int
          ? json['lead']
          : (json['lead'] is Map ? json['lead']['id'] : int.tryParse(json['lead_id']?.toString() ?? '0') ?? 0),
      leadCompany: json['lead_company']?.toString() ??
          (json['lead'] is Map ? json['lead']['company_name']?.toString() : ''),
      channel: json['channel']?.toString().toLowerCase() ?? 'call',
      summary: json['summary']?.toString() ?? 'Interaction',
      notes: json['notes']?.toString() ?? '',
      loggedById: json['logged_by'] is int
          ? json['logged_by']
          : (json['logged_by'] is Map ? json['logged_by']['id'] : int.tryParse(json['logged_by_id']?.toString() ?? '')),
      loggedByName: json['logged_by_name']?.toString() ??
          (json['logged_by'] is Map ? json['logged_by']['username']?.toString() : ''),
      createdAt: json['created_at']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'lead': leadId,
      'channel': channel,
      'summary': summary,
      'notes': notes,
    };
  }
}
