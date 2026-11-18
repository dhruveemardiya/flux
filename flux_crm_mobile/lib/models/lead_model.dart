/// Represents a CRM Lead record matching the Django backend CRMSegmentLead / CRMLead.
class CRMLead {
  final int id;
  final String companyName;
  final String contactPerson;
  final String email;
  final String phone;
  final String status;
  final int? segmentId;
  final String? segmentName;
  final int? assignedToId;
  final String? assignedToName;
  final String notes;
  final String address;
  final String city;
  final String state;
  final String country;
  final String? createdAt;
  final String? updatedAt;

  CRMLead({
    required this.id,
    required this.companyName,
    required this.contactPerson,
    required this.email,
    required this.phone,
    required this.status,
    this.segmentId,
    this.segmentName,
    this.assignedToId,
    this.assignedToName,
    this.notes = '',
    this.address = '',
    this.city = '',
    this.state = '',
    this.country = '',
    this.createdAt,
    this.updatedAt,
  });

  factory CRMLead.fromJson(Map<String, dynamic> json) {
    return CRMLead(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      companyName: json['company_name']?.toString() ?? json['company']?.toString() ?? 'Unnamed Company',
      contactPerson: json['contact_person']?.toString() ?? json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      status: json['status']?.toString().toLowerCase() ?? 'new',
      segmentId: json['segment'] is int
          ? json['segment']
          : (json['segment'] is Map ? json['segment']['id'] : int.tryParse(json['segment_id']?.toString() ?? '')),
      segmentName: json['segment_name']?.toString() ??
          (json['segment'] is Map ? json['segment']['name']?.toString() : null),
      assignedToId: json['assigned_to'] is int
          ? json['assigned_to']
          : (json['assigned_to'] is Map ? json['assigned_to']['id'] : int.tryParse(json['assigned_to_id']?.toString() ?? '')),
      assignedToName: json['assigned_to_name']?.toString() ??
          (json['assigned_to'] is Map ? json['assigned_to']['username']?.toString() : null),
      notes: json['notes']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      country: json['country']?.toString() ?? '',
      createdAt: json['created_at']?.toString(),
      updatedAt: json['updated_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'company_name': companyName,
      'contact_person': contactPerson,
      'email': email,
      'phone': phone,
      'status': status,
      if (segmentId != null) 'segment': segmentId,
      if (assignedToId != null) 'assigned_to': assignedToId,
      'notes': notes,
      'address': address,
      'city': city,
      'state': state,
      'country': country,
    };
  }

  CRMLead copyWith({
    String? companyName,
    String? contactPerson,
    String? email,
    String? phone,
    String? status,
    int? segmentId,
    String? segmentName,
    int? assignedToId,
    String? assignedToName,
    String? notes,
    String? address,
    String? city,
    String? state,
    String? country,
  }) {
    return CRMLead(
      id: id,
      companyName: companyName ?? this.companyName,
      contactPerson: contactPerson ?? this.contactPerson,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      status: status ?? this.status,
      segmentId: segmentId ?? this.segmentId,
      segmentName: segmentName ?? this.segmentName,
      assignedToId: assignedToId ?? this.assignedToId,
      assignedToName: assignedToName ?? this.assignedToName,
      notes: notes ?? this.notes,
      address: address ?? this.address,
      city: city ?? this.city,
      state: state ?? this.state,
      country: country ?? this.country,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
