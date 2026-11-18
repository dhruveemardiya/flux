import 'dart:convert';

/// Represents a system user and their CRM role.
class CRMUser {
  final int id;
  final String username;
  final String email;
  final String firstName;
  final String lastName;
  final String role; // 'admin', 'manager', 'staff'
  final bool isActive;

  CRMUser({
    required this.id,
    required this.username,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.isActive = true,
  });

  String get displayName {
    final full = '$firstName $lastName'.trim();
    return full.isNotEmpty ? full : username;
  }

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isManager => role.toLowerCase() == 'manager' || isAdmin;
  bool get isStaff => role.toLowerCase() == 'staff';

  factory CRMUser.fromJson(Map<String, dynamic> json) {
    return CRMUser(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['first_name']?.toString() ?? '',
      lastName: json['last_name']?.toString() ?? '',
      role: json['role']?.toString().toLowerCase() ?? 'staff',
      isActive: json['is_active'] is bool ? json['is_active'] : true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'role': role,
      'is_active': isActive,
    };
  }

  String serialize() => jsonEncode(toJson());

  factory CRMUser.deserialize(String jsonString) {
    return CRMUser.fromJson(jsonDecode(jsonString) as Map<String, dynamic>);
  }
}
