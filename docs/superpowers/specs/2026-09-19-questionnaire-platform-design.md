# Design: Plateforme de gestion de questionnaires

**Date**: 2026-09-19
**Status**: Approved
**Related Spec Kit feature**: [specs/001-questionnaire-platform/spec.md](../../../specs/001-questionnaire-platform/spec.md)

## Context

Projet fil rouge du module DevOps 2 : une application de gestion de questionnaires
(auteur/répondant/analyste), utilisée pour l'automatisation pédagogique (Git, CI/CD,
Docker, Kubernetes) sur 11 séances, et pour de vrais sondages de fin de séance.

Ce document est né d'un test délibéré du hook `before_specify` de l'extension
`superpowers-bridge` (Spec Kit) sur une feature déjà spécifiée
(`specs/001-questionnaire-platform/`), après avoir modifié la commande
`speckit.superpowers-bridge.brainstorm` pour qu'elle laisse `brainstorming` écrire
son document de design normal (au lieu de le supprimer). Le contenu fonctionnel
(rôles, entités, workflows) était déjà arrêté dans `spec.md`/`plan.md` ; ce
brainstorming a rouvert et tranché trois décisions techniques.

## Décisions rouvertes et arbitrées

### Stack technique

**Décision** : Backend **Strapi 5** (inchangé) + Frontend **Next.js** (remplace
React 18 + Vite de `plan.md`/`research.md`).

**Alternatives explorées** :
- Réécrire le backend à la main (Node.js/Express/PostgreSQL sans CMS), pour
  enseigner la plomberie plutôt que la masquer derrière Strapi — écarté : l'objectif
  réel de cette session était de tester le mécanisme `superpowers-bridge`, pas de
  relancer un débat d'architecture approfondi ; Strapi reste un choix valable et
  déjà implémenté (content-types + `GET /health` posés dans le prototype T001).
- Frontend React+Vite pur (choix initial de `research.md`) — remplacé par Next.js
  à la demande explicite de l'utilisateur : Next.js colocalise pages et logique
  serveur (Route Handlers / Server Actions) dans un seul projet frontend, tout en
  restant sur React comme bibliothèque de composants.

**Impact sur les artefacts existants** : `plan.md` (Primary Dependencies,
Structure Decision) et `research.md` (section "Frontend framework") doivent être
mis à jour pour remplacer "React 18 + Vite" par "Next.js" — non fait dans ce
document ; à reporter dans `/speckit.plan` si cette feature est re-planifiée.

### Modèle de rôles

**Décision confirmée** : pas de rôle "analyste" séparé. Un auteur consulte,
exporte et relance sur ses propres questionnaires ; un administrateur peut le
faire sur l'ensemble. (Correspond à FR-016 de `spec.md`, déjà en place.)

### Mécanisme d'invitation

**Décision confirmée** : email automatique contenant un lien signé unique par
invité, portant nom/prénom/email pré-associés. (Correspond à FR-017/FR-019 de
`spec.md`, déjà en place.)

## Architecture

Deux services déployés séparément :

- **`backend/`** : Strapi 5 — API REST + panneau d'administration, PostgreSQL
  comme stockage. Expose `GET /health` (liveness/readiness).
- **`frontend/`** : Next.js (App Router) — consomme l'API Strapi via fetch/REST ;
  pas de connexion directe à la base de données depuis le frontend.

Conteneurisés indépendamment (un `Dockerfile` par service, deux entrées dans
`docker-compose.yml`), cohérent avec la progression par séance de la
constitution du projet (S3 build npm sur chacun, S5-S7 Docker/Compose, S11
Kubernetes = un Deployment par service).

## Composants

- Strapi porte les content-types déjà modélisés dans `data-model.md` :
  Questionnaire, Question, Réponse, ReponseQuestion (jonction), Invitation.
- Next.js porte trois groupes de pages, alignés sur les User Stories de
  `spec.md` :
  1. **Création/édition** (auteur, US1) — formulaire questionnaire + éditeur de
     questions.
  2. **Remplissage** (répondant, US2) — accès public ou via jeton d'invitation,
     pré-remplissage nom/prénom/email si invité.
  3. **Résultats** (auteur/administrateur, US3) — statistiques, export CSV,
     non-répondants/relance.

## Flux de données

Le contrat REST déjà écrit dans `contracts/api.md` ne change pas : Next.js ne
réimplémente aucune logique métier, il consomme les mêmes endpoints Strapi. Le
choix SSR (page résultats, données fraîches à chaque vue) vs CSR (formulaire de
remplissage, plus interactif) est un détail d'implémentation par page, non
structurant pour le contrat d'API.

## Gestion d'erreurs

Erreurs API Strapi (4xx/5xx) remontées telles quelles et affichées via un
composant d'erreur générique côté Next.js. La validation FR-010 (question
obligatoire manquante à la soumission) est affichée inline sur le formulaire de
remplissage, à partir du `422` documenté dans `contracts/api.md`.

## Tests

- Backend : Jest + Supertest (inchangé de `plan.md`).
- Frontend : Vitest + Testing Library (le nom du framework change de
  React+Vite à Next.js, l'outillage de test reste le même écosystème).
- Les deux sous le cycle RED-GREEN-REFACTOR strict imposé par le hook
  `before_implement` (Superpowers `test-driven-development` +
  `subagent-driven-development`), conformément au Principe I de la constitution
  du projet.

## Suite

Ce document est un enregistrement du brainstorming, pas une nouvelle
implémentation planifiée dans cette session : la maquette de tâches déjà
générée (`tasks.md`, T001 déjà implémenté avec Strapi) reste valide pour la
partie backend. Si cette décision "Next.js" est retenue pour de vrai, elle
nécessite de repasser par `/speckit.plan` puis `/speckit.tasks` pour propager
le changement de framework frontend dans les artefacts Spec Kit et régénérer
les tâches frontend en conséquence.
