import 'package:dio/dio.dart';

import '../api_exception.dart';
import '../api_response.dart';

/// [DioException] 을 도메인 친화적인 [ApiException] 으로 정규화한다.
///
/// 변환 결과는 `DioException.error` 에 담아 전달하고, [DioClient] 가 이를 꺼내 throw 한다.
/// (인터셉터 체인 규약상 onError 는 DioException 만 다음 단계로 넘길 수 있기 때문)
final class ErrorInterceptor extends Interceptor {
  const ErrorInterceptor();

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // 이미 변환된 에러(토큰 재발급 실패 등)는 그대로 통과 → 멱등성 보장
    if (err.error is ApiException) {
      handler.next(err);
      return;
    }
    handler.next(err.copyWith(error: mapDioException(err)));
  }

  static ApiException mapDioException(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const RequestTimeoutException();
      case DioExceptionType.connectionError:
        return const NetworkException();
      case DioExceptionType.cancel:
        return const RequestCancelledException();
      case DioExceptionType.badCertificate:
        // 인증서 오류는 중간자 공격 가능성 → 절대 무시하고 진행하지 않는다
        return const NetworkException('보안 연결을 확인할 수 없습니다.');
      case DioExceptionType.badResponse:
        final problem = ProblemDetails.tryParse(err.response?.data);
        if (problem != null) return ServerException(problem);
        return ContractViolationException(err.response?.data);
      case DioExceptionType.unknown:
        return UnknownApiException(err.error);
    }
  }
}
