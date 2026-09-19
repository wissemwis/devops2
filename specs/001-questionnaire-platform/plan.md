# Implementation Plan: Plateforme de gestion de questionnaires

**Branch**: `001-questionnaire-platform` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-questionnaire-platform/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

**Amendment 2026-09-19 (a)**: Frontend framework changed from React 18 + Vite to **Next.js**,
per the brainstorming design at
[docs/superpowers/specs/2026-09-19-questionnaire-platform-design.md](../../docs/superpowers/specs/2026-09-19-questionnaire-platform-design.md).
Backend (Strapi 5) is unchanged. This amendment updates Technical Context, Constitution
Check, Project Structure below, and `research.md`/`quickstart.md`; it does not touch
`data-model.md` or `contracts/api.md` (backend-only, unaffected) nor `tasks.md` (regenerated
separately by `/speckit-tasks` if needed).

**Amendment 2026-09-19 (b)**: Language changed to **TypeScript** on both backend (Strapi 5)
and frontend (Next.js), replacing plain JavaScript — explicit decision by the project owner.
Updates Technical Context (Language/Version, Testing) and `research.md` below; propagated to
`tasks.md` file extensions by `/speckit-tasks`.

## Summary

Plateforme web permettant à un auteur de créer/publier des questionnaires (Likert, choix
multiple, texte libre), à un répondant d'y répondre via lien public ou invitation privée, et à
l'auteur/administrateur de consulter les résultats, les exporter en CSV et relancer les
non-répondants des questionnaires privés. Approche technique : API headless Strapi comme
backend (schéma Questionnaire/Question/Réponse/Utilisateur, endpoints REST), frontend Next.js
consommant cette API, le tout conteneurisé et déployé progressivement (Docker Compose → CI →
Kubernetes) conformément à la constitution du projet.

## Technical Context

**Language/Version**: TypeScript sur Node.js 20 LTS (runtime requis par Strapi 5), backend et
frontend

**Primary Dependencies**: Strapi 5 en mode TypeScript (backend API + admin, content-types
générés en `.ts`), Next.js (App Router, frontend, TypeScript activé via `tsconfig.json`),
Nodemailer ou service SMTP équivalent (emails d'invitation, FR-017)

**Storage**: PostgreSQL (production et CI), SQLite acceptable en développement local uniquement

**Testing**: Jest + Supertest (fichiers `.test.ts`) pour les tests de contrat/intégration de
l'API Strapi, Vitest + Testing Library (fichiers `.test.ts`/`.test.tsx`) pour le frontend
Next.js — appliqués selon le cycle RED-GREEN-REFACTOR imposé par le hook `before_implement`
(Superpowers `test-driven-development`)

**Target Platform**: Conteneurs Linux (Docker), orchestrés via Kubernetes en cible finale (S11) ;
pipelines CI sur Jenkins ou GitLab CI (S8-S10)

**Project Type**: Application web (backend API + frontend séparés) — Option 2 de la structure
projet ci-dessous

**Performance Goals**: Résultats affichés en moins de 2 s pour un questionnaire ayant jusqu'à
1000 réponses (SC-003) ; soumission de réponse acceptée sans erreur perçue dans 95% des cas
(SC-004)

**Constraints**: Aucun secret en clair dans le dépôt (Principe IV) ; accès aux questionnaires
privés strictement limité aux invités (FR-008) ; chaque service déployé expose un endpoint de
santé et des logs structurés (Principe V) ; tout déploiement doit être scripté et reproductible
(Principe III)

**Scale/Scope**: Échelle pédagogique — de l'ordre du millier de réponses simultanées par
questionnaire (hypothèse de spec.md), usage réel initial = un questionnaire de fin de séance par
séance du module (11 séances)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Statut | Justification |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | `/speckit-implement` délègue à `before_implement` (superpowers-bridge → subagent-driven-development + test-driven-development) : un sous-agent par tâche, cycle RED-GREEN-REFACTOR obligatoire avant tout code de production. |
| II. Simplicité et YAGNI | PASS | Structure à deux projets (backend Strapi / frontend Next.js) justifiée par la nature même du produit décrit (API + front séparés dans la spec source) ; pas de couche d'abstraction additionnelle (pas de microservices, pas de BFF) à ce stade. Next.js n'introduit pas de complexité supplémentaire par rapport à React+Vite — même bibliothèque de composants, juste un outillage de build/routage différent. |
| III. Infrastructure as Code et Reproductibilité | PASS | Dockerfile + docker-compose.yml versionnés dès S5-S7 ; pipeline CI versionné (Jenkinsfile ou .gitlab-ci.yml) ; manifests Kubernetes versionnés pour S11. Aucune étape manuelle de déploiement. |
| IV. Sécurité par défaut | PASS | Secrets (DB, SMTP, JWT Strapi) injectés via variables d'environnement/CI secrets, jamais commités ; accès aux questionnaires privés par lien signé unique (FR-017), vérifié côté serveur. |
| V. Observabilité | PASS (avec ajout technique) | Le endpoint de santé n'est pas un besoin utilisateur donc absent de spec.md à dessein, mais est ajouté ici comme exigence technique transverse : l'API Strapi expose `GET /health` (voir contracts/), et les logs applicatifs sont structurés (JSON) sur stdout pour être collectés par la CI/les conteneurs. |

Aucune violation constitutionnelle non justifiée : la section Complexity Tracking reste vide.

**Re-check post Phase 1** : les entités techniques ajoutées en Phase 1 (`ReponseQuestion`,
`Invitation` — absentes de `spec.md` mais nécessaires à l'implémentation) restent la brique
minimale requise par FR-002/FR-013/FR-017/FR-019 ; aucune ne constitue une abstraction
prématurée. Gates toujours au vert.

## Project Structure

### Documentation (this feature)

```text
specs/001-questionnaire-platform/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

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
├── app/                        # Next.js App Router
│   ├── questionnaires/create/  # création (US1)
│   ├── q/[token]/               # remplissage public ou par jeton d'invitation (US2)
│   └── questionnaires/[id]/results/  # résultats (US3)
├── components/
├── services/                   # client API vers le backend Strapi
└── tests/
    ├── unit/
    └── integration/
```

**Structure Decision**: Option 2 (application web backend/frontend séparés), conforme à la
description source ("API Strapi" + "Front : create, view, results pages"), avec le frontend
implémenté en Next.js (App Router) depuis l'amendement du 2026-09-19 — voir
`docs/superpowers/specs/2026-09-19-questionnaire-platform-design.md`. Chaque type de contenu
Strapi (questionnaire, question, response) correspond à une entité de
`spec.md`/`data-model.md` ; le frontend Next.js ne parle au backend que via son API REST (pas
d'accès direct à la base de données depuis le frontend).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
