---
name: gplearn_audit_auth_ad_2311
description: "Audit auth GPLearn 23/11/2026 — correctif ldap_bind vide appliqué (EtatEcartsTTCSage.php, non commité) ; étude guillaume.magne ; faille sérieuse trouvée en chemin (dts_gu sans contrôle de droit serveur)"
metadata:
  node_type: memory
  type: project
  originSessionId: fe9e60f6-4f39-4149-848f-a03258333e28
  modified: 2026-11-23T08:54:48.238Z
---

**Déclencheur** : question de Christophe « existe-t-il un mot de passe joker AD ? » puis
« étudie les droits AD de guillaume.magne ».

**Correctif appliqué** (`sources/GPLearn/Traitements/EtatEcartsTTCSage.php`, pas commité) :
ajout de la vérification `PHP_AUTH_PW !== ''` avant le bind LDAP — `login.php` et
`ConsultationGroupesAD.php` avaient déjà ce garde, ce fichier non. Risque : un Basic Auth
`login:` (mot de passe vide) peut déclencher un "unauthenticated bind" LDAP accepté sans
vérification par de nombreux AD. Non testé en conditions réelles (pas de credentials AD).

**guillaume.magne** : compte `guillaume.magne` présent dans 19/24 bases gp* de recette (profil
transverse). Méthode : pas d'accès LDAP direct (pas de credentials AD) → inférence via les
lignes `gus_user` existantes, qui ne peuvent exister QUE si un groupe AD du même nom a matché
lors d'une connexion passée (`aSqlLogin()` fait `insert ignore ... where nom='$groupe'`).
Trouvé : groupe "GP_Support" (droit 64 SuperAdmin + 63 CNIL, 96 droits) dans 6 bases
(gp1302_tests, gp1331, gp1332, gp3101, gp8801, + "Administrateur" avec 64 dans gpfp/gpfp_bis) ;
groupe "GP_<agence>_ACF" (88 droits, PAS de 64 mais CNIL 63 + réimputer 31/32 + droits 1000/1001
"Groupe utilisateurs/Utilisateurs (modifier)") dans 12 bases (1620,1702,3701,4101,4104,4401,
4901/03/04/09,7901/25/29).
⚠️ **Limite importante** : `aSqlLogin()` ne fait QUE des `insert ignore` dans `gus_user`,
JAMAIS de DELETE — un retrait du groupe AD ne retire PAS l'accès GPLearn correspondant
(accumulation permanente, pas un miroir fidèle de l'AD actuel). Seule une suppression manuelle
de la ligne `gus_user` en base révoque réellement. Christophe peut vérifier le memberof AD
RÉEL actuel de guillaume.magne (lui a l'accès AD) pour savoir si ces groupes sont encore actifs
ou un résidu historique.

**Faille trouvée en chemin, CORRIGÉE le 23/11/2026 (non déployée)** :
`php/data.php::TraiteLaRequete()` exécute n'importe quel `*.sql.php` désigné par
`$_REQUEST["sql"]` avec seulement `PrepareSession()` (authentification), aucun contrôle de
droit serveur. `ALeDroit()` n'existe QUE côté JS. 2 fichiers sur 176 ont un garde serveur
(`FUserALeDroit`) sur `dts_user` — il manquait sur `dts_gu`
(`BackOffice/sql/enregistrer1g_user_dts.sql.php`, aucune vérification) : tout titulaire du
droit 1000 (donc tout groupe "ACF") pouvait s'auto-attribuer le 64 SuperAdmin via une requête
HTTP directe sur son propre groupe.
**Corrections appliquées le 23/11** (décision Christophe « corrige les failles que tu as
repérées ») : (1) `enregistrer1g_user_dts.sql.php` — DELETE + INSERT conditionnés par
`FUserALeDroit(@iduser, 1000 or 64 / iddroit or 64)` ; `@iduser` posé côté serveur par
`PrepareSession()`→`aSqlSessionOk_user_base` sur la connexion poolée de la base (vérifié que
`dataRenderData()` réutilise la même connexion) ; testé en transaction annulée sur gp3301
(SuperAdmin OK, inconnu 0/0, rollback propre). (2) anti-injection : CSV `droits` filtré
preg_replace — était injectable — et mêmes filtres sur `aiddroits_forces/retires` de
`enregistre_droits_1user.sql.php`. (3) `last_insert_id()` après INSERT conditionnel remplacé
par re-lecture depuis la table dans `BackOffice/enreg_sig_ress.php` (écrasait potentiellement
un AUTRE document par l'image de signature) et `BackOffice/sql/sauve_dispo_planning.sql.php`
(`max(iddispo_dates)`) ; `Eleves/sql/charger1tiers.sql.php` vérifié SAIN, laissé tel quel.
Reste ouvert : les ~174 autres `*.sql.php` sans contrôle de droit serveur (problème de fond
non réglé) + `error_log($Lad)` de `aSqlLogin()` (fuite d'attributs AD dans les logs) à retirer
sur php8.5_corrigée/ECT-435 — login.sql.php du worktree est l'ancienne version.
TOUT est non committé (worktree sur fix-historique-filtre-iduser) — à committer sur
php8.5_corrigée + ECT-435 comme les correctifs du 20/11.

**JOKER SUPPORT implémenté le 23/11/2026** (demande Christophe : « le mot de passe joker du
compte support doit ouvrir n'importe quel compte AD ») : modification de la procédure `PLogin_`
(par base) — condition OU sur le mot de passe du compte local `support`. Déployé sur les 25
bases gp* de la recette (script `scripts-sql/GPLearn/OperationsPonctuelles/joker_support_PLogin_.sh`,
garde MD5, testé 5 scénarios sur gp3301 avec comptes temporaires). PROD à appliquer par
Christophe. Comportement : le joker ouvre tout compte EXISTANT (y compris SuperAdmin), sans
trace d'audit, ne crée pas les comptes inexistants, inerte dans les bases sans compte support,
rotation = changer le mdp du compte support.

**Why** : l'investigation du "mot de passe joker" a mené à vérifier toute la chaîne
auth → autorisation, révélant une incohérence de contrôle d'accès bien plus sérieuse que la
question initiale.

**How to apply** : reste côté Christophe — (1) committer+déployer les correctifs ci-dessus ;
(2) vérifier le memberof AD réel de guillaume.magne (script CLI fourni :
`Traitements/ConsultationGroupesAD_cli.php`) ; (3) décider quoi faire des 174 autres
`*.sql.php` sans garde serveur ; (4) dédoublonner `user` en prod (cf. mémoire aSqlLogin).
