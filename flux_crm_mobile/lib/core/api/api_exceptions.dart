import 'package:dio/dio.dart';

/// Base exception class for API errors.
abstract class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic rawData;

  ApiException(this.message, {this.statusCode, this.rawData});

  @override
  String toString() => message;
}

/// Network connectivity, socket timeout, or host unreachable error.
class NetworkException extends ApiException {
  NetworkException(String message) : super(message);
}

/// 401 Unauthorized - Invalid credentials or expired session token.
class UnauthorizedException extends ApiException {
  UnauthorizedException([String message = 'Authentication required. Please sign in again.'])
      : super(message, statusCode: 401);
}

/// 403 Forbidden - Permission denied for current CRM role.
class ForbiddenException extends ApiException {
  ForbiddenException([String message = 'You do not have permission to perform this action.'])
      : super(message, statusCode: 403);
}

/// 404 Resource Not Found.
class NotFoundException extends ApiException {
  NotFoundException([String message = 'Requested resource was not found.'])
      : super(message, statusCode: 404);
}

/// 400 Bad Request - DRF validation error with field-level feedback.
class ValidationException extends ApiException {
  final Map<String, List<String>> fieldErrors;

  ValidationException(String message, {this.fieldErrors = const {}, dynamic rawData})
      : super(message, statusCode: 400, rawData: rawData);

  factory ValidationException.fromResponse(dynamic data) {
    if (data is Map) {
      if (data.containsKey('detail') && data['detail'] is String) {
        return ValidationException(data['detail'] as String, rawData: data);
      }
      if (data.containsKey('error') && data['error'] is String) {
        return ValidationException(data['error'] as String, rawData: data);
      }
      if (data.containsKey('message') && data['message'] is String) {
        return ValidationException(data['message'] as String, rawData: data);
      }

      final Map<String, List<String>> fields = {};
      data.forEach((key, value) {
        if (value is List) {
          fields[key.toString()] = value.map((e) => e.toString()).toList();
        } else if (value is String) {
          fields[key.toString()] = [value];
        }
      });

      final String summary = fields.entries
          .map((e) => '${e.key}: ${e.value.join(", ")}')
          .join('\n');

      return ValidationException(
        summary.isNotEmpty ? summary : 'Validation error occurred.',
        fieldErrors: fields,
        rawData: data,
      );
    }
    return ValidationException(data?.toString() ?? 'Invalid request.');
  }
}

/// 500+ Internal Server Error.
class ServerException extends ApiException {
  ServerException([String message = 'Server error occurred. Please try again later.'])
      : super(message, statusCode: 500);
}

/// Helper to map DioError to typed ApiException.
ApiException mapDioError(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return NetworkException('Connection timed out. Check your server address and network.');
    case DioExceptionType.connectionError:
      return NetworkException(
        'Cannot connect to Flux backend at ${error.requestOptions.baseUrl}. '
        'Verify Django server is running and accessible.',
      );
    case DioExceptionType.badResponse:
      final statusCode = error.response?.statusCode;
      final data = error.response?.data;
      if (statusCode == 401) {
        return UnauthorizedException(
          data is Map && data['detail'] != null ? data['detail'].toString() : 'Invalid username or password.',
        );
      } else if (statusCode == 403) {
        return ForbiddenException(
          data is Map && data['detail'] != null ? data['detail'].toString() : 'Permission denied.',
        );
      } else if (statusCode == 404) {
        return NotFoundException();
      } else if (statusCode == 400) {
        return ValidationException.fromResponse(data);
      } else if (statusCode != null && statusCode >= 500) {
        return ServerException(
          'Internal server error ($statusCode). Please check backend logs.',
        );
      }
      return ValidationException(data?.toString() ?? 'Request failed with status $statusCode.');
    case DioExceptionType.cancel:
      return NetworkException('Request was cancelled.');
    case DioExceptionType.unknown:
    default:
      return NetworkException(error.message ?? 'An unexpected network error occurred.');
  }
}
