---
name: project_fusion_gp1301_gp1302_geo_meteo
description: "Migration ident_u_* (base geo_meteo) gp1301→gp1302 exécutée en PRODUCTION le 2026-11-02 ; 1 décision manuelle en attente, script VALIDATION en échec non résolu"
metadata:
  node_type: memory
  type: project
  originSessionId: 36f4ad14-a281-4420-a671-48e544d2c076
  modified: 2026-11-02T10:49:23.885Z
---

Le 2026-11-02, la migration des tables de correspondance `ident_u_rdv`, `ident_u_tiers`,
`ident_u_bureau`, `ident_u_produit`, `ident_u_formateur` de la base `geo_meteo`
(host `mysql-prod.ecf-cerca.fr:3308`) a été exécutée en **production**, recodant les
références `gp1301` → `gp1302` (fichier
`geo_meteo/Operations_Ponctuelles/Migration_ident_u_gp1301_gp1302_geo_meteo_20260921.sql`,
introuvable dans le checkout `sources/scripts-sql/geo_meteo/` de ce conteneur au
02/11 — soit non synchronisé via Drive, soit supprimé après exécution). Ces tables
stockent un recodage `base` (ex. 'gp1301'/'gp1302') + identifiant local, pas une jointure
cross-base live — cf. le script générique `RecodificationAgencesCerca_ident_u.sql` du
même dossier (table temporaire `_ta_(bdd, age_o, age_d)` + `update ignore ... join`), qui
ne couvre que `ident_u_bureau` : le script du 20260921 est une variante dédiée gp1301→gp1302
étendue aux 5 tables, avec déduplication et un traitement spécifique "TGD" pour
ident_u_formateur.

Résultat conforme à tous les "attendu" imprimés par le script lui-même :
- `ident_u_rdv`, `ident_u_tiers`, `ident_u_bureau`, `ident_u_formateur` : 0 ligne gp1301
  restante.
- `ident_u_produit` : 1 ligne restante **volontairement** — id=336, code_produit=`*LPP`,
  activite=6 — signalée par le script comme nécessitant une décision manuelle (aucun
  mapping gp1302 équivalent trouvé automatiquement). Reste à trancher avec Christophe.

**Point ouvert, non résolu** : un script séparé `..._VALIDATION_20260921.sql`, lancé 1h10
avant (09:24:26, soit avant la migration à 10:34:09), a échoué immédiatement :
`ERROR 1049 (42000) Unknown database 'gp1302'` à sa ligne 43 — donc il référence la vraie
base schéma `gp1302` (pas seulement la colonne `base` de `geo_meteo.ident_u_*`),
introuvable sur ce host:port. N'a rien modifié (erreur avant toute écriture), mais n'a
donc jamais pu apporter de confirmation indépendante au-delà du bilan auto-imprimé par le
script de migration. Script introuvable ici, pas d'accès prod depuis ce conteneur pour
investiguer plus (pas de credentials pour `mysql-prod.ecf-cerca.fr:3308` dans ce
workspace — seuls ceux de recette `gp-mysql-rct.cerca-ecf.lan:3306` sont documentés dans
`sources/CLAUDE.md`) — à clarifier avec Christophe : bug du script, ou gp1302 hébergée sur
un autre host:port que mysql-prod:3308 ?

**Historique (hérité de l'ancienne mémoire `project_gplearn_fusion_gp1301_gp1302.md`,
perdue dans le wipe `/root/.claude` — cf. [[reference_memoire_emplacement_durable]], non
reverifié depuis)** : la fusion gp1301→gp1302 avait été faite et testée en recette, avec
renommage en `gp1302_tests`/`gp6202_tests`, et une anonymisation v2 (permutation) en cours
par quelqu'un d'autre à l'époque — ne pas supposer que c'est encore la v1.

**Why:** Cette exécution prod du 02/11 est le premier signal observé que la fusion
avance au-delà de la recette — mais ne couvre que ce sous-ensemble geo_meteo/ident_u_*,
pas forcément l'intégralité de la fusion (tables métier GPLearn elles-mêmes gp1301→gp1302,
état de l'anonymisation v2, etc. — statut inconnu, à vérifier avec Christophe avant de
supposer la fusion complète terminée).

**How to apply:** Ne pas relancer ce script (idempotence non vérifiée — à confirmer avant
toute relance, puisque le `update ignore ... join _ta_` du template n'est pas garanti
rejouable sans effet si déjà appliqué). Si la fusion complète gp1301→gp1302 revient en
conversation, vérifier l'état réel plutôt que de se fier à l'ancienne accroche "held for
tests before prod" — elle est maintenant partiellement obsolète.
