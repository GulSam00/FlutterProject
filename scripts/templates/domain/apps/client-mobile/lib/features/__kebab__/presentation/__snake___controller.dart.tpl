import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/__snake___repository.dart';
import '../domain/__snake__.dart';

/// __Pascal__ 목록 컨트롤러. **생성된 뼈대다.**
///
/// `AsyncNotifier` 를 쓴다 (`StateNotifier`·`ChangeNotifier` 는 쓰지 않는다).
/// 로딩·데이터·에러 세 상태를 직접 관리하지 않아도 되고, 화면에서 exhaustive 처리를 강제할 수 있다.
///
/// - `build()` 가 초기 로딩이자 재로딩 진입점이다 (`ref.invalidateSelf()` → build 재실행).
/// - build 가 다시 실행될 때 이전 build 의 `onDispose` 가 먼저 호출되므로 취소 토큰이 누수 없이 교체된다.
/// - autoDispose: 화면을 벗어나면 진행 중 요청이 함께 취소된다.
class __Pascal__ListController extends AsyncNotifier<__Pascal__Page> {
  @override
  Future<__Pascal__Page> build() async {
    final cancelToken = CancelToken();
    ref.onDispose(() => cancelToken.cancel('__Pascal__ListController disposed'));

    return ref.watch(__camel__RepositoryProvider).fetchPage(cancelToken: cancelToken);
  }

  /// Pull-to-refresh 용 수동 갱신. 완료(성공·실패)까지 기다릴 수 있는 Future 를 반환한다.
  Future<void> refresh() async {
    ref.invalidateSelf();
    try {
      await future;
    } on Object {
      // 에러는 state(AsyncError) 로 UI 에 반영되므로 여기서는 삼킨다
    }
  }
}

final __camel__ListControllerProvider =
    AsyncNotifierProvider.autoDispose<__Pascal__ListController, __Pascal__Page>(
      __Pascal__ListController.new,
    );
