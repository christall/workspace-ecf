---
name: Modèle planning FP — plgfpro
description: Architecture détaillée du planning formation professionnelle (base plgfpro / PlanniFProWeb) — radicalement différent du planning GP
type: project
originSessionId: c839d15c-2c69-439c-87f6-00e81c69f3d4
---
Le planning FP (plgfpro) est structurellement différent du planning GP (plg_arg).
C'est le point de complexité majeur de l'unification.

**Why:** Sans comprendre cette différence, on risque de sous-estimer la complexité du module planning FP ou de mal concevoir le MCD unifié.
**How to apply:** Quand on parle de planning dans le contexte FP, toujours penser hiérarchie 5 niveaux + compétences. Quand on parle de planning GP, penser créneau simple.

## Hiérarchie planning FP

```
activites (69)
  — Catégories : CACES, Habilitations électriques, Conduite pro, Sécurité...
  └── typeactions (431)
        — Ex: CACES R482 cat. A, Habilitation BS, Perfectionnement conduite
        └── actions (77 289 en base)
              — Session concrète : "CACES R482 - Lyon - 15/06 au 20/06"
              — Champs clés : nom, debut, fin, idsite, idtpaction, nb_places,
                              famille, code_produit, fgest_no_module,
                              date_om (ordre de mission), date_bc (bon de commande)
              └── planning (384 222 créneaux)
                    — Créneau : idplg, idaction, idmodule, date_debut, date_fin, hdeb, hfin, qte
                    — plg_jours (84 528) : horaires journaliers détaillés
                    └── modules (324)
                          — Briques pédago : Théorie, Pratique engin, Évaluation...
                          — heures, heures_jours, coeff_temps_travail
                          — produit_gplearn : lien vers produit dans GPLearn
```

## Ressources et compétences

```
ressources (1 789 : formateurs + véhicules + machines + simulateurs)
  — typeress (24 types) : Formateur, Engin CACES, Simulateur, Véhicule...
  — vacataire, interimaire : flags pour contrats spéciaux
  └── competence_ress (46 197)
        — idress + idmodule + priorité + date validité
        — Un formateur peut animer tel module jusqu'à telle date
  └── suivi_competence_ressource (12)
        — suivi des habilitations formateurs (avec référentiel_suivi)
  └── disp_horaires (2 433) + dispo_dates (407) : disponibilités

plg_ress (659 406) : affectation ressource → créneau planning
besoin_competence (615 388) : compétence requise pour chaque créneau
  — La vue "ressources compétentes" = intersection competence_ress ∩ besoin_competence
```

## Saisie des heures

```
heures_trav (917 000) : heures saisies par ressource/créneau
justif_heures (618 288) : justifications détaillées
vheures_trav_synthese (vue) : synthèse par ressource/module
vheures_trav_jour_module (vue) : détail journalier
```

## Modèles de planning (gabarits)

```
modeles_plg (56) : modèles de planning réutilisables
modeles_plg_plg (763) : créneaux dans les modèles
modele_plg_besoin_comp (41 403) : besoins compétences dans les modèles
```

## Parcours récurrents (rdrd/udrd)

```
rdrd_planning (5 077) : planning de parcours récurrents (rdrd = ?)
rdrd_plg_ress, rdrd_plg_jours, rdrd_besoin_competence
udrd_planning (4 156) : planning udrd
udrd_plg_ress, udrd_plg_jours, udrd_besoin_competence, udrd_idtransac
```
Ces tables semblent gérer des formations récurrentes ou des parcours multi-sessions.

## Intégrations externes dans plgfpro

- **NEVEA** : `pfp_nevea_action` (52K), `pfp_nevea_catalogue` (365), `pfp_nevea_site` (50)
  → Synchronisation des actions avec la plateforme régionale
- **Formagest** : `code_lib_prod_fg` (175 codes produits), `produit_activite_fg` (685),
  `fg_codes_activites_locaux`, `fg_modules`
  → Actions importées depuis Formagest (`fgest_import`, `fgest_database`)
- **Argan** : `famille_argan` sur modules et typeactions (codes famille pour le portail réseau)

## Différence clé avec planning GP

| Aspect | Planning GP (plg_arg) | Planning FP (plgfpro) |
|---|---|---|
| Créneau = | Leçon de conduite ponctuelle | Journée d'une action sur un module |
| Durée | Quelques heures | Peut durer des semaines (multi-créneaux) |
| Rattachement | Produit + ressource + élèves | Module d'une action + ressources habilitées |
| Compétences | Non (n'importe quel moniteur) | Oui (habilitation requise avec validité) |
| Facturation | Ligne de facture directe | Via conventions/financeurs |
| Stagiaires | Via stage + stg_elv | Via repartition_stgr_ress_plg |
