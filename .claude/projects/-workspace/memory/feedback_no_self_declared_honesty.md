---
name: feedback-no-self-declared-honesty
description: "Never use \"honnêtement\" or similar self-declared honesty markers in copy written for Christophe — the word itself reads as a sales tell"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 36bf4286-44c1-4cf4-813d-dfa71f83b0b2
  modified: 2026-10-19T12:46:52.364Z
---

Avoid self-referential honesty claims in any persuasive/marketing copy written for Christophe —
words like "honnêtement," "en toute transparence," "pour être franc," "sans détour" used as a
rhetorical marker rather than literal description.

**Why:** Christophe's own heuristic, stated 19/10/2026: when a salesperson says "honnêtement" to
him, his reaction is « il est en train de me la faire à l'envers » (he's about to con me) —
someone who's actually honest doesn't need to claim it, they just state facts. Caught on
FactiFlow's homepage ("Où en est le produit, honnêtement") and in `calculateur.html`'s verdict
copy (an anti-sell message telling the prospect not to buy — already honest by construction).
In both cases the surrounding text already demonstrated honesty through concrete, specific
statements; the label added nothing and actively undermined the credibility it claimed.

**How to apply:** When writing sales/marketing/persuasive copy for Christophe, on any project,
let facts and plain, specific statements carry the honesty — never label a statement as honest,
transparent, or sincere. If a sentence doesn't sound credible without the label, the fix is to
make the underlying claim more concrete, not to add a label on top of it. Check new copy for
this pattern before shipping it, not just when asked to review existing copy.

**Recurrence 21/10/2026 — the check must also run on COPIED/REUSED copy, not only new copy.**
Christophe flagged it again (« le critère honnête ne me plait pas, tic de langage ? ») on the
pièce n°2 rewrite of `guide-integrateur-pa.html` — the heading came from the OLD page and was
carried over verbatim into the new draft. A grep of `site/*.html` found three survivors:
`guide-integrateur-pa.html` (« Comment choisir — le critère honnête »), `plateformes-agreees-
multiples.html` (« Comment trancher, sans s'auto-justifier » + « donner quand même le critère
honnête »), `calculateur.html` (« Bornes d'honnêteté ») — all fixed 21/10. Lesson: when
reusing existing copy in a rewrite, run the pattern check on the reused text too; and prefer
sweeping the whole site (`grep -rn "honnêt"`) before shipping a new page that links into
existing pages.
