---
name: Mapping conceptuel inter-systèmes CERCA/ECF
description: Correspondances entre GPLearn, plgfpro/NEVEA et fplearn — pipeline de synchro, clef du MCD unifié
type: project
originSessionId: c839d15c-2c69-439c-87f6-00e81c69f3d4
---
Les trois systèmes représentent les mêmes entités métier avec des noms différents.
Ce mapping est la base du MCD unifié de la refonte.

**Why:** Sans ce mapping, on risque de créer des doublons ou de mal migrer les données.
**How to apply:** Utiliser ces correspondances pour toute question de modèle de données, migration, ou nommage d'entités dans le nouveau système.

---

## Pipeline de synchronisation actuel

```
NEVEA (maître FP — ERP régional externe)
  ↓ robot_import_nevea.php  (pull API REST NEVEA → plgfpro)
plgfpro (planning FP opérationnel)
  ↓ lien_crm/lien_crm.php  (pfp2crm_* functions)
fplearn (CRM — miroir + correspondances)
  ↓ lien_crm/robot_planning_plannifpro2gplearn.php
gplearn/gpfp (planning GP — plg_arg)
```

**NEVEA est le système maître** pour les données de formation professionnelle. Les actions y naissent et sont importées vers plgfpro, puis propagées vers fplearn, puis vers gplearn.

### Fonctions de synchronisation (lien_crm.php)

| Fonction | Source → Destination | Via table de correspondance |
|---|---|---|
| `pfp2crm_site` | plgfpro.sites → fplearn.sites_sit | `lien_site_externe_lsx` |
| `pfp2crm_activite` | plgfpro.activites → fplearn.catalogue_cat | `lien_catalogue_ext_lcx` |
| `pfp2crm_typeaction` | plgfpro.typeactions → fplearn.catalogue_cat | `lien_catalogue_ext_lcx` |
| `pfp2crm_action` | plgfpro.actions → fplearn.opportunite_opp | `lien_opportunite_externe_oex` (3 liens : PlanniFPro + NEVEA + Formagest) |
| `pfp2crm_typeress` | plgfpro.typeress → fplearn.ressource_type_rty | `lien_ressource_type_externe_rte` |
| `pfp2crm_ressource` | plgfpro.ressources → fplearn.ressource_res | `lien_ressource_externe_rxe` |
| `crm2gpl_action` | fplearn.opportunite_opp → gplearn.stage | `lien_opportunite_externe_oex` (gplearn/stage) |
| `crm2gpl_ressource` | fplearn.ressource_res → gplearn.intervt | `lien_ressource_externe_rxe` (gplearn/intervt) |

**Note importante :** dans GPLearn, les ressources FP sont dans la table `intervt` (intervenants), pas dans `age_ress`.

### robot_planning_plannifpro2gplearn.php

Synchronise les créneaux plgfpro.planning → gplearn.plg_arg :
- `plg_arg.idplgpart` = ID du créneau source plgfpro (clé de correspondance)
- `modules.produit_gplearn` = mapping module FP → code produit GPLearn (TH, PRAT, PC, Camp, WEBX...)
- Supprime et recrée les plg_arg correspondants à chaque modification

---

## Mapping entités

| Concept métier | GPLearn (bases gp*) | plgfpro / NEVEA | fplearn |
|---|---|---|---|
| Personne (apprenant) | `tiers` | fiche personne NEVEA | `personne_physique_pph` |
| Organisation | — | — | `personne_morale_pmo` |
| Session de formation | `stage` non ponctuel | `action` | `opportunite_opp` |
| Inscription | `stg_elv` | apprenant | `lien_opportunite_personne_lop` |
| Créneau simple | `stage` ponctuel + `plg_arg` | créneau `planning` | — |
| Ressource (formateur FP) | `intervt` (base gpfp) | `ressources` | `ressource_res` |
| Ressource (moniteur GP) | `age_ress` (via tiers) | — | — |
| Site | `sites_sit` | `sites` | `sites_sit` |
| Catalogue formation | `produits` + `type_stage` | `typeactions` + `activites` | `catalogue_cat` |
| Créneau planning (lien source) | `plg_arg.idplgpart` | `planning.idplg` | — |

---

## Points critiques

**stage ponctuel** = artifice technique GPLearn pour rattacher des élèves à un créneau `plg_arg` unique. À supprimer dans le nouveau modèle.

**fplearn.lien_*_ext** = tables pivot inter-systèmes. Deviennent inutiles dans le système unifié.

**fplearn.utilisateur_uti** (16 888 lignes) : base de contacts FP très riche. À fusionner dans `persons`.

**Fiche apprenant NEVEA** : 600+ champs de suivi de certifications professionnelles :
- Résultats CACES par catégorie (chariot, engins, PEMP, grues mobiles, grues auxiliaires, pont roulant)
- Habilitations électriques (B0V, BTA, H0V, HTA, BR, BC, H1V, H2V...) avec résultats par niveau
- FIMO/FCO/FCP avec numéros, dates, formateurs
- Permis tous types (A, A1, A2, B, B96, BE, C, C1, CE, D, D1, DE...)
- Dates médicales (cariste, engin, permis, PEMP, grues...)
- Qualifications transport (TP conducteur porteur/voyageur, CAP conduite...)
- C'est une fiche de traçabilité certifications extrêmement complète, sans équivalent dans GPLearn

---

## ERP externes

- **NEVEA** : ERP régional FP (maître). API REST : `https://ecf-cerca.nevea.fr/api/v1/...` avec `privateid` hardcodé (vulnérabilité). Endpoint apprenants : `/api/v1/vendor/ecf/cerca/apprenant/`
- **Formagest** : ERP externe. Données dans plgfpro.actions : `fgest_database`, `fgest_no_module`. Catalogue local : `code_lib_prod_fg`, `produit_activite_fg`

---

## Entités cibles du nouveau modèle

```
persons             ← tiers (×17 bases) + personne_physique_pph (157K) + fiche personne NEVEA
                       + utilisateur_uti (16 888)
organizations       ← personne_morale_pmo
certifications      ← données apprenant NEVEA (600+ champs → modèle structuré)
training_sessions   ← stage non ponctuel + action (77K) + opportunite_opp (141K)
enrollments         ← stg_elv + apprenant NEVEA + lien_opportunite_personne_lop (166K)
planning_slots      ← plg_arg (GP) + planning FP (384K)
resources           ← intervt/age_ress (GP) + ressources (FP, 1789)
```
