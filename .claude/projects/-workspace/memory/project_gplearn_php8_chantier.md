---
name: project-gplearn-php8-chantier
description: "Chantier PHP8 GPLearn — reprise via sources/GPLearn/REPRISE-20261030.md ; branche php8.5_corrigée poussée sur origin, Drive en cours de sortie"
metadata: 
  node_type: memory
  type: project
  originSessionId: 253bb3dd-cb1f-4130-9e49-f135c1ff93c0
  modified: 2026-10-30T10:05:55.730Z
---

Chantier migration PHP8 de GPLearn (parc CERCA/ECF). **Reprise : `sources/GPLearn/REPRISE-20261030.md`** (état au matin du 30/10/2026 — remplace la version du 27/10, dont tout le contenu « non commité » a depuis été committé). Complète `sources/GPLearn/CLAUDE.md` et `sources/CLAUDE.md`.

Points clés :
- Branche `php8.5_corrigée` (HEAD `e6b5fe16`) **poussée sur `origin`** — ce n'est plus une branche locale isolée. 3 commits depuis la dernière reprise, tous par Christophe depuis Windows (fix mpdf & co ; génération documents + compta, 38 fichiers ; export compte PRD).
- Fatals Mpdf (chemin d'include, `tempDir`, `number_format` sur chaîne pré-formatée) corrigés sur 8 fichiers test — seul 1 explicitement confirmé par test WAMP, 4 en attente de confirmation avant application en masse aux 29 fichiers restants du même motif.
- Gardes `isset()` orphelines affichées en clair dans la page : 27/28 fichiers corrigés (le 28e, `php/render_data.php`, est un faux positif du détecteur — volontairement non touché).
- html2pdf : 3 occurrences de `count()` sur `getimagesize()` false corrigées ; retest demandé à Christophe (`Acces_myroad.php`), pas de confirmation reçue.
- 2 bugs PHP8-fatal réels toujours actifs sur `origin/production` (bareword `$_POST[date]`/`$_REQUEST[nplaces ]` etc.), jamais sortis en hotfix isolé contrairement à Sage Compta.
- Sortie de Google Drive en cours (motivée par la série d'incidents de sync du 29/10, cf. `sources/CLAUDE.md`) — Drive était en pause au moment de la reprise, à vérifier si relancé.
- Fusion `php8.5_corrigée` → `recette`/`production` toujours en attente, indépendante de ce qui précède.
- Rationalisation Sage Compta PRD (numéro de pièce unique + ordre des lignes) : voir mémoire séparée `project_glpi13179_sage_regroupement`.
