# Research: Plateforme de gestion de questionnaires

## Frontend framework

- **Decision**: React 18 + Vite.
- **Rationale**: La spec source ne précise pas de framework front ; React est l'écosystème le
  plus documenté pour consommer une API Strapi (Strapi publie ses propres guides et starters
  React), ce qui réduit le risque pédagogique sur un module de 11 séances. Vite donne un build
  rapide, aligné avec S3 "build npm".
- **Alternatives considered**: Vue 3 (bon support Strapi mais moins de ressources
  pédagogiques francophones alignées sur ce module) ; Next.js (apporte du SSR non requis par la
  spec — violerait le principe II Simplicité/YAGNI pour ce périmètre).

## Persistance

- **Decision**: PostgreSQL en CI/production, SQLite toléré en développement local.
- **Rationale**: Strapi supporte nativement les deux ; PostgreSQL est le choix par défaut
  recommandé par Strapi pour la production et s'intègre facilement à Docker Compose et à un
  StatefulSet/managed service Kubernetes en S11.
- **Alternatives considered**: MySQL (équivalent mais moins courant dans les tutoriels Strapi
  récents) ; SQLite en production (rejeté — pas adapté à un déploiement Kubernetes multi-pod).

## Emails d'invitation (FR-017)

- **Decision**: Provider SMTP générique via le plugin Email de Strapi (Nodemailer), configuré
  par variables d'environnement.
- **Rationale**: Strapi fournit un plugin Email officiel prêt à l'emploi ; rester sur un
  provider SMTP générique (plutôt qu'un SaaS propriétaire nommé) évite un couplage non demandé
  par la spec et respecte le principe II.
- **Alternatives considered**: Service SaaS tiers dédié — rejeté à ce stade car non requis par
  la spec et ajouterait une dépendance externe non justifiée (YAGNI).

## Lien signé d'invitation (FR-017)

- **Decision**: Jeton signé (JWT à portée restreinte, un par invitation/questionnaire/répondant)
  encodé dans l'URL d'invitation, vérifié côté API avant d'autoriser l'accès en lecture/écriture
  au questionnaire privé.
- **Rationale**: Réutilise les primitives déjà présentes dans Strapi (signature JWT) sans
  introduire de nouveau mécanisme cryptographique ; le jeton peut porter l'identité pré-associée
  (nom, prénom, email — FR-019) pour pré-remplir le formulaire de réponse.
- **Alternatives considered**: Table d'access-list vérifiée à la connexion (rejetée comme choix
  principal par la réponse Q2 de l'utilisateur, qui a préféré l'email automatique à lien signé).

## Observabilité (Principe V)

- **Decision**: Endpoint `GET /health` exposé par le backend Strapi (route custom minimale,
  sans authentification, retournant `{"status":"ok"}` avec code 200 si l'API et la base de
  données répondent) ; logs applicatifs en JSON structuré sur stdout.
- **Rationale**: Répond directement à l'exigence de la constitution ; format standard
  consommable par n'importe quel orchestrateur de conteneurs (probe de liveness/readiness
  Kubernetes en S11).
- **Alternatives considered**: Aucune — c'est une exigence non négociable de la constitution,
  pas un choix parmi plusieurs options produit.
