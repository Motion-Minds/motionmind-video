---
title: Revise a run
description: Review notes for a run that isn't approved yet. Technical fixes stay in the same run; a new creative direction becomes a new version.
category: video
order: 3
fields: brand, campaign, run, notes, extra
---
Use the motionmind skill (revise an existing run).

Revise {{brand}}/{{campaign}} run {{run}}.
First check runs/{{run}}/.editing.json: if it exists, ask me to press "Done editing". Then run `npx hyperframes history` in src/ to see my changes from HyperFrames Studio.
Notes: {{notes}}

Technical fixes (typos, positions, small timing tweaks) go in the same run. If the notes change the creative direction, create a new version and tell me first.
When done: `motionmind render {{brand}}/{{campaign}} {{run}}`, run the skill's QA checklist, and add rules from my notes to the feedback rules in TASTE.md.

Extra: {{extra}}
