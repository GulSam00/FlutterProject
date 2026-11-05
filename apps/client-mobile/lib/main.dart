import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/observability/crash_reporter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  const CrashReporter crashReporter = ConsoleCrashReporter();

  // 1) 위젯 빌드/레이아웃/페인트 중 발생한 프레임워크 에러
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(
      crashReporter.recordError(
        details.exception,
        details.stack,
        fatal: true,
        reason: 'FlutterError',
      ),
    );
  };

  // 2) 프레임워크 밖(비동기 콜백, 플랫폼 채널 등)의 미처리 예외
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(crashReporter.recordError(error, stack, fatal: true, reason: 'PlatformDispatcher'));
    return true; // 처리됨으로 표시 → 앱이 즉시 종료되지 않음
  };

  runApp(const ProviderScope(child: App()));
}
