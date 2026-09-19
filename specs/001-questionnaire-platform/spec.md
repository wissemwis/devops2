# Feature Specification: Plateforme de gestion de questionnaires

**Feature Branch**: `001-questionnaire-platform`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Projet fil rouge du module DevOps 2 : une application de gestion de questionnaires développée sur les 11 séances, servant de terrain pour l'automatisation (Git, CI/CD), la dockerisation et le déploiement Kubernetes. Vision produit : créer une plateforme simple et robuste de gestion de questionnaires (auteurs, répondants, analystes), capable de collecter des réponses à grande échelle. [...] Entités : Questionnaire, Question, Réponse, Utilisateur. Workflows : Création, Réponse, Consultation des résultats."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Créer et publier un questionnaire (Priority: P1)

Un auteur crée un nouveau questionnaire, y ajoute des questions de différents types (Likert, choix multiple, texte libre), en définit la visibilité (publique ou privée sur invitation), puis le publie pour le rendre accessible aux répondants.

**Why this priority**: Sans questionnaire créé et publié, aucune autre fonctionnalité (réponse, analyse) n'a de valeur. C'est la brique fondatrice qui permet de démontrer un MVP dès la première itération.

**Independent Test**: Peut être testé intégralement en créant un compte auteur, en composant un questionnaire de plusieurs questions, en le publiant, et en vérifiant que son statut passe de "brouillon" à "publié" avec un lien d'accès généré.

**Acceptance Scenarios**:

1. **Given** un auteur authentifié sans questionnaire existant, **When** il saisit un titre, une description, ajoute au moins une question et publie, **Then** le questionnaire apparaît avec le statut "publié" et un lien d'accès est disponible.
2. **Given** un questionnaire en brouillon, **When** l'auteur ajoute une question de type Likert marquée obligatoire, **Then** la question est enregistrée avec sa position dans l'ordre du questionnaire.
3. **Given** un questionnaire publié, **When** l'auteur le ferme, **Then** son statut passe à "fermé" et aucune nouvelle réponse n'est acceptée.

---

### User Story 2 - Répondre à un questionnaire (Priority: P2)

Un répondant accède à un questionnaire publié via un lien (public ou invitation privée), le remplit à son rythme, et reçoit une confirmation une fois sa réponse soumise.

**Why this priority**: C'est la fonctionnalité qui produit la donnée de valeur (les réponses) une fois qu'un questionnaire existe ; elle dépend de la User Story 1 mais reste testable et démontrable indépendamment avec un questionnaire déjà publié.

**Independent Test**: Peut être testé en accédant à un questionnaire publié existant via son lien, en répondant à toutes les questions obligatoires, en soumettant, et en vérifiant la réception d'une confirmation et le passage du statut de la réponse à "complète".

**Acceptance Scenarios**:

1. **Given** un questionnaire publié et public, **When** un répondant ouvre le lien, **Then** il peut voir et commencer à répondre aux questions sans authentification préalable.
2. **Given** un questionnaire privé sur invitation, **When** un utilisateur non invité tente d'y accéder, **Then** l'accès lui est refusé.
3. **Given** un répondant qui a rempli toutes les questions obligatoires, **When** il soumet ses réponses, **Then** le statut de sa réponse passe à "complète" et une confirmation lui est affichée.
4. **Given** un répondant qui quitte le questionnaire avant de le terminer, **When** il revient plus tard, **Then** sa réponse reste en statut "en cours" jusqu'à soumission complète.

---

### User Story 3 - Consulter et exporter les résultats (Priority: P3)

Un analyste consulte les résultats agrégés d'un questionnaire (statistiques, graphiques), exporte les données en CSV, et identifie les répondants invités qui n'ont pas encore répondu afin de les relancer.

**Why this priority**: Apporte la valeur d'analyse une fois que des réponses ont été collectées ; dépend des User Stories 1 et 2 mais constitue une tranche verticale testable séparément avec un jeu de réponses déjà existant.

**Independent Test**: Peut être testé en chargeant un questionnaire disposant déjà de réponses, en vérifiant l'affichage de statistiques par question, en déclenchant un export CSV, et en vérifiant la liste des non-répondants pour un questionnaire privé.

**Acceptance Scenarios**:

1. **Given** un questionnaire avec des réponses complètes, **When** l'analyste ouvre la vue résultats, **Then** il voit une répartition statistique/graphique par question.
2. **Given** un questionnaire avec des réponses, **When** l'analyste demande un export, **Then** un fichier CSV contenant l'ensemble des réponses est généré.
3. **Given** un questionnaire privé sur invitation avec des invités n'ayant pas répondu, **When** l'analyste consulte la liste des non-répondants, **Then** il peut déclencher une relance vers ces invités.

---

### Edge Cases

- Que se passe-t-il si un auteur tente de publier un questionnaire sans aucune question ?
- Que se passe-t-il si un répondant soumet une réponse alors que le questionnaire vient d'être fermé entre le chargement de la page et la soumission ?
- Comment le système gère-t-il une question obligatoire à laquelle le répondant n'a pas répondu au moment de la soumission finale ?
- Que se passe-t-il si le même répondant (même email) tente de répondre deux fois à un questionnaire qui n'autorise qu'une réponse par personne ?
- Comment le système gère-t-il l'upload d'une image de question dans un format ou une taille non supportés ?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre à un utilisateur avec le rôle auteur de créer un questionnaire avec un titre et une description.
- **FR-002**: Le système DOIT permettre à l'auteur d'ajouter, réordonner et supprimer des questions dans un questionnaire, chaque question ayant un texte, un type (Likert, choix multiple, texte libre), une position et un indicateur "obligatoire".
- **FR-003**: Le système DOIT permettre d'attacher une image optionnelle à une question.
- **FR-004**: Le système DOIT permettre à l'auteur de définir la visibilité d'un questionnaire comme publique (accessible via lien) ou privée (accessible sur invitation uniquement).
- **FR-005**: Le système DOIT permettre à l'auteur de faire transitionner le statut d'un questionnaire entre brouillon, publié et fermé.
- **FR-006**: Le système DOIT refuser toute nouvelle réponse sur un questionnaire au statut fermé.
- **FR-007**: Le système DOIT permettre à un répondant d'accéder à un questionnaire publié via son lien, sans authentification préalable pour les questionnaires publics.
- **FR-008**: Le système DOIT restreindre l'accès à un questionnaire privé aux seuls utilisateurs explicitement invités.
- **FR-009**: Le système DOIT permettre à un répondant de remplir un questionnaire à son rythme, en conservant l'état "en cours" tant que la réponse n'est pas soumise complète.
- **FR-010**: Le système DOIT valider que toutes les questions marquées obligatoires ont une réponse avant d'accepter la soumission comme "complète".
- **FR-011**: Le système DOIT afficher une confirmation au répondant une fois sa réponse soumise comme complète.
- **FR-012**: Le système DOIT enregistrer, pour chaque réponse, l'identité du répondant (nom, prénom, email) ou son caractère anonyme selon le type de questionnaire (voir FR-019), ainsi que la date et l'heure de soumission.
- **FR-013**: Le système DOIT permettre à un analyste de visualiser les résultats agrégés d'un questionnaire sous forme de statistiques et de graphiques par question.
- **FR-014**: Le système DOIT permettre à un analyste d'exporter l'ensemble des réponses d'un questionnaire au format CSV.
- **FR-015**: Le système DOIT permettre à un analyste d'identifier, pour un questionnaire privé, les invités n'ayant pas encore soumis de réponse complète, et de déclencher une relance à leur intention.
- **FR-016**: Le système DOIT distinguer au moins les rôles utilisateur suivants : auteur, répondant, administrateur. Il n'existe pas de rôle "analyste" séparé : un auteur consulte les résultats, les exporte et déclenche des relances sur les questionnaires dont il est l'auteur ; un administrateur peut le faire sur l'ensemble des questionnaires.
- **FR-017**: Le système DOIT mettre en œuvre l'invitation à un questionnaire privé par l'envoi automatique d'un email contenant un lien signé et unique donnant accès au questionnaire pour ce seul invité.
- **FR-018**: Le système DOIT limiter le suivi des non-répondants et la fonctionnalité de relance aux seuls questionnaires privés sur invitation, dont les invités sont identifiés par avance ; les questionnaires publics ne sont pas soumis à ce suivi.
- **FR-019**: Le système DOIT collecter le nom, le prénom et l'email de chaque répondant à un questionnaire privé sur invitation (ces trois champs sont obligatoires et pré-associés à l'invitation) ; pour un questionnaire public, ces champs restent optionnels et le répondant peut rester anonyme.

### Key Entities *(include if feature involves data)*

- **Questionnaire**: titre, description, dates de création/modification, statut (brouillon, publié, fermé), auteur (référence Utilisateur), visibilité (publique ou privée).
- **Question**: texte, type (Likert, choix multiple, texte libre), position dans le questionnaire, indicateur obligatoire, image optionnelle ; appartient à un Questionnaire.
- **Réponse**: répondant (nom, prénom, email — obligatoires pour un questionnaire privé sur invitation ; optionnels/anonyme pour un questionnaire public), date et heure de soumission, statut (en cours, complète) ; regroupe les réponses individuelles à chaque Question d'un Questionnaire.
- **Utilisateur**: email, nom, rôle (auteur, répondant, administrateur — voir FR-016), date d'inscription.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un auteur peut créer et publier un questionnaire de 10 questions en moins de 10 minutes.
- **SC-002**: Un répondant peut accéder à un questionnaire publié et soumettre une réponse complète en moins de 5 minutes pour un questionnaire type de 10 questions.
- **SC-003**: La plateforme conserve un temps de réponse perceptible comme instantané (résultats affichés en moins de 2 secondes) pour un questionnaire ayant recueilli jusqu'à 1000 réponses.
- **SC-004**: 95 % des soumissions de réponses aboutissent sans erreur perçue par le répondant.
- **SC-005**: Un analyste peut obtenir un export CSV complet des réponses d'un questionnaire en une seule action.

## Assumptions

- Les comptes auteur/administrateur utilisent une authentification standard (email + mot de passe) ; l'authentification fédérée (SSO) est hors périmètre pour cette version.
- Un répondant sur un questionnaire public peut répondre sans créer de compte ; son identité (email) est facultative sauf si l'auteur l'exige.
- Les statistiques par question se limitent à des agrégations simples (répartition des choix, moyenne pour Likert, liste des réponses libres) ; des analyses croisées avancées sont hors périmètre pour cette version.
- La volumétrie cible ("grande échelle") est interprétée comme de l'ordre du millier de réponses simultanées par questionnaire pour ce projet pédagogique, sans exigence d'échelle industrielle.
- Le déploiement technique (Strapi, Docker, CI/CD, Kubernetes) progresse séance par séance conformément à la constitution du projet ; cette spécification ne couvre que le comportement fonctionnel attendu, pas le calendrier de déploiement.
- Cas d'usage principal motivant les questionnaires privés : un questionnaire de fin de séance envoyé aux participants du module, où le nom, le prénom et l'email de chaque répondant sont requis pour l'identification (voir FR-019).
