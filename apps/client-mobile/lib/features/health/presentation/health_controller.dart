import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/health_repository.dart';
import '../domain/health_report.dart';

const healthPollInterval = Duration(seconds: 10);

/// 헬스 상태 AsyncNotifier.
///
/// - `build()` 가 곧 초기 로딩이자 재로딩 진입점이다. (`ref.invalidateSelf()` → build 재실행)
/// - build 가 다시 실행될 때마다 이전 build 의 `onDispose` 가 먼저 호출되므로
///   타이머/요청 취소 토큰이 누수 없이 교체된다.
/// - autoDispose: 화면을 벗어나면 폴링과 진행 중 요청이 함께 정리된다 (배터리/데이터 절약).
class HealthController extends AsyncNotifier<HealthReport> {
  @override
  Future<HealthReport> build() async {
    final cancelToken = CancelToken();
    final timer = Timer(healthPollInterval, ref.invalidateSelf);
    ref.onDispose(() {
      timer.cancel();
      cancelToken.cancel('HealthController disposed');
    });

    return ref.watch(healthRepositoryProvider).fetchReport(cancelToken: cancelToken);
  }

  /// Pull-to-refresh 용 수동 갱신. 완료(성공/실패)까지 대기 가능한 Future 를 반환한다.
  Future<void> refresh() async {
    ref.invalidateSelf();
    try {
      await future;
    } on Object {
      // 에러는 state(AsyncError) 로 UI 에 반영되므로 여기서는 삼킨다
    }
  }
}

final healthControllerProvider = AsyncNotifierProvider.autoDispose<HealthController, HealthReport>(
  HealthController.new,
);
