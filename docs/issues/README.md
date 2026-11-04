# 이슈 관리

작업할 이슈를 저장소 안의 파일로 관리한다. 이슈 하나 = 파일 하나
(`<YYYY-MM-DD>-<slug>.md`)이고, 파일 이름이 곧 이슈 ID다.
한 파일 안에 현재 상태, 배경, 완료 조건, 변경 로그(최신순)가 모인다.

- 새 이슈: `_TEMPLATE.md`를 복사한다. 날짜는 만든 날, slug는 내용을 알 수 있게 구체적으로 쓴다.
- 작업 절차와 변경 로그 형식: 루트 [`CLAUDE.md`](../../CLAUDE.md)의 "이슈 작업 절차"가 기준이다.
- 상태는 각 파일의 frontmatter `status`에만 적는다 (목록 파일을 따로 두면 두 곳이 어긋난다).

```bash
# 전체 상태 보기
grep -H '^status:' docs/issues/[0-9]*.md

# 진행 중인 이슈만
grep -l '^status: in-progress' docs/issues/[0-9]*.md

# 특정 이슈의 커밋 이력
git log --oneline --grep 'Issue: 2026-11-04-verify-tini-signal-handling'
```
