import 'package:flutter/foundation.dart';

/// 크래시/에러 수집 추상화.
///
/// 벤더(Crashlytics, Sentry)를 코드 전역에 직접 import 하면 교체 비용이 커진다.
/// 이 인터페이스 구현체만 바꿔 끼우면 된다.
abstract interface class CrashReporter {
  Future<void> recordError(Object error, StackTrace? stack, {bool fatal = false, String? reason});
}

/// 기본 구현: 디버그 콘솔 출력. 릴리스 빌드에서는 벤더 구현체로 교체한다.
final class ConsoleCrashReporter implements CrashReporter {
  const ConsoleCrashReporter();

  @override
  Future<void> recordError(
    Object error,
    StackTrace? stack, {
    bool fatal = false,
    String? reason,
  }) async {
    debugPrint('[${fatal ? 'FATAL' : 'ERROR'}] ${reason ?? ''} $error\n${stack ?? ''}');
  }
}
