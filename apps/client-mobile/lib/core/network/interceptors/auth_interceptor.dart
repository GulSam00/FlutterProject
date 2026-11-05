import 'dart:async';

import 'package:dio/dio.dart';

import '../../auth/token_refresher.dart';
import '../../auth/token_storage.dart';
import '../api_exception.dart';

/// 요청 옵션 `extra` 키
abstract final class AuthExtra {
  /// 인증 헤더를 붙이지 않는 공개 API (헬스체크, 로그인 등)
  static const skipAuth = 'auth.skip';

  /// 재발급 후 재시도된 요청 표시 (무한 재시도 방지)
  static const retried = 'auth.retried';
}

/// 액세스 토큰 첨부 + 401 시 토큰 재발급 파이프라인.
///
/// 핵심 설계
/// 1. **Single-flight refresh**: 화면 진입 시 API 5개가 동시에 401 을 받으면 refresh 도 5번 호출된다.
///    리프레시 토큰 회전(rotation) 정책에서는 2번째 호출부터 "이미 사용된 토큰"으로 거부되어 강제 로그아웃된다.
///    → 진행 중인 refresh Future 를 공유해 단 한 번만 호출한다.
/// 2. **Stale token 감지**: 대기하던 요청이 깨어났을 때, 이미 다른 요청이 토큰을 갱신했다면 refresh 없이 재시도.
/// 3. **재시도는 별도 Dio 로**: QueuedInterceptor 내부에서 같은 Dio 로 재요청하면,
///    재요청의 onError 가 현재 onError 뒤에 큐잉되어 교착(deadlock)이 발생한다.
final class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required TokenStorage tokenStorage,
    required TokenRefresher tokenRefresher,
    required Dio retryDio,
    this.onSessionExpired,
  }) : _tokenStorage = tokenStorage,
       _tokenRefresher = tokenRefresher,
       _retryDio = retryDio;

  final TokenStorage _tokenStorage;
  final TokenRefresher _tokenRefresher;
  final Dio _retryDio;

  /// 세션 만료 시 호출 (예: 라우터를 로그인 화면으로 이동, 전역 상태 초기화)
  final FutureOr<void> Function()? onSessionExpired;

  Future<AuthTokens>? _inflightRefresh;

  static const _authHeader = 'Authorization';

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra[AuthExtra.skipAuth] == true) {
      handler.next(options);
      return;
    }
    final tokens = await _tokenStorage.read();
    if (tokens != null) {
      options.headers[_authHeader] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final isUnauthorized = err.response?.statusCode == 401;
    final canRefresh =
        options.extra[AuthExtra.skipAuth] != true && options.extra[AuthExtra.retried] != true;

    if (!isUnauthorized || !canRefresh) {
      handler.next(err);
      return;
    }

    final current = await _tokenStorage.read();
    if (current == null) {
      // 비로그인 상태의 401 은 재발급 대상이 아님
      handler.next(err);
      return;
    }

    // ── 1단계: 토큰 확보 (필요할 때만 refresh) ──
    final AuthTokens fresh;
    final usedHeader = options.headers[_authHeader];
    if (usedHeader != 'Bearer ${current.accessToken}') {
      // 이 요청이 대기하는 동안 다른 요청이 이미 토큰을 갱신함
      fresh = current;
    } else {
      try {
        fresh = await (_inflightRefresh ??= _refresh(current.refreshToken).whenComplete(() {
          _inflightRefresh = null;
        }));
      } on Object catch (refreshError) {
        if (_isSessionInvalid(refreshError)) {
          await _expireSession();
          handler.next(err.copyWith(error: const UnauthorizedException()));
        } else {
          // 네트워크/5xx 로 refresh 에 실패한 것은 "세션 만료"가 아니다.
          // 여기서 로그아웃시키면 일시적 통신 장애만으로 사용자가 강제 로그아웃되는 UX 사고가 난다.
          handler.next(err);
        }
        return;
      }
    }

    // ── 2단계: 원 요청 재시도 ──
    try {
      final response = await _retryDio.fetch<Object?>(
        options.copyWith(
          headers: {...options.headers, _authHeader: 'Bearer ${fresh.accessToken}'},
          extra: {...options.extra, AuthExtra.retried: true},
        ),
      );
      handler.resolve(response);
    } on DioException catch (retryError) {
      // 재시도 결과의 에러는 다음 인터셉터(ErrorInterceptor)가 정규화한다
      handler.next(retryError);
    }
  }

  /// refresh 실패가 "토큰 자체가 무효"인 경우인지 판단
  bool _isSessionInvalid(Object error) {
    if (error is FormatException) return true;
    if (error is DioException) {
      final status = error.response?.statusCode;
      return status == 400 || status == 401 || status == 403;
    }
    return false;
  }

  Future<AuthTokens> _refresh(String refreshToken) async {
    final tokens = await _tokenRefresher.refresh(refreshToken);
    await _tokenStorage.save(tokens);
    return tokens;
  }

  Future<void> _expireSession() async {
    await _tokenStorage.clear();
    await onSessionExpired?.call();
  }
}
