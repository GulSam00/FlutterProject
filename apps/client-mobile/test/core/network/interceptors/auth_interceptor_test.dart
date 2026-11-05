import 'dart:convert';
import 'dart:typed_data';

import 'package:client_mobile/core/auth/token_refresher.dart';
import 'package:client_mobile/core/auth/token_storage.dart';
import 'package:client_mobile/core/network/api_exception.dart';
import 'package:client_mobile/core/network/dio_client.dart';
import 'package:client_mobile/core/network/interceptors/auth_interceptor.dart';
import 'package:client_mobile/core/network/interceptors/error_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

const _validToken = 'access-2';

/// 유효 토큰(access-2)일 때만 200, 그 외 401 을 반환하는 가짜 서버
final class _FakeApiAdapter implements HttpClientAdapter {
  int calls = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    await Future<void>.delayed(const Duration(milliseconds: 10));
    final authorized = options.headers['Authorization'] == 'Bearer $_validToken';
    if (!authorized) {
      return _json(401, {
        'type': 'urn:problem-type:unauthorized',
        'title': 'Unauthorized',
        'status': 401,
      });
    }
    return _json(200, {
      'success': true,
      'data': options.path,
      'meta': {'timestamp': '2026-01-01T00:00:00.000Z', 'requestId': 'req-1', 'path': options.path},
    });
  }

  static ResponseBody _json(int status, Object body) => ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

final class _InMemoryTokenStorage implements TokenStorage {
  _InMemoryTokenStorage(this.tokens);

  AuthTokens? tokens;

  @override
  Future<AuthTokens?> read() async => tokens;

  @override
  Future<void> save(AuthTokens tokens) async => this.tokens = tokens;

  @override
  Future<void> clear() async => tokens = null;
}

final class _FakeRefresher implements TokenRefresher {
  _FakeRefresher(this._behavior);

  final Future<AuthTokens> Function() _behavior;
  int calls = 0;

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    calls++;
    await Future<void>.delayed(const Duration(milliseconds: 20));
    return _behavior();
  }
}

DioException _dioError(int? status) {
  final options = RequestOptions(path: '/auth/refresh');
  return DioException(
    requestOptions: options,
    type: status == null ? DioExceptionType.connectionError : DioExceptionType.badResponse,
    response: status == null
        ? null
        : Response<Object?>(requestOptions: options, statusCode: status),
  );
}

({DioClient client, _FakeApiAdapter adapter, _InMemoryTokenStorage storage, List<String> events})
_setUp(_FakeRefresher refresher) {
  final adapter = _FakeApiAdapter();
  final storage = _InMemoryTokenStorage(
    const AuthTokens(accessToken: 'access-1-expired', refreshToken: 'refresh-1'),
  );
  final events = <String>[];
  final options = BaseOptions(baseUrl: 'http://test');
  final retryDio = Dio(options)..httpClientAdapter = adapter;
  final dio = Dio(options)
    ..httpClientAdapter = adapter
    ..interceptors.addAll([
      AuthInterceptor(
        tokenStorage: storage,
        tokenRefresher: refresher,
        retryDio: retryDio,
        onSessionExpired: () => events.add('expired'),
      ),
      const ErrorInterceptor(),
    ]);
  return (client: DioClient(dio), adapter: adapter, storage: storage, events: events);
}

String _decodeString(Object? json) => json! as String;

void main() {
  test('동시 401 이 발생해도 refresh 는 단 한 번만 호출된다 (single-flight)', () async {
    final refresher = _FakeRefresher(
      () async => const AuthTokens(accessToken: _validToken, refreshToken: 'refresh-2'),
    );
    final h = _setUp(refresher);

    final results = await Future.wait([
      for (final path in ['/a', '/b', '/c']) h.client.get(path, decoder: _decodeString),
    ]);

    expect(results, ['/a', '/b', '/c']);
    expect(refresher.calls, 1);
    expect(h.storage.tokens?.accessToken, _validToken);
  });

  test('refresh 가 401 이면 세션을 만료시키고 UnauthorizedException', () async {
    final h = _setUp(_FakeRefresher(() => throw _dioError(401)));

    await expectLater(
      h.client.get('/a', decoder: _decodeString),
      throwsA(isA<UnauthorizedException>()),
    );
    expect(h.storage.tokens, isNull);
    expect(h.events, ['expired']);
  });

  test('refresh 가 네트워크 오류면 토큰을 보존한다 (일시 장애로 로그아웃 금지)', () async {
    final h = _setUp(_FakeRefresher(() => throw _dioError(null)));

    await expectLater(h.client.get('/a', decoder: _decodeString), throwsA(isA<ServerException>()));
    expect(h.storage.tokens?.refreshToken, 'refresh-1');
    expect(h.events, isEmpty);
  });
}
