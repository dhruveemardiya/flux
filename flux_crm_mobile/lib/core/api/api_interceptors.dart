import 'package:dio/dio.dart';
import '../storage/secure_storage_service.dart';

/// Interceptor that attaches the DRF Token to requests and handles global 401 responses.
class AuthInterceptor extends Interceptor {
  final SecureStorageService _storageService;
  final Function()? onUnauthorized;

  AuthInterceptor(this._storageService, {this.onUnauthorized});

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // If the request already has an Authorization header (e.g. Basic Auth for /api/login/), keep it
    if (!options.headers.containsKey('Authorization')) {
      final token = await _storageService.getToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Token $token';
      }
    }

    options.headers['Accept'] = 'application/json';
    if (!options.headers.containsKey('Content-Type') && options.data is! FormData) {
      options.headers['Content-Type'] = 'application/json';
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Don't trigger global logout if the 401 was during the login attempt itself
      if (!err.requestOptions.path.contains('/login/')) {
        onUnauthorized?.call();
      }
    }
    handler.next(err);
  }
}
