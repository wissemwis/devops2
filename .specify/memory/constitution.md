<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: n/a (first adoption)
- Added sections:
  - Core Principles: I. Test-First (Superpowers TDD, NON-NEGOTIABLE), II. Simplicité & YAGNI,
    III. Infrastructure as Code & Reproductibilité, IV. Sécurité par défaut,
    V. Observabilité
  - Contraintes Techniques et Pédagogiques (Section 2)
  - Workflow de Développement et Déploiement (Section 3)
  - Governance
- Removed sections: none
- Deferred TODOs: none
- Templates requiring follow-up: none — plan-template.md, spec-template.md, tasks-template.md
  reference the constitution generically and need no edits for this ratification.
-->
# Questionnaire App (DevOps 2) Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Le TDD est obligatoire pour toute tâche d'implémentation : un test qui échoue est écrit et
observé en échec (RED) avant tout code de production (GREEN), suivi d'un refactor si
nécessaire. Ce cycle est appliqué et vérifié par le workflow Superpowers
(`test-driven-development` + `subagent-driven-development`) lors de `/speckit-implement`.
Aucune tâche ne peut être marquée `[X]` dans `tasks.md` sans preuve du cycle
RED-GREEN-REFACTOR.

### II. Simplicité et YAGNI
Chaque séance du module ajoute la brique minimale nécessaire pour satisfaire les besoins
courants de la spécification — pas d'abstraction, de couche ou de configuration anticipant des
besoins futurs non spécifiés. Trois lignes similaires valent mieux qu'une abstraction
prématurée. Toute complexité ajoutée (nouvelle dépendance, couche d'indirection, pattern
générique) doit être justifiée dans `plan.md`.

### III. Infrastructure as Code et Reproductibilité
Tout déploiement (Docker, Docker Compose, pipelines Jenkins/GitLab CI, manifests Kubernetes)
DOIT être versionné dans le dépôt et exécutable par script — aucune étape de déploiement
manuelle et non reproductible n'est acceptée. Chaque changement d'infrastructure est testable
localement avant d'être poussé vers un pipeline partagé.

### IV. Sécurité par défaut
Aucun secret (token, mot de passe, clé API) n'est commité en clair ; les secrets sont injectés
via variables d'environnement ou un gestionnaire de secrets dédié au pipeline CI/CD. L'accès
aux questionnaires privés est contrôlé par invitation explicite (email ou lien signé), jamais
par simple obscurité d'URL.

### V. Observabilité
Chaque service déployé (API Strapi, frontend, tout service ajouté en cours de module) expose
des logs structurés et un endpoint de santé (`/health` ou équivalent) permettant de vérifier
son état sans accès direct au processus.

## Contraintes Techniques et Pédagogiques

- Stack de référence : API Strapi (backend + schéma de données), frontend consommant cette API,
  conteneurisation Docker/Docker Compose, intégration continue (Jenkins ou GitLab CI au choix
  de la séance), déploiement final sur Kubernetes.
- Le déploiement progresse séance par séance (S1 initialisation Git → S2 branching → S3 build
  npm → S4 pipeline CI simple → S5-S7 Docker/Compose → S8-S10 Jenkins/GitLab CI → S11
  Kubernetes) ; une fonctionnalité livrée à une séance donnée ne doit pas dépendre d'un outil
  prévu pour une séance ultérieure.
- Les entités de domaine (Questionnaire, Question, Réponse, Utilisateur) et leurs contraintes
  telles que décrites dans la spécification du projet font foi pour la modélisation du schéma
  Strapi.

## Workflow de Développement et Déploiement

- Toute nouvelle fonctionnalité suit le cycle Spec Kit standard :
  `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`, avec les hooks de l'extension `superpowers-bridge` actifs
  (`before_specify` optionnel vers le brainstorming, `before_implement` obligatoire vers le
  TDD + subagent-driven-development).
- Chaque tâche d'implémentation est revue (conformité à la spec + qualité du code) avant d'être
  marquée complète, conformément au processus prescrit par `subagent-driven-development`.
- Les pipelines CI/CD doivent rester verts avant toute fusion sur la branche principale ; un
  pipeline rouge bloque le merge, il ne se contourne pas.

## Governance

Cette constitution prévaut sur toute autre pratique ou préférence individuelle pour ce projet.
Toute dérogation à un principe ci-dessus DOIT être explicitement justifiée dans `plan.md` sous
une section « Complexity Tracking » ou équivalente, avant validation du plan.

Les amendements à cette constitution suivent le versionnage sémantique :
- MAJOR : suppression ou redéfinition incompatible d'un principe existant.
- MINOR : ajout d'un principe ou d'une section, ou extension matérielle d'une règle existante.
- PATCH : clarifications, corrections de formulation, changements non sémantiques.

Chaque amendement doit produire un Sync Impact Report (commentaire HTML en tête de fichier) et
mettre à jour la date de dernier amendement ci-dessous.

**Version**: 1.0.0 | **Ratified**: 2026-09-19 | **Last Amended**: 2026-09-19
