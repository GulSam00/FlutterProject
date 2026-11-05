import '../../../core/network/api_response.dart';

/// `@repo/shared-types` 의 `HealthCheckResult` 에 대응하는 도메인 모델.
///
/// 서버가 `HEALTH_EXPOSE_DETAILS=false`(운영 기본값)로 돌면 응답에는 `status` 와 `checkedAt` 만 온다.
/// 공개 엔드포인트가 버전·메모리 수치·의존성 지연시간을 흘리지 않게 하려는 의도된 동작이다.
/// 그래서 상세 필드는 모두 nullable 이고, 화면은 값이 없는 경우를 처리해야 한다.
/// 상세가 없다고 해서 파싱 오류로 다루면, 정상 운영 서버에 붙였을 때 앱이 에러 화면만 띄운다.
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
  const DependencyHealth({required this.status, this.latencyMs, this.message});

  factory DependencyHealth.fromJson(Object? json) {
    if (json case {'status': final Object? status}) {
      final map = json as JsonMap;
      final latencyMs = map['latencyMs'];
      final message = map['message'];
      return DependencyHealth(
        status: ComponentStatus.parse(status),
        latencyMs: latencyMs is num ? latencyMs.toDouble() : null,
        message: message is String ? message : null,
      );
    }
    throw FormatException('Invalid DependencyHealth', json);
  }

  final ComponentStatus status;
  final double? latencyMs;
  final String? message;
}

final class MemoryHealth {
  const MemoryHealth({
    required this.status,
    this.rssBytes,
    this.heapUsedBytes,
    this.heapTotalBytes,
    this.rssThresholdBytes,
  });

  factory MemoryHealth.fromJson(Object? json) {
    if (json case {'status': final Object? status}) {
      final map = json as JsonMap;
      return MemoryHealth(
        status: ComponentStatus.parse(status),
        rssBytes: _asInt(map['rssBytes']),
        heapUsedBytes: _asInt(map['heapUsedBytes']),
        heapTotalBytes: _asInt(map['heapTotalBytes']),
        rssThresholdBytes: _asInt(map['rssThresholdBytes']),
      );
    }
    throw FormatException('Invalid MemoryHealth', json);
  }

  final ComponentStatus status;
  final int? rssBytes;
  final int? heapUsedBytes;
  final int? heapTotalBytes;
  final int? rssThresholdBytes;
}

/// 컴포넌트별 상세. 상세 정보가 꺼져 있으면 [HealthReport.components] 가 null 이다.
final class HealthComponents {
  const HealthComponents({required this.database, required this.redis, required this.memory});

  final DependencyHealth database;
  final DependencyHealth redis;
  final MemoryHealth memory;
}

final class HealthReport {
  const HealthReport({
    required this.isHealthy,
    required this.checkedAt,
    this.version,
    this.uptime,
    this.components,
  });

  factory HealthReport.fromJson(Object? json) {
    if (json case {'status': final String status, 'checkedAt': final String checkedAt}) {
      final map = json as JsonMap;
      final version = map['version'];
      final uptimeSeconds = map['uptimeSeconds'];
      return HealthReport(
        isHealthy: status == 'ok',
        checkedAt: DateTime.parse(checkedAt),
        version: version is String ? version : null,
        uptime: uptimeSeconds is num ? Duration(seconds: uptimeSeconds.toInt()) : null,
        components: _parseComponents(map['components']),
      );
    }
    throw FormatException('Invalid HealthReport', json);
  }

  final bool isHealthy;
  final DateTime checkedAt;
  final String? version;
  final Duration? uptime;
  final HealthComponents? components;
}

/// 상세가 꺼져 있으면 null. 단, 키가 있는데 구조가 틀리면 계약 위반이므로 [FormatException] 을 던진다.
HealthComponents? _parseComponents(Object? json) {
  if (json == null) return null;
  if (json case {
    'database': final Object? database,
    'redis': final Object? redis,
    'memory': final Object? memory,
  }) {
    return HealthComponents(
      database: DependencyHealth.fromJson(database),
      redis: DependencyHealth.fromJson(redis),
      memory: MemoryHealth.fromJson(memory),
    );
  }
  throw FormatException('Invalid HealthReport.components', json);
}

int? _asInt(Object? value) => value is num ? value.toInt() : null;
