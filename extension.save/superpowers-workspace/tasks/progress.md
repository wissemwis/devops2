# SDD ledger — plan: specs/001-questionnaire-platform/tasks.md

Scope note: this run is a deliberately limited test of the superpowers-bridge
`before_implement` hook, requested by the human partner. Only T001 is in
scope; T002+ are intentionally not dispatched in this run.

Deviation from SKILL.md Setup: skipped `using-git-worktrees` isolation.
Reason: this session's harness pins it to a single existing branch
(`claude/speckit-superpowers-bridge-36azzs`) and forbids creating/pushing to
another branch without explicit permission — creating an isolated worktree
branch here would conflict with that constraint. Work proceeds directly on
the current branch instead. Flagged to human partner as an observed
adjustment, not a silent deviation.

## Pre-flight scan (T001 only)

T001 is the only task in scope for this run — no other in-scope task shares
a file or interface with it, so the cross-task conflict table is empty by
construction. Self-consistency check: T001's own text (create backend/,
frontend/ directories per plan.md Project Structure) does not contradict
itself. Scan clean.

## Friction found

`scripts/task-brief` expects Superpowers' own plan format (`## Task N`
headings). Spec Kit's `tasks.md` uses a checklist format (`- [ ] T001 ...`)
instead — the script failed with "task 1 not found". Worked around by
writing `.superpowers/sdd/tasks/task-1-brief.md` by hand, following the
same content contract the script would have produced. `review-package`
(diff-based, format-agnostic) worked unmodified.

## Task 1

- Implementer dispatched (haiku): DONE. Commit cf67ae7 "T001: Create
  project structure for backend/ and frontend/". TDD evidence: RED 11/11
  failing → GREEN 11/11 passing (tests/structure/test_layout.sh).
- Task reviewer dispatched (haiku): Spec ✅ full compliance, Code quality ✅,
  Test quality ✅, no Critical/Important/Minor findings. Task quality:
  Approved.
- Controller spot-check: re-ran tests/structure/test_layout.sh independently
  — 11/11 passing, matches both reports.

Task 1: complete (commits 8963171..cf67ae7, review clean)

## Run stopped here by explicit request

Human partner asked to test only T001 before deciding whether to continue.
No final whole-branch review was run (not applicable — the plan is not
complete, only 1/55 tasks executed). T002+ not dispatched.

---

## Resumed 2026-09-22 — Superpowers plugin now installed (v6.4.1)

Reconciled against tasks.md + git log: T002–T009 are complete (each `[X]` with a
recorded task-scoped reviewer verdict in tasks.md; T009 = commits c22be2c..0b5e0fc,
PR #11 open). They ran before this ledger was maintained per task; tasks.md
annotations + git history are their record. Do not re-dispatch.

Scope of this run: T010 only (human partner asked for "next task").

Ruling: work in-place on branch `claude/task-t010-docker-compose` stacked on
`claude/task-t009-json-logger` (0b5e0fc) instead of a git worktree off main — PR #11
is still open and T010's branch would otherwise conflict on CLAUDE.md/tasks.md —
cost if wrong: rebase onto main after #11 merges (trivial).

## Pre-flight scan (T010)

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T010 ↔ T055 (Dockerfiles, Phase 7 later) | T010 must wire `backend`/`frontend` services; T055 produces the Dockerfiles those would `build:` from | Conflict: no Dockerfile exists yet |
| T010 ↔ T006 (database.ts) | T010 sets DATABASE_* env for backend; database.ts reads DATABASE_CLIENT/URL/HOST/... with DATABASE_URL taking precedence | Risk: root `.env.example` ships a non-empty DATABASE_URL → would override DATABASE_HOST=db if compose loads a `.env` copied from it |
| T010 ↔ T008 (/health) | healthcheck consumer | Clean — bare `/health` exists |
| T010 ↔ T005 (.env.example) | compose reads vars from `.env` | Clean — no secrets may be inlined (Principe IV) |
| T010 ↔ quickstart.md | quickstart runs `docker compose up -d db` then native `npm run develop` | Constraint: service must be named `db` and publish 5432 to host |
| T010 self-consistency | task text only names the file + three services | Clean |

Ruling: T010's `backend`/`frontend` services run the official `node:20` image with the
source bind-mounted and `npm ci && npm run develop|dev` (dev-mode stack, which is
research.md's stated purpose for T010 in V1: local development) — T055 later swaps
`image:`+`command:` for `build:` — cost if wrong: T055 rewrites two service blocks.

Ruling: compose must set DATABASE_URL explicitly empty (or otherwise neutralise it) for
the backend service so DATABASE_HOST=db wins — cost if wrong: backend in compose connects
to the placeholder host from `.env`.

## Task 10
- BASE 0b5e0fc
- Implementer dispatched (sonnet), agent afa0f44610b25f200; brief task-10-brief.md, report task-10-report.md
- Controller commit e9e4e87 (bridge 0.3.0, not T010 work) landed on this branch mid-task: T010 review package must use BASE e9e4e87, not 0b5e0fc.
- Implementer DONE: c59f382. Controller spot-check: full tests/structure suite 155/155 with node on PATH (implementer's 2 reds were sandbox PATH only). Implementer used sudo to delete root-owned backend/types/generated/ left by container bind mount (flag).
- Controller commit 4f67fd4 (bridge 0.4.0, not T010 work) landed after c59f382; T010 review range stays e9e4e87..c59f382.
- Task reviewer (sonnet): Spec ✅, Task quality Approved, 0 Critical / 0 Important.
  ⚠️ item (json_logger/user_role reds only due to missing node) resolved by controller: 155/155 with node on PATH.
Task 10: minor (deferred): docker-compose.yml:77 DATABASE_PORT literal 5432 while sibling DB vars are ${VAR} (container-internal port; add comment or interpolate)
Task 10: minor (deferred): docker-compose.yml:46 `restart: unless-stopped` on db not requested by brief (YAGNI)
Task 10: minor (deferred): container bind mount leaves root-owned, un-gitignored backend/types/generated/ on host after `docker compose up` — needs a follow-up (gitignore + non-root user / volume)
Task 10: complete (commits e9e4e87..c59f382, review clean)
- Final whole-branch review dispatched (opus) over 0b5e0fc..22d82eb (T010 + unreviewed bridge 0.3.0/0.4.0 commits), with deferred-minor triage.
- Final review (opus): "With fixes" — 0 Critical, 6 Important (4 bridge, 2 compose), minors. Findings + rulings: final-fix-findings.md
Ruling: bridge scope when args empty = invoking /speckit-implement's input, else ask human (never all tasks) — cost if wrong: one extra question per run.
Ruling: bridge hook replaces speckit-implement Outline 3-9; caller never implements in-context — cost if wrong: none vs HARD RULE.
Ruling: writing-plans runs on every brainstorming path (overrides bounded "implement directly") — owner's explicit requirement.
Ruling: plan reaches subagents only via task-brief + Global Constraints (SDD rule), plus design-doc path — cost if wrong: subagent misses cross-task plan context; reviewer's final review is the net.
Ruling: bridge never deletes the SDD workspace in this repo (historically tracked files) — cost if wrong: stale workspace dirs accumulate (git-ignored).
Ruling: compose backend/frontend run as non-root node user, loopback-only ports, LOG_LEVEL default http, drop restart — cost if wrong: volume-permission rework.
Ruling: no Docker-absent skip in the compose test (T056 decides CI runner); NEXT_PUBLIC_API_BASE_URL SSR concern carried forward in tasks.md.
- Controller: reverted sdd-workspace's .gitignore rewrite (/.superpowers -> /.superpowers/*, equivalent) to keep the tree clean.
- Final fix wave (sonnet): DONE — 759a149 (bridge 0.4.1 + CLAUDE.md), 81e365f (compose non-root via init service, loopback ports, LOG_LEVEL default; test 30->40 checks). Suite 165/165. Controller check: no root-owned files under backend/frontend after live run. Scoped re-review dispatched (sonnet) over 22d82eb..81e365f.
- Scoped re-review (sonnet): A1-A9, B1-B6, C1a-d ADDRESSED; B7/B8/C2 confirmed no change. New Important in fix diff: `user: "${UID:-1000}:${GID:-1000}"` never tracks host uid (bash doesn't export UID; .env.example lacks UID/GID) → effectively hardcoded 1000.
Task 10: parked — compose user uid is effectively hardcoded 1000 — Ruling: real, deferred (no second fix wave per SDD); correct on this host and for most single-user Linux/macOS/WSL setups; recorded as a tasks.md carry-forward (document `UID=$(id -u)`/`GID=$(id -g)` in .env.example or drop the "parameterised" framing) — cost if wrong: a contributor with uid≠1000 gets bind-mounted files owned by 1000.
Final review: complete (fix wave 22d82eb..81e365f, 1 parked).
