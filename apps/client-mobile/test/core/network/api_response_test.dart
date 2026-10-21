import 'package:client_mobile/core/network/api_response.dart';
import 'package:client_mobile/features/health/domain/health_report.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const meta = {
    'timestamp': '2026-01-01T00:00:00.000Z',
    'requestId': 'req-12345678',
    'path': '/api/v1/health',
  };

  group('ApiResponse.fromJson', () {
    test('envelope 를 언래핑하고 data 를 디코딩한다', () {
      final res = ApiResponse.fromJson({
        'success': true,
        'data': 42,
        'meta': meta,
      }, (json) => json! as int);
      expect(res.data, 42);
      expect(res.meta.requestId, 'req-12345678');
    });

    test('envelope 가 아니면 FormatException', () {
      expect(() => ApiResponse.fromJson({'data': 1}, (json) => json), throwsFormatException);
    });
  });

  group('ProblemDetails.tryParse', () {
    test('RFC 7807 응답을 파싱한다', () {
      final problem = ProblemDetails.tryParse({
        'type': 'urn:problem-type:validation-failed',
        'title': 'Validation Failed',
        'status': 400,
        'requestId': 'req-1',
        'errors': [
          {
            'field': 'email',
            'messages': ['must be an email'],
          },
        ],
      });
      expect(problem?.status, 400);
      expect(problem?.errors.single.field, 'email');
    });

    test('비표준 응답(HTML 등)은 null', () {
      expect(ProblemDetails.tryParse('<html>502 Bad Gateway</html>'), isNull);
    });
  });

  test('HealthReport.fromJson', () {
    final report = HealthReport.fromJson({
      'status': 'error',
      'version': '0.1.0',
      'uptimeSeconds': 120,
      'checkedAt': '2026-01-01T00:00:00.000Z',
      'components': {
        'database': {'status': 'up', 'latencyMs': 1.5},
        'redis': {'status': 'down', 'latencyMs': 1500, 'message': 'timeout after 1500ms'},
        'memory': {
          'status': 'up',
          'rssBytes': 100,
          'heapUsedBytes': 50,
          'heapTotalBytes': 80,
          'rssThresholdBytes': 1000,
        },
      },
    });
    expect(report.isHealthy, isFalse);
    expect(report.redis.status, ComponentStatus.down);
    expect(report.redis.message, 'timeout after 1500ms');
  });
}
