# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) frontend, Strapi 5 backend, both TypeScript, PostgreSQL storage.
Decided in `specs/001-questionnaire-platform/plan.md` and `research.md` (not asked during
this init interview — recorded here for impeccable's own reference). V1 deploys on managed
platforms (Vercel + Strapi Cloud); see `.specify/memory/constitution.md` for the later
self-hosted migration track. No frontend code exists yet beyond an empty directory scaffold
(`frontend/app/`, `frontend/components/`, `frontend/services/`) — see `CLAUDE.md` § Current
state.

## Users

- **Auteur**: creates and publishes questionnaires (Likert, multiple-choice, free-text
  questions), sets visibility (public link or private invitation), reviews results, and
  relaunches non-respondents. Also plays the "analyste" role from the original product vision
  — no separate analyst account exists (decision FR-016).
- **Répondant**: opens a questionnaire via public link or a personal invitation link, fills it
  at their own pace, submits, and gets a confirmation. For private (invited) questionnaires,
  name/first name/email are required and pre-filled from the invitation.
- **Administrateur**: same capabilities as auteur but across all questionnaires, not just their
  own.

## Product Purpose

A questionnaire platform (create, publish, collect responses, view results, export CSV) built
for two connected reasons: it is deployed for real use as the end-of-session feedback survey
tool for a DevOps course, and its own codebase is the pre-built teaching artifact students use
in a "software factory" exercise (Git, CI/CD, Docker, Kubernetes) for that same course module.
Success means both a working survey tool students actually fill out, and a codebase clean and
real enough to be worth building a CI/CD pipeline around.

## Positioning

Not competing on generic form-building breadth against Google Forms or Typeform. The
differentiation is fit to one specific context: only the roles and questionnaire lifecycle a
course actually needs (draft → published → closed, public or invited access, Likert/multiple-
choice/free-text), no unrelated survey-tool feature surface — and the product itself doubles
as the course's CI/CD teaching material, which a generic SaaS form tool cannot do by
definition.

## Operating Context

Used session by session across an 11-session DevOps module: an auteur (often the instructor)
publishes a questionnaire at the end of a session, students respond via a private invitation
link (name/first name/email required) or the public link, and results/exports support the next
session's planning. In parallel, the same repository is the subject of the module's own Git/CI/
Docker/Kubernetes exercises — see `.specify/memory/constitution.md` § "Contraintes Techniques
et Pédagogiques" for the session-by-session deployment calendar.

## Capabilities and Constraints

- Question types: Likert, multiple-choice, free-text; each optionally required, optionally
  illustrated with an image.
- Questionnaire lifecycle: brouillon (draft) → publié (published) → fermé (closed); at least
  one question required before publishing.
- Visibility: publique (public link, anonymous by default) or privée (invitation-only; name,
  first name, email required and pre-filled from the invitation — FR-019).
- Results: per-question aggregation (distribution for Likert/multiple-choice, list for
  free-text), CSV export, non-respondent tracking and relaunch (private questionnaires only —
  FR-018).
- No secrets committed to the repo (env vars only); every deployed service exposes `GET
  /health` and structured logs — constitution Principles IV and V.
- Full functional requirements: `specs/001-questionnaire-platform/spec.md` (FR-001…FR-019).

## Brand Commitments

None. No existing name, logo, or visual identity constrains this project — fully open for a
visual world to be established in a future `new-work` pass. (`index.html` at the repo root is
an unrelated "coming soon" landing page from a different, unrelated initiative in this
repository — not this product's incumbent design.)

## Evidence on Hand

None yet — no screenshots, testimonials, or case studies exist. `specs/001-questionnaire-
platform/spec.md`, `data-model.md`, and `contracts/api.md` are the closest thing to evidence:
they are specifications, not built/verified product truth, and must not be treated as
screenshots or user quotes.

## Product Principles

1. **Course-fit over feature-completeness** — build exactly the questionnaire lifecycle a
   DevOps course session needs, nothing a generic form builder would add for breadth.
2. **The codebase is itself the product** — every implementation choice is also teaching
   material for the module's CI/CD exercise; code quality and clarity matter as much as the
   running app.
3. **Two deployment tracks, one product** — a fast managed V1 (Vercel + Strapi Cloud) for real
   use now, and a self-hosted migration (Docker/CI/Kubernetes) introduced on the course's own
   calendar, never the other way around.
4. **Identified respondents for private questionnaires** — when a questionnaire is invitation-
   only, the respondent's name, first name, and email are captured, never anonymous.
5. **No invented product facts** — respect what `spec.md`/`data-model.md`/`contracts/api.md`
   actually specify; do not add scope future work hasn't confirmed.

## Accessibility & Inclusion

No formal compliance requirement (e.g. WCAG AA) established by the institution. Standard good
practice — contrast, keyboard navigation, screen-reader support — applies without a mandated
audit.
