---
name: feedback-handoff-when-env-lacks-capability
description: "Don't assume live DB access is unavailable — recette MySQL is directly reachable from this container; test before declaring a capability gap"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 396ac3f1-ca0b-4c87-9c3f-c95ba2ee5afc
  modified: 2026-11-04T14:49:22.858Z
---

When a task needs a capability that seems unavailable (live DB query, running a specific server), don't just prepare the handoff and call it blocked — try the obvious direct path first, since the assumption that it's unreachable may itself be wrong.

**Correction (04/11/2026)** : during a bddTools import-failure investigation, I assumed "no live DB access from this container" (based on `.lan`/internal hostnames and no prior precedent of connecting) and wrote up a diagnosis entirely from static code reading + MySQL documentation knowledge, flagged as unconfirmed. Christophe then said: "tu as accès au mysql recette (pas prod mais recette oui)" — and indeed `mysql -h gp-mysql-rct.cerca-ecf.lan -P 3306 -u proc_stock -p... ` (credentials already sitting in plain sight in `sources/CLAUDE.md` § Connexion MySQL) connected immediately, no VPN/tunnel needed. I had the access the whole time and didn't try it.

**Why**: the original "no Docker/live DB here" belief was a generalization from one true case (no Docker, no mysqld binary to self-host a test server) to a different, untested case (reaching an *existing* MySQL server on the CERCA LAN). Those are not the same capability.

**How to apply**:
- Recette MySQL (`gp-mysql-rct.cerca-ecf.lan:3306`, creds in `sources/CLAUDE.md`) is reachable directly from this container — use it to verify hypotheses (table/view types, row counts, `information_schema`) instead of reasoning blind, and to apply low-risk fixes (e.g. `DROP VIEW`/`DROP TABLE` on recette) once confirmed.
- Prod (`mysql-fp.ecf-cerca.fr:3309` and others) is explicitly **out of scope** — Christophe scoped the access to "recette, pas prod" ; don't extend this access to prod without him saying so again for that specific host.
- Still ask before DROP/DELETE-class statements even on recette (destructive-action confirmation rule, [[feedback_confirmations]]) — reachability isn't the same as blanket permission.
- Still true as a fallback: when a capability genuinely isn't available after actually trying (e.g. no Docker, no mysqld binary to self-host), prepare fully and hand off the one exact command rather than stopping at "blocked."

**Addendum (04/11/2026, background job session)** : `gp-mysql-rct.cerca-ecf.lan` failed to
resolve (`getent hosts` empty, `ERROR 2005 Unknown server host`) even with the VPN confirmed
active by Christophe — `/etc/resolv.conf` in this container only has the public `1.1.1.1`, no
internal CERCA DNS. **The route itself was fine** — connecting with the bare IP
(`mysql -h 192.168.1.130 ...`, IP obtained by asking Christophe to `ping` the hostname from
Windows) worked immediately. So: a `.lan` hostname failing to resolve is a DNS-config gap
specific to this container/session, not proof the VPN/route is down — ask for the IP (via
`ping`/`nslookup` from the user's side) and connect directly before concluding "unreachable."
Unclear whether this is specific to background-job sessions vs interactive ones (the
`/workspace` 9p mount confirmed this was the *same* container as the interactive session in
this case, so it's not a separate sandbox) — re-test DNS first on the next occurrence, this
addendum is about the workaround, not a confirmed permanent gap.
