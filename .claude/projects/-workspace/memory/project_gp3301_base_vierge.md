---
name: gp3301_base_vierge
description: Base de travail vierge gp3301 (Bordeaux) créée sur la recette le 19/11/2026 depuis gp3101 — structure+backoffice sans tarifs/modèles/ressources/utilisateurs/banques ; choix par défaut en attente de validation Christophe
metadata:
  node_type: memory
  type: project
  originSessionId: fe9e60f6-4f39-4149-848f-a03258333e28
  modified: 2026-11-20T09:13:55.548Z
---

**Base gp3301 créée sur la recette le 19/11/2026** à partir de gp3101 (ECF SUD-OUEST,
restaurée en copie prod complète sur `gp-mysql-rct`/192.168.1.130 le même jour).
Contenu : structure complète (329 tables / 28 vues / 157 triggers / 386 routines),
agence unique '3301' Bordeaux, 69 produits sans prix (agence forcée 3301), 30 tables
référentielles copiées (familles/filières/permis/type_stage/megabase/options filtrées/
**droits 98 + groupe_droits 19 + type_grp_u 3**…),
toutes les données de production à zéro. Script autoportant :
`sources/scripts-sql/GPLearn/OperationsPonctuelles/clone_gp3101_vers_gp3301.sh`
(détail complet + pièges dans `sources/scripts-sql/GPLearn/CLAUDE.md` § gp3301).

**Groupes/droits** (état corrigé le 19/11/2026, après question de Christophe) : le catalogue
`droits` + l'arbre `groupe_droits` + `type_grp_u` sont COPIÉS (référentiels backoffice chargés
par params.php) ; `user`, `dts_user`, `gus_user`, `abo_etat_gu` restent VIDES
(affectations/utilisateurs). Leçon : catalogue ≠ affectations.

**Groupes génériques créés le 19/11/2026** (script `OperationsPonctuelles/groupes_generiques_gp3301.sh`)
après proposition validée par Christophe : 5 groupes — `Bordeaux` (Agence, agences='3301',
droits {2111,2211}), `Responsable` (92, copie gp3101 id 2), `Secrétaire` (48, copie id 47),
`Moniteur` (22, profil RESSERRÉ option b : droits du Moniteur gp3101 sans les 25 droits
« (modifier) » backoffice pollués), `GP_Support` (96, copie id 50 — inclut SuperAdmin 64 +
CNIL 63, à réserver à Christophe). Optionnels écartés : « Secrétaire (limité) » (son contenu
réel ne colle pas à son nom) et groupe Planning. Droits effectifs = union groupes abonnés +
dts_user, avec `min(attribue)` → dts_user attribue=0 retire un droit de groupe.

**Authentification (vérifié 20/11/2026)** : LDAP configuré (ldap_url/ldap_domain copiés) mais
**aucun login n'était possible** — la table `dossier` n'avait pas été copiée et sert de source
à l'INSERT d'auto-création de l'utilisateur AD. Corrigé le 20/11 (`dossier_gp3301.sh`, secrets
laissés NULL). Restent deux limites **côté Christophe** : les noms des 5 groupes créés ne
matchent aucun groupe AD réel (mapping par égalité stricte `g_user.nom` = nom du groupe AD), et
`ldap_sort()` (supprimée en PHP 8) est toujours sur origin/recette+production. Détail dans
`sources/scripts-sql/GPLearn/CLAUDE.md` § gp3301.

**Choix par défaut posés, à faire valider par Christophe** : code agence '3301' ; nom
registre bases_serveurs « ECF BORDEAUX (base vierge) » ; `id_codes_planning` et
`docx_modele_agence` vides (liées aux agences 31xx) ; AUCUN utilisateur créé (ni local ni
gpcontrolserveurs) mais options LDAP conservées → login AD possible ; rien dans `ecom_sites`.

**Procédure réutilisable** (écrite le 20/11/2026) : `sources/scripts-sql/GPLearn/METHODE-BASE-VIERGE.md`
— méthode généralisée pour créer une base vierge depuis n'importe quelle source (principe
« cloner vide puis réinjecter », tri référentiel/donnée/secret, 8 étapes, checklist, pièges).

**Why** : demande du 19/11/2026 — base de travail vierge « gp3301 » pour repartir d'un
backoffice propre (produits sans prix, référentiels conservés) sans aucune donnée de prod.

**How to apply** : prochaine étape côté Christophe = test applicatif (routage
`?base=gp3301`, création éventuelle d'un utilisateur). Si une donnée référentielle manque
à l'usage (ex. codes planning), c'est un choix assumé de départ vierge, pas une perte —
tout reste disponible dans gp3101 pour un rechargement ciblé. Rejouer le script avec
`--force` recrée la base depuis gp3101 (attention : écrase gp3301).
