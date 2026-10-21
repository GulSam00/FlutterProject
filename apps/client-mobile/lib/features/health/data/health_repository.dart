import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../domain/health_report.dart';

/// 헬스 도메인 데이터 접근 계층. Presentation 은 이 클래스만 의존한다 (Dio 를 모른다).
final class HealthRepository {
  const HealthRepository(this._client);

  final DioClient _client;

  /// 서버는 의존성 장애 시 503 + problem.details(진단 결과) 를 반환한다.
  /// 진단 화면에선 이것도 "유효한 결과"이므로 정상 데이터로 승격한다. (웹 클라이언트와 동일한 정책)
  Future<HealthReport> fetchReport({CancelToken? cancelToken}) async {
    try {
      return await _client.get(
        '/health',
        decoder: HealthReport.fromJson,
        cancelToken: cancelToken,
        skipAuth: true,
      );
    } on ServerException catch (e) {
      final degraded = e.statusCode == 503 ? _tryParseReport(e.problem.details) : null;
      if (degraded != null) return degraded;
      rethrow;
    }
  }

  static HealthReport? _tryParseReport(Object? json) {
    if (json == null) return null;
    try {
      return HealthReport.fromJson(json);
    } on FormatException {
      return null;
    }
  }
}

final healthRepositoryProvider = Provider<HealthRepository>(
  (ref) => HealthRepository(ref.watch(dioClientProvider)),
);
