---

description: "Task list template for feature implementation"
---

# Tasks: Plateforme de gestion de questionnaires

**Input**: Design documents from `/specs/001-questionnaire-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Requis pour toutes les tâches d'implémentation — la Constitution du projet (Principe I,
NON-NEGOTIABLE) impose le TDD strict, appliqué par le hook `before_implement` de l'extension
`superpowers-bridge` (Superpowers `test-driven-development` + `subagent-driven-development`) :
chaque tâche d'implémentation ci-dessous doit être précédée d'un test qui échoue.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths: `backend/` = API Strapi, `frontend/` = React/Vite (Option 2, voir plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create project structure per plan.md: `backend/`, `frontend/` at repository root
- [ ] T002 Initialize backend Strapi 5 project in `backend/` (Node.js 20 LTS) per plan.md Primary Dependencies
- [ ] T003 [P] Initialize frontend React 18 + Vite project in `frontend/` per plan.md Primary Dependencies
- [ ] T004 [P] Configure linting/formatting (ESLint + Prettier) for `backend/` and `frontend/`
- [ ] T005 Create `.env.example` documenting DB, JWT and SMTP variables per plan.md Constraints (Principe IV — aucun secret en clair)

**Checkpoint**: Setup terminé — la phase Foundational peut commencer.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Aucune user story ne peut démarrer avant la fin de cette phase.

- [ ] T006 Configure PostgreSQL connection in `backend/config/database.js` per research.md (Storage: PostgreSQL en CI/production, SQLite en dev)
- [ ] T007 [P] Extend the Strapi `users-permissions` User content-type with `role` (enum: auteur, répondant, administrateur) in `backend/src/extensions/users-permissions/content-types/user/schema.json` per data-model.md Utilisateur
- [ ] T008 [P] Implement `GET /health` route + controller in `backend/src/api/health/routes/health.js` and `backend/src/api/health/controllers/health.js` returning `{"status":"ok"}` (200) or `{"status":"degraded","reason":<cause>}` (503) per contracts/api.md
- [ ] T009 [P] Configure structured JSON logging on stdout in `backend/config/logger.js` (Principe V — Observabilité)
- [ ] T010 Create `docker-compose.yml` at repository root wiring `db` (PostgreSQL), `backend`, `frontend` services per plan.md Constraints (Principe III — IaC)

**Checkpoint**: Fondations prêtes — les user stories peuvent démarrer (en parallèle si staffé).

---

## Phase 3: User Story 1 - Créer et publier un questionnaire (Priority: P1) 🎯 MVP

**Goal**: Un auteur crée un questionnaire, y ajoute des questions typées, définit sa visibilité,
et le publie.

**Independent Test**: Créer un compte auteur, composer un questionnaire de plusieurs questions,
le publier, vérifier la transition de statut brouillon → publié et la présence d'un lien d'accès
(quickstart.md Scénario 1).

### Tests for User Story 1 ⚠️

> Écrire ces tests en premier, confirmer qu'ils échouent avant toute implémentation (Principe I).

- [ ] T011 [P] [US1] Contract test `POST /api/questionnaires` in `backend/tests/contract/test_questionnaires_create.js`
- [ ] T012 [P] [US1] Contract test `PATCH /api/questionnaires/:id/questions` in `backend/tests/contract/test_questions_add.js`
- [ ] T013 [P] [US1] Contract test `POST /api/questionnaires/:id/publish` (incl. rejet 422 si aucune question — edge case spec.md) in `backend/tests/contract/test_questionnaire_publish.js`
- [ ] T014 [P] [US1] Contract test `POST /api/questionnaires/:id/close` in `backend/tests/contract/test_questionnaire_close.js`
- [ ] T015 [P] [US1] Integration test quickstart.md Scénario 1 in `backend/tests/integration/test_create_publish.js`

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create `Questionnaire` content-type (`titre`: string requis, `description`: text optionnel, `statut`: enum brouillon/publié/fermé défaut brouillon, `visibilite`: enum publique/privée requis, `auteur`: relation many-to-one Utilisateur) in `backend/src/api/questionnaire` per data-model.md
- [ ] T017 [P] [US1] Create `Question` content-type (`texte`: string requis, `type`: enum likert/choix_multiple/texte_libre requis, `position`: integer requis unique par questionnaire, `obligatoire`: boolean défaut false, `image`: media optionnel, `questionnaire`: relation many-to-one) in `backend/src/api/question` per data-model.md
- [ ] T018 [US1] Implement `POST /api/questionnaires` controller + route in `backend/src/api/questionnaire/controllers/questionnaire.js` (depends on T016)
- [ ] T019 [US1] Implement `PATCH /api/questionnaires/:id/questions` controller + route in `backend/src/api/question/controllers/question.js` (depends on T017, T018)
- [ ] T020 [US1] Implement `POST /api/questionnaires/:id/publish` with "au moins une question" validation (422 sinon) in `backend/src/api/questionnaire/controllers/questionnaire.js` (depends on T018, T019)
- [ ] T021 [US1] Implement `POST /api/questionnaires/:id/close` transition (statut → fermé) in `backend/src/api/questionnaire/controllers/questionnaire.js` (depends on T020)
- [ ] T022 [P] [US1] Frontend: questionnaire creation page in `frontend/src/pages/CreateQuestionnaire.jsx`
- [ ] T023 [P] [US1] Frontend: question editor component (ajout/réordre/suppression, types Likert/choix multiple/texte libre) in `frontend/src/components/QuestionEditor.jsx`
- [ ] T024 [US1] Frontend: API client + publish/close actions in `frontend/src/services/questionnaireService.js` (depends on T022, T023)

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment (MVP).

---

## Phase 4: User Story 2 - Répondre à un questionnaire (Priority: P2)

**Goal**: Un répondant accède à un questionnaire publié (public ou privé sur invitation), le
remplit à son rythme, et reçoit confirmation à la soumission.

**Independent Test**: Ouvrir un questionnaire publié existant via son lien, répondre aux questions
obligatoires, soumettre, vérifier la confirmation et le statut "complète" (quickstart.md
Scénario 2) ; pour un questionnaire privé, vérifier l'accès restreint et le pré-remplissage via
invitation (quickstart.md Scénario 3).

### Tests for User Story 2 ⚠️

- [ ] T025 [P] [US2] Contract test `GET /api/questionnaires/:id` (accès public sans auth, refus si privé sans jeton — FR-007/FR-008) in `backend/tests/contract/test_questionnaire_get.js`
- [ ] T026 [P] [US2] Contract test `POST /api/questionnaires/:id/reponses` (upsert, statut en_cours) in `backend/tests/contract/test_reponses_create.js`
- [ ] T027 [P] [US2] Contract test `POST /api/questionnaires/:id/reponses/:reponseId/submit` (422 si question obligatoire manquante — FR-010) in `backend/tests/contract/test_reponse_submit.js`
- [ ] T028 [P] [US2] Contract test `POST /api/questionnaires/:id/invitations` (création + envoi email) in `backend/tests/contract/test_invitations_create.js`
- [ ] T029 [P] [US2] Integration test quickstart.md Scénario 2 (public) in `backend/tests/integration/test_repondre_public.js`
- [ ] T030 [P] [US2] Integration test quickstart.md Scénario 3 (privé, pré-remplissage nom/prénom/email) in `backend/tests/integration/test_repondre_prive.js`

### Implementation for User Story 2

- [ ] T031 [P] [US2] Create `Reponse` content-type (`nom`/`prenom`/`email`: requis si questionnaire privé sinon optionnels — FR-019, `statut`: enum en_cours/complète défaut en_cours, `dateSoumission`, `questionnaire`: relation) in `backend/src/api/response` per data-model.md
- [ ] T032 [P] [US2] Create `ReponseQuestion` content-type (jonction `reponse`/`question`/`valeur` JSON) in `backend/src/api/response-question` per data-model.md
- [ ] T033 [P] [US2] Create `Invitation` content-type (`nom`, `prenom`, `email` requis, `jeton` unique signé, `statut` dérivé) in `backend/src/api/invitation` per data-model.md
- [ ] T034 [US2] Implement `GET /api/questionnaires/:id` with public/private + signed-token access rule (depends on T016, T033)
- [ ] T035 [US2] Implement `POST /api/questionnaires/:id/invitations` (création + envoi email SMTP via plugin Email Strapi — research.md) (depends on T033)
- [ ] T036 [US2] Implement `POST /api/questionnaires/:id/reponses` upsert, pré-remplissage nom/prénom/email depuis l'invitation si présent (depends on T031, T032, T034)
- [ ] T037 [US2] Implement `POST /api/questionnaires/:id/reponses/:reponseId/submit` with obligatoire-fields validation (FR-010) and unicité (questionnaire, email) pour questionnaire privé — edge case double soumission (depends on T036)
- [ ] T038 [P] [US2] Frontend: public/private questionnaire fill page (pré-remplissage si invitation) in `frontend/src/pages/FillQuestionnaire.jsx`
- [ ] T039 [US2] Frontend: submission + confirmation UI, message d'erreur sur question obligatoire manquante in `frontend/src/pages/FillQuestionnaire.jsx` (depends on T038)

**Checkpoint**: User Stories 1 et 2 fonctionnelles indépendamment.

---

## Phase 5: User Story 3 - Consulter et exporter les résultats (Priority: P3)

**Goal**: Un auteur/administrateur consulte les résultats agrégés d'un questionnaire, les exporte
en CSV, identifie les non-répondants d'un questionnaire privé et déclenche une relance.

**Independent Test**: Charger un questionnaire disposant déjà de réponses, vérifier
l'affichage de statistiques par question, déclencher un export CSV, vérifier la liste des
non-répondants et la relance pour un questionnaire privé (quickstart.md Scénario 4).

### Tests for User Story 3 ⚠️

- [ ] T040 [P] [US3] Contract test `GET /api/questionnaires/:id/resultats` in `backend/tests/contract/test_resultats.js`
- [ ] T041 [P] [US3] Contract test `GET /api/questionnaires/:id/export.csv` in `backend/tests/contract/test_export_csv.js`
- [ ] T042 [P] [US3] Contract test `GET /api/questionnaires/:id/non-repondants` (questionnaire privé uniquement — FR-018) in `backend/tests/contract/test_non_repondants.js`
- [ ] T043 [P] [US3] Contract test `POST /api/questionnaires/:id/relance` in `backend/tests/contract/test_relance.js`
- [ ] T044 [P] [US3] Integration test quickstart.md Scénario 4 in `backend/tests/integration/test_resultats_export.js`

### Implementation for User Story 3

- [ ] T045 [US3] Implement `GET /api/questionnaires/:id/resultats` aggregation service (distribution Likert/choix multiple, liste texte libre) in `backend/src/api/questionnaire/services/resultats.js` (depends on T031, T032)
- [ ] T046 [US3] Implement `GET /api/questionnaires/:id/export.csv` (une ligne par réponse complète) in `backend/src/api/questionnaire/services/export.js` (depends on T045)
- [ ] T047 [US3] Implement `GET /api/questionnaires/:id/non-repondants` (invitations sans réponse liée, questionnaire privé uniquement — FR-018) (depends on T033, T031)
- [ ] T048 [US3] Implement `POST /api/questionnaires/:id/relance` (renvoi de l'email d'invitation) (depends on T035, T047)
- [ ] T049 [P] [US3] Frontend: results page with charts (statistiques par question) in `frontend/src/pages/Results.jsx`
- [ ] T050 [US3] Frontend: CSV export action + non-répondants/relance UI in `frontend/src/pages/Results.jsx` (depends on T049)

**Checkpoint**: Les trois user stories sont fonctionnelles indépendamment.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Write `backend/Dockerfile` and `frontend/Dockerfile` (Principe III — S5-S7)
- [ ] T052 [P] Write initial CI pipeline (`.gitlab-ci.yml` or `Jenkinsfile`) running lint + tests on push (Principe III — S4, S8-S10)
- [ ] T053 [P] Write Kubernetes manifests (Deployment + Service for backend/frontend, readiness/liveness probe on `GET /health`) in `k8s/` (Principe III/V — S11)
- [ ] T054 Run quickstart.md end-to-end validation against a local docker-compose stack
- [ ] T055 Security hardening pass: confirm no secret committed, `.env.example` matches `.gitignore` coverage (Principe IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance.
- **Foundational (Phase 2)**: dépend de Setup — bloque toutes les user stories.
- **User Stories (Phase 3-5)**: dépendent toutes de Foundational. US1 est indépendante ; US2
  dépend de US1 pour disposer d'un questionnaire publié à tester mais son code (T025-T039) est
  indépendant des fichiers de US1 ; US3 dépend de données produites par US1+US2 pour être
  démontrée mais son code (T040-T050) est indépendant.
- **Polish (Phase 6)**: dépend de l'achèvement des user stories voulues.

### Parallel Opportunities

- T003, T004 (Setup) en parallèle.
- T007, T008, T009 (Foundational) en parallèle.
- Tests T011-T015 (US1) en parallèle entre eux ; T016, T017 (modèles US1) en parallèle.
- Tests T025-T030 (US2) en parallèle ; T031, T032, T033 (modèles US2) en parallèle.
- Tests T040-T044 (US3) en parallèle.
- T051, T052, T053 (Polish) en parallèle.

---

## Implementation Strategy

### MVP First (User Story 1 uniquement)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. Valider indépendamment (quickstart.md Scénario 1), démontrer.

### Incremental Delivery

1. Setup + Foundational → fondation prête.
2. US1 → validation indépendante → démo (MVP).
3. US2 → validation indépendante → démo.
4. US3 → validation indépendante → démo.
5. Polish (Phase 6), avec progression Docker/CI/Kubernetes alignée sur le calendrier de séances
   de la constitution.
