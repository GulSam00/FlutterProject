/// 빌드 타임 환경 설정.
///
/// `--dart-define` 으로 주입한다. (시크릿을 앱 바이너리에 넣지 말 것 — 디컴파일로 쉽게 추출된다)
///
/// ```bash
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080 --dart-define=APP_ENV=dev
/// ```
///
/// - Docker Compose 스택: Nginx 모바일 전용 포트 `8080` (Host 헤더 라우팅 불필요)
///   - Android 에뮬레이터: 호스트 머신 = `10.0.2.2` → `http://10.0.2.2:8080`
///   - iOS 시뮬레이터: `http://localhost:8080`
///   - 실기기: 같은 Wi-Fi 의 호스트 IP → `http://192.168.x.x:8080`
/// - NestJS 를 호스트에서 직접 실행(`pnpm dev`)한 경우: 포트 `3000`
final class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.environment,
    this.connectTimeout = const Duration(seconds: 5),
    this.receiveTimeout = const Duration(seconds: 15),
    this.sendTimeout = const Duration(seconds: 15),
  });

  factory AppConfig.fromEnvironment() {
    const baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8080');
    const env = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    return AppConfig(apiBaseUrl: baseUrl, environment: AppEnvironment.parse(env));
  }

  /// API Origin (버전 prefix 제외). 예: `http://api.local.dev`
  final String apiBaseUrl;
  final AppEnvironment environment;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;

  /// NestJS 의 globalPrefix + URI versioning 과 동일한 규약 (`/api/v1`)
  String get apiRoot => '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1';
}

enum AppEnvironment {
  dev,
  staging,
  prod;

  static AppEnvironment parse(String raw) =>
      AppEnvironment.values.firstWhere((e) => e.name == raw, orElse: () => AppEnvironment.dev);

  bool get isProd => this == AppEnvironment.prod;
}
