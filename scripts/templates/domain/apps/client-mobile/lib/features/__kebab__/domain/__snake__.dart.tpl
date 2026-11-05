/// `@repo/shared-types` 의 `__Pascal__` 에 대응하는 모델. **생성된 뼈대다.**
///
/// 이 파일은 TypeScript 계약의 손 사본이다. 자동 생성되지 않으므로
/// `packages/shared-types/src/__kebab__.ts` 를 고치면 같은 커밋에서 여기도 고친다.
///
/// `fromJson` 은 패턴 매칭으로 구조를 검증하고, 맞지 않으면 [FormatException] 을 던진다.
/// 형식이 틀린 데이터를 기본값으로 덮으면 서버·앱 버전 불일치가 조용히 넘어가고,
/// 화면에는 빈 값이 그려진다. DioClient 가 이 예외를 ContractViolationException 으로 바꾼다.
final class __Pascal__ {
  const __Pascal__({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
  });

  factory __Pascal__.fromJson(Object? json) {
    if (json case {
      'id': final String id,
      'name': final String name,
      'createdAt': final String createdAt,
      'updatedAt': final String updatedAt,
    }) {
      return __Pascal__(
        id: id,
        name: name,
        createdAt: DateTime.parse(createdAt),
        updatedAt: DateTime.parse(updatedAt),
      );
    }
    throw FormatException('Invalid __Pascal__', json);
  }

  final String id;

  /// 자리표시자. 실제 필드로 교체할 것.
  final String name;
  final DateTime createdAt;
  final DateTime updatedAt;
}

/// 목록 응답. 서버의 `Paginated<T>` 와 같은 모양이다.
final class __Pascal__Page {
  const __Pascal__Page({required this.items, required this.page, required this.totalPages});

  factory __Pascal__Page.fromJson(Object? json) {
    if (json case {
      'items': final List<Object?> items,
      'pageInfo': {'page': final num page, 'totalPages': final num totalPages},
    }) {
      return __Pascal__Page(
        items: items.map(__Pascal__.fromJson).toList(growable: false),
        page: page.toInt(),
        totalPages: totalPages.toInt(),
      );
    }
    throw FormatException('Invalid __Pascal__Page', json);
  }

  final List<__Pascal__> items;
  final int page;
  final int totalPages;
}
