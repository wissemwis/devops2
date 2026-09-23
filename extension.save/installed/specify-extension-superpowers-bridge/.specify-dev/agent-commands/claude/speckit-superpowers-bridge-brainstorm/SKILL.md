---
name: speckit-superpowers-bridge-brainstorm
description: Refine the raw feature idea via Superpowers brainstorming before /speckit.specify writes spec.md
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Wissem Hamza
  source: superpowers-bridge:commands/speckit.superpowers-bridge.brainstorm.md
---

# Superpowers Brainstorming Bridge

## Purpose

Before /speckit.specify turns the raw request into `spec.md`, run it through the
Superpowers `brainstorming` skill: natural-language questioning, 2-3 proposed
approaches, and a design presented in sections for human validation — instead of
jumping straight to a spec document.

## Behavior

1. Invoke the Superpowers `brainstorming` skill on the following input:

   $ARGUMENTS

2. Follow the skill's own process (classify spike/bounded/architectural, ask
   clarifying questions one at a time, propose approaches, present the design in
   sections, get approval after each section).

## Constraints — override brainstorming's default hand-off

- Let the `brainstorming` skill write its design document to
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and commit it, as it
  normally would. This is the durable record of the brainstorming session.
- In addition to that file, once the human partner approves the design,
  produce a concise structured brief (purpose, target users, key user stories
  with priorities, constraints, success criteria) so /speckit.specify has an
  immediate input without re-reading the design doc.
- Do NOT invoke the `writing-plans` skill afterward, and do NOT auto-chain into
  any other Superpowers skill. This hook's only job is to produce the approved
  design doc + brief.
- Do NOT create, modify or delete any application source files during this step.

## Hand-off

Once the brief is approved, output it clearly labeled `## Refined Brief`,
reference the path of the design document written under
`docs/superpowers/specs/`, and tell the user: "Brainstorming terminé — le
brief ci-dessus (et le document de design associé) vont maintenant alimenter
/speckit.specify." Then stop; the calling /speckit.specify command resumes
from here with this brief as its effective input.