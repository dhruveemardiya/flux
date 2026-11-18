/// Application-wide constants, configuration defaults, and storage keys.
class AppConstants {
  static const String appName = 'Flux CRM';
  static const String appVersion = '1.0.0';

  // Network Configuration Defaults
  // Android Emulator accesses host via 10.0.2.2; iOS/Desktop uses 127.0.0.1
  static const String defaultAndroidEmulatorUrl = 'http://10.0.2.2:8000/api';
  static const String defaultIosSimulatorUrl = 'http://127.0.0.1:8000/api';
  static const String defaultBaseUrl = defaultAndroidEmulatorUrl;

  static const int connectTimeoutSeconds = 15;
  static const int receiveTimeoutSeconds = 15;
  static const int sendTimeoutSeconds = 15;

  // Storage Keys for Secure Storage & Preferences
  static const String keyAuthToken = 'flux_crm_auth_token';
  static const String keyUserRole = 'flux_crm_user_role';
  static const String keyUserData = 'flux_crm_user_data';
  static const String keyCustomBaseUrl = 'flux_crm_custom_base_url';

  // CRM Roles matching Django backend
  static const String roleAdmin = 'admin';
  static const String roleManager = 'manager';
  static const String roleStaff = 'staff';

  // Lead Statuses
  static const List<String> leadStatuses = [
    'new',
    'contacted',
    'qualified',
    'proposal_sent',
    'negotiation',
    'won',
    'lost',
  ];

  // Activity Statuses (My Work & Task Activities)
  static const List<String> activityStatuses = [
    'pending',
    'in_progress',
    'completed',
    'cancelled',
  ];

  // Communication Channels
  static const List<String> communicationChannels = [
    'call',
    'email',
    'whatsapp',
    'meeting',
    'sms',
    'other',
  ];
}
