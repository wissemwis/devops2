# API Contract: Plateforme de gestion de questionnaires

API REST exposée par le backend Strapi. Toutes les routes sont préfixées par `/api` sauf
mention contraire. Authentification : session/JWT Strapi standard pour auteur/administrateur ;
jeton d'invitation signé en query string pour l'accès à un questionnaire privé (FR-017).

## Santé (Principe V — Observabilité)

### GET /health

- Auth : aucune.
- Réponse `200`: `{"status": "ok"}`
- Réponse `503`: `{"status": "degraded", "reason": "<cause>"}` si la base de données est
  injoignable.

## Questionnaires

### POST /api/questionnaires

- Auth : auteur.
- Body: `{ "titre": string, "description"?: string, "visibilite": "publique"|"privée" }`
- Réponse `201`: questionnaire créé, `statut: "brouillon"`. (FR-001)

### PATCH /api/questionnaires/:id/questions

- Auth : auteur (propriétaire).
- Body: `{ "texte": string, "type": "likert"|"choix_multiple"|"texte_libre", "position": int, "obligatoire": bool, "image"?: mediaId }`
- Réponse `200`: question ajoutée. (FR-002, FR-003)

### POST /api/questionnaires/:id/publish

- Auth : auteur (propriétaire).
- Précondition : au moins une question existe, sinon `422` (Edge Case).
- Réponse `200`: `statut: "publié"`. (FR-005)

### POST /api/questionnaires/:id/close

- Auth : auteur (propriétaire) ou administrateur.
- Réponse `200`: `statut: "fermé"`. Toute tentative ultérieure de réponse renvoie `403`. (FR-006)

### GET /api/questionnaires/:id

- Auth : aucune si `visibilite: publique` et `statut: publié` ; jeton d'invitation requis si
  `visibilite: privée` (FR-007, FR-008).
- Réponse `200`: questionnaire + questions ordonnées par `position`.

### POST /api/questionnaires/:id/invitations

- Auth : auteur (propriétaire).
- Body: `{ "invites": [{ "nom": string, "prenom": string, "email": string }] }`
- Effet : envoie un email par invité contenant un lien signé unique. (FR-017, FR-019)
- Réponse `201`: liste des invitations créées (statut `envoyée`).

### GET /api/questionnaires/:id/non-repondants

- Auth : auteur (propriétaire) ou administrateur ; uniquement pour un questionnaire privé (FR-018).
- Réponse `200`: liste des invitations sans `Réponse` liée.

### POST /api/questionnaires/:id/relance

- Auth : auteur (propriétaire) ou administrateur.
- Body: `{ "invitationIds": [string] }`
- Effet : renvoie l'email d'invitation aux invités listés. (FR-015)

## Réponses

### POST /api/questionnaires/:id/reponses

- Auth : aucune si public ; jeton d'invitation requis si privé (pré-remplit
  `nom`/`prenom`/`email` depuis l'invitation, FR-019).
- Body: `{ "reponsesQuestions": [{ "questionId": string, "valeur": any }] }` (soumission
  partielle acceptée, `statut` reste `en_cours` — FR-009)
- Réponse `201` ou `200` (upsert) : réponse enregistrée.

### POST /api/questionnaires/:id/reponses/:reponseId/submit

- Auth : identique à la création.
- Précondition : toutes les questions `obligatoire: true` ont une `valeur`, sinon `422` listant
  les questions manquantes. (FR-010)
- Réponse `200`: `statut: "complète"`, `dateSoumission` renseignée ; déclenche l'affichage de
  confirmation côté frontend. (FR-011)

## Résultats

### GET /api/questionnaires/:id/resultats

- Auth : auteur (propriétaire) ou administrateur.
- Réponse `200`: agrégats par question (distribution pour Likert/choix multiple, liste pour
  texte libre). (FR-013)

### GET /api/questionnaires/:id/export.csv

- Auth : auteur (propriétaire) ou administrateur.
- Réponse `200`, `Content-Type: text/csv` : une ligne par réponse complète, une colonne par
  question. (FR-014)
