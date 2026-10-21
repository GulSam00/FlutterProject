import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

/// 토큰 저장소 추상화 — 테스트에서 인메모리 구현으로 교체 가능.
abstract interface class TokenStorage {
  Future<AuthTokens?> read();
  Future<void> save(AuthTokens tokens);
  Future<void> clear();
}

/// Keychain(iOS) / Keystore 기반 암호화 저장소(Android) 에 저장한다.
///
/// 운영 리스크: SharedPreferences 는 평문 저장이라 루팅/백업 추출로 토큰이 탈취될 수 있다.
/// 매 요청마다 보안 저장소를 읽으면 플랫폼 채널 왕복 비용이 크므로 메모리 캐시를 둔다.
final class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'auth.access_token';
  static const _refreshKey = 'auth.refresh_token';

  final FlutterSecureStorage _storage;
  AuthTokens? _cache;
  bool _loaded = false;

  @override
  Future<AuthTokens?> read() async {
    if (_loaded) return _cache;
    final access = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);
    _cache = (access != null && refresh != null)
        ? AuthTokens(accessToken: access, refreshToken: refresh)
        : null;
    _loaded = true;
    return _cache;
  }

  @override
  Future<void> save(AuthTokens tokens) async {
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    await _storage.write(key: _refreshKey, value: tokens.refreshToken);
    _cache = tokens;
    _loaded = true;
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    _cache = null;
    _loaded = true;
  }
}
