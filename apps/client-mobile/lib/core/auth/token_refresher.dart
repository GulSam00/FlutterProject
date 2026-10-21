import 'package:dio/dio.dart';

import '../network/api_response.dart';
import 'token_storage.dart';

/// 리프레시 토큰으로 새 토큰 쌍을 발급받는 계약.
///
/// 보일러플레이트는 인증 도메인을 포함하지 않으므로 "인터페이스 + 기본 구현"만 제공한다.
/// 인증 모듈 도입 시 서버의 `POST /api/v1/auth/refresh` 가 아래 응답 규격을 따르면 그대로 동작한다.
/// `{ success: true, data: { accessToken, refreshToken }, meta }`
abstract interface class TokenRefresher {
  Future<AuthTokens> refresh(String refreshToken);
}

final class DioTokenRefresher implements TokenRefresher {
  /// [dio] 는 반드시 인증 인터셉터가 "없는" 별도 인스턴스여야 한다.
  /// 같은 인스턴스를 쓰면 refresh 요청의 401 이 다시 refresh 를 유발하는 무한 루프가 생긴다.
  const DioTokenRefresher(this._dio, {this.path = '/auth/refresh'});

  final Dio _dio;
  final String path;

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    final response = await _dio.post<Object?>(path, data: {'refreshToken': refreshToken});
    return ApiResponse.fromJson(response.data, _decodeTokens).data;
  }

  static AuthTokens _decodeTokens(Object? json) {
    if (json case {'accessToken': final String access, 'refreshToken': final String refresh}) {
      return AuthTokens(accessToken: access, refreshToken: refresh);
    }
    throw FormatException('Invalid token payload', json);
  }
}
