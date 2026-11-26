---
name: Pas de demande de confirmation systématique
description: L'utilisateur ne veut pas être sollicité pour confirmer chaque action (sauf destructeur irréversible) ; exception ajoutée 10/11/2026 — git commit/push demandent toujours confirmation avant, sur tout dépôt
type: feedback
originSessionId: c7788c22-d96e-400c-8172-cc6c68039838
modified: 2026-11-10T08:21:27.487Z
---
Ne pas demander de confirmation à chaque étape. Procéder directement (répondre Y implicitement) sauf pour les actions vraiment destructrices et irréversibles (DROP, DELETE massif, push force, etc.).

**Why:** L'utilisateur trouve les confirmations répétées inutiles et ralentissantes.

**How to apply:** Lire, analyser, exécuter directement. Réserver la confirmation explicite uniquement aux opérations à fort risque de perte de données ou impact production.

**Exception confirmée le 10/11/2026 : `git commit`/`git push`, même non-force.** Suite à mon
rapport du 09/11 sur l'état de `sources/GPLearn` (commits `e45304c8`/`398288fe` déjà présents
sur `origin/recette`/`origin/production`), Christophe a demandé qui commit/push normalement et
m'a explicitement dit de **demander confirmation avant de le faire** — alors même que ce
memo dit globalement de ne pas demander de confirmation. Ne pas généraliser l'exception :
`git status`/`diff`/`log`/`show` (lecture pure) restent à exécuter directement, aucune
confirmation requise — seuls `commit`/`push` (et a fortiori tout ce qui modifierait l'historique
partagé) demandent confirmation avant action, sur n'importe quel dépôt, pas seulement
`sources/` (qui a déjà sa propre règle absolue, "jamais", dans CLAUDE.md racine — Christophe
commit/push toujours lui-même depuis Windows pour ce dossier précis).
**Why:** push sur `recette`/`production` déclenche un déploiement CI/CD automatique
(`git reset --hard` sur le serveur, cf. `sources/CLAUDE.md`) — un push est donc une action à
impact production immédiat, pas une simple sauvegarde ; Christophe veut rester seul décideur du
moment où ça part, même si le commit lui-même est anodin.
**Complément, même incident** : mon rapport disait "poussé... très probablement [Christophe]"
au lieu de vérifier — j'avais le moyen de le confirmer tout de suite (`git log -1 --format=%an
%ae` sur le commit en question) et ne l'ai fait qu'après qu'il pose la question. Toujours
vérifier l'auteur réel d'un commit avant d'en parler, surtout quand la question "est-ce que
Claude aurait pu faire ça lui-même" peut se poser — ne pas se contenter d'une déduction
temporelle plausible. Cf. [[feedback_verify_before_asserting_long_sessions]].
