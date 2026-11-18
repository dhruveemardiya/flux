import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

/// Secure persistence service for auth tokens, cached credentials, and server configurations.
class SecureStorageService {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  late final SharedPreferences _sharedPrefs;
  bool _initialized = false;

  Future<void> init() async {
    if (!_initialized) {
      _sharedPrefs = await SharedPreferences.getInstance();
      _initialized = true;
    }
  }

  // Auth Token
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: AppConstants.keyAuthToken, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: AppConstants.keyAuthToken);
  }

  Future<void> deleteToken() async {
    await _secureStorage.delete(key: AppConstants.keyAuthToken);
  }

  // User Role
  Future<void> saveUserRole(String role) async {
    await _secureStorage.write(key: AppConstants.keyUserRole, value: role);
  }

  Future<String?> getUserRole() async {
    return await _secureStorage.read(key: AppConstants.keyUserRole);
  }

  // User Data JSON
  Future<void> saveUserData(String jsonString) async {
    await _secureStorage.write(key: AppConstants.keyUserData, value: jsonString);
  }

  Future<String?> getUserData() async {
    return await _secureStorage.read(key: AppConstants.keyUserData);
  }

  // Custom Base URL (allows toggling between emulator 10.0.2.2, localhost 127.0.0.1, or LAN IP)
  Future<void> saveCustomBaseUrl(String url) async {
    if (!_initialized) await init();
    await _sharedPrefs.setString(AppConstants.keyCustomBaseUrl, url);
  }

  Future<String> getBaseUrl() async {
    if (!_initialized) await init();
    final customUrl = _sharedPrefs.getString(AppConstants.keyCustomBaseUrl);
    if (customUrl != null && customUrl.trim().isNotEmpty) {
      return customUrl.trim();
    }
    return AppConstants.defaultBaseUrl;
  }

  // Clear Session
  Future<void> clearSession() async {
    await _secureStorage.delete(key: AppConstants.keyAuthToken);
    await _secureStorage.delete(key: AppConstants.keyUserRole);
    await _secureStorage.delete(key: AppConstants.keyUserData);
  }
}
