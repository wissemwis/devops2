---
name: Questionnaires — Espace auteur
description: A course notebook on a Seyès-ruled page, where the red margin holds the structure and every questionnaire is written in ink.
colors:
  papier: "#fbfbf8"
  reglure: "#dce3f3"
  reglure-forte: "#b9c6e8"
  marge: "#d8343a"
  encre: "#1f3fa8"
  encre-sombre: "#182f7e"
  graphite: "#2b2b2b"
  graphite-doux: "#5b5f6b"
  crayon: "#616161"
  tampon: "#707070"
  stylo-rouge: "#c62828"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "64px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "32px"
  label-marge:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0.025em"
  label-tampon:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "0.025em"
  meta:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "32px"
    fontFeature: "tnum"
rounded:
  sm: "4px"
  cercle: "999px"
spacing:
  trame: "8px"
  ligne: "32px"
  marge: "96px"
  marge-etroite: "20px"
components:
  button-primary:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.papier}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "{spacing.ligne}"
  button-primary-hover:
    backgroundColor: "{colors.encre-sombre}"
    textColor: "{colors.papier}"
  button-primary-pending:
    backgroundColor: "{colors.encre-sombre}"
    textColor: "{colors.papier}"
  link-encre:
    textColor: "{colors.encre}"
    typography: "{typography.body}"
  link-encre-hover:
    textColor: "{colors.encre-sombre}"
  champ-ligne:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    height: "{spacing.ligne}"
    padding: "0 4px"
  champ-ligne-label:
    textColor: "{colors.graphite-doux}"
    typography: "{typography.body}"
    height: "{spacing.ligne}"
  tampon-brouillon:
    textColor: "{colors.crayon}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  tampon-publie:
    textColor: "{colors.encre}"
    typography: "{typography.label-tampon}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  tampon-ferme:
    textColor: "{colors.tampon}"
    typography: "{typography.label-tampon}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  annotation-erreur:
    textColor: "{colors.stylo-rouge}"
    typography: "{typography.body}"
---

# Design System: Questionnaires — Espace auteur

## Overview

**Creative North Star: "Le Cahier Seyès"**

The author space is a French course notebook. Every screen is one full-viewport sheet of near-white paper ruled in the Seyès pattern, with a red margin rule running the full height as the structural rail. Content is written *on* the ruling: body text sits on 32 px lines, fields are a baseline drawn on a line, the questionnaire list reads like a table of contents with its numbers in the margin. Ink blue is the only action colour; red pen is reserved for mistakes.

The world is built for Operate mode: an instructor preparing at a desk, on a laptop, in daylight. Clarity outranks expression, so the brand lives in the material (paper, ruling, margin, ink, stamps) rather than in decoration. The scene is light only; there is no dark theme, on purpose (`color-scheme: light`).

Two looks are explicitly rejected: the "hacker" look (dark ground, neon, monospace everywhere) and the Google Forms clone (violet accent, centred white card on a grey dashboard). The page is the sheet; there is no card.

**Key Characteristics:**
- One full-height ruled sheet per screen, never a card on a background.
- A 2 px red margin rule as the structural rail; section labels and list numbers live in the margin.
- Vertical rhythm locked to the 32 px ruling; the 8 px fine ruling is the smallest unit.
- Total palette commitment: nothing outside the notebook's paper, ruling, inks and pencil.
- State is marked as with a pen: focus circles the control in ink, statuts are stamps, errors are red-pen annotations.
- One workhorse typeface, Atkinson Hyperlegible Next, at 17 px on 32 px lines.

## Colors

A notebook palette: paper, pale blue ruling, a red margin, ink blue, graphite and pencil — and nothing else.

### Primary
- **Encre (ink blue)**: the only action and focus colour — the primary button fill, links, the focus circle, the caret, and the « PUBLIÉ » stamp.
- **Encre sombre (dark ink)**: hover and pending state of ink elements (button fill while submitting, link hover).

### Secondary
- **Marge (margin red)**: the 2 px vertical margin rule, full height of the sheet. Structural only — never text, never a fill, never an error signal.

### Tertiary
- **Stylo rouge (red pen)**: errors only — the error annotation text, its « ! » mark in the margin, and the baseline of an invalid field.

### Neutral
- **Papier (paper)**: the sheet, the page background, the field background (which masks the ruling under typed text), and the text on the ink button. Near-white, deliberately not cream.
- **Réglure (fine ruling)**: the Seyès fine horizontal lines every 8 px, and (at 55 % via `color-mix`) the faint verticals every 32 px.
- **Réglure forte (strong ruling)**: the Seyès strong line every 32 px, the dotted leader in the table of contents, text selection, and the scrollbar thumb.
- **Graphite**: body text and the 2 px field baseline at rest.
- **Graphite doux (soft graphite)**: secondary text — field labels, margin labels, list numbers, the author's name, « modifié le … ».
- **Crayon (pencil)**: the « brouillon » stamp and the empty-state line.
- **Tampon (stamp grey)**: the « FERMÉ » stamp.

### Named Rules
**The Red Pen Rule.** Red pen means a mistake, and only a mistake. The margin red is structure; the two reds never swap roles.

**The One Ink Rule.** Every actionable thing — button, link, focus — is ink blue. Nothing else on the sheet is blue except the ruling.

**The Notebook-Only Rule.** No colour enters the world that a notebook, an ink pen, a pencil or a rubber stamp could not produce.

## Typography

**Body Font:** Atkinson Hyperlegible Next (with ui-sans-serif, system-ui, sans-serif), weights 400 and 700, subsets latin and latin-ext, loaded through `next/font`.

**Character:** One legible, unfussy workhorse family for everything; the notebook carries the personality, so the type does not need to. No school cursive, no monospace.

### Hierarchy
- **Headline** (700, 28 px, 64 px line = two ruling lines, −0.02em): the page title — « Connexion », « Mes questionnaires ». Written on the line.
- **Body** (400, 17 px, 32 px line): all running text, field labels, typed values, list entries, links, error annotations.
- **Label marge** (700, 14 px, uppercase, wide tracking): the margin label, « Espace auteur ».
- **Label tampon** (14 px on a 24 px line, wide tracking; bold for « PUBLIÉ »/« FERMÉ », regular lowercase for « brouillon »): statut stamps.
- **Meta** (400, 14 px, tabular numerals): « modifié le … » dates. List numbers use tabular numerals at body size.

### Named Rules
**The Ruling Rule.** Every line box is 32 px (or a multiple of it). A new text element that is not on the ruling is a bug.

## Layout

The sheet is a two-column grid at 640 px and above: a margin column exactly as wide as the margin offset (96 px) and a content column. The red rule sits on the column boundary, drawn by the sheet background itself, so it always runs the full viewport height. The margin column holds the margin label (right-aligned, one ruling line from the top) and, by absolute positioning into the margin, list numbers and the « ! » error mark aligned to their line.

The content column has 40 px side padding, starts one ruling line down, and ends with three blank ruling lines. Forms sit in a narrow column (`max-width: 28rem`). The questionnaire list uses the full content width: number (in the margin), title (truncates), dotted leader that stretches, statut stamp, then the date.

Vertical spacing is counted in ruling lines only: one line between a title and what follows, one line before each field, two lines before the primary button.

**Responsive (below 640 px):** the margin offset narrows to 20 px and the grid collapses to one column; the margin label moves above the content, list numbers come inline before the title, the date is hidden, the « ! » mark sits 16 px left of the annotation. The ruling and the red rule stay.

### Named Rules
**The Margin Rail Rule.** Structure lives in the margin: labels, numbers, error marks. The content column carries only content.

## Elevation & Depth

Flat. There are no shadows anywhere and no stacked surfaces: the sheet is the only surface, and depth is conveyed by the ruling behind content, the ink weight of the text, and the stamp borders. The only `box-shadow` in the code is a functional one: an inset paper-coloured fill that neutralises the browser's autofill background so an autofilled field stays on paper.

### Named Rules
**The One Sheet Rule.** Nothing floats above the paper. No cards, no modals-as-cards, no drop shadows.

## Shapes

Mostly square, as paper and ink are. The primary button and the stamps have a slightly softened corner (`{rounded.sm}`); fields have no box at all, just a 2 px baseline. The focus indicator is the one round shape: a 2 px ink outline, 6 px away from the control, fully rounded — the control circled by hand. The « PUBLIÉ » stamp is tilted −2° as a real stamp would be; the others sit straight.

## Components

### Buttons
- **Character:** solid ink, pressed onto the page.
- **Primary:** ink-blue fill, paper text, bold body type, one ruling line tall (32 px), 24 px horizontal padding, softened corners. Placed two ruling lines below the last field.
- **Hover / Active:** fill darkens to dark ink over 120 ms; on press the button drops 1 px.
- **Pending:** label becomes « Connexion… », fill stays dark ink, cursor `wait`, button disabled.
- **Focus:** the ink circle (see Inputs).
- **Text action:** « Se déconnecter » and « Réessayer » are ink links (underline, 4 px underline offset), not buttons in appearance.

### Inputs / Fields (ChampLigne)
- **Style:** the field is a line of the notebook — label above on its own ruling line in soft graphite, then a 32 px input with no box, paper background (so ruling never shows under typed text) and a 2 px graphite baseline.
- **Focus:** baseline turns ink blue (120 ms) and the control is circled: 2 px ink outline, 6 px offset, fully rounded.
- **Error:** baseline turns red pen (`aria-invalid`), the field is described by the error annotation above the fields.
- **Autofill:** forced back to graphite text on paper.

### Statut stamps (TamponStatut)
One colour law per statut, used everywhere a statut appears:
- **brouillon:** pencil grey, 1 px dashed border, lowercase, regular weight — not yet committed.
- **PUBLIÉ:** ink blue, 2 px solid border, uppercase bold, tilted −2° — officially stamped.
- **FERMÉ:** stamp grey, 2 px solid border, uppercase bold, straight — archived.

### Error annotation (AnnotationErreur)
A red-pen note written on the next ruling line, announced with `role="alert"`, with a bold « ! » placed in the margin on the same line. Used for login errors, a failed list load and the « service indisponible » state of the author space; the recovery link inside it is an ink link (« Réessayer »).

### Sheet (Feuille)
The page itself: full-viewport paper with the Seyès ruling (8 px fine, 32 px strong, faint 32 px verticals) and the red margin rule, a margin column with the uppercase label, and the content column as `<main>`.

### Table of contents (Sommaire)
The author's questionnaires as a numbered list, most recent first: number in the margin (tabular), title (truncated on one line), a dotted leader in strong-ruling blue that stretches to the stamp, the statut stamp, then « modifié le 24 septembre 2026 » in small soft graphite (French long date, Europe/Paris). **Empty state:** a single pencil line, « Vos questionnaires apparaîtront ici. » — an invitation on a ready page, never an apology.

### Header line
In the author space, the first line of the content column carries the author's name (soft graphite, truncated) on the left and « Se déconnecter » on the right.

## Do's and Don'ts

### Do:
- **Do** put every line box on the 32 px ruling; count vertical space in ruling lines.
- **Do** keep structure in the margin: the margin label, list numbers and the « ! » of an error.
- **Do** use ink blue for every action and for focus, and only for those (plus the « PUBLIÉ » stamp).
- **Do** apply the statut colour law (pencil dashed brouillon, tilted ink PUBLIÉ, grey FERMÉ) wherever a statut appears, including future detail and results pages.
- **Do** keep the ruling off control text: fields have a paper background.
- **Do** keep transitions at 120 ms on colour only (plus the 1 px press), and honour `prefers-reduced-motion` (all transitions drop to 0 ms).
- **Do** write empty states as an invitation on a ready page.

### Don't:
- **Don't** add a dark theme, dark grounds, neon or monospace-everywhere — the "hacker" look is rejected.
- **Don't** centre a white card on a grey background or use a violet accent — no Google Forms clone.
- **Don't** use red pen for anything but errors, or the margin red for anything but the margin rule.
- **Don't** add shadows, floating cards or colours from outside the notebook.
- **Don't** add a school cursive or a second typeface.

### Known limitations (to fix in a later pass)
- The margin label's line height does not sit exactly on the ruling.
- The fully rounded focus outline visually curves around the field baseline rather than circling it cleanly.
- Truncated questionnaire titles and author names have no `title` attribute, so the full text is not reachable on hover.
- No fallback font metrics are declared for Atkinson Hyperlegible Next, so the swap from the system fallback can shift text slightly (Next.js build warns about it).
