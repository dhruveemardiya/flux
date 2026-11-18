/// Represents a CRM Segment grouping leads by vertical, industry, or geography.
class CRMSegment {
  final int id;
  final String name;
  final String description;
  final int leadCount;
  final String? createdAt;

  CRMSegment({
    required this.id,
    required this.name,
    this.description = '',
    this.leadCount = 0,
    this.createdAt,
  });

  factory CRMSegment.fromJson(Map<String, dynamic> json) {
    return CRMSegment(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['name']?.toString() ?? 'Unnamed Segment',
      description: json['description']?.toString() ?? '',
      leadCount: json['leads_count'] is int
          ? json['leads_count']
          : (json['lead_count'] is int
              ? json['lead_count']
              : int.tryParse(json['lead_count']?.toString() ?? '0') ?? 0),
      createdAt: json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
    };
  }
}
