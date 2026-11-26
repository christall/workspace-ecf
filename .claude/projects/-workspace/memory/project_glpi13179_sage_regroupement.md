---
name: glpi-13179-sage-regroupement
description: "Ticket GLPI 13179 (compta) — écritures Sage GPLearn déséquilibrées ; VT corrigé et déployé 29/10 ; PRD : regroupement A/TVA déployé 09/11 ; 10/11 — vrai bug de signe trouvé et corrigé en local pour PRD (Sage ignore le Sens des lignes A, il faut Sens=G + signe négatif), vérifié sur 4 agences, pas commité ; VT n'est PAS concerné (pas d'agrégation multi-lignes côté VT, confirmé)"
metadata:
  node_type: memory
  type: project
  originSessionId: df7ba0ce-898d-4912-b05e-96399818e296
  modified: 2026-11-10T09:56:55.253Z
---

Ticket GLPI 13179 ouvert le 22/10/2026 par Virginie Lairmelin (compta, pour Éléonore) : les
exports Sage GPLearn n'avaient plus de ligne G sur le compte 706xxx et certaines écritures
étaient déséquilibrées pièce par pièce. Cause : commit `1b329f29` (02/10/2026, "regroupement
des lignes 6&7 / écriture de clôture") dans `SageCsvRegroupeLignes()`
(`Traitements/ExportSageCompta.inc.php`), qui fusionnait tout Type de Compte "G" de classe 6/7
par (compte, sens) seul, tous tiers/pièces confondus — sur **tous** les exports (VT quotidien
+ PRD mensuel), alors que seule la clôture de production en avait besoin.

**Volet VT — CORRIGÉ et DÉPLOYÉ en prod le 29/10/2026** : fix du 26/10 (`2a5bc5c4` →
`recette` `50be69da` → `production` `61275767`), restreint le regroupement au seul journal
PRD (`$colonnes[4]=='PRD'`). Vérifié directement sur `origin/production` après fetch. Détail
dans `sources/GPLearn/CLAUDE.md` § « Export Sage Compta » (sections datées fusionnées en une
seule le 06/11 — chercher ce titre, pas l'ancien "anomalie ventes...").

**Volet PRD — nouvelle demande compta du 29/10/2026, corrigé en local le même jour, NON
commité/déployé** : fichier `Echanges_claude_code/8704_PRD__X_20261029_101159_ecriture
demandée onglet jaune.xlsx` — la compta veut, pour la clôture PRD : (1) les lignes "A"
(détail analytique, 7061000000) regroupées **par section analytique** au lieu d'une par
tiers, et (2) les lignes "G" de 4458660000 (TVA/Fact° d'Avance, jamais couvert par le fix du
26/10 car hors classe 6/7) regroupées en une seule, comme 7061000000. Les deux au net
débit/crédit (pas seulement même sens). Implémenté dans `SageCsvRegroupeLignes()`, vérifié par
rejeu de la fonction réelle sur l'écriture 8704/09-2026 (résultat identique au centime à la
cible, totaux globaux inchangés, VT non affecté).

**Complément 30/10/2026, même jour que la demande initiale, corrigé en local** : Christophe a
précisé deux règles supplémentaires (N° de Pièce identique pour toute l'agence y compris sur
les lignes tiers "X" ; ordre strict X → G(7) → A(7) → G(TVA)). Nouvelle fonction
`SageCsvOrdonnePRD()`, vérifiée **champ par champ sur les 1270 lignes** de l'écriture réelle —
correspondance exacte sauf la valeur du N° de Pièce (choisi = code agence, à confirmer avec
la compta : l'exemple du fichier, 44756, est le code tiers d'un client réel réutilisé sans
intention de convention, pas une valeur à reproduire telle quelle).

Détail complet, code, et ce qui reste **non vérifié** (comportement Sage réel sur ces lignes
nettées/renumérotées, déséquilibre global 428533,95 € inchangé par le premier fix — probablement
une caractéristique déjà acceptée de l'écriture PRD, pas confirmé ; valeur exacte attendue pour
le N° de Pièce partagé) : `sources/GPLearn/CLAUDE.md` § « Export Sage Compta » → listes
"Ouvert, à trancher avec la compta" (sections datées fusionnées en une seule le 06/11).

**Why:** Le 26/10/2026, le clone `sources/GPLearn/.git` était figé depuis le 16/07 et
l'analyse du ticket semblait non confirmable. **Le 29/10/2026, le clone était à jour (dernier
commit daté du jour même)** — Christophe a dû fetcher depuis Windows entre les deux. La
fonction, le commit `1b329f29`, et le fix du 26/10 existaient bien, simplement invisibles
depuis un clone périmé — confirme la règle du CLAUDE.md racine (vérifier la date du dernier
fetch avant de conclure qu'un commit "n'existe pas").

**How to apply:** Le volet VT est clos (déployé, vérifié). Le volet PRD est prêt côté code
mais **attend la décision de Christophe** : passer en recette, committer/déployer lui-même
(Claude ne committe jamais dans `sources/`). Si cette mémoire est relue après le 29/10/2026,
vérifier d'abord si le correctif PRD a été commité/déployé (`git log` sur
`Traitements/ExportSageCompta.inc.php`, branche `recette`/`production`) avant de supposer
l'un ou l'autre état.

**Mise à jour 04/11/2026 — toujours pas déployé, confirmé sur données réelles, pas une
régression.** Éléonore relance (« même problème qu'avec les ventes », fichier
`Bequet_exemple prod GP Learn.xlsx` = session d'import Sage réelle, agence 2801/BEQUET, PRD,
4120 lignes). Comptages sur ce fichier : 602 N° de Pièce distincts, 1372 lignes "A" et 1372
lignes "G" TVA toutes individuelles — signature exacte de la version `2a5bc5c4` (26/10,
toujours celle sur `origin/production` au dernier fetch du 30/10), pas de nouveau bug.
`e6b5fe16` (le fix PRD complet, 30/10) n'a donc jamais bougé. Isolé un patch
one-file testé par application à blanc sur `origin/production` + `php -l` OK :
`sources/GPLearn/FIX-EXPORT-PRD-SAGE-20261030.patch`. Détail dans `sources/GPLearn/CLAUDE.md`
§ « Export Sage Compta ». Reste ouvert : valeur du N° de Pièce (code agence) jamais
confirmée par la compta — à trancher avant ou avec ce déploiement.

**Mystère "branche introuvable sur GitLab" résolu le 04/11/2026** : Christophe cherchait
`php8.5_corrigée`, dont le commit `e6b5fe16` était retrouvable sur GitLab sous le nom
**`php8.5_production`** (SHA strictement identique) — à l'époque `php8.5_corrigée` elle-même
ne semblait pas poussée sur origin. ⚠️ Non reverifié depuis : au 05/11, `origin/php8.5_corrigée`
existe bel et bien dans `git branch -a` — à re-confirmer si cette nuance redevient importante,
ne pas supposer l'un ou l'autre état sans revérifier. Plan exécuté depuis : cherry-pick du seul
commit `e6b5fe16` sur une branche neuve partant de `recette`, d'abord nommée
`fix-export-prd-sage-20261104`, renommée **`ECT-455`** le 05/11 (même commit, pas un merge de
toute la branche `php8.5_production` — le reste du chantier PHP8.5 reste une décision séparée,
non adoptée). Changements EtatEcartsTTCSage (ticket distinct, cf.
[[project_etatecartsttcsage_agence_inscription]]) ajoutés en indexé sur cette même branche le
05/11, pas encore commités — à committer par Christophe depuis Windows.

**07/11/2026 — 2e relance Éléonore, toujours le même problème, toujours pas déployé.** Nouveau
mail compta : « les données ne sont pas concaténées », import manuel fait « pour Bequet en
concaténant les données », suppression en cours des écritures erronées importées côté CERCA,
demande une date de mise à disposition des fichiers corrects **envoyés directement** (pas dans
l'espace dédié, le temps qu'elle finisse de purger les écritures erronées). Vocabulaire
« concaténer » = le regroupement `SageCsvRegroupeLignes`/`SageCsvOrdonnePRD` côté compta.
Vérifié ce jour :
- `ECT-455` (checkout courant) toujours **non mergée** dans `origin/recette`/`origin/production`
  (`git merge-base --is-ancestor`), mais **à jour** sur `recette` (`origin/recette` est ancêtre
  d'`ECT-455` — pas de rebase nécessaire). Dernier `fetch` : 06/11 09:45, donc photo quasi
  fraîche.
- Mystère résolu : le commit qui porte `SageCsvOrdonnePRD()` sur `ECT-455` s'appelle
  **`4d924864`**, pas `e6b5fe16` comme noté plus haut — même contenu/auteur/date (30/10), hash
  différent parce que le cherry-pick a eu un conflit sur CLAUDE.md (déjà documenté ci-dessus),
  jamais sur le code. Pas un nouveau commit, pas un nouveau risque.
- `php -l` OK sur `Traitements/ExportSageCompta.inc.php` et le robot sur ce checkout.
- Le contenu métier est donc **toujours exactement celui déjà validé** fin octobre (rejeu réel
  sur BEQUET/gp2801 lui-même) — ce n'est pas un nouveau bug ni une régression, juste le même
  export qui retourne le même format cassé à chaque clôture mensuelle tant qu'`ECT-455` n'est
  pas mergée/déployée.

**Pourquoi je n'ai pas régénéré de fichier "corrigé" à envoyer directement à Éléonore** :
`gp-mysql-rct.cerca-ecf.lan` (seule base MySQL jamais confirmée accessible depuis ce conteneur)
n'est pas confirmé être la même donnée que la vraie prod ayant généré les fichiers erronés
qu'elle a reçus — cf. [[feedback_handoff_when_env_lacks_capability]] (« prod toujours hors
périmètre »). Produire un fichier comptable réel sur une hypothèse de source non vérifiée est
exactement le risque que `CLAUDE.md` interdit (§ Pas d'approximation). Christophe est seul à
pouvoir soit (a) merger/déployer `ECT-455` puis relancer le robot mensuel en prod pour générer
de vrais fichiers corrects, soit (b) confirmer que `gp-mysql-rct` fait bien foi pour Bequet sur
la période concernée, auquel cas un rejeu local redeviendrait pertinent.

**09/11/2026 — correction importante : `ECT-455` n'a PAS le regroupement complet, seulement le
volet ordre/N°Pièce. L'entrée du 07/11 ci-dessus ("le contenu métier est... déjà validé fin
octobre") était fausse.**

Christophe a déposé 3 exports réels générés depuis `ECT-455`
(`sources/Echanges_claude_code/{1620,1702,3701}_PRD__X_20261109_*_ecritures.csv`, 3 agences
différentes de Bequet) pour vérification avant déploiement. Comptage direct des lignes (pas une
relecture de commentaire) :
- N° de Pièce unique par agence (1620/1702/3701 chacun) → le volet `SageCsvOrdonnePRD()`
  fonctionne bien.
- G(7xx) : bien groupé (2 lignes/fichier, D et C net) → fonctionnait déjà depuis le fix du
  26/10 (classe 6/7 déjà couverte par l'ancienne version de `SageCsvRegroupeLignes`).
- **A (analytique) : PAS groupé** — 1860/959/1258 lignes "A" alors que les combos réels
  (compte,axe,section) sont seulement 14/10/10 ; une seule section (ex. `1620-52`) porte 955
  lignes non fusionnées sur le fichier 1620 à elle seule.
- **G/TVA (4458660000) : PAS groupé** — 1856/936/1253 lignes individuelles, alors qu'un seul
  compte sans axe/section devrait donner 1 ligne nette par fichier.

Cause trouvée en relisant le **corps réel** de la fonction (pas en supposant) : celle actuellement
sur `ECT-455` est l'**ancienne version restreinte** (ne traite que `Type de Compte=='G' and
Journal=='PRD' and classe 6/7` ; "A" explicitement exclu par son propre commentaire —
"la fusionner avec G doublerait le montant compté"). La version complète (G par compte seul, A
par compte+axe+section, TVA incluse, net signé) existe mot pour mot sur `origin/php8.5_production`
**et** `php8.5_corrigée` (identiques) — mais n'a **jamais été portée sur `ECT-455`**. Seule
`SageCsvOrdonnePRD()` (commit `4d924864`) a été cherry-pickée ; la réécriture de
`SageCsvRegroupeLignes()` elle-même ne l'a pas été — `git log --all -S"section analytique"`
confirme qu'aucun commit visible d'ici ne porte ce texte dans ce fichier en dehors de
`4d924864`/`e6b5fe16` (qui ne contiennent que le commentaire de `SageCsvOrdonnePRD`, pas une
vraie réécriture de `SageCsvRegroupeLignes`).

**Leçon** : je m'étais fié le 07/11 à l'affirmation de l'entrée du 29-30/10 ("implémenté dans
SageCsvRegroupeLignes(), vérifié par rejeu...") sans relire le corps réel de la fonction sur
`ECT-455` ce jour-là — seulement sa présence/absence de merge. Pour une fonction aussi centrale,
toujours relire le corps réel plutôt que faire confiance au nom du commit/de la fonction dans
`git log`. Cf. [[feedback_verify_before_asserting_long_sessions]].

Équilibre global D/C des 3 fichiers (à titre d'info, pas un nouveau signal) : écarts de
562081,39 € / 362140,04 € / 435064,29 € (D>C dans les 3 cas) — même famille que l'écart de
428533,95 € déjà noté comme "probablement une caractéristique acceptée de l'écriture PRD,
jamais confirmée avec la compta" ; non creusé davantage ici, à ne pas confondre avec le bug de
regroupement ci-dessus.

**How to apply (mise à jour, remplace celle du 07/11) :** le statut de merge d'`ECT-455` ne
suffit plus comme test — même mergée telle quelle, elle produirait encore le symptôme signalé
par la compta. Avant tout déploiement : porter le corps actuel de `SageCsvRegroupeLignes()`
depuis `origin/php8.5_production` (ou `php8.5_corrigée`, identique) vers `ECT-455`, à la place
de la version restreinte — changement mécanique, aucune nouvelle dépendance (les deux versions
appellent les mêmes `SageCsvMontantVersCentimes`/`SageCsvCentimesVersMontant` déjà présentes sur
`ECT-455`). Pas fait à ce jour (Claude ne committe jamais dans `sources/` — décision/action pour
Christophe). Une fois ce portage fait, revérifier sur un export réel (même méthode que ci-dessus :
compter lignes "A"/"G TVA" vs combos distincts) avant de considérer le ticket clos.

**09/11/2026, même jour — portage fait et revérifié, pas encore commité.** Christophe a confirmé
(git status clean sur `ECT-455` côté Windows) avant que je modifie le fichier. Corps de
`SageCsvRegroupeLignes()` remplacé sur `ECT-455` par celui d'`origin/php8.5_production` — `diff`
confirme le fichier `Traitements/ExportSageCompta.inc.php` maintenant **byte-à-byte identique**
entre les deux branches. `php -l` propre.

Revérification par rejeu (pas une confiance aveugle dans le diff) : petit harnais PHP isolé
(4 fonctions extraites + script, dans `$CLAUDE_JOB_DIR/tmp`, pas dans le dépôt) rejouant
`SageCsvRegroupeLignes()`+`SageCsvOrdonnePRD()` sur les 3 CSV réels déposés ce jour :
- 1620 : A 1860→14, G-TVA 1856→1, G-7xx 2→1, écart D-C global inchangé (562081,39 € avant/après).
- 1702 : A 959→10, G-TVA 936→1, écart D-C inchangé (362140,04 €).
- 3701 : A 1258→10, G-TVA 1253→1, écart D-C inchangé (435064,29 €).
Le D et le C bruts baissent chacun du même montant sur les 3 (ex. 1620 : -28108,92 € des deux
côtés) — c'est le netting voulu (une section peut mélanger débit/crédit, cf. commentaire de la
fonction), pas une perte : seul D-C doit rester constant, vérifié constant partout.

Patch de secours (`FIX-EXPORT-PRD-SAGE-20261030.patch`) revérifié par la même occasion : il
contient bien la réécriture complète (`estSynthese`), **pas le même trou qu'avait `ECT-455`**
— utilisable tel quel si besoin d'un chemin de déploiement alternatif.

Détail et texte identique dans `sources/GPLearn/CLAUDE.md` § « Export Sage Compta » (mis à jour
le même jour).

**How to apply (mise à jour, remplace celle d'avant) :** le code est maintenant complet et
revérifié sur 4 agences au total (8704 fin octobre + 1620/1702/3701 le 09/11), **mais toujours
pas commité/poussé/déployé** — à la prochaine relecture, vérifier d'abord l'état de commit sur
`ECT-455` (`git status`/`git log` côté Windows ou conteneur) avant de supposer où on en est :
soit Christophe a commité et il ne reste que merge+déploiement+rejouer le robot mensuel en prod,
soit rien n'a bougé et le fichier local porte encore la correction en attente. Reste ouvert, non
lié au code : valeur du N° de Pièce PRD jamais confirmée par la compta.

**09/11/2026, fin d'après-midi — nouvelle relance Éléonore (15h34), nouvelles agences, nouveau
symptôme distinct.** Mail : « regarde en plus du 8601, les agences 4401, 4903, 7930 » +
« le montant réparti analytiquement n'est pas égal au montant mis en compte général ». Christophe
a restauré ces 4 bases depuis la **vraie prod** (pas recette — comble enfin le gap noté le
07/11 ci-dessus sur la fiabilité de `gp-mysql-rct` comme proxy de la prod) et déposé les 4 CSV
réels (`Echanges_claude_code/{4401,4903,7930,8601}_PRD__X_20261109_*_ecritures.csv`) dans la
foulée d'un message qui donnait aussi, de mémoire, les codes "gp4901"/"gp7901" — **faux, à ne
pas réutiliser** : les fichiers réels et le mail d'Éléonore convergent sur 4903/7930, vérifié
directement sur les noms de fichiers, pas sur sa reformulation orale.

Analyse des 4 CSV (déjà générés avec le regroupement corrigé — lignes "A" = nombre de combos
distincts partout, donc ce n'est pas une régression du fix du jour) : deux phénomènes présents
simultanément, **à ne pas confondre** l'un avec l'autre ni avec le point jamais tranché plus haut :
1. 706/7061000000 : net A == net G exactement sur les 4 fichiers — réconcilié, fonctionne.
2. 4458660000 (TVA) : 0 ligne "A" sur les 4 fichiers contre G non nul (29676,00 / 67725,85 /
   -177,65 / 71083,98 €) — 100 % reproductible. **Vérifié dans le code brut de génération des
   lignes** (avant tout regroupement, pas dans `SageCsvRegroupeLignes`) : seul le compte 706 a
   jamais eu un bloc générant une ligne "A" (`if ($ligne->analytique>'')`), la branche TVA (44x,
   VT comme PRD) n'en a jamais émis, avant comme après tous les fixes récents. Si la compta a
   réellement besoin d'une répartition analytique de la TVA, c'est une fonctionnalité neuve à
   concevoir (ex. prorata par section), pas un bug à corriger.
3. Le déséquilibre global D-C (= net G-706, déjà listé ci-dessus comme "a priori accepté,
   jamais confirmé") réapparaît identique sur ces 4 agences aussi (148379,60 / 338633,22 /
   -888,35 / 355627,27 €) — troisième lecture possible de la phrase d'Éléonore.
Détail chiffré complet dans `sources/GPLearn/CLAUDE.md` § « Export Sage Compta » (même date).

**Détail d'exécution notable** : HEAD du checkout `sources/GPLearn` était sur
`fix-historique-filtre-iduser` (pas `ECT-455`) au moment de cette analyse — le fichier
`ExportSageCompta.inc.php` du working tree reste malgré tout byte-à-byte identique à
`origin/php8.5_production` (vérifié par diff), donc le fix de regroupement est bien présent
pour quiconque génère un export depuis ce checkout ; pas vérifié si c'est committé sur cette
branche ou toujours un working-tree modifié en attente (commande `git diff --stat HEAD` restée
bloquée >120s sur ce montage 9p, cf. lenteur déjà documentée dans `sources/CLAUDE.md`) — à
confirmer côté Windows avant de supposer l'un ou l'autre état.

**How to apply :** ne pas répondre à Éléonore (ni coder un prorata TVA) sans qu'elle précise
laquelle des 3 lectures ci-dessus elle vise — les corrections sont de nature complètement
différente (aucune / nouvelle fonctionnalité / déjà discuté ailleurs). Si elle confirme viser la
TVA (point 2), c'est une décision produit (méthode de prorata) à prendre avec elle avant tout
code, pas une correction de bug au sens des points précédents de cette mémoire.

**09/11/2026, correction importante sur le statut de déploiement — tout ce qui précède disant
"pas commité/poussé/déployé" est PÉRIMÉ.** Vérifié par diff de contenu (pas par confiance dans
une branche nommée) : `Traitements/ExportSageCompta.inc.php` est **byte-à-byte identique** sur
`origin/recette` ET `origin/production` au commit `e45304c8` (09/11 09:55:33, "ajustement des
regroupements", fetch `.git/FETCH_HEAD` à 13:11 le même jour — donc une photo fraîche, pas une
vieille branche jamais fetchée). Le cherry-pick/merge a donc eu lieu entre l'email de Christophe
à 09h20 ("dès que le patch est en place...") et 09h55 — cohérent avec le "couac" qu'il
mentionnait. Le volet PRD complet (G/A par section + TVA) est donc réellement **en production**,
pas seulement prêt en local. Pour mémoire, le HEAD du checkout au moment de cette vérification
était sur une branche `fix-historique-filtre-iduser` (créée après coup, descendant de `recette`
donc héritant déjà du fix) — pas la peine de chercher `ECT-455` pour statuer sur ce point, le
contenu réel sur `recette`/`production` est la seule source fiable.

**Bonus découvert au passage** : `Traitements/EtatEcartsTTCSage.php` (ticket distinct, cf.
[[project_etatecartsttcsage_agence_inscription]]) est **lui aussi** déjà byte-à-byte identique
sur `origin/production` (commit `398288fe`, 08/11 08:52:51) — ce ticket aussi est en réalité
déployé, pas juste "indexé sur ECT-455" comme noté précédemment.

**How to apply (remplace les précédentes) :** le vrai sujet ouvert n'est plus "committer/
déployer" (fait) mais uniquement la clarification à obtenir d'Éléonore sur sa phrase du 09/11
15h34 (TVA sans ligne A, vs déséquilibre D≠C déjà connu, vs autre chose) + la valeur du N° de
Pièce PRD jamais confirmée. Si une future session retrouve encore des notes "pas déployé" plus
haut dans ce fichier, se fier à cette entrée du 09/11 (vérifiée par diff de contenu direct sur
`origin/production`), pas aux entrées antérieures.

**10/11/2026 — la clarification est arrivée, et c'est ni la TVA ni le déséquilibre global.**
Éléonore (relayée par Christophe) : **Sage ne lit pas le Sens (D/C) des lignes "A"** — il doit
recevoir le même Sens que la ligne "G" du compte, et c'est le **signe du Montant** (positif ou
"-") qui porte la vraie direction de chaque ligne analytique. Confirmé par calcul à la main sur
l'image qu'Éléonore avait jointe (agence 4903, cf. échange du 09/11 sur l'image email) avant
d'avoir la confirmation verbale — l'hypothèse testée numériquement collait déjà exactement.

Deux fausses pistes explorées avant d'arriver là, gardées pour ne pas les rejouer : (1) le
"C manquant" (Christophe pensait qu'Éléonore avait pu additionner sans voir le Sens 'C' d'une
ligne — vérifié vrai arithmétiquement pour 3 agences sur 4, mais ne touchait que la lecture
humaine du fichier, pas l'import Sage lui-même, et n'expliquait pas 8601) ; (2) ma proposition
initiale de signe "inversé" (Sens flippé + montant positif) — fausse, Christophe a corrigé :
Sens reste celui de G, c'est le Montant qui devient signé.

**Corrigé dans le code (PRD uniquement, sur demande explicite de Christophe — VT vérifié mais
PAS touché)** : détail et numéros de vérification dans `sources/GPLearn/CLAUDE.md`
§ « Export Sage Compta » (entrée du 10/11). Résumé : nouveau bloc dans
`SageCsvRegroupeLignes()` (`Traitements/ExportSageCompta.inc.php`), rejoué sur les 4 CSV réels
4401/4903/7930/8601 du 09/11 — seules les lignes A-706 en sens opposé à G changent (1 par
fichier sur 3 des 4 agences, 0 sur 8601), rien d'autre ne bouge, somme des Montant (même Sens
partout désormais) = G exactement sur les 4 fichiers. `php -l` propre. **Pas commité.**

**Correction le même jour : VT n'a PAS le même défaut**, contrairement à ce que j'avais écrit
juste au-dessus (code "quasi identique" en surface, mais j'avais sauté l'étape de vérifier si
VT agrège plusieurs lignes comme PRD). Christophe : « une ligne de facture ne se découpe pas en
plusieurs analytiques contraires » — et le code confirme : VT ne fait jamais de netting
multi-lignes façon `SageCsvRegroupeLignes()`, chaque ligne "A" est un miroir strict de sa propre
ligne "G" (même `$ligne`, même montant, même sens). Le bug PRD vient spécifiquement de
l'agrégation mensuelle (plusieurs étudiants/sections fusionnés dans un seul G) — sans elle, pas
de scénario où A et G divergent. VT n'a donc pas besoin de ce correctif, ce n'est pas juste
"pas encore fait". Cf. [[feedback_verify_before_asserting_long_sessions]] : j'ai conclu sur une
ressemblance de code sans vérifier le mécanisme réel (agrégation ou pas) qui cause le bug.

**How to apply (remplace celle d'avant) :** le volet "regroupement A/TVA par section" (déployé
09/11) et le volet "signe des lignes A pour Sage" (corrigé en local 10/11, pas commité) sont
deux correctifs distincts sur la même fonction — ne pas les confondre si on doit les committer
séparément. Le point TVA (4458660000 sans ligne A du tout) et le déséquilibre global D≠C restent
ouverts, sans rapport avec ce bug de signe. Reste aussi ouvert, non lié : valeur du N° de Pièce
PRD jamais confirmée par la compta.
