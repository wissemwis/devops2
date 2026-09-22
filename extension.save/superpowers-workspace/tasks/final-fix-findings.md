# Final-review fix wave — branch claude/task-t010-docker-compose (FIX_BASE 22d82eb)

Source: final whole-branch review (opus) over 0b5e0fc..22d82eb. Verdict "With fixes".
Every item below is to be fixed in THIS single fix wave unless marked "no change".
Controller rulings are binding (they resolve the open choices the reviewer offered).

## A. superpowers-bridge (bump to 0.4.1)

Files that MUST stay in sync (same edits in all):
- /project/devops2/extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md (source)
- /project/devops2/.specify/extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md (byte-identical copy)
- /project/devops2/.specify/extensions/superpowers-bridge/.specify-dev/agent-commands/claude/speckit-superpowers-bridge-tdd-implement/SKILL.md
  (generated: SKILL frontmatter — keep its existing name/compatibility/metadata keys, description = source description — then the source body with
  `/memory/constitution.md` replaced by `.specify/memory/constitution.md`; end with a trailing newline.
  `.claude/skills/speckit-superpowers-bridge-tdd-implement/SKILL.md` is a symlink to it — do not replace the symlink.)
- /project/devops2/extensions/superpowers-bridge/extension.yml and /project/devops2/.specify/extensions/superpowers-bridge/extension.yml: version "0.4.1" (byte-identical).
Read the installed Superpowers skills the bridge invokes before editing:
/home/ubuntu/.claude/plugins/cache/superpowers-marketplace/superpowers/6.4.1/skills/{brainstorming,writing-plans,subagent-driven-development}/SKILL.md
and /project/devops2/.claude/skills/speckit-implement/SKILL.md (the caller).

A1 (Important) Scope argument is lost: speckit-implement invokes the hook bare, so the bridge's `$ARGUMENTS` is empty
   and "empty = every unchecked task" would scope a "next task" run to the whole backlog.
   Ruling: scope = this command's arguments if non-empty; else the user input of the invoking /speckit-implement;
   if both are empty, ASK the human (offer "next unchecked task" as the default). Never silently default to all tasks.
A2 (Important) After the hook returns, speckit-implement's own Outline would execute remaining unchecked tasks in-context
   (HARD RULE violation). Ruling: add an explicit terminal instruction at the end of the bridge: this hook REPLACES
   /speckit-implement's Outline steps 3-9; when it returns, the invoking /speckit-implement MUST NOT implement any task
   itself — it proceeds directly to its Mandatory Post-Execution Hooks (after_implement) and Completion Report.
   Mirror this in CLAUDE.md (see C1).
A3 (Important) The bridge misstates brainstorming's terminal step (only the architectural path ends in writing-plans; the
   bounded path says "no plan document / implement directly"). Ruling: whatever path brainstorming classifies, the next
   step is step 4 (writing-plans) — this explicitly overrides the bounded path's "no spec / no plan / implement directly"
   terminal state; a tasks.md item is never a spike (classify bounded or architectural). writing-plans is never skipped.
A4 (Important) Step 6 dispatch contents contradict SDD's rule that the task-brief is the single source of requirements and
   that subagents never read the whole plan. Ruling: implementer dispatch carries the tasks.md ID line, the task-brief
   path (per SDD), the design-doc path, and the paths of spec.md/plan.md/tasks.md/constitution.md as reference reading;
   the plan reaches subagents ONLY via task-brief output + the plan's Global Constraints block; explicitly "do not read the
   whole implementation plan". Reviewer gets SDD's inputs (brief, report, package, global constraints) + design-doc path.
A5 (Minor) Git state before steps 3-4 commit anything. Ruling: add a step before brainstorming: never commit on main —
   if on main/master, create and switch to a branch `claude/<task-ids>-<slug>`; otherwise stay on the current feature
   branch; state that SDD's worktree setup may reuse this branch in place (record that as a ledger note, not a new
   ruling each run).
A6 (Minor) SDD's Finish (`rm -rf <workspace>` + finishing-a-development-branch). Ruling: do NOT delete the workspace in
   this repo (some `.superpowers/sdd/tasks/*` files are git-tracked historically); still collect the "Rulings I made"
   list per SDD; then invoke superpowers:finishing-a-development-branch, whose push/PR/merge options remain gated by
   the human (step "only stop for … push/merge" already covers it).
A7 (Minor) Purpose line says "two-stage review"; SDD 6.4.1 is one task review with two verdicts (spec + quality). Reword.
A8 (Minor) FEATURE_DIR undefined in step 1: say it is the feature directory resolved by the invoking /speckit-implement
   (e.g. specs/001-questionnaire-platform/).
A9 (Minor) Generated SKILL.md missing final newline — fix.

## B. docker-compose.yml + tests/structure/test_docker_compose.sh (T010 area) — TDD applies: extend the test first (RED), then fix (GREEN)

B1 (Important) Container runs as root and leaves root-owned files in the host checkout via the bind mounts
   (observed: backend/dist/config, backend/dist/src, backend/.strapi-updater.json (0600), backend/types/generated/,
   frontend/.next, frontend/next-env.d.ts), which breaks host `npm run build`/`npm run develop` on Linux.
   Ruling: run `backend` and `frontend` as the image's non-root `node` user (uid/gid 1000 — this host's user is also
   uid 1000; parameterise as `user: "${UID:-1000}:${GID:-1000}"` only if it stays simple). Named node_modules volumes
   are created root-owned, so make them writable for that user without a Dockerfile (e.g. a tiny one-shot root step in
   the service command/entrypoint that chowns the volume mountpoint then drops to the user, or an init service —
   choose the simplest that works and explain it in a comment). MUST be live-verified: `docker compose up -d`, both
   healthy, `/health` 200, frontend 200, then `find backend frontend -user root` (excluding node_modules volumes, which
   are not on the host) returns nothing, then `docker compose down -v`. If a clean non-root setup proves infeasible,
   report DONE_WITH_CONCERNS with what you tried — do not silently fall back.
   Add assertions to the test for the `user:` setting on backend/frontend.
B2 (Important) All ports published on 0.0.0.0 with placeholder credentials (Principe IV "Sécurité par défaut").
   Ruling: bind to loopback: "127.0.0.1:5432:5432", "127.0.0.1:1337:1337", "127.0.0.1:3000:3000". Test asserts host_ip 127.0.0.1.
B3 (Minor, fix now) `LOG_LEVEL: ${LOG_LEVEL}` yields "" with an older .env → winston level '' logs everything. Use
   `${LOG_LEVEL:-http}`. Test asserts the default when LOG_LEVEL is unset.
B4 (Minor, fix now) Remove `restart: unless-stopped` from db (unrequested, YAGNI).
B5 (Minor, fix now) Add a short comment on `DATABASE_PORT: 5432` (container-internal port of db, independent of host mapping).
B6 (Minor, fix now) test_docker_compose.sh:177 `'profiles' not in data` can never fail and :178 duplicates the exact-set
   check (~:111) — remove both.
B7 no change: skipping when Docker is absent (future CI, T056) — ruling: keep failing loudly; T056 decides its runner.
B8 no change now: NEXT_PUBLIC_API_BASE_URL for SSR from inside the container — recorded as a carry-forward for the
   first SSR page (controller will note it in tasks.md).

## C. Documentation

C1 CLAUDE.md: (a) in the before_implement description, say v0.4.1 and state A2 (hook replaces the Outline; the
   invoking /speckit-implement never implements tasks itself); (b) CLAUDE.md "Subagents never inherit this session's
   context: any dispatch must explicitly pass …" — align with A4 (task-brief + design-doc path + reference docs, never
   the whole plan); (c) the "Known friction" line "Runs before v0.4.0 (T001–T010) used hand-written briefs in
   .superpowers/sdd/tasks/" is inaccurate — correct to: T001, T005, T009, T010 have hand-written briefs there; T002–T008
   predate the ledger (their record is the tasks.md annotation + git history); (d) the "Current state" docker-compose
   caveat about root-owned files — update to match the B1 outcome (remove if fixed, list real paths if not);
   mention ports are loopback-only.
C2 Do NOT edit tasks.md (controller does it). Do NOT commit anything under .superpowers/.

## Scope / git hygiene
Stage files explicitly by path. Suggested commits: one for the bridge 0.4.1 + CLAUDE.md, one for the compose/test fix.
Commit messages end with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
