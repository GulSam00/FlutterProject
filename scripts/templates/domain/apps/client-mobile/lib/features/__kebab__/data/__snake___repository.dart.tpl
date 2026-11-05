import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../domain/__snake__.dart';

/// __Pascal__ 데이터 접근 계층. **생성된 뼈대다.**
///
/// Presentation 은 이 클래스만 의존한다 (Dio 를 모른다).
/// 그래서 통신 방식을 바꿀 때 화면 코드를 고치지 않아도 되고, 테스트에서 이 클래스만 대체하면 된다.
///
/// 에러를 여기서 삼키지 않는다. `DioClient` 가 이미 sealed `ApiException` 으로 정규화했고,
/// 어떻게 보여줄지는 Presentation 이 결정한다.
final class __Pascal__Repository {
  const __Pascal__Repository(this._client);

  final DioClient _client;

  Future<__Pascal__Page> fetchPage({int page = 1, int limit = 20, CancelToken? cancelToken}) {
    return _client.get(
      '/__kebabPlural__',
      decoder: __Pascal__Page.fromJson,
      query: {'page': page, 'limit': limit},
      cancelToken: cancelToken,
    );
  }

  Future<__Pascal__> fetchOne(String id, {CancelToken? cancelToken}) {
    return _client.get('/__kebabPlural__/$id', decoder: __Pascal__.fromJson, cancelToken: cancelToken);
  }

  Future<__Pascal__> create({required String name, CancelToken? cancelToken}) {
    return _client.post(
      '/__kebabPlural__',
      decoder: __Pascal__.fromJson,
      body: {'name': name},
      cancelToken: cancelToken,
    );
  }
}

final __camel__RepositoryProvider = Provider<__Pascal__Repository>(
  (ref) => __Pascal__Repository(ref.watch(dioClientProvider)),
);
