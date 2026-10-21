import 'api_response.dart';

/// 네트워크 계층의 모든 실패를 표현하는 봉인(sealed) 계층.
///
/// `sealed` 이므로 UI 에서 `switch` 로 분기할 때 컴파일러가 모든 케이스 처리를 강제한다.
/// → 새 에러 유형을 추가하면 처리하지 않은 화면에서 컴파일 에러가 발생해 누락을 막는다.
sealed class ApiException implements Exception {
  const ApiException(this.message);

  /// 사용자에게 노출 가능한 메시지
  final String message;

  /// 서버가 내려준 RFC 7807 정보 (있을 때만)
  ProblemDetails? get problem => null;

  /// 동일 요청 재시도가 의미 있는지 (5xx/네트워크/타임아웃)
  bool get isRetryable => false;

  @override
  String toString() => '$runtimeType: $message';
}

/// 서버에 도달하지 못함 (DNS, 연결 거부, 오프라인)
final class NetworkException extends ApiException {
  const NetworkException([super.message = '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.']);

  @override
  bool get isRetryable => true;
}

/// 연결/송신/수신 타임아웃
final class RequestTimeoutException extends ApiException {
  const RequestTimeoutException([super.message = '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.']);

  @override
  bool get isRetryable => true;
}

/// 서버가 4xx/5xx 와 함께 RFC 7807 응답을 반환
final class ServerException extends ApiException {
  ServerException(this._problem) : super(_problem.detail ?? _problem.title);

  final ProblemDetails _problem;

  @override
  ProblemDetails get problem => _problem;

  int get statusCode => _problem.status;

  @override
  bool get isRetryable => statusCode >= 500;
}

/// 토큰 재발급까지 실패하여 세션이 만료됨 → 로그인 화면으로 유도
final class UnauthorizedException extends ApiException {
  const UnauthorizedException([super.message = '세션이 만료되었습니다. 다시 로그인해 주세요.']);
}

/// 응답이 계약(스키마)과 다름 → 앱/서버 버전 불일치 가능성
final class ContractViolationException extends ApiException {
  const ContractViolationException(this.cause, [super.message = '예상하지 못한 서버 응답입니다.']);

  final Object? cause;
}

/// 사용자 또는 화면 이탈로 요청이 취소됨 (UI 에 에러로 표시하지 않는다)
final class RequestCancelledException extends ApiException {
  const RequestCancelledException() : super('요청이 취소되었습니다.');
}

final class UnknownApiException extends ApiException {
  const UnknownApiException(this.cause, [super.message = '알 수 없는 오류가 발생했습니다.']);

  final Object? cause;
}
