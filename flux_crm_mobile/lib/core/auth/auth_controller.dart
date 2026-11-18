import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../api/api_exceptions.dart';
import '../storage/secure_storage_service.dart';
import '../../models/user_model.dart';

enum AuthStatus { initial, authenticating, authenticated, unauthenticated, error }

/// Manages authentication state, token lifecycle, and current user profile.
class AuthController extends ChangeNotifier {
  final ApiClient apiClient;
  final SecureStorageService storageService;

  AuthStatus _status = AuthStatus.initial;
  CRMUser? _currentUser;
  String? _errorMessage;

  AuthController({
    required this.apiClient,
    required this.storageService,
  });

  AuthStatus get status => _status;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _currentUser != null;
  CRMUser? get currentUser => _currentUser;
  String? get errorMessage => _errorMessage;

  /// Check stored token and restore user session on startup
  Future<void> checkAuth() async {
    _status = AuthStatus.authenticating;
    notifyListeners();

    try {
      final token = await storageService.getToken();
      if (token == null || token.isEmpty) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }

      // Try reading cached user first for instant display
      final cachedUserJson = await storageService.getUserData();
      if (cachedUserJson != null && cachedUserJson.isNotEmpty) {
        try {
          _currentUser = CRMUser.deserialize(cachedUserJson);
        } catch (_) {}
      }

      // Verify token with backend /api/users/me/
      final response = await apiClient.get(ApiEndpoints.currentUser);
      if (response.statusCode == 200 && response.data != null) {
        final userData = response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : (response.data is List && (response.data as List).isNotEmpty
                ? (response.data as List).first as Map<String, dynamic>
                : <String, dynamic>{});

        // Ensure role from storage or response is set
        final role = await storageService.getUserRole() ?? 'staff';
        userData['role'] = userData['role'] ?? role;

        _currentUser = CRMUser.fromJson(userData);
        await storageService.saveUserData(_currentUser!.serialize());
        _status = AuthStatus.authenticated;
      } else {
        await storageService.clearSession();
        _currentUser = null;
        _status = AuthStatus.unauthenticated;
      }
    } catch (e) {
      // If network unreachable but cached session exists, retain offline session
      if (_currentUser != null) {
        _status = AuthStatus.authenticated;
      } else {
        await storageService.clearSession();
        _status = AuthStatus.unauthenticated;
      }
    }

    notifyListeners();
  }

  /// Sign in using DRF Basic Authentication exchange matching web app
  Future<bool> login(String username, String password) async {
    _status = AuthStatus.authenticating;
    _errorMessage = null;
    notifyListeners();

    try {
      final String credentials = base64Encode(utf8.encode('$username:$password'));
      final response = await apiClient.post(
        ApiEndpoints.login,
        options: Options(
          headers: {
            'Authorization': 'Basic $credentials',
          },
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final String token = data['token']?.toString() ?? '';
        final String role = data['role']?.toString().toLowerCase() ?? 'staff';

        if (token.isEmpty) {
          throw ValidationException('Authentication failed: Missing token in server response.');
        }

        // Persist token and role
        await storageService.saveToken(token);
        await storageService.saveUserRole(role);

        // Fetch current user details via /api/users/me/
        final userResponse = await apiClient.get(ApiEndpoints.currentUser);
        Map<String, dynamic> userData = {};
        if (userResponse.data is Map<String, dynamic>) {
          userData = userResponse.data as Map<String, dynamic>;
        }
        userData['role'] = role;

        _currentUser = CRMUser.fromJson(userData);
        await storageService.saveUserData(_currentUser!.serialize());

        _status = AuthStatus.authenticated;
        notifyListeners();
        return true;
      } else {
        throw ValidationException('Invalid response from login server.');
      }
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during login. Please try again.';
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    }
  }

  /// Sign out and clear stored credentials
  Future<void> logout() async {
    try {
      // Attempt backend logout if online
      await apiClient.post(ApiEndpoints.logout).catchError((_) => null);
    } catch (_) {}

    await storageService.clearSession();
    _currentUser = null;
    _status = AuthStatus.unauthenticated;
    _errorMessage = null;
    notifyListeners();
  }
}
