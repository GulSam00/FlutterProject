import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '__snake___controller.dart';

/// __Pascal__ 목록 화면. **생성된 뼈대다.**
class __Pascal__ListPage extends ConsumerWidget {
  const __Pascal__ListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(__camel__ListControllerProvider);
    final controller = ref.read(__camel__ListControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('__PascalPlural__')),
      body: RefreshIndicator(
        onRefresh: controller.refresh,
        child: state.when(
          // skipLoadingOnRefresh: 갱신 중에 기존 목록을 유지한다. 없으면 폴링마다 화면이 깜빡인다.
          skipLoadingOnRefresh: true,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorView(error: error, onRetry: controller.refresh),
          data: (page) => ListView.builder(
            itemCount: page.items.length,
            itemBuilder: (context, index) {
              final item = page.items[index];
              return ListTile(title: Text(item.name), subtitle: Text(item.id));
            },
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});

  final Object error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_message(error), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => onRetry(), child: const Text('다시 시도')),
          ],
        ),
      ),
    );
  }

  /// sealed [ApiException] 을 exhaustive 하게 처리한다.
  /// `default:` 로 묶으면 하위 타입이 추가됐을 때 컴파일러가 처리 누락을 알려주지 못한다.
  static String _message(Object error) => switch (error) {
    NetworkException() => '네트워크에 연결할 수 없습니다.',
    RequestTimeoutException() => '요청이 시간 내에 끝나지 않았습니다.',
    UnauthorizedException() => '다시 로그인해 주세요.',
    ContractViolationException() => '앱 버전이 서버와 맞지 않습니다. 업데이트가 필요합니다.',
    RequestCancelledException() => '요청이 취소되었습니다.',
    ServerException(:final problem) => problem.detail ?? '서버 오류가 발생했습니다.',
    UnknownApiException() => '알 수 없는 오류가 발생했습니다.',
    _ => '알 수 없는 오류가 발생했습니다.',
  };
}
