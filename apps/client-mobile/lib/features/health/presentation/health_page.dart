import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../domain/health_report.dart';
import 'health_controller.dart';

class HealthPage extends ConsumerWidget {
  const HealthPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(healthControllerProvider);
    final controller = ref.read(healthControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('System Health')),
      body: RefreshIndicator(
        onRefresh: controller.refresh,
        // 폴링 중에는 이전 데이터를 유지 (깜빡임 방지)
        child: state.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorView(error: error, onRetry: controller.refresh),
          data: (report) => _ReportView(report: report),
        ),
      ),
    );
  }
}

class _ReportView extends StatelessWidget {
  const _ReportView({required this.report});

  final HealthReport report;

  @override
  Widget build(BuildContext context) {
    final components = report.components;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          leading: _StatusDot(isUp: report.isHealthy),
          title: Text(report.isHealthy ? 'All systems operational' : 'Degraded'),
          subtitle: Text(_summary(report)),
        ),
        const Divider(),
        // 서버가 상세 정보를 공개하지 않는 경우(운영 기본값). 전체 상태까지만 표시한다.
        if (components == null)
          const ListTile(
            leading: Icon(Icons.lock_outline, size: 18),
            title: Text('Component details not exposed'),
            subtitle: Text('이 서버는 전체 상태만 공개합니다. 상세 진단은 서버 로그를 확인하세요.'),
          )
        else ...[
          _DependencyTile(name: 'PostgreSQL', health: components.database),
          _DependencyTile(name: 'Redis', health: components.redis),
          ListTile(
            leading: _StatusDot(isUp: components.memory.status == ComponentStatus.up),
            title: const Text('Memory'),
            subtitle: Text(_memoryLabel(components.memory)),
          ),
        ],
      ],
    );
  }

  static String _summary(HealthReport report) {
    final uptime = report.uptime;
    return [
      ?report.version.let((v) => 'v$v'),
      ?uptime.let((u) => 'uptime ${u.inMinutes}m'),
      'checked ${report.checkedAt.toLocal().toIso8601String()}',
    ].join(' · ');
  }

  static String _memoryLabel(MemoryHealth memory) {
    final rss = memory.rssBytes;
    if (rss == null) return memory.status == ComponentStatus.up ? 'up' : 'down';
    final threshold = memory.rssThresholdBytes;
    final used = _mb(rss);
    return threshold == null ? 'RSS $used MB' : 'RSS $used / ${_mb(threshold)} MB';
  }

  static String _mb(int bytes) => (bytes / (1024 * 1024)).toStringAsFixed(1);
}

/// nullable 값을 조건부로 문자열에 끼워 넣기 위한 작은 확장.
/// `?expr` (null-aware element) 과 함께 쓰면 "값이 있으면 이 항목을 넣는다"를 분기 없이 표현할 수 있다.
extension _NullableLet<T extends Object> on T? {
  R? let<R extends Object>(R Function(T value) transform) {
    final value = this;
    return value == null ? null : transform(value);
  }
}

class _DependencyTile extends StatelessWidget {
  const _DependencyTile({required this.name, required this.health});

  final String name;
  final DependencyHealth health;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: _StatusDot(isUp: health.status == ComponentStatus.up),
      title: Text(name),
      subtitle: Text(
        [
          ?health.latencyMs?.toStringAsFixed(2).let((ms) => '$ms ms'),
          ?health.message,
          if (health.latencyMs == null && health.message == null)
            health.status == ComponentStatus.up ? 'up' : 'down',
        ].join(' · '),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.isUp});

  final bool isUp;

  @override
  Widget build(BuildContext context) {
    final color = isUp ? Colors.green : Theme.of(context).colorScheme.error;
    return Icon(Icons.circle, size: 14, color: color, semanticLabel: isUp ? 'up' : 'down');
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});

  final Object error;
  final Future<void> Function() onRetry;

  /// sealed class 덕분에 새 ApiException 하위 타입이 생기면 이 switch 에서 컴파일 에러로 누락을 알려준다
  String get _message => switch (error) {
    final NetworkException e => e.message,
    final RequestTimeoutException e => e.message,
    final ServerException e => '${e.problem.title} (${e.statusCode})\n${e.message}',
    final UnauthorizedException e => e.message,
    final ContractViolationException e => e.message,
    final RequestCancelledException e => e.message,
    final UnknownApiException e => e.message,
    _ => '알 수 없는 오류가 발생했습니다.',
  };

  String? get _requestId =>
      error is ApiException ? (error as ApiException).problem?.requestId : null;

  @override
  Widget build(BuildContext context) {
    // RefreshIndicator 가 동작하려면 스크롤 가능한 자식이 필요하다
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(Icons.cloud_off, size: 48, color: Theme.of(context).colorScheme.error),
        const SizedBox(height: 16),
        Text(_message, textAlign: TextAlign.center),
        if (_requestId case final id?) ...[
          const SizedBox(height: 8),
          SelectableText(
            'requestId: $id',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 16),
        Center(
          child: FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
        ),
      ],
    );
  }
}
