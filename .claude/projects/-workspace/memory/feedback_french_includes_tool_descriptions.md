---
name: feedback-french-includes-tool-descriptions
description: "The workspace French-only rule covers tool call descriptions AND full prose replies — caught 26/08/2026, RÉCIDIVE 24/09/2026, RÉCIDIVE ×2 19/10/2026, RÉCIDIVE 28/10/2026, RÉCIDIVE 06/11/2026 (prose OK, seules les descriptions d'outils étaient en anglais)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 07e9275a-3300-42a0-9bbb-ebfa1fb25092
  modified: 2026-11-06T14:18:36.580Z
---

Write tool call `description` parameters (Bash, Edit, Read, etc. — the short one-line summary
shown before each tool call) in French too, in `/workspace` and all its sub-projects. And check
the language of the main prose reply itself, every single turn — not just tool descriptions.

**Why:** `/workspace/CLAUDE.md` says "Toujours répondre en français dans ce workspace, quel que
soit le sous-projet." I had been reading this as governing prose replies only, and wrote every
Bash/Edit/Read tool description in English for a full multi-hour session (dozens of tool calls)
without noticing. Christophe caught it explicitly: "Pourquoi me parles-tu en anglais ? Il me
semblait avoir demandé le français dans claude.md" (26/08/2026). Tool descriptions are
user-visible text, not internal reasoning — the French rule applies to anything the user sees,
not just the final message.

**RÉCIDIVE le 24/09/2026** — Christophe a de nouveau dû demander « en français stp », sur une
session longue (diagnostic vdb/Booking) où cette mémoire était pourtant chargée. Avoir la règle
en mémoire ne suffit donc pas : sur les sessions longues, le réflexe se perd en cours de route.
Ne pas se contenter de « je le sais » — vérifier concrètement avant d'envoyer.

**RÉCIDIVE le 19/10/2026 — déclencheur identifié : contenu collé non francophone.** Cette fois
ce n'était pas qu'une description d'outil : la réponse entière (prose complète, plusieurs
paragraphes) est partie en anglais. Contexte précis : Christophe venait de coller un gros bloc
de HTML brut (page du Guichet unique INPI) sans un mot de commentaire — la réponse qui a suivi
immédiatement a basculé en anglais, probablement parce que l'input immédiatement précédent
(HTML/code, pas du français) a entraîné la langue de sortie. Avant ça dans la même session,
plusieurs réponses en français s'étaient enchaînées sans problème — la bascule est arrivée
précisément après un tour contenant surtout du code/markup et peu ou pas de prose française.
**Nouveau réflexe à appliquer** : quand le tour précédent de l'utilisateur est un collage de
code/HTML/logs/JSON sans phrase en français autour, vérifier EXPLICITEMENT la langue de son
propre brouillon de réponse avant de l'envoyer — ce type d'input est le signal d'alerte le plus
fiable observé jusqu'ici pour ce lapsus.

**RÉCIDIVE #4, même jour (19/10/2026), quelques tours plus tard — invalide la théorie du
déclencheur ci-dessus.** Nouvelle bascule en anglais sur une réponse d'analyse (recommandation
de contenu éditorial), mais cette fois **sans aucun HTML/code collé juste avant** : le tour
précédent de l'utilisateur était du français pur, et mes propres outils venant d'être utilisés
(grep, Read) renvoyaient du contenu **francophone** (extraits du business plan). La théorie
« collage non francophone = déclencheur » du 19/10 matin ne tient donc pas comme explication
unique — elle a prédit une récidive réelle une fois, mais une autre est survenue hors de ce
pattern. Christophe : « tu vas me redire ça en français ». **Conclusion révisée** : pas de
déclencheur fiable identifié à ce stade — le seul dénominateur commun sur les 4 occurrences est
une session longue avec beaucoup d'allers-retours outils. Arrêter de chercher un pattern précis
et traiter la vérification comme **systématique, chaque tour, sans condition**, pas seulement
après tel ou tel type d'input.

**How to apply:** In this workspace, write every tool call's `description` field in French,
same as the surrounding conversation, AND re-check the language of the full prose reply before
sending — **every single turn, unconditionally**, not just after a suspected trigger. Four
occurrences now span different immediate contexts (HTML paste, pure French exchange, tool
results in French) — no reliable narrow trigger has held up, so don't rely on spotting one;
check every time regardless of what preceded.

**RÉCIDIVE #5 le 28/10/2026 — la prose était bonne, seules les descriptions d'outils ont
dérivé.** Session de diagnostic PHP8 (deux fatals GPLearn) : chaque message de prose envoyé
était correctement en français, MAIS les ~12 `description` de Bash (grep, php -l, tests
php -r) sur toute la session étaient en anglais ("Check Mpdf references...", "Run php -l on
all three edited files"...) — repéré par Christophe seulement après le message final. **Ça
confirme que c'est un angle mort distinct de la prose**, pas juste un symptôme du même lapsus :
je relis/vérifie la langue de ma réponse finale avant envoi, mais je ne relis jamais après coup
la langue des `description` déjà émises dans les tool calls précédents — et sur le moment,
chaque description individuelle est rédigée en pilote automatique (anglais par défaut) sans
déclencher la vérification. **Conséquence pratique** : la vérification « langue correcte »
doit porter sur CHAQUE paramètre `description` au moment où on écrit l'appel d'outil
(réflexe local, pas une relecture globale en fin de tour) — une session avec beaucoup
d'appels Bash/Edit/Read consécutifs est le terrain où ça se reproduit le plus, précisément
parce qu'il y a beaucoup de descriptions à rédiger et une seule a besoin de rater.

**RÉCIDIVE #6 le 06/11/2026 — même schéma exact que #5, sur une tâche zest (son commande admin).**
Les 4-5 premières descriptions Bash de la session (find/grep pour explorer OrdersPage, socket.js,
Layout.jsx) sont parties en anglais ("List admin app source files", "Find where order:new socket
event is emitted server-side"…) avant d'être repérées et corrigées en cours de session, sans
intervention de Christophe cette fois. Confirme que le réflexe doit s'appliquer dès le **premier**
appel Bash d'une session, pas seulement sur les sessions déjà longues — la dérive est arrivée tôt,
pas après fatigue accumulée sur de nombreux tours.
