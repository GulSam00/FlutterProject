import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/token_refresher.dart';
import '../auth/token_storage.dart';
import '../config/app_config.dart';
import 'api_exception.dart';
import 'api_response.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/error_interceptor.dart';

/// Dio 래퍼 — 표준 응답 언래핑과 에러 정규화를 책임진다.
///
/// 호출부(Repository)는 envelope(`success/meta`)나 [DioException] 을 몰라도 된다.
///  - 성공: `T` 를 반환
///  - 실패: 항상 [ApiException] 하위 타입을 throw (sealed → switch 로 전수 처리 가능)
final class DioClient {
  const DioClient(this._dio);

  final Dio _dio;

  Future<T> get<T>(
    String path, {
    required JsonDecoder<T> decoder,
    Map<String, Object?>? query,
    CancelToken? cancelToken,
    bool skipAuth = false,
  }) => _send(
    () => _dio.get<Object?>(
      path,
      queryParameters: query,
      cancelToken: cancelToken,
      options: _options(skipAuth),
    ),
    decoder,
  );

  Future<T> post<T>(
    String path, {
    required JsonDecoder<T> decoder,
    Object? body,
    CancelToken? cancelToken,
    bool skipAuth = false,
  }) => _send(
    () =>
        _dio.post<Object?>(path, data: body, cancelToken: cancelToken, options: _options(skipAuth)),
    decoder,
  );

  Future<T> put<T>(
    String path, {
    required JsonDecoder<T> decoder,
    Object? body,
    CancelToken? cancelToken,
  }) => _send(() => _dio.put<Object?>(path, data: body, cancelToken: cancelToken), decoder);

  Future<T> patch<T>(
    String path, {
    required JsonDecoder<T> decoder,
    Object? body,
    CancelToken? cancelToken,
  }) => _send(() => _dio.patch<Object?>(path, data: body, cancelToken: cancelToken), decoder);

  Future<T> delete<T>(String path, {required JsonDecoder<T> decoder, CancelToken? cancelToken}) =>
      _send(() => _dio.delete<Object?>(path, cancelToken: cancelToken), decoder);

  Options _options(bool skipAuth) => Options(extra: {AuthExtra.skipAuth: skipAuth});

  Future<T> _send<T>(Future<Response<Object?>> Function() send, JsonDecoder<T> decoder) async {
    final Response<Object?> response;
    try {
      response = await send();
    } on DioException catch (e) {
      final error = e.error;
      throw error is ApiException ? error : ErrorInterceptor.mapDioException(e);
    }

    try {
      return ApiResponse.fromJson(response.data, decoder).data;
    } on FormatException catch (e) {
      // 서버/앱 버전 불일치를 조용히 넘기지 않는다 (null 화면 대신 명시적 에러)
      throw ContractViolationException(e);
    } on TypeError catch (e) {
      throw ContractViolationException(e);
    }
  }
}

/// Dio 인스턴스 조립.
///
/// 인터셉터 순서가 곧 파이프라인이다:
///   onRequest : Auth(토큰 첨부) → Log
///   onError   : Auth(401 → refresh/retry) → Error(정규화) → Log
Dio createDio({
  required AppConfig config,
  required TokenStorage tokenStorage,
  Future<void> Function()? onSessionExpired,
}) {
  final baseOptions = BaseOptions(
    baseUrl: config.apiRoot,
    connectTimeout: config.connectTimeout,
    receiveTimeout: config.receiveTimeout,
    sendTimeout: config.sendTimeout,
    contentType: Headers.jsonContentType,
    responseType: ResponseType.json,
    headers: const {'Accept': 'application/json, application/problem+json'},
    // 2xx 외에는 모두 DioException 으로 처리 → 에러 인터셉터 한 곳에서 일관 처리
    validateStatus: (status) => status != null && status >= 200 && status < 300,
  );

  // refresh / retry 전용 "인터셉터 없는" 인스턴스 (무한 루프·교착 방지)
  final bareDio = Dio(baseOptions);

  final dio = Dio(baseOptions)
    ..interceptors.addAll([
      AuthInterceptor(
        tokenStorage: tokenStorage,
        tokenRefresher: DioTokenRefresher(bareDio),
        retryDio: bareDio,
        onSessionExpired: onSessionExpired,
      ),
      const ErrorInterceptor(),
      // 릴리스 빌드에서 토큰/개인정보가 로그로 유출되지 않도록 디버그에서만 활성화
      if (kDebugMode)
        LogInterceptor(
          requestHeader: false,
          responseHeader: false,
          requestBody: true,
          responseBody: true,
          logPrint: (o) => debugPrint(o.toString()),
        ),
    ]);

  return dio;
}

// ─────────────────────────── Providers ───────────────────────────

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment());

final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());

/// 세션 만료 이벤트를 앱 전역(라우터 등)에 알리기 위한 콜백. 앱 시작 시 override 한다.
final sessionExpiredHandlerProvider = Provider<Future<void> Function()>((ref) => () async {});

final dioProvider = Provider<Dio>((ref) {
  final dio = createDio(
    config: ref.watch(appConfigProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    onSessionExpired: () => ref.read(sessionExpiredHandlerProvider)(),
  );
  // Provider 폐기 시 소켓/커넥션 풀 정리
  ref.onDispose(dio.close);
  return dio;
});

final dioClientProvider = Provider<DioClient>((ref) => DioClient(ref.watch(dioProvider)));
