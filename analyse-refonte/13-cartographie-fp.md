# Cartographie bases FormaPro — plgfpro + fplearn

> Version 1.0 — 2026-06-01
> Exploration directe des bases MySQL ECF CERCA

---

## Décision architecturale validée

**Un seul contexte ERP** — pas de séparation "auto-école" / "formation pro".
L'**activité** est le seul discriminant métier (Permis B, CACES R482, Habilitation électrique…).
Cette décision est cohérente avec le MCD v0.8 (doc 07) qui unifiait déjà GP et FP.

---

## Architecture réelle du pont GP ↔ FP

```
plgfpro (planning FP natif)
    ↓  robots PHP : lien_crm/robot_planning_plannifpro2gplearn.php
    ↓              lien_crm/lien_crm.php (pfp2crm_action, pfp2crm_ressource…)
gpfp  ← BASE CENTRALE : même schéma que gp1702 (plg_arg, plg_ress, stg_elv, tiers, stage, factures…)
    ↑
fplearn (CRM FP) ← mémorise les IDs de TOUTES les bases dans ses tables lien_*_ext
```

### Tables lien_*_ext de fplearn — registre universel d'identifiants

`fplearn` est le **registre cross-système** : chaque entité dans une base externe est identifiée par `(application, base_de_donnees, table, IDExterne)`.

| Table fplearn | Lignes | Ce qu'elle relie |
|---|---|---|
| `lien_personne_physique_externe_pex` | 190k | stagiaire fplearn ↔ nevea (105k), gpfp.tiers (30k), ArganClient.tiers (55k+) |
| `lien_opportunite_externe_oex` | 242k | opportunité fplearn ↔ nevea (51k), plgfpro.actions (51k), Formagest (37k), gpfp.stage (15k) |
| `lien_catalogue_ext_lcx` | 1k | catalogue fplearn ↔ plgfpro.activites, plgfpro.typeactions, nevea |
| `lien_ressource_externe_rxe` | 1k | ressource fplearn ↔ plgfpro.ressources |
| `lien_site_externe_lsx` | 70 | site fplearn ↔ plgfpro.sites, nevea |

### `gpfp` — la base de synchronisation

`gpfp` utilise **exactement le même schéma que gp1702** (GPLearn). C'est la copie FP en format GP :

| Table gpfp | Lignes | Équivalent gp1702 |
|---|---|---|
| `plg_arg` | 138k (35k en 2026) | `plg_arg` (créneaux planning) |
| `plg_ress` | 177k | `plg_ress` (ressources par créneau) |
| `plg_stg` | 138k | `plg_stg` (stages par créneau) |
| `stg_elv` | 61k (633 actifs 2026) | `stg_elv` (stagiaires par stage) |
| `tiers` | 32k | `tiers` (stagiaires FP) |
| `stage` | 15k | `stage` (sessions de formation) |
| `factures` | 9k | `factures` |
| `type_stage` | (même structure) | `type_stage` |

**Conséquence pour l'import ERP** : le script `import-gplearn.ts` existant peut importer `gpfp` **avec les mêmes requêtes** que `gp1702`. La distinction GP/FP vient des données `type_stage` (CACES R489, Permis C, FCO…) vs permis grand public.

### ArganClient — autres bases GP du réseau

`fplearn.lien_personne_physique_externe_pex` référence aussi des bases `acXXXX` (ArganClient) :
`ac8620`, `ac1620`, `ac4101`, `ac8704`, `ac1706`, `ac7901`… — ce sont d'autres centres GP du réseau CERCA avec leurs propres bases.

---

## Vue d'ensemble des bases sources

| Base | Rôle | Tables | Lignes totales estimées |
|---|---|---|---|
| `gp1702` | Auto-école grand public La Rochelle | ~80 | ~3 M |
| `plgfpro` | Planning & pédagogie FP (réseau CERCA) | 128 | ~3,4 M |
| `fplearn` | CRM stagiaires & opportunités FP | 100 | ~1,1 M |

Les bases `gp1301`, `gp1302`… etc. = autres centres auto-école du réseau (même schéma que gp1702).

---

## Base `plgfpro` — Planning & Pédagogie FP

### Volumes clés

| Table | Lignes | Équivalent ERP unifié |
|---|---|---|
| `heures_trav` | 917 000 | `heures_travail` |
| `plg_ress` | 652 989 | `ressources_creneaux` |
| `besoin_competence` | 615 388 | `besoins_creneaux` |
| `justif_heures` | 617 384 | sous-table `heures_travail` |
| `planning` | 384 081 | `creneaux_planning` |
| `actions` | 78 628 | `sessions_formation` |
| `plg_jours` | 84 528 | `creneaux_horaires_jour` |
| `ressources` | 1 789 | `ressources` (formateurs + véhicules + salles) |
| `modules` | 324 | `modules` (catalogue) |
| `activites` | 69 | `activites` (discriminant métier) |
| `typeactions` | 431 | `types_actions` |
| `competence` | 17 | `competences` |
| `sites` | 53 | `sites` |
| `statuts` | 5 | enum sur `creneaux_planning` |

### Entités principales

#### `activites` (69) → `activites` ERP
Le discriminant métier principal. Exemples :
- CACES (R482 cat A/B/C, R489 cat 1/3/5…)
- Habilitations électriques (BS, BE, B2…)
- Conduite pro (FCOS, FCO marchandises, FCO voyageurs…)
- Permis auto-école (B, A, AM, C, D…) → même table que GP
- AIPR, BEPECASER, 3CTACA, SST…

```
activites.idactivite → activites.id
activites.libelle_court → activites.code
activites.libelle_long → activites.nom
```

#### `actions` (78 628) → `sessions_formation` ERP
Une action = une session de formation planifiée (ex : "CACES R482 cat A — site Nantes — 15/06→20/06").

```
actions.idaction → sessions_formation.id_source_plgfpro
actions.nom → sessions_formation.titre
actions.debut/fin → sessions_formation.date_debut/fin
actions.idsite → sessions_formation.site_id
actions.nb_places → sessions_formation.nb_places
actions.famille → sessions_formation.famille (T/S/L…)
actions.code_produit → sessions_formation.code_produit_gp (lien GP)
actions.idtpaction → types_actions (catalogue)
```

#### `planning` (384 081) + `plg_jours` (84 528) → `creneaux_planning` ERP
Hiérarchie FP :
```
activite → typeaction → action → planning (créneau module) → plg_jours (récurrences journalières)
```
- `planning` = un créneau (module × site × action, avec hdeb/hfin)
- `plg_jours` = découpage hebdomadaire avec récurrences ("toutes les sem", "1 sem/2"…)
- Clé : `planning.idplg` ← `plg_ress.idplg` et `plg_jours.idplg`

#### `ressources` (1 789) → `ressources` ERP
Partagé avec GP (moniteurs = formateurs). Types :
- Formateurs (idtpress=1)
- Salles (3), Autocar (4), Porteurs (5), Articulés (6)
- Engins CACES (7), Chariots (8), PEMP (9), Camion-grue (10)
- Pistes (11), Aires CACES (12), Jury d'examen (17)
- Simulateurs (inclus), véhicules auto-école (16)

```sql
typeress : {1=Formateurs, 3=Salles, 4-13=Véhicules/Engins, 15=Outils pédago, 17=Jury}
```

#### `modules` (324) → `modules` ERP
Briques pédagogiques réutilisables : Théorie PL présentielle, Plateau Permis C, Évaluation pratique…
Champ `produit_gplearn` (varchar 4) = lien vers code produit GP (`TH`, `PRAT`, `LCC`…) → **pont GP↔FP naturel**.

#### `competence` + `competence_ress` → `competences` + `competences_ressources`
17 compétences définies. `competence_ress` (46 197 lignes) = certifications formateur avec date de validité.

---

## Base `fplearn` — CRM Apprenants & Opportunités

### Volumes clés

| Table | Lignes | Équivalent ERP unifié |
|---|---|---|
| `lien_opportunite_externe_oex` | 244 101 | lien FP↔plgfpro |
| `data_lien_opportunite_personne_dlop` | 244 400 | données additionnelles inscriptions |
| `lien_opportunite_personnes_lop` | 185 093 | `inscriptions` |
| `personne_physique_pph` | 161 076 | `personnes` |
| `opportunite_opp` | 141 080 | `sessions_formation` (côté commercial) |
| `utilisateur_uti` | 16 888 | `utilisateurs` |
| `catalogue_pedago_cpg` | 4 257 | `modules` (catalogue pédago) |
| `personne_morale_pmo` | 51 | `organisations` |
| `rdv_rdv` | 1 780 | `interactions_crm` |

### Entités principales

#### `personne_physique_pph` (161 076) → `personnes` ERP
Stagiaires FP. Même table que les élèves GP dans l'ERP unifié. Champs :
```
pph_IDpersonne_physique → personnes.id_source_fplearn
pph_nom, pph_prenom, pph_email, pph_telephone_mobile
pph_date_naissance, pph_code_postal, pph_ville
pph_json_data → données extensibles (champs métier variables)
```

#### `opportunite_opp` (141 080) → complète `sessions_formation`
Côté commercial d'une session : désignation, montant, statut/étape, dates.
Liée à `plgfpro.actions` via `lien_opportunite_externe_oex` :
```
opportunite_opp.opp_IDopportunite
  → lien_opportunite_externe_oex (oex_application='plgfpro', oex_table='actions')
  → plgfpro.actions.idaction
```

#### `lien_opportunite_personnes_lop` (185 093) → `inscriptions` ERP
Stagiaire inscrit à une opportunité (= session FP).
```
lop_IDlien → inscriptions.id_source_fplearn
lop_IDopportunite → inscriptions.session_id
lop_IDpersonne_physique → inscriptions.personne_id
lop_IDpersonne_morale → inscriptions.organisation_id (employeur)
lop_nature_lien = 21 → type_inscription = 'stagiaire'
```

#### `personne_morale_pmo` (51) → `organisations` ERP
Entreprises clientes et financeurs. Champs standards (dénomination, email, téléphone, adresse).

---

## Pont GP ↔ FP — correspondances clés

| Concept | GP (gp1702) | FP (plgfpro/fplearn) | ERP unifié |
|---|---|---|---|
| **Apprenant** | `tiers` (44k) | `personne_physique_pph` (161k) | `personnes` |
| **Session** | `stage` (1M, dénormalisé) | `actions` (79k) | `sessions_formation` |
| **Créneau** | `plg_arg` | `planning` + `plg_jours` | `creneaux_planning` |
| **Inscription** | `stg_elv` | `lien_opportunite_personnes_lop` | `inscriptions` |
| **Ressource** | `intervt` (moniteurs) | `ressources` (types variés) | `ressources` |
| **Activité** | filière (permis B, AM…) | `activites` (CACES, hab…) | `activites` ← **discriminant unique** |
| **Contrat/Facture** | `factures` | `opportunite_opp` (montant) | `contrats` + `factures` |

---

## Spécificités FP absentes du GP

### Conventions de formation (gestion contractuelle)
Dans `gp1702` : tables `conventions`, `convention_formations`, `conv_fin`, `conv_tiers` (vides ou partielles).
À modéliser dans l'ERP :
- **Convention** : type (contrat de formation, convention simplifiée, lettre de commande…), financeur, montant
- **Financeurs** : OPCO, France Travail, CPF, employeur direct
- **Multi-financement** : une convention peut avoir plusieurs financeurs partiels

### Compétences formateurs avec dates de validité
`competence_ress` (46 197 lignes) — crucial pour la planification FP :
- Un formateur ne peut animer un module que s'il a la compétence requise et qu'elle est valide
- `besoin_competence` (615k) = par module, quels types de ressources et combien
- Règle d'affectation automatique : `plg_ress` déduit des `besoin_competence` filtrés par `competence_ress` valides

### Modules pédagogiques réutilisables
`modules` (324) avec `produit_gplearn` → pont direct vers les codes produits GP.
Un créneau FP = module × action × site × horaires (plus structuré qu'un créneau GP).

### Répartition stagiaires/formateurs
`repartition_stgr_ress_plg` (611 lignes actifs) — affectation d'un stagiaire à un formateur spécifique sur un créneau. Clé de jointure : `(idplg, idress, idlop)`.

---

## Impact sur le MCD unifié (doc 07)

Le MCD v0.8 est **compatible** avec ces données. Points à consolider :

1. **`activites`** — discriminant central. Attribut `famille` (GP/FP/mixte) à ajouter pour filtrage UI si nécessaire, mais pas de séparation de contexte.

2. **`sessions_formation`** — fusionne `plgfpro.actions` (planning) et `fplearn.opportunite_opp` (commercial). Champs à ajouter : `ref_nevea`, `code_produit_gp`, `famille_fgest`, `lieu_convocation`.

3. **`creneaux_planning`** — la hiérarchie `planning` + `plg_jours` (récurrences) est déjà capturée par `creneaux_horaires_jour`.

4. **`conventions`** — à ajouter dans groupe FACTURATION. Structure : `id, franchise_id, session_id, type_convention, financeur_id, montant_financeur, statut`.

5. **`competences_ressources`** — déjà dans le MCD. Ajouter `date_validite` (obligatoire pour FP).

6. **`besoins_creneaux`** — déjà dans le MCD. Mapper depuis `besoin_competence` (idplg, idtpress, nb).

---

## Prochaines étapes

- [ ] **Import `gpfp`** : ajouter `MYSQL_DATABASE=gpfp` au script existant `import-gplearn.ts` — même requêtes, activités FP importées automatiquement via `type_stage.nom` (CACES R489, FCO, SST…)
- [ ] **Import `fplearn`** : compléter avec conventions, financeurs (OPCO, CPF, France Travail), opportunités
- [ ] Ajouter tables `conventions`, `financeurs` au schéma SQLite ERP (groupe FACTURATION)
- [ ] Module ERP "Conventions" (financeurs, OPCO, CPF) — dans le même espace facturation
- [ ] Compétences formateurs avec dates de validité : `competences_ressources.date_validite`
- [ ] Planning multi-formateurs FP : même composant `PlanningGridSemaine` avec activités FP filtrées
