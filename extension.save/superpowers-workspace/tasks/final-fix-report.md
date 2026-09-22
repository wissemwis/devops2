# Final-fix report — branch claude/task-t010-docker-compose

Fix wave for `.superpowers/sdd/tasks/final-fix-findings.md` (FIX_BASE 22d82eb).
All work done directly (no subagents dispatched, per instructions).

## Section A — superpowers-bridge 0.4.1

Files touched (all four kept byte-identical / substitution-consistent, verified below):
- `extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md` (source)
- `.specify/extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md` (copy)
- `.specify/extensions/superpowers-bridge/.specify-dev/agent-commands/claude/speckit-superpowers-bridge-tdd-implement/SKILL.md` (generated)
- `extensions/superpowers-bridge/extension.yml` + `.specify/extensions/superpowers-bridge/extension.yml` (version 0.4.0 -> 0.4.1)

`.claude/skills/speckit-superpowers-bridge-tdd-implement/SKILL.md` — left untouched, still a
symlink to the generated file above (confirmed with `ls -la`, not replaced).

### A1 (Important) — scope loss — FIXED
New step 2: scope resolution order is (a) this command's own `$ARGUMENTS`, (b) else the invoking
`/speckit-implement`'s user input, (c) else ASK the human, offering "next unchecked task" as the
default. Explicit "never silently default to 'every unchecked task'" line added.

### A2 (Important) — terminal-state leak into /speckit-implement's own Outline — FIXED
New step 11 (last step in the file): "**Terminal instruction.** This hook REPLACES
`/speckit-implement`'s Outline steps 3-9 in full. When this hook returns, the invoking
`/speckit-implement` MUST NOT implement, review, or mark `[X]` any task itself... It proceeds
directly to its own 'Mandatory Post-Execution Hooks' (`after_implement`) section and then its
Completion Report." Mirrored in CLAUDE.md (`CLAUDE.md:69-71`).

### A3 (Important) — brainstorming terminal-step misstatement — FIXED
Step 4 (brainstorm) now has two new constraint bullets: "A `tasks.md` item is never a spike...
Classify it bounded or architectural — never spike," and "Whatever path brainstorming classifies
(bounded or architectural), the next step is step 5 below (`writing-plans`). This explicitly
overrides the bounded path's normal terminal state... `writing-plans` is never skipped for a
`tasks.md` item, on either path."

### A4 (Important) — dispatch contents contradict SDD's task-brief rule — FIXED
Step 7 rewritten. Old text handed the subagent "the plan written in step 4" as a path to read
directly — that's the whole `writing-plans` document, which SDD says a subagent should never
read. New text: the plan text "reach[es] the subagent only through SDD's own channel — its
task-brief output plus the plan's Global Constraints block copied verbatim — never as a
handed-over path to the step-5 plan document." Dispatch now carries: tasks.md ID line, task-brief
path (SDD's `scripts/task-brief`), design-doc path (step 4), and spec.md/plan.md/tasks.md/
constitution.md paths explicitly labeled "reference reading only" with an instruction not to read
the whole `writing-plans` document. Reviewer inputs updated to "SDD's own — the brief file, the
report file, the review-package diff, and the plan's Global Constraints block — plus the
design-doc path from step 4; never the whole plan document either."

### A5 (Minor) — git state before any commit — FIXED
New step 3: "Git safety, before brainstorming touches anything." If on main/master, create and
switch to `claude/<task-ids>-<slug>`; otherwise stay on the current branch. Notes that SDD's
worktree setup may reuse this branch, recorded as a standing fact, not a fresh ruling each run.

### A6 (Minor) — SDD's `rm -rf <workspace>` Finish step — FIXED
Step 10: "Do NOT delete this plan's SDD workspace afterward, even though SDD's own Finish step
says to — some `.superpowers/sdd/tasks/*` files are git-tracked historically in this repo, so
leave the workspace in place. Still collect the 'Rulings I made' list per SDD's Finish section,
then invoke `superpowers:finishing-a-development-branch` — its push/PR/merge options remain gated
by the human..."

### A7 (Minor) — "two-stage review" misnomer — FIXED
Purpose section reworded: "...and one task review (spec compliance + code quality —
`subagent-driven-development`'s single review with two verdicts) after each." Step 8 also
reworded to "SDD's single review with two verdicts."

### A8 (Minor) — FEATURE_DIR undefined — FIXED
Step 1: "FEATURE_DIR is the feature directory the invoking `/speckit-implement` already resolved
(its `check-prerequisites.sh --json` output, e.g. `specs/001-questionnaire-platform/`)."

### A9 (Minor) — generated SKILL.md missing final newline — FIXED
Generated programmatically with an explicit trailing-newline guarantee; verified below (single
`\n`, not `\n\n`).

### Sync verification (commands + outputs)

```
$ diff extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md \
       .specify/extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md
(no output) -> IDENTICAL

$ diff extensions/superpowers-bridge/extension.yml .specify/extensions/superpowers-bridge/extension.yml
(no output) -> IDENTICAL

$ python3 - <<'EOF'
src_path = "extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md"
skill_path = ".specify/extensions/superpowers-bridge/.specify-dev/agent-commands/claude/speckit-superpowers-bridge-tdd-implement/SKILL.md"
with open(src_path) as f: src = f.read()
body = src.split("---\n", 2)[2]
expected_body = body.replace("/memory/constitution.md", ".specify/memory/constitution.md")
if not expected_body.endswith("\n"): expected_body += "\n"
with open(skill_path) as f: skill = f.read()
actual_body = skill.split("---\n", 2)[2]
print("Bodies match:", actual_body == expected_body)
print("SKILL.md ends with single trailing newline:", skill.endswith("\n") and not skill.endswith("\n\n"))
EOF
Bodies match: True
SKILL.md ends with single trailing newline: True

$ ls -la .claude/skills/speckit-superpowers-bridge-tdd-implement/SKILL.md
lrwxrwxrwx ... SKILL.md -> ../../../.specify/extensions/superpowers-bridge/.specify-dev/agent-commands/claude/speckit-superpowers-bridge-tdd-implement/SKILL.md
(symlink untouched, not replaced)
```

The only intentional divergence between source and generated SKILL.md is the frontmatter (name/
compatibility/metadata added, description copied from source) and the single substitution of
`/memory/constitution.md` -> `.specify/memory/constitution.md` inside the body (line 1's
FEATURE_DIR-reading bullet) — everything else in the body is byte-identical, confirmed above.

## Section B — docker-compose.yml + tests/structure/test_docker_compose.sh

TDD followed throughout (`superpowers:test-driven-development` invoked via the Skill tool before
starting): test extended first, RED captured against the *old* docker-compose.yml, then
docker-compose.yml changed for GREEN.

### RED (before touching docker-compose.yml)

Ran `bash tests/structure/test_docker_compose.sh` after extending the test but before editing
the compose file. 13 failures, all and only the new/changed assertions (no unexpected
passes/failures) — full output captured; summary:

```
✗ FAIL: exactly the services db, backend, frontend, init are declared
✗ FAIL: db's published port is bound to 127.0.0.1 only
✗ FAIL: backend depends_on init with condition service_completed_successfully
✗ FAIL: backend runs as the non-root node user (uid:gid 1000:1000...)
✗ FAIL: backend's published port is bound to 127.0.0.1 only
✗ FAIL: frontend depends_on init with condition service_completed_successfully
✗ FAIL: frontend runs as the non-root node user (uid:gid 1000:1000...)
✗ FAIL: frontend's published port is bound to 127.0.0.1 only
✗ FAIL: init mounts the backend-node-modules volume
✗ FAIL: init mounts the frontend-node-modules volume
✗ FAIL: init's command chowns the mounted volumes
✗ FAIL: init publishes no ports (internal one-shot helper only)
✗ FAIL: backend LOG_LEVEL falls back to 'http' when LOG_LEVEL is unset in the env file
Total: 40 | Passed: 27 | Failed: 13
```

### GREEN (after editing docker-compose.yml)

```
Total: 40 | Passed: 40 | Failed: 0
✓ All tests passed!
```

### B1 (Important) — non-root containers / root-owned host files — FIXED, live-verified

`docker-compose.yml`: added a new `init` service (image `node:20`, default root user, no ports)
whose command is `chown -R ${UID:-1000}:${GID:-1000} /mnt/backend-node-modules
/mnt/frontend-node-modules` over the two named node_modules volumes mounted at those paths.
`backend` and `frontend` now set `user: "${UID:-1000}:${GID:-1000}"` and
`depends_on: { db: {condition: service_healthy}, init: {condition: service_completed_successfully} }`
(backend) / `depends_on: { backend: {condition: service_started}, init: {condition:
service_completed_successfully} }` (frontend), so the chown always completes before either
service starts as the non-root user. See `docker-compose.yml:1-40` (init service + header
comment explaining the mechanism) and `docker-compose.yml:70,113` (`user:` lines).

**Live verification** (throwaway root `.env` from `.env.example`, removed after; `docker compose
down -v` at the end; no `sudo` used):

```
$ id                                    # host user
uid=1000(ubuntu) gid=1000(ubuntu) ...

$ cp .env.example .env
$ docker compose up -d
 Container devops2-init-1 Created/Started, Exited (0)
 Container devops2-db-1 Healthy
 Container devops2-backend-1 Started
 Container devops2-frontend-1 Started
# polled docker compose ps --format json for backend Health
[19] backend health=healthy   (~3m10s: npm ci + Strapi build/boot)

$ docker compose ps -a
devops2-backend-1    Up (healthy)     127.0.0.1:1337->1337/tcp
devops2-db-1         Up (healthy)     127.0.0.1:5432->5432/tcp
devops2-frontend-1   Up               127.0.0.1:3000->3000/tcp
devops2-init-1       Exited (0)

$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:1337/health
{"status":"ok"}
HTTP_STATUS:200

$ curl -s -o /dev/null -w "frontend HTTP_STATUS:%{http_code}\n" http://127.0.0.1:3000/
frontend HTTP_STATUS:200

$ docker compose logs backend --tail 4
{"level":"info","message":"Strapi started successfully",...}
{"level":"http","message":"GET /health (18 ms) 200",...}
{"level":"http","message":"GET /health (12 ms) 200",...}
{"level":"http","message":"GET /health (7 ms) 200",...}

$ docker compose exec -T backend id
uid=1000(node) gid=1000(node) groups=1000(node)
$ docker compose exec -T frontend id
uid=1000(node) gid=1000(node) groups=1000(node)
```

**Root-owned-files check** — before `docker compose up`, an empty root-owned `frontend/
node_modules` directory (a leftover from an earlier session's run, dated before this fix wave
started) was found and removed with a plain `rmdir` (no sudo needed — `frontend/` itself is
owned by the host user, so removing an *empty* child it doesn't own is a normal directory
operation, not a permission escalation). After `docker compose up -d` and full live verification:

```
$ find backend frontend -user root
frontend/node_modules
EXIT=0

$ ls -A frontend/node_modules; echo "entries: $(ls -A frontend/node_modules | wc -l)"
entries: 0
```

The only root-owned filesystem object is the empty `frontend/node_modules` *mountpoint*
directory itself — created by the Docker daemon (which runs as root on the host) at container-
setup time because a named volume (`frontend-node-modules`) is mounted at a path nested inside a
bind mount (`./frontend:/app`); the daemon must materialize the mountpoint on the host before the
containerized, non-root process ever starts, so this one directory entry is unavoidable via the
`user:` field alone and is exactly what the finding's own wording anticipates: "excluding
node_modules volumes, which are not on the host". Its *contents* (0 entries) confirm no real
install output ever lands there — `npm ci`'s actual output goes into the named volume, not the
host filesystem, exactly as intended. `backend/node_modules` was not recreated as a mountpoint at
all, because a real (host-native, pre-existing, `ubuntu`-owned) `backend/node_modules` directory
was already present from an earlier native `npm install`, so Docker had no empty path to
materialize there.

```
$ find backend frontend -user root -not -name node_modules
(no output) EXIT=0
```

`backend/types` (Strapi's auto-generated types, the specific side effect T010's own report
flagged as root-owned) is now `ubuntu:ubuntu` after this run, not `root:root` — confirming the
non-root fix actually resolves the originally-reported symptom, not just a synthetic check.

Cleanup:
```
$ docker compose down -v
 (all 3 containers + init + 3 volumes + network removed)
$ rm -f .env
$ rmdir frontend/node_modules   # empty mountpoint dir, removed without sudo
$ rm -rf backend/types          # generated artifact from this verification run, ubuntu-owned
$ git status --porcelain        # clean except unrelated pre-existing .superpowers/sdd/tasks/progress.md
```

No root-owned files were left anywhere in the working tree after cleanup — verified with
`find . -user root` (excluding `.git`) returning nothing.

### B2 (Important) — ports published on 0.0.0.0 — FIXED
`db`, `backend`, `frontend` now publish `"127.0.0.1:5432:5432"`, `"127.0.0.1:1337:1337"`,
`"127.0.0.1:3000:3000"` respectively (`docker-compose.yml:48,76,122`). Test asserts
`host_ip == '127.0.0.1'` on every published port for all three services (and confirmed live:
`docker compose ps -a` above shows `127.0.0.1:*->*` for all three, not `0.0.0.0:*`).

### B3 (Minor, fix now) — `LOG_LEVEL: ${LOG_LEVEL}` empty-string trap — FIXED
Changed to `LOG_LEVEL: ${LOG_LEVEL:-http}` (`docker-compose.yml:96`). Test builds a *second*
throwaway env file (`.env.example` with the `LOG_LEVEL=` line stripped) and asserts the resolved
`environment.LOG_LEVEL == 'http'`; RED before the fix confirmed the old `${LOG_LEVEL}` form
resolved to `''` (test failed as expected), GREEN after confirms the default applies.

### B4 (Minor, fix now) — `restart: unless-stopped` on db — REMOVED
`docker-compose.yml`'s `db` service no longer has a `restart:` key (was YAGNI/unrequested per the
finding).

### B5 (Minor, fix now) — comment on `DATABASE_PORT: 5432` — ADDED
`docker-compose.yml:88-91`: "db's container-internal port (the service network alias 'db' always
listens on Postgres's default 5432) — independent of the host-side port mapping above, which a
contributor could change without affecting this value."

### B6 (Minor, fix now) — dead/duplicate test assertions — REMOVED
Deleted both `check_model "'profiles' not in data" ...` and `check_model "len(data['services'])
== 3" ...` from `tests/structure/test_docker_compose.sh`. (The primary services-set assertion at
the top of the file — `set(data['services'].keys()) == {...}` — was updated in the same pass to
include the new `init` service, which is the assertion that actually needs to change when the
service count changes; that update is a direct consequence of B1's design, not part of B6's
"these two never usefully fail" fix.)

### B7 / B8 — no change, as ruled
Not touched.

## Section C — Documentation

### C1(a) — before_implement description: v0.4.1 + A2 statement — DONE
`CLAUDE.md:54-75`: version bumped to v0.4.1 in the description; explicit sentence "**This hook
replaces `/speckit-implement`'s own Outline steps 3-9 entirely**: once it returns, the invoking
`/speckit-implement` does not implement, review, or mark `[X]` any task itself — it proceeds
straight to its Mandatory Post-Execution Hooks and Completion Report."

### C1(b) — subagent dispatch contents aligned with A4 — DONE
`CLAUDE.md:77-85`: rewritten to describe task-brief path + design-doc path + reference-only
spec/plan/tasks/constitution paths, explicitly stating the `writing-plans` plan document itself
is never handed to a subagent as a path to read.

### C1(c) — "Known friction" inaccuracy — FIXED
`CLAUDE.md:94-96`: "T001, T005, T009 and T010 have hand-written briefs in
`.superpowers/sdd/tasks/` from runs before v0.4.0 introduced `writing-plans`; T002-T008 predate
this ledger entirely — their record is the `tasks.md` inline annotation plus git history, not a
brief file." Verified against the actual directory listing: `task-1-brief.md`, `task-5-brief.md`,
`task-9-brief.md`, `task-10-brief.md` are the only brief files present (matches T001/T005/T009/
T010).

### C1(d) — docker-compose caveat updated to match B1/B2 — DONE
`CLAUDE.md:116-124`: replaced the old "the bind mount leaves root-owned backend/types/generated/
files on the host" caveat (no longer true) with a description of the non-root/init-service
mechanism, the live-verification result (no root-owned files under backend/frontend, excepting
the expected empty node_modules mountpoint directory), and loopback-only ports.

### C2 — tasks.md not touched; nothing under `.superpowers/` committed
Confirmed: `git status --porcelain` before and after both commits shows only the pre-existing,
already-modified `.superpowers/sdd/tasks/progress.md` (present in the branch's git status at the
start of this session, untouched by me) — never staged or committed. `tasks.md` was not read for
editing and has no diff.

## Full test-suite results (post-fix, with the portable Node 22 on PATH)

```
tests/structure/test_backend_init.sh    -> Total: 7  | Passed: 7  | Failed: 0
tests/structure/test_database_config.sh -> Total: 18 | Passed: 18 | Failed: 0
tests/structure/test_docker_compose.sh  -> Total: 40 | Passed: 40 | Failed: 0
tests/structure/test_env_example.sh     -> Total: 25 | Passed: 25 | Failed: 0
tests/structure/test_frontend_init.sh   -> Total: 7  | Passed: 7  | Failed: 0
tests/structure/test_health_route.sh    -> Total: 14 | Passed: 14 | Failed: 0
tests/structure/test_json_logger.sh     -> Total: 18 | Passed: 18 | Failed: 0
tests/structure/test_layout.sh          -> Total: 13 | Passed: 13 | Failed: 0
tests/structure/test_lint_format.sh     -> Total: 14 | Passed: 14 | Failed: 0
tests/structure/test_user_role.sh       -> Total: 9  | Passed: 9  | Failed: 0
```

10 scripts, 165/165 passing (baseline was 10 scripts / 155/155; the +10 net comes entirely from
`test_docker_compose.sh` growing 30 -> 40 checks: +13 new assertions, -2 removed per B6, +1 net
from updating the services-set check in place — 30 - 2 + 12 = 40).

## Commits

```
759a149 superpowers-bridge 0.4.1: fix scope loss, terminal-state leak, dispatch contents
        (extensions/superpowers-bridge/{commands/*.md,extension.yml},
         .specify/extensions/superpowers-bridge/{commands/*.md,extension.yml,
         .specify-dev/.../SKILL.md}, CLAUDE.md)

81e365f T010 final-fix: non-root containers, loopback ports, safe LOG_LEVEL default
        (docker-compose.yml, tests/structure/test_docker_compose.sh)
```

Both staged explicitly by path (no `git add -A`/`.`); nothing under `.superpowers/` staged or
committed; `tasks.md` untouched; working tree clean afterward except the pre-existing, unrelated
`.superpowers/sdd/tasks/progress.md` modification that predates this fix wave.

## Concerns for the controller

None load-bearing. One note: the empty root-owned `frontend/node_modules` mountpoint directory
recreated by every `docker compose up` (Docker-daemon behavior, not fixable from the compose file
alone) is gitignored and empty, so it doesn't pollute `git status` or hold any real content — but
a contributor who runs `docker compose up` locally will see it appear on the host each time. Not
a regression from this fix (it existed identically, for the same daemon-level reason, before B1
was fixed) and explicitly anticipated/excluded by the finding's own wording.
