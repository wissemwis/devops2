# Research: Plateforme de gestion de questionnaires

## Frontend framework

- **Decision**: Next.js (App Router). *(Amendement 2026-09-19 — remplace React 18 + Vite, voir
  `docs/superpowers/specs/2026-09-19-questionnaire-platform-design.md`.)*
- **Rationale**: Choix tranché explicitement par l'utilisateur lors du brainstorming
  Superpowers du 2026-09-19, en gardant Strapi côté backend. Next.js reste sur React comme
  bibliothèque de composants (pas de rupture d'écosystème) tout en colocalisant pages et
  éventuelle logique serveur légère (Route Handlers / Server Actions) dans un seul projet
  frontend ; Strapi publie également des guides d'intégration Next.js.
- **Alternatives considered** *(évaluation initiale, avant amendement)* : React 18 + Vite
  (choix initial — SPA pure, pas de SSR) ; Vue 3 (bon support Strapi mais moins de ressources
  pédagogiques francophones alignées sur ce module). Le SSR de Next.js, jugé non requis par la
  spec dans l'évaluation initiale, n'est pas devenu une exigence fonctionnelle avec ce
  changement : son usage reste optionnel page par page (voir "Flux de données" dans le document
  de design) et ne remet pas en cause le principe II Simplicité/YAGNI.

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
