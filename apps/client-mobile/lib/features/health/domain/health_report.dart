import '../../../core/network/api_response.dart';

/// `@repo/shared-types` 의 `HealthCheckResult` 에 대응하는 도메인 모델.
enum ComponentStatus {
  up,
  down;

  static ComponentStatus parse(Object? raw) => switch (raw) {
    'up' => ComponentStatus.up,
    'down' => ComponentStatus.down,
    _ => throw FormatException('Invalid component status', raw),
  };
}

final class DependencyHealth {
  const DependencyHealth({required this.status, required this.latencyMs, this.message});

  factory DependencyHealth.fromJson(Object? json) {
    if (json case {'status': final Object? status, 'latencyMs': final num latencyMs}) {
      final message = (json as JsonMap)['message'];
      return DependencyHealth(
        status: ComponentStatus.parse(status),
        latencyMs: latencyMs.toDouble(),
        message: message is String ? message : null,
      );
    }
    throw FormatException('Invalid DependencyHealth', json);
  }

  final ComponentStatus status;
  final double latencyMs;
  final String? message;
}

final class MemoryHealth {
  const MemoryHealth({
    required this.status,
    required this.rssBytes,
    required this.heapUsedBytes,
    required this.heapTotalBytes,
    required this.rssThresholdBytes,
  });

  factory MemoryHealth.fromJson(Object? json) {
    if (json case {
      'status': final Object? status,
      'rssBytes': final num rss,
      'heapUsedBytes': final num heapUsed,
      'heapTotalBytes': final num heapTotal,
      'rssThresholdBytes': final num threshold,
    }) {
      return MemoryHealth(
        status: ComponentStatus.parse(status),
        rssBytes: rss.toInt(),
        heapUsedBytes: heapUsed.toInt(),
        heapTotalBytes: heapTotal.toInt(),
        rssThresholdBytes: threshold.toInt(),
      );
    }
    throw FormatException('Invalid MemoryHealth', json);
  }

  final ComponentStatus status;
  final int rssBytes;
  final int heapUsedBytes;
  final int heapTotalBytes;
  final int rssThresholdBytes;
}

final class HealthReport {
  const HealthReport({
    required this.isHealthy,
    required this.version,
    required this.uptime,
    required this.checkedAt,
    required this.database,
    required this.redis,
    required this.memory,
  });

  factory HealthReport.fromJson(Object? json) {
    if (json case {
      'status': final String status,
      'version': final String version,
      'uptimeSeconds': final num uptimeSeconds,
      'checkedAt': final String checkedAt,
      'components': {
        'database': final Object? database,
        'redis': final Object? redis,
        'memory': final Object? memory,
      },
    }) {
      return HealthReport(
        isHealthy: status == 'ok',
        version: version,
        uptime: Duration(seconds: uptimeSeconds.toInt()),
        checkedAt: DateTime.parse(checkedAt),
        database: DependencyHealth.fromJson(database),
        redis: DependencyHealth.fromJson(redis),
        memory: MemoryHealth.fromJson(memory),
      );
    }
    throw FormatException('Invalid HealthReport', json);
  }

  final bool isHealthy;
  final String version;
  final Duration uptime;
  final DateTime checkedAt;
  final DependencyHealth database;
  final DependencyHealth redis;
  final MemoryHealth memory;
}
