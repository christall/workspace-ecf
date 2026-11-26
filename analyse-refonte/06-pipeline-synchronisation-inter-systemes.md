# Pipeline de synchronisation inter-systèmes

## Vue d'ensemble

Le système actuel maintient la cohérence entre trois bases distinctes via un pipeline de robots PHP. **NEVEA est le système maître** pour les données de formation professionnelle.

```
NEVEA (ERP régional externe — maître FP)
  │  API REST : https://ecf-cerca.nevea.fr/api/v1/vendor/ecf/cerca/
  ↓
robot_import_nevea.php          → plgfpro (actions, planning, sites, typeactions)
  ↓
lien_crm/lien_crm.php           → fplearn (opportunites, catalogue, ressources)
  ↓
robot_planning_plannifpro2gplearn.php → gplearn/gpfp (plg_arg, stage, intervt)
```

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `PlanniFProWeb/serverside/lien_nevea/robot_import_nevea.inc.php` | Import NEVEA → plgfpro (actions, apprenants, sites, catalogue) |
| `PlanniFProWeb/serverside/lien_nevea/robot_import_nevea.php` | Robot planifié déclenchant l'import |
| `PlanniFProWeb/serverside/lien_nevea/majcaces_import_nevea_apprenants.php` | Mise à jour CACES depuis NEVEA |
| `PlanniFProWeb/serverside/lien_crm/lien_crm.php` | Fonctions de synchro plgfpro → fplearn |
| `PlanniFProWeb/serverside/lien_crm/robot_planning_plannifpro2gplearn.php` | Synchro planning plgfpro → gplearn.plg_arg |

---

## Fonctions de synchronisation (lien_crm.php)

Le fichier `lien_crm.php` expose 8 fonctions qui propagent les données de plgfpro vers fplearn puis vers gplearn :

```
pfp2crm_site(basePFP, idsite)
  plgfpro.sites → fplearn.sites_sit
  Correspondance : lien_site_externe_lsx (application='PlanniFPro' ou 'nevea')

pfp2crm_activite(basePFP, idactivite)
  plgfpro.activites → fplearn.catalogue_cat (entrée parent)
  Correspondance : lien_catalogue_ext_lcx

pfp2crm_typeaction(basePFP, idtypeaction)
  plgfpro.typeactions → fplearn.catalogue_cat (enfant de l'activité)
  Correspondance : lien_catalogue_ext_lcx (PlanniFPro + nevea)

pfp2crm_action(basePFP, idpfp)
  plgfpro.actions → fplearn.opportunite_opp
  Correspondance : lien_opportunite_externe_oex avec 3 liens simultanés :
    application='PlanniFPro', table='actions',             IDExterne=idaction_pfp
    application='nevea',      table='actions_de_formation', IDExterne=id_nevea
    application='Formagest',  table='modules',              IDExterne=fgest_no_module

pfp2crm_typeress(basePFP, idtpress)
  plgfpro.typeress → fplearn.ressource_type_rty
  Correspondance : lien_ressource_type_externe_rte

pfp2crm_ressource(basePFP, idress, crm_res_idtype)
  plgfpro.ressources → fplearn.ressource_res
  Correspondance : lien_ressource_externe_rxe

crm2gpl_action(basePFP, baseCrm, baseGPL, idOpportunite)
  fplearn.opportunite_opp → gplearn.stage (non ponctuel)
  + création type_stage si inexistant
  Correspondance : lien_opportunite_externe_oex (application='gplearn', table='stage')

crm2gpl_ressource(baseCrm, baseGPL, idress_crm)
  fplearn.ressource_res → gplearn.intervt  ← NB: c'est "intervt", pas "age_ress"
  Correspondance : lien_ressource_externe_rxe (application='gplearn', table='intervt')
```

---

## robot_planning_plannifpro2gplearn.php

Déclenché périodiquement, ce robot réplique les créneaux FP dans GPLearn :

1. Lit les créneaux `plgfpro.planning` modifiés depuis `pfp2gp_last_lecture_planning_dt`
2. Pour chaque créneau :
   - Synchronise le site, le type d'action, l'action → fplearn
   - Crée/met à jour le `stage` dans gplearn via fplearn
   - Synchronise les ressources (formateurs/engins) → gplearn.intervt
   - Appelle `FAddJourHorairesPrn(idplg)` pour calculer les journées détaillées
   - Supprime et recrée les `plg_arg` correspondants dans gplearn
3. Utilise `plg_arg.idplgpart` = ID plgfpro comme clé de correspondance
4. Mappe `modules.produit_gplearn` → `plg_arg.produit` (TH, PRAT, PC, Camp, WEBX...)

---

## Mapping modules FP → produits GPLearn

La table `plgfpro.modules.produit_gplearn` fait le lien :

| Nom module (convention) | Code produit GPLearn |
|---|---|
| `%theo%dist%` (théorie à distance) | `WEBX` |
| `%theo%` (théorie présentiel) | `TH` |
| `%prat%` (pratique) | `PRAT` |
| `%test%` ou `%exam%` (évaluation) | `PC` |
| `%voyag%` (déplacement/voyage) | `Camp` |

---

## Fiche apprenant NEVEA — 600+ champs

La fiche apprenant dans NEVEA est un modèle de **traçabilité de certifications professionnelles** sans équivalent dans GPLearn. Catégories principales :

| Domaine | Nb champs | Contenu |
|---|---|---|
| Identité / Contact | ~15 | Nom, prénom, civilité, naissance, adresse, email, société |
| Permis de conduire | ~30 | A, A1, A2, B, B96, BE, C, C1, CE, D, D1, DE + dates médicales + préfecture |
| CACES Chariots (cat 1-6) | ~25 | Passage/résultat/date/testeur + heures + rattrapage |
| CACES Engins de chantier (cat 1-10) | ~35 | Idem + telecom par catégorie |
| CACES PEMP (1A/1B/2A/2B/3A/3B) | ~20 | Passage/résultat/date/testeur + heures |
| CACES Grues auxiliaires (G1A→G2C) | ~15 | Passage/résultat/date/testeur |
| CACES Grues mobiles (Gmacab/Gmasol/Gmecab/Gmesol) | ~15 | Passage/résultat/date/testeur |
| CACES Pont roulant | ~10 | Commande sol/cabine, avec/sans fil |
| Habilitations électriques | ~30 | B0V/BTA/H0V/HTA + niveaux superviseur/ouvrierBT/ouvrierHT |
| FIMO/FCO/FCP | ~15 | Num, date, formateur, validité, type |
| Qualifications transport | ~20 | TP conducteur porteur/voyageur, CAP conduite, SST |
| Suivi parcours/insertion | ~30 | Devenir 0/3/6/9/12 mois, statut, rémunération, sortie |

**Implication MCD :** modéliser une entité `person_certifications` avec un modèle structuré par type (CACES, habilitation, permis, qualification), plutôt que 600 colonnes dans `persons`.

---

## Paramètres de synchronisation

Dans `plgfpro.parametres` :

| Clé | Valeur |
|---|---|
| `nevea_last_synchro_date_time` | Timestamp dernière synchro actions NEVEA |
| `nevea_last_action_lit_apprenants_dt` | Dernière lecture apprenants NEVEA |
| `pfp2gp_last_lecture_planning_dt` | Dernier export planning → gplearn |
| `nevea_last_synchro_id` | Dernier ID NEVEA traité |
| `base_crm` | Nom de la base fplearn (ex: `fplearn`) |
| `base_gpfp` | Nom de la base gplearn FP (ex: `gpfp`) |

---

## Vulnérabilités dans la couche de synchro

1. **`privateid` NEVEA hardcodé** dans `eleves.php` — clé API en clair dans le source
2. **Credentials NEVEA** (`c.alleon:C@ll&onN2v2a`) hardcodés dans `robot_import_nevea.inc.php`
3. Toutes les fonctions `pfp2crm_*` et `crm2gpl_*` utilisent `mysql_*` dépréciées et construisent les requêtes par concaténation de chaînes (injection SQL possible)

---

## Ce que cela implique pour la refonte

Dans le nouveau système unifié :
- **La synchronisation inter-bases disparaît** — tout est dans une seule base PostgreSQL
- **NEVEA reste externe et maître FP** tant qu'il n'est pas remplacé — une couche d'import active est nécessaire (webhook ou polling), pas seulement pour la migration
- **Formagest reste une intégration active** — le système envoie des données vers Formagest (portail e-commerce national) ; `fgest_no_module` et `fgest_database` doivent être conservés comme références permanentes
- **Les tables `lien_*_ext`** en tant que tables pivot multi-systèmes disparaissent, **mais** les IDs externes sont conservés comme colonnes dans les entités (`ext_nevea_ref`, `ext_fgest_*`) et une table `external_sync_state` trace l'état de synchronisation par système
- **La fiche apprenant NEVEA** nécessite une entité `person_certifications` structurée
- **Le mapping modules → produits** (`produit_gplearn`) doit être repensé dans le catalogue unifié
