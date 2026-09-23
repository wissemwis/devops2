# Data Model: Plateforme de gestion de questionnaires

Dérivé de la section "Key Entities" de `spec.md`. Modélisé comme content-types Strapi
(collection types), sans détail de migration.

## Utilisateur (User)

Étend le content-type utilisateur natif de Strapi (`users-permissions`).

| Champ | Type | Règles |
|---|---|---|
| email | string, unique | requis, format email |
| nom | string | requis |
| role | relation → rôle `users-permissions` (types `auteur`, `repondant`, `administrateur`) | requis (FR-016) — pas de rôle "analyste" séparé |
| dateInscription | datetime | `createdAt` natif de Strapi |

**Amendement 2026-09-23 (T061)** : `role` n'est plus un enum ajouté au User (T007, qui écrasait
la relation native et cassait la résolution des permissions) mais la relation native du plugin
`users-permissions` vers ses rôles ; les trois rôles FR-016 sont des rôles `users-permissions`
de types `auteur`, `repondant`, `administrateur`. `nom` est ajouté par l'extension
`backend/src/extensions/users-permissions/content-types/user/schema.json` ; `dateInscription`
est le `createdAt` natif. Les permissions de chaque rôle sont déclarées dans `ROLE_PERMISSIONS`
(`backend/src/bootstrap/permissions.ts`) et accordées à chaque démarrage (T062) ; chaque
endpoint ajoute son action à cette table.

Les comptes sont créés par un administrateur (panneau d'admin Strapi ; compte de test de
développement : T062) ; l'inscription publique est fermée (`allow_register: false`, réappliqué
à chaque démarrage par `backend/src/bootstrap/roles.ts`).

Un utilisateur créé sans rôle reçoit le rôle `repondant` (`default_role` et un cycle de vie
`beforeCreate` dans `backend/src/bootstrap/roles.ts`).

## Questionnaire

| Champ | Type | Règles |
|---|---|---|
| titre | string | requis |
| description | text | optionnel |
| statut | enum: brouillon, publié, fermé | requis, défaut `brouillon` (FR-005) |
| visibilite | enum: publique, privée | requis (FR-004) |
| auteur | relation → Utilisateur (many-to-one) | requis |
| dateCreation | datetime | généré automatiquement |
| dateModification | datetime | mis à jour automatiquement |

**Transitions de statut** (FR-005, FR-006) : `brouillon → publié → fermé`, linéaire et
irréversible. Une réponse ne peut être créée/modifiée que si `statut = publié` (FR-006).

**Règle de validation** : un questionnaire ne peut passer à `publié` que s'il contient au moins
une question (Edge Case §spec.md).

## Question

| Champ | Type | Règles |
|---|---|---|
| texte | string | requis |
| type | enum: likert, choix_multiple, texte_libre | requis |
| position | integer | requis, unique au sein d'un même questionnaire, détermine l'ordre |
| obligatoire | boolean | requis, défaut `false` |
| image | media (optionnel) | format image standard (png/jpg/webp), taille max définie au niveau infra |
| questionnaire | relation → Questionnaire (many-to-one) | requis |

## Réponse (Response)

Une `Réponse` regroupe l'ensemble des réponses individuelles d'un répondant à un
`Questionnaire` donné.

| Champ | Type | Règles |
|---|---|---|
| questionnaire | relation → Questionnaire (many-to-one) | requis |
| nom | string | requis si `questionnaire.visibilite = privée` (FR-019), sinon absent |
| prenom | string | requis si `questionnaire.visibilite = privée` (FR-019), sinon absent |
| email | string | requis si `questionnaire.visibilite = privée` (FR-019), optionnel sinon (anonyme par défaut) |
| statut | enum: en_cours, complète | requis, défaut `en_cours` (FR-009) |
| dateSoumission | datetime | renseigné à la transition vers `complète` |
| reponsesQuestions | relation → ReponseQuestion (one-to-many) | — |

**Règle de validation** : la transition vers `statut = complète` est refusée tant qu'une
`ReponseQuestion` manque pour une `Question.obligatoire = true` du questionnaire (FR-010).

**Contrainte d'unicité** : pour un questionnaire privé, au plus une `Réponse` par
(`questionnaire`, `email` invité) — cf. Edge Case sur la double soumission.

## ReponseQuestion (entité d'implémentation, non listée dans spec.md)

Table de jonction portant la valeur de réponse à une question précise ; nécessaire pour
respecter FR-002/FR-013 (une question par ligne, agrégation par question) sans être un concept
utilisateur de premier plan — d'où son absence de `spec.md`.

| Champ | Type | Règles |
|---|---|---|
| reponse | relation → Réponse (many-to-one) | requis |
| question | relation → Question (many-to-one) | requis |
| valeur | JSON (dépend de `question.type` : entier 1-5 pour Likert, id(s) d'option pour choix multiple, texte libre pour texte_libre) | requis si `question.obligatoire = true` |

## Invitation (entité d'implémentation, non listée dans spec.md)

Nécessaire pour porter le lien signé d'un questionnaire privé (FR-017) vers une identité
pré-associée (FR-019), en amont de toute `Réponse`.

| Champ | Type | Règles |
|---|---|---|
| questionnaire | relation → Questionnaire (many-to-one) | requis, `questionnaire.visibilite = privée` |
| nom, prenom, email | string | requis |
| jeton | string, unique | signé, à usage unique par répondant |
| statut | enum: envoyée, répondue | dérivé de l'existence d'une `Réponse` liée (calcul du "non-répondant", FR-015/FR-018) |
