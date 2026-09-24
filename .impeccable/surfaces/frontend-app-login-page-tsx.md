---
version: 1
slug: "frontend-app-login-page-tsx"
primary_target: "frontend/app/login/page.tsx"
related_targets: ["frontend/app/questionnaires/page.tsx","frontend/app/questionnaires/layout.tsx"]
---

# Espace auteur — connexion et « Mes questionnaires »

Scope: `/login` and the protected `/questionnaires` home of the author space (T063). Visitor mode: Operate. Audience: the instructor (auteur) or an administrateur, preparing at a desk, laptop, daylight. Job: sign in, see their questionnaires and their statut, sign out. Constraints: French only, light theme only, no « hacker » look, no Google Forms clone; T022–T024 extend this world, they do not reinvent it.

## Direction contract

THESIS: The author space is a course notebook: every questionnaire is written in ink on a Seyès-ruled page and the red margin holds the structure. It refuses the category default of a centred white card on a grey dashboard.

OWN-WORLD: Near-white paper #fbfbf8, pale Seyès ruling (#dce3f3 every 8 px, #b9c6e8 every 32 px, faint verticals), a 2 px red margin rule #d8343a as the structural rail, ink blue #1f3fa8 for actions and focus, graphite #2b2b2b text, red pen #c62828 for errors only. Fields are written on a ruling line; focus circles the control in ink; statuts are stamps (pencil dashed « brouillon », ink tilted « PUBLIÉ », grey « FERMÉ »). Atkinson Hyperlegible Next, 17 px on 32 px lines.

STORY: The author recognises their own notebook, signs in without friction, and reads their questionnaires like a table of contents: what exists, in which state, most recent first.

FIRST VIEWPORT: `/login` — one full-viewport ruled sheet; « Espace auteur » in the margin at top; a ~28 rem column with « Connexion » written on a line, Email and Mot de passe on ruling lines, « Se connecter » in solid ink two lines below. `/questionnaires` — margin « Espace auteur »; a header line with the author's name and « Se déconnecter »; « Mes questionnaires »; numbered entries with the number in the margin, dotted leader, statut stamp, « modifié le … ».

FORM: Cahier Seyès, assigned direction (position 3 of the ordered grounded list), seed key 8d74740c; raises: lifecycle steps stay visible (Orizuru), state marked with a pen (convention catalog), empty state as invitation (drum machine), total palette commitment (Datamatics), one colour law per statut (rain garden).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
