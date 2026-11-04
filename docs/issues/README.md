# 이슈 관리

작업할 이슈를 저장소 안의 파일로 관리한다. 이슈 하나 = 파일 하나
(`ISSUE-<4자리 번호>-<slug>.md`)이고, 배경·완료 조건·변경 로그가 한 파일에 모인다.

- 새 이슈: `_TEMPLATE.md`를 복사한다. 번호는 기존 최대 번호 + 1.
- 작업 절차와 변경 로그 형식: 루트 [`CLAUDE.md`](../../CLAUDE.md)의 "이슈 작업 절차"가 기준이다.
- 상태는 각 파일의 frontmatter `status`에만 적는다 (목록 파일을 따로 두면 두 곳이 어긋난다).

```bash
# 전체 상태 보기
grep -H '^status:' docs/issues/ISSUE-*.md

# 진행 중인 이슈만
grep -l '^status: in-progress' docs/issues/ISSUE-*.md

# 특정 이슈의 커밋 이력
git log --oneline --grep ISSUE-0001
```
