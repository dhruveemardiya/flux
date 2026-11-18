import 'dart:io';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage_service.dart';
import 'api_exceptions.dart';
import 'api_interceptors.dart';

/// Configured HTTP client wrapper built on Dio.
class ApiClient {
  final SecureStorageService storageService;
  late final Dio _dio;

  ApiClient({required this.storageService, Function()? onUnauthorized}) {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.defaultBaseUrl,
        connectTimeout: const Duration(seconds: AppConstants.connectTimeoutSeconds),
        receiveTimeout: const Duration(seconds: AppConstants.receiveTimeoutSeconds),
        sendTimeout: const Duration(seconds: AppConstants.sendTimeoutSeconds),
        responseType: ResponseType.json,
      ),
    );

    _dio.interceptors.add(
      AuthInterceptor(storageService, onUnauthorized: onUnauthorized),
    );
  }

  /// Update the base URL at runtime (e.g. user toggles LAN IP)
  void updateBaseUrl(String newBaseUrl) {
    _dio.options.baseUrl = newBaseUrl;
  }

  /// Synchronize base URL with saved preference
  Future<void> syncBaseUrl() async {
    final url = await storageService.getBaseUrl();
    _dio.options.baseUrl = url;
  }

  // HTTP GET
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      await syncBaseUrl();
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  // HTTP POST
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      await syncBaseUrl();
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  // HTTP PUT
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      await syncBaseUrl();
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  // HTTP PATCH
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      await syncBaseUrl();
      return await _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  // HTTP DELETE
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      await syncBaseUrl();
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  // POST Multipart / Form Data (for Excel Import)
  Future<Response<T>> uploadFile<T>(
    String path, {
    required File file,
    String fileField = 'file',
    Map<String, dynamic>? additionalFields,
  }) async {
    try {
      await syncBaseUrl();
      final String fileName = file.path.split(Platform.pathSeparator).last;
      final formData = FormData.fromMap({
        fileField: await MultipartFile.fromFile(file.path, filename: fileName),
        ...?additionalFields,
      });

      return await _dio.post<T>(
        path,
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }
}
