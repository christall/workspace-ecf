---
name: project-nevea-pointcompta-1310
description: "Ticket compta Éléonore MICHAUD 13/10/2026 (mail Point compta / suite réunion 11/09) — banques 1910, PRNV, agence d'inscription gp1620 — 2/4 corrigés en local le 18/11"
metadata:
  node_type: memory
  type: project
  originSessionId: ce07c49c-5301-404f-822b-354a7bfec1d8
  modified: 2026-11-18T15:07:50.145Z
---

Source : mail « Point compta » d'Éléonore MICHAUD (compta), 13/10/2026, point jugé
« non solutionné », renvoyant à son mail « Suite réunion du 11/09 » à Christophe ALLEON
(PJ « EM_Mail suite réunion du 11092026.pdf », IBAN dedans — PJ non fournie à Claude).

4 points demandés, statut au 18/11/2026 :

1. **Banques 1910 côté Nevea** (SG1910 compte 5121201910, BP1910 compte 5121101910, CERCA+COA)
   — **corrigé en local** dans `sources/applisWeb/nevea/remises_en_banques_nevea_sage.php`
   (clé PHP dupliquée qui écrasait la bonne valeur par une fausse + 2 comptes SG/BP transposés,
   bug probablement ancien). `php -l` propre. Pas commité (Claude ne committe jamais dans
   `sources/`). Détail technique complet : `sources/applisWeb/nevea/CLAUDE.md` (nouveau fichier).
2. **IBAN comptes bancaires CERCA/COA** — **hors périmètre code** : la table de mapping nevea
   ne porte aucun RIB/IBAN, c'est probablement une saisie à faire directement dans Sage (fiche
   banque) par la compta — à confirmer avec Christophe, rien identifié à coder ici.
3. **Écriture PRNV** : compte `4870000000` → `4180000001` — **corrigé en local** dans
   `production_nevea_sage.php::add1Csv487()`, seule occurrence de ce compte dans tout
   `applisWeb` (vérifié par grep avant correctif). `php -l` propre. Pas commité.
4. **Ventes imputées sur l'agence d'inscription** (base `gp1620`, pièces Sage
   `1601-`/`1602-`/`1603-`/`1604-`/`1606-`) — **corrigé en local le 18/11/2026**, après que
   Christophe a restauré `gp1620` en recette. Root cause réelle, différente de l'hypothèse
   initiale : pas une fusion mal faite, mais `agences.comptable`/`agences.agence_pri` (déjà
   correctement renseigné : 1601-1606 → comptable=0/agence_pri=1620) **jamais suivi** par
   `ExportCompta.inc.php::ASqlQSituFacDet()` ni par `EtatEcartsTTCSage.php::facturesGPLearn()`.
   Le lien fait dans le mail avec [[project_etatecartsttcsage_agence_inscription]] était trompeur
   — ce ticket-là avait corrigé un problème différent (priorité lfacture/produits/tiers), pas
   celui-ci. Les deux fonctions résolvent maintenant l'agence via
   `if(comptable=1 or agence_pri vide, code, agence_pri)`, vérifié par rejeu réel avant/après sur
   gp1620 (32 lignes corrigées) et gp7901 (non-régression, y compris un cas limite
   agence_pri='' trouvé et corrigé en cours de route). Détail complet : `sources/GPLearn/
   CLAUDE.md` § Rapprochement GPLearn ↔ Sage. Pas commité (Christophe commit depuis Windows) —
   à tester en recette avant prod. Non traité : `ASqlQSituPrdDet()` (export PRD) a
   probablement le même défaut, pas demandé dans ce ticket.

**Why:** ticket compta avec attente explicite de bouclage ("chaque point traité et confirmé à
la compta") — Éléonore attend un retour point par point, pas un correctif silencieux sans suivi.
**How to apply:** à la reprise, (a) vérifier si Christophe a testé/déployé les points 1 et 3
(fait en local seulement, jamais exercé en conditions réelles Sage) ; (b) pour le point 4,
obtenir soit un accès gp1620, soit la confirmation de Christophe sur l'hypothèse de recodage
avant d'écrire le moindre script ; (c) pour le point 2, confirmer avec Christophe que c'est
bien une action Sage pure sans rapport avec ce dépôt.
