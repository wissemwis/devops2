# Task Brief — T001

Source: specs/001-questionnaire-platform/tasks.md, Phase 1: Setup

- [ ] T001 Create project structure per implementation plan: `backend/`, `frontend/` at repository root

## Exact requirement (verbatim from plan.md § Project Structure)

```text
backend/
├── src/
│   └── api/
│       ├── questionnaire/   # content-type + controllers/routes/services (Strapi)
│       ├── question/
│       ├── response/
│       └── user-role/       # extension du rôle utilisateur (auteur/répondant/administrateur)
└── tests/
    ├── contract/             # tests de contrat des endpoints REST
    └── integration/          # scénarios de bout en bout (creation → réponse → résultats)

frontend/
├── src/
│   ├── components/
│   ├── pages/                # création, remplissage, résultats
│   └── services/              # client API vers le backend Strapi
└── tests/
    ├── unit/
    └── integration/
```

## Scope for this task

T001 is a scaffolding task only: create the directory tree above (empty
directories, or directories containing only a `.gitkeep` where git would
otherwise not track them). Do NOT initialize package.json, install
dependencies, or write any application code — those belong to T002/T003
(out of scope for this dispatch).

## TDD approach for this task

This is a structural/scaffolding task, not application logic — apply
test-driven-development in the form that fits: write a test FIRST that
asserts the expected directories do NOT yet exist (RED), run it and confirm
it fails, then create the minimal directory structure to make it pass
(GREEN). Use a lightweight shell test (e.g. a `tests/structure/test_layout.sh`
using `[ -d ... ]` assertions, or an equivalent minimal test runner already
idiomatic for a bare repo with no test framework yet installed — this repo
has no Node project at the root, so do not assume Jest/Vitest are available
yet). Keep the test itself under version control.

## Report contract

Report one of: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
Write the full report to `.superpowers/sdd/tasks/task-1-report.md`, and
return to the controller only: status, commit hash(es), a one-line test
summary, and any concerns.
