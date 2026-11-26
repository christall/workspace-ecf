---
name: gplearn_fusion_gp1301_gp1302
description: "Fusion gp1301→gp1302 (GPLearn) — incident Eve du 04/11 CLÔTURÉ par Christophe le 06/11 (backlog : prospects/inscriptions, filtre agence, *HM). Incident Eve 16/11 (remises en banque 1301 cassées, table banques jamais migrée) CORRIGÉ EN RECETTE ET EN PROD le 16/11 — chantier clos."
metadata:
  node_type: memory
  type: project
  originSessionId: 842372fd-6a2c-4d81-8080-7907cad8439f
  modified: 2026-11-16T09:45:23.728Z
---

**✅ INCIDENT 16/11/2026 — remises en banque 1301 cassées — CORRIGÉ EN RECETTE ET EN PROD,
chantier clos.** Eve signalait que les remises en banque de 1301 ne fonctionnaient plus. Root
cause vérifiée par requête directe (gp1301 standalone vs gp1302 post-fusion, `gp-mysql-rct`) :
`Fusion_Complete_gp1301_gp1302.sql` ne touchait jamais `banques` (0 mention sur 873 lignes) —
le même oubli déjà vécu et corrigé une fois sur `Fusion_Complete_gp8801_gp8803.sql` (incident
Nicolas/ECF Synergie du 07/08/2026, « remises en banque affichant celles d'un autre
(Xavier) ») n'avait jamais été porté dans le script gp1301→gp1302, écrit/exécuté 3 mois plus
tard. `reglts` (règlements) a bien été migrée, mais `reglts.banque` gardait le code gp1301
brut et `banques` n'avait pas suivi : 13 codes exclusifs gp1301 → 37 481 lignes `reglts`
orphelines (invisibles, INNER JOIN dans `cherche_rbq.sql.php`) ; 4 codes en collision avec des
banques natives gp1302 différentes → ~10 486 lignes mal rattachées ; `03` un cas à part
démasqué en creusant (absent de `banques` mais 3193 lignes natives gp1302 dessous, rien à voir
avec gp1301 — un ancien compte désactivé avant même la fusion).

**Correctif écrit, testé en recette (deux fois — idempotence vérifiée) le 16/11/2026, puis
EXÉCUTÉ EN PROD par Christophe le même jour à 10:39 via bddTools** (`mysql-adh.ecf-cerca.fr:3307`) :
`scripts-sql/GPLearn/OperationsPonctuelles/Recode_Banques_gp1301_gp1302_20261116.sql`. Volumes
gp1301 source légèrement différents en prod (ex. code `01` : 450 lignes contre 437 en
recette), mais couverture restée à 100% (`n_apparie`=`n_source` sur les 4 codes recodés) —
confirme que l'appariement par contenu est robuste à la dérive recette/prod, pas un chiffre
figé. Journal bddTools sans ligne `FIN trt_file` explicite (coupure d'affichage/copier-coller,
pas un échec : le client `mysql` s'arrête net à la 1ère erreur, et les 4 blocs de vérification
de l'Étape 6 sont ressortis intégralement propres dans le journal — preuve suffisante que tout
ce qui précède a réussi ; seul le tout dernier `DROP TABLE` du script, un brouillon sans
impact, n'a pas de confirmation visuelle directe). 12
codes exclusifs sans collision copiés tels quels ; `03`+`01`+`02`+`04`+`05` (5 vraies
collisions) recodés en `103`/`101`/`102`/`104`/`105`, lignes `reglts` migrées identifiées par
appariement de contenu (pas par le code seul) pour ne toucher aucune ligne native gp1302.
`rbq_verr` volontairement non touchée (ambiguïté de date non résoluble sans risque). Piège
inédit rencontré : trigger `TGreglts_bu` (déployé 04/11, donc inexistant quand la fusion et le
fix gp8803 ont été écrits) bloque silencieusement l'UPDATE si `daterem <= cloture_banque` —
neutralisé par DROP/CREATE TRIGGER le temps de l'opération. Vérifié au niveau applicatif
réel : la requête de `cherche_rbq.sql.php` pour un utilisateur agence=1301 renvoie désormais
30 899 remises. Détail complet, requêtes de vérification, et **nouvelle entrée dans la
checklist générique de fusion** (`banques` vue oubliée 2 fois de suite, pas un hasard) :
`scripts-sql/GPLearn/CLAUDE.md` § « banques jamais migrée » + § moteur générique
`PRegroupeImport`.

**Chantier clos.** Script autoportant et idempotent, rejouable sans risque si un doute
survient un jour sur son exécution (ne retrouvera rien à recoder une fois déjà fait).

**How to apply** : si Eve ou quelqu'un d'autre signale encore un problème sur les remises
1301, ce n'est pas une régression de ce correctif-ci à rouvrir aveuglément — vérifier d'abord
si c'est un cas neuf (nouvelle donnée, nouvel écran) avant de ressortir ce diagnostic.

---

**⚠️ RÉOUVERT le 04/11/2026, CAUSE RACINE CONFIRMÉE sur données réelles (copie de la gp1302
prod restaurée par Christophe sur le serveur recette, 192.168.1.130).** Eve (fonctionnelle,
mail à Christophe) signalait 2 symptômes après la fusion prod du 02/11 : chiffres « prospects
et inscriptions B » du 01-02/11 faux (non résolu, cf. plus bas) et plannings mélangés
1301/1302 pour Pascale, Stéphane REBOA et TGD.

**Confirmé par requête directe** : les 3 sont des cas de dédoublonnage Partie 4
(`no_autorisation_enseigner` identique entre gp1301 et gp1302) — le code gp1301 décalé
(+376) de chacun est bien absent de gp1302 (625, 470 et l'ancien 253 de TGD n'existent plus),
donc chacun a réellement été fusionné en une seule fiche `intervt` côté gp1302 :
- **TGD = code 371 = `nom` « TGD2 MARSEILLE », `prenom` « THE GOOD DRIVE ».** Pas une
  personne — une ressource/marque partagée, visiblement utilisée indépendamment par les 2
  agences. La fusionner comme un doublon humain était une erreur. **Preuve concrète sur Nov
  2026** : code 371 a 3 créneaux différents (3 élèves différents : BENDJEDDOU idplgarg=888975
  migré gp1301, MESYEG idplgarg=895099 migré gp1301, HANSE idplgarg=640790 natif gp1302) tous
  à 15h00-16h00 le même jour — triple réservation impossible pour un vrai formateur, c'est le
  symptôme même décrit par Eve. Volume total : 2649 créneaux natifs gp1302 + 470 migrés
  gp1301 désormais confondus sous un seul calendrier.
- **Stéphane R (probable REBOA) = code 175.** ~50/50 réel : 7675 créneaux natifs gp1302 +
  9835 migrés gp1301 — volumes comparables, cohérent avec quelqu'un qui travaille vraiment
  aux deux agences. Le merge est probablement correct *en principe*, mais personne n'avait
  anticipé qu'il n'existe aucun filtre d'affichage par agence une fois fusionné (cf. ci-dessous).
- **Pascale = code 358.** 3650 créneaux natifs gp1302 + seulement 65 migrés gp1301 — empreinte
  gp1301 faible, cohérente avec « ne travaille que sur 1302 » + un vieux reliquat (affectation
  historique ponctuelle ?) côté 1301 jamais nettoyé avant la fusion.

**Mécanisme confirmé sain, pas la cause** : `stg_elv.base`/`aSqlTiersBaseExt()`
(`Planning/data.php`+`sql/planning.sql.php`) — feature pré-existante pour stages inter-
agences, continue de résoudre correctement vers les bases d'origine non modifiées (vérifié
dans `FListeElevesPlg`). Le fallback `(Élève X de base Y):(???)` existe pour les cas
non résolus localement — pas rencontré de corruption dessus.

**Piste "deux bases vivantes qui divergent" ÉCARTÉE** : Christophe confirme gp1301 coupée le
01/11/2026, donc *avant* la fusion du 02/11 — gp1301 était déjà figée, aucune divergence
possible après coup. Les ex-utilisateurs de 1301 se connectent maintenant à gp1302 avec leurs
identifiants importés depuis gp1301 (confirmé par Christophe) : ils voient donc tout gp1302
sans filtre d'agence — même classe de défaut que l'incident remises bancaires du 01/09/2026
(filtrage par agence opt-in par requête, jamais automatique dans ce code). C'est cette
absence de filtre, combinée aux 3 fusions formateur ci-dessus, qui produit tout ce qu'Eve a
décrit.

**Critère technique pour distinguer natif/migré sur une fiche fusionnée** : `plg_arg.idplgarg
<= 641094` = natif gp1302 ; `>= 641096` = migré depuis gp1301 (décalage +641095, validé dans
le chantier du 02/11). Utilisable pour un script de scission ciblée si Christophe décide de
démériger TGD (quasi certain) et/ou Pascale/Stéphane (sa décision métier, pas la mienne —
il faut qu'il confirme si Pascale/Stéphane ont réellement eu une activité légitime sur
gp1301, ou si c'est un reliquat à ignorer).

**TGD démergé — EXÉCUTÉ EN PROD le 05/11/2026.** Décision Christophe : Stéphane R (175) pas
touché (vraie personne, chevauchements = mêmes absences notées dans les 2 bases + quelques
vraies doubles leçons plausibles, cf. détail plus bas) ; TGD oui (confirmé pas une personne).
Scripts dans `scripts-sql/GPLearn/OperationsPonctuelles/` : `Demerge_TGD_gp1302_20261104.sql`
(plg_ress/ress_evt — 447/580 lignes séparées vers un nouveau code archive, 634 en recette ET
en prod par coïncidence) puis `Import_hprod_TGD1_gp1301_vers_gp1302_20261104.sql` (hprod,
jamais importée par la fusion d'origine — importée séparément avec recodification produit
*LI/*EVA/*LML→LCI/EI/LCI, mapping repris du script de recodification gp1301 déjà écrit et
arbitré par Christophe, jamais exécuté en prod sur gp1301 lui-même). Les deux dépendent l'un
de l'autre dans cet ordre (le second retrouve le code archive par nom, jamais en dur).

⚠️ **Piège rencontré sur le script hprod** : vérifié 124 lignes le 04/11 sur la copie
**recette** de gp1301 — mais le script tournait pour de vrai sur la **prod**
(`mysql-adh.ecf-cerca.fr:3307`, différente de la recette `gp-mysql-rct.cerca-ecf.lan` où j'ai
fait toute l'investigation), qui en avait 149 le 05/11. Cause confirmée par Christophe : un
cron continue de calculer `hprod` sur gp1301 même après sa coupure aux utilisateurs — pas un
signe que gp1301 est encore « vivante » pour la saisie, juste un batch de calcul qui tourne
toujours. **Leçon : ne jamais figer en dur un comptage vérifié sur une copie recette dans un
script destiné à la prod** — recette et prod peuvent diverger même sur une base par ailleurs
figée. Le script corrigé lit le compte en direct à l'exécution (garde-fou utile = « rien déjà
importé côté cible », pas un nombre absolu) plutôt que d'exiger une valeur figée.

⚠️ **Rebelote le 05-06/11** : même après le 1er correctif (garde « 0 attendu » → juste
informatif), le **même cron a continué à écrire sous le code 634** pendant que
j'investiguais (22 lignes apparues entre deux tentatives, sans script lancé) — confirmé que
ce cron tourne aussi côté **gp1302** (pas seulement gp1301), probablement parce qu'il
recalcule `hprod` depuis le planning lui-même et a vu les 447 créneaux nouvellement basculés
sur 634. Deuxième correctif, plus robuste : import sélectif par `NOT EXISTS` sur la clé
naturelle déjà documentée pour cette table (date+produit+famille, pas de PK) — rend le script
idempotent, rejouable à l'infini même si le cron continue d'écrire en parallèle. **Exécuté
avec succès en prod le 06/11/2026 (3e tentative) : 131 lignes importées + 18 déjà couvertes
par le cron = 149 lues, cohérent ; total final 153 lignes sous le code 634 (22 cron + 131
import).** TGD est maintenant proprement démergé dans tous les sens (plg_ress, ress_evt,
hprod) — **ce volet de l'incident est clos.**

**Encore ouvert** :
1. Chiffres prospects/inscriptions B du 01-02/11 — pas encore localisé le bon écran/rapport
   dans le code (le fichier au nom évident, `Stats_ProspectsEtInscriptions.sql.php`, est du
   code mort, jamais inclus nulle part — pas la source réelle). Besoin du nom de l'écran ou
   de la pièce jointe d'Eve pour continuer.
2. Les ~140 « doublons formateurs potentiels par nom » jamais auto-fusionnés pourraient
   contenir d'autres ressources génériques comme TGD — repéré un autre candidat au passage :
   code 366/506 `*HM`, sans prénom, même profil que TGD (pas encore vérifié, pas demandé par
   Christophe à ce stade).
3. Le filtre d'agence manquant côté affichage planning (correctif structurel, dépasse ce cas
   précis) — pas encore traité.

**CLÔTURÉ par Christophe le 06/11/2026** (« consigne, je ferme ») : les 3 points ci-dessus
restent en **backlog sans échéance**, pas une tâche en cours — ne pas les reprendre de sa
propre initiative dans une session future, attendre qu'il relance explicitement (ex. « reprends
l'incident Eve » ou mention directe d'un des 3 sujets).

**Accès DB** : fonctionne depuis cette session en passant par l'IP directe. ⚠️ Deux serveurs
distincts, ne pas confondre : **recette** `gp-mysql-rct.cerca-ecf.lan` = `192.168.1.130` (là où
j'ai fait toute l'investigation et testé les scripts) vs **prod** `mysql-adh.ecf-cerca.fr:3307`
(où Christophe exécute pour de vrai via bddTools — jamais interrogée directement par moi).
Cf. [[feedback_handoff_when_env_lacks_capability]] pour le détail de l'accès.

---

**02/11/2026 — chantier déclaré TERMINÉ de bout en bout (statut désormais contesté, cf.
réouverture ci-dessus).** Fusion `Fusion_Complete_gp1301_gp1302.sql`
exécutée en prod (confirmée par log littéral malgré un 502 proxy pendant l'exécution — le
backend a continué puis terminé, `code=0`). Script post-fusion geo_meteo
(`Migration_ident_u_gp1301_gp1302_geo_meteo_20260921.sql`) exécuté en prod sur le serveur
geo_meteo à 10:34 : succès total, 0 résidu inattendu (`ident_u_rdv` 6811/6811, `ident_u_tiers`
1617/1617, `ident_u_bureau` 3/3, `ident_u_formateur` TGD+4 formateurs — tous migrés sans
collision). Détail complet dans `scripts-sql/GPLearn/CLAUDE.md` § Fusion gp1301→gp1302.

**Seul point ouvert, non bloquant** : `ident_u_produit` (`*LPP`, activité 6) — 1 ligne
volontairement laissée en base='gp1301' dans le cache geo_meteo, décision manuelle Christophe
à prendre (garder en trace inerte, ou basculer vers gp1302 au risque de créer une entrée
ID_TACHE redondante côté easysysteme). Documenté dans le script lui-même (bloc 4b).

**Point méthodologique à retenir pour une prochaine fusion similaire** : pour dériver un vrai
décalage post-fusion sur une table activement écrite en continu (ex. `plg_arg`/rdv), ne
jamais utiliser `MAX(cible) - MAX(source)` — faux si la base cible est en prod live (son
`MAX()` courant inclut de l'activité native postérieure à la fusion elle-même). Matcher des
lignes individuelles par contenu, ancré sur un décalage déjà validé sur une table plus stable
(ici `intervt`/formateurs, quasi inchangé sur quelques heures). Détail et requête exacte dans
`scripts-sql/GPLearn/CLAUDE.md` même section.

**~140 doublons formateurs "potentiels par nom"** (diagnostic Partie 4 de la fusion, jamais
auto-fusionnés) restent en attente d'arbitrage Christophe — même politique que
[[project_fusion_gp8801_gp8803]], non bloquant, aucune échéance connue.

**Why** : Christophe a demandé le 01/11/2026 à retrouver ce qui était préparé pour l'exécuter
en prod — même famille d'opérations que [[project_fusion_gp8801_gp8803]] (méthode éprouvée),
sens inversé (gp1301 dans gp1302) à cause d'easysysteme (gp1302 porte les credentials).

**How to apply** : ⚠️ ne plus traiter ce chantier comme clos — le statut « c'est acté » posé le
02/11 a été contredit par un signalement terrain concret le 04/11 (cf. réouverture en tête de
fichier). Reprendre à l'investigation de l'incident Eve avant de retraiter `*LPP`/6 ou les
doublons formateurs par nom (toujours ouverts, non liés à l'incident).
