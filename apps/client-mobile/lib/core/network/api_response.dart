/// 서버 `@repo/shared-types` 의 `ApiResponse<T>` / `ProblemDetails` 와 1:1 대응하는 Dart 모델.
///
/// TypeScript 쪽 Zod 스키마와 마찬가지로, 신뢰 경계(네트워크)를 넘어온 JSON 은
/// 반드시 구조 검증 후 모델로 변환한다. 형식이 다르면 [FormatException] 을 던진다.
library;

/// JSON 디코더 시그니처. `dynamic` 대신 `Object?` 를 사용해 명시적 타입 검사를 강제한다.
typedef JsonDecoder<T> = T Function(Object? json);

typedef JsonMap = Map<String, Object?>;

final class ResponseMeta {
  const ResponseMeta({required this.timestamp, required this.requestId, required this.path});

  factory ResponseMeta.fromJson(Object? json) {
    if (json case {
      'timestamp': final String timestamp,
      'requestId': final String requestId,
      'path': final String path,
    }) {
      return ResponseMeta(timestamp: DateTime.parse(timestamp), requestId: requestId, path: path);
    }
    throw FormatException('Invalid ResponseMeta', json);
  }

  final DateTime timestamp;
  final String requestId;
  final String path;
}

/// 표준 성공 응답 `{ success: true, data: T, meta: {...} }`
final class ApiResponse<T> {
  const ApiResponse({required this.data, required this.meta});

  factory ApiResponse.fromJson(Object? json, JsonDecoder<T> decodeData) {
    if (json case {'success': true, 'data': final Object? data, 'meta': final Object? meta}) {
      return ApiResponse(data: decodeData(data), meta: ResponseMeta.fromJson(meta));
    }
    throw FormatException('Response is not a valid ApiResponse envelope', json);
  }

  final T data;
  final ResponseMeta meta;
}

final class FieldError {
  const FieldError({required this.field, required this.messages});

  factory FieldError.fromJson(Object? json) {
    if (json case {'field': final String field, 'messages': final List<Object?> messages}) {
      return FieldError(field: field, messages: messages.whereType<String>().toList());
    }
    throw FormatException('Invalid FieldError', json);
  }

  final String field;
  final List<String> messages;
}

/// RFC 7807 Problem Details
final class ProblemDetails {
  const ProblemDetails({
    required this.type,
    required this.title,
    required this.status,
    this.detail,
    this.instance,
    this.requestId,
    this.errors = const [],
    this.details,
  });

  /// 서버가 RFC 7807 형식을 지키지 않았을 수 있으므로(프록시 502 HTML 등) 실패 시 null 을 반환한다.
  static ProblemDetails? tryParse(Object? json) {
    if (json case {
      'type': final String type,
      'title': final String title,
      'status': final int status,
    }) {
      final map = json as JsonMap;
      final rawErrors = map['errors'];
      return ProblemDetails(
        type: type,
        title: title,
        status: status,
        detail: map['detail'] as String?,
        instance: map['instance'] as String?,
        requestId: map['requestId'] as String?,
        errors: rawErrors is List<Object?> ? rawErrors.map(FieldError.fromJson).toList() : const [],
        details: map['details'],
      );
    }
    return null;
  }

  final String type;
  final String title;
  final int status;
  final String? detail;
  final String? instance;
  final String? requestId;
  final List<FieldError> errors;

  /// 도메인별 추가 컨텍스트. 소비 측에서 별도로 디코딩한다.
  final Object? details;
}
