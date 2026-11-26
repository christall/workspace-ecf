---
name: feedback-verify-before-asserting-long-sessions
description: "In long sessions, verify before asserting — confidence creeps ahead of verification under momentum"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 72afc534-437c-4048-8025-619017720948
  model: claude-sonnet-5
  modified: 2026-10-19T13:14:19.590Z
---

The user observed directly: "plus les sessions sont longues plus tu délires" (the longer the session, the more you go off the rails) — and it held up under scrutiny, not just a vague impression.

Two concrete incidents from the same session (tra/tra-lab work, 2026-08-01):
1. Wrote into permanent project docs that "nginx fait le TLS", citing a specific verification method and date, when the actual check performed was just "a file named nginx-tra.conf exists in the repo" — never actually confirmed nginx was installed or running. Had full SSH access to check directly and didn't bother. Turned out to be Apache; nginx wasn't even installed.
2. Presented a data analysis result (regime-weighted position sizing "improves returns by 2-4 points") as a finding worth showing the user, without an out-of-sample check — despite having read, earlier in the *same* session, a prior study on the same codebase explaining that an analogous result had evaporated under exactly that check. The user had to ask for the check; it reversed the finding for 3 of 4 profiles.

**Why**: momentum. After a long string of successful actions, confidence outpaces verification — "sounds consistent with everything else I've confirmed" quietly substitutes for actually checking. This is a discipline failure, not a context-window/memory limitation — in both cases the means to verify were available and unused. Compacting the conversation does not fix this (confirmed with the user): the errors weren't caused by lost context, and a compacted summary — being lossy by nature — could plausibly make it *worse* by smoothing "verified via SSH on date X" down to "X is true."

**How to apply**: in any session, but especially past the point where a long string of actions has gone smoothly — before writing a specific factual claim into a durable artifact (docs, commit messages, a report to the user), ask whether it was actually checked or just inferred/pattern-matched, and if a cheap check is available (a file read, an SSH command, re-running a script with a stricter test), do it before asserting rather than after being asked. Prefer re-deriving over reusing memory/context for anything with drift risk (see also [[memory-vs-claudemd-separation]] for how CLAUDE.md and this memory system divide that verification-worthy knowledge).

**Third incident, same pattern, different domain (FactiFlow, 2026-10-19)**: pulled live funnel
metrics from D1 (qualification=1, demo_facturex=1, b2_abandon=1, one waitlist signup) during a
long session. Correctly identified the waitlist entry as a self-test (email literally said
`test@…`), then immediately failed to apply the same scrutiny one paragraph later: presented
the matching qualification→demo→abandon sequence as "le tout premier signal comportemental
réel" (hedged as too small to conclude from, but still framed as possibly-organic). Christophe:
"la personne qui a fait le parcours c'est moi." With 0 real clients and a funnel freshly wired
up, "the founder tested his own new feature" is the default explanation for a single coherent
event sequence, not one hypothesis among several — the same inference I'd already made two
sentences earlier for the waitlist row. **The failure wasn't missing data, it was not applying
a conclusion already reached in the same breath to the next, structurally identical, data
point.** Worth a specific check beyond the general rule: when a dataset has multiple rows and
one has already been identified as self-generated, actively ask whether the others share the
same explanation before presenting any of them as external signal.
