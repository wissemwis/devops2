# Quickstart: Plateforme de gestion de questionnaires

Guide de validation manuelle de bout en bout, une fois l'implémentation des User Stories 1-3
terminée. Ne contient pas de code d'implémentation — voir `contracts/api.md` et
`data-model.md` pour le détail.

**Amendement 2026-09-19** : frontend Next.js (remplace React+Vite) — commandes `npm install`
/ `npm run dev` inchangées, frontend servi par défaut sur `http://localhost:3000` (port par
défaut Next.js, contre 5173 pour Vite).

## Prérequis

- Node.js 20 LTS, Docker + Docker Compose.
- Variables d'environnement backend renseignées (`.env` à partir de `.env.example`) : accès
  PostgreSQL, clé JWT Strapi, credentials SMTP pour les invitations.

## Démarrage local

```bash
docker compose up -d db
cd backend && npm install && npm run develop
cd ../frontend && npm install && npm run dev
```

- Vérifier `GET http://localhost:1337/health` → `{"status":"ok"}`.

## Scénario 1 — Créer et publier (User Story 1, P1)

1. Se connecter en tant qu'auteur (compte de test seedé) : définir `DEV_AUTEUR_EMAIL` et
   `DEV_AUTEUR_PASSWORD` (et optionnellement `DEV_AUTEUR_NOM`) avant de démarrer le backend —
   l'emplacement dépend du mode de démarrage utilisé dans « Démarrage local » ci-dessus : le
   fichier `.env` racine (lu par `docker-compose.yml`) si le backend tourne via
   `docker compose up`, ou `backend/.env` si le backend tourne nativement
   (`cd backend && npm run develop`, comme dans « Démarrage local »). Dans les deux cas, le
   backend crée ce compte `auteur` au démarrage, uniquement en développement
   (`NODE_ENV=development`). Ne jamais définir ces variables dans un déploiement.
2. Créer un questionnaire, ajouter 3 questions (une de chaque type), visibilité `publique`.
3. Publier.
4. **Attendu** : `statut = publié`, un lien public est affiché et fonctionnel.

## Scénario 2 — Répondre (User Story 2, P2)

1. Ouvrir le lien public généré à l'étape précédente dans une session non authentifiée.
2. Répondre à la question obligatoire, laisser la question optionnelle vide, soumettre.
3. **Attendu** : soumission acceptée, confirmation affichée, `statut = complète`.
4. Retenter une soumission sans répondre à la question obligatoire.
5. **Attendu** : rejet avec message indiquant la question manquante (FR-010).

## Scénario 3 — Questionnaire privé de fin de séance (FR-017, FR-019)

1. Créer un questionnaire `visibilite: privée`, l'inviter avec nom/prénom/email d'un compte de
   test.
2. Vérifier la réception de l'email d'invitation contenant le lien signé.
3. Ouvrir ce lien : le formulaire de réponse doit être pré-rempli avec nom/prénom/email.
4. Soumettre une réponse complète.
5. Consulter `GET /api/questionnaires/:id/non-repondants` : l'invité ayant répondu n'y figure
   plus.

## Scénario 4 — Résultats et export (User Story 3, P3)

1. En tant qu'auteur du questionnaire du Scénario 1, ouvrir la vue résultats.
2. **Attendu** : répartition affichée par question, cohérente avec la réponse soumise au
   Scénario 2.
3. Déclencher l'export CSV.
4. **Attendu** : fichier téléchargé contenant une ligne pour la réponse du Scénario 2.

## Nettoyage

```bash
docker compose down -v
```
