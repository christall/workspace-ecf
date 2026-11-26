# MCD Unifié — Refonte CERCA/ECF

> Version 0.9 — 2026-06-01 (décision D23 : un seul contexte ERP, activité = seul discriminant GP/FP ; cartographie plgfpro/fplearn confirmée compatible — voir doc 13)
> Version 0.8 — 2026-05-29 (modèle pédagogique complet : criteres_parcours, evaluations_pedagogiques, progressions_personnes, evaluations_cepc, evaluations_evini — analyse ECFCoach)
> Version 0.7 — 2026-05-29 (gouvernance G1-G10 intégrée : liens_personnes_personnes, jours_feries, creneaux_horaires_jour, numérotation factures migration, décisions D14-D22)
> Version 0.6 — 2026-05-21 (groupe 22 : disponibilités ressources/apprenants ; groupe 23 : CRM unifié — pipeline, interactions, devis, signataires contrat ; corrections automates_notifications triggers)
> Précédent : Version 0.5 — 2026-05-20 (groupe 9 : produits GP, filières, permis, tarification en cascade, accords-cadres ; phase 2 : examens, modèles documents, notifications, vente en ligne, rémunérations, géoloc, signature, consolidation ; architecture : niveau entreprise ajouté)
> Fusion GPLearn (GP auto-école) + PlanniFProWeb/plgfpro/fplearn (FP formation professionnelle)

---

## Principes directeurs

1. **Hiérarchie à 3 niveaux** : `entreprises` (CERCA, autres entités du groupe) → `franchises` (centre de formation = 1 base `gp****` source) → `sites` (agences/bureaux physiques). Le tenant d'isolation = `franchise_id` (niveau centre de formation).
1b. **Un seul schéma PostgreSQL** par franchise — Row Level Security via `franchise_id` sur chaque table
2. **Partitionnement** sur `creneaux_planning` et `inscriptions` par `(franchise_id, RANGE date_debut)` — ~120 M lignes en production
3. **Les entités métier s'unifient** ; les références externes (NEVEA, Formagest) sont conservées comme champs nullable pour la migration et la resynchronisation
4. **Les artefacts techniques** disparaissent : `stage` ponctuel supprimé, bases `gp*` multiples consolidées. Les références externes NEVEA et Formagest sont **conservées** (intégrations actives)
5. **Nommage** : snake_case, français sans accents, pluriel pour les tables, `id` pour les PKs UUID v7
6. **(D23 — 2026-06-01) Un seul contexte** : pas de séparation GP/FP dans l'interface ni le modèle. `activites` est le seul discriminant métier (Permis B, CACES R482, Habilitation électrique…). Sources : `plgfpro.activites` (69) fusionnées avec les filières GP. Voir doc 13 pour la cartographie complète.

---

## Groupes d'entités

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE    entreprises · franchises · utilisateurs              │
│                    sites · organisations                                │
├─────────────────────────────────────────────────────────────────────────┤
│  PERSONNES         personnes · certifications_personnes                 │
│                    liens_personnes_personnes                            │
├─────────────────────────────────────────────────────────────────────────┤
│  CATALOGUE         activites · types_actions · modules                  │
│                    competences                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  SESSIONS &        sessions_formation · creneaux_planning               │
│  PLANNING          creneaux_horaires_jour · jours_feries                │
│                    ressources_creneaux · besoins_creneaux               │
│                    affectations_pedagogiques                            │
│  PÉDAGOGIE         criteres_pedagogiques · baremes_criteres_pedagogiques│
│                    criteres_parcours (4 tables)                         │
│                    evaluations_pedagogiques · progressions_personnes    │
│                    evaluations_cepc · evaluations_evini                 │
├─────────────────────────────────────────────────────────────────────────┤
│  INSCRIPTIONS      inscriptions · presence_creneaux · emargements       │
├─────────────────────────────────────────────────────────────────────────┤
│  RESSOURCES        ressources · types_ressources · ressources_sites     │
│                    competences_ressources · heures_travail              │
│                    suivis_ressources · liens_ressources_personnes       │
│                    groupes_planning · groupes_planning_sites            │
│                    groupes_planning_ressources                          │
│                    utilisateurs_groupes_planning                        │
├─────────────────────────────────────────────────────────────────────────┤
│  FACTURATION       factures · lignes_factures · reglements              │
│                    contrats                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  TRANSVERSE        documents · journal_audit                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1 — INFRASTRUCTURE

### 1.1 `entreprises`
Entité juridique du groupe (CERCA, ou autre entreprise du groupe). Niveau au-dessus des centres de formation.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nom` | varchar(200) | ex: `CERCA`, `ECF Grand Ouest` |
| `siren` | varchar(14) NULL | |
| `is_active` | boolean | |
| `created_at` | timestamptz | |

> Pas de table source directe — dérivé de la connaissance métier et de `gpcontrolserveurs`

---

### 1.2 `franchises`
Centre de formation = une base `gp****` dans le système actuel. Unité de tenant (isolation RLS).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `entreprise_id` | uuid FK entreprises | entreprise propriétaire |
| `code` | varchar(10) UNIQUE | ex: `3101`, `8803` — ancien préfixe base `gp*` |
| `nom` | varchar(100) | |
| `is_active` | boolean | |
| `created_at` | timestamptz | |

> Source : liste des bases `gp*` dans `gpcontrolserveurs`

---

### 1.3 `utilisateurs`
Utilisateurs applicatifs (moniteurs, admin, gestionnaires FP, formateurs, directeurs régionaux...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `entreprise_id` | uuid FK entreprises | entreprise d'appartenance (obligatoire) |
| `franchise_id` | uuid FK franchises NULL | NULL = utilisateur niveau entreprise (accès multi-centres) |
| `email` | varchar(255) UNIQUE | |
| `password_hash` | varchar(255) | argon2id |
| `prenom` | varchar(100) | |
| `nom` | varchar(100) | |
| `is_active` | boolean | |
| `last_login_at` | timestamptz | |
| `created_at` | timestamptz | |

> RLS : si `franchise_id` non-NULL → accès restreint au centre de formation ; si NULL → accès à tous les centres de `entreprise_id`
> Source : `gplearn.users`, `plgfpro.ressources.code_acces` (credentials consolidées), `fplearn.utilisateur_uti`

---

### 1.4 `roles` / `roles_utilisateurs` / `permissions`
RBAC standard — portée sur 3 niveaux possibles.

```
roles (id, franchise_id NULL, nom, description)   -- NULL = rôle entreprise (multi-centres)
permissions (id, ressource, action)               -- ex: ('creneaux_planning','write')
permissions_roles (role_id, permission_id)
roles_utilisateurs (utilisateur_id, role_id, franchise_id NULL, site_id NULL)
  -- franchise_id : portée centre de formation ; site_id : portée bureau ; NULL = portée héritée du rôle
```

---

### 1.5 `sites`
Lieu physique (agence GP ou site de formation FP).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `code` | varchar(20) | |
| `nom` | varchar(150) | |
| `adresse` | text | |
| `code_postal` | varchar(10) | |
| `ville` | varchar(100) | |
| `type` | enum('gp','fp','both') | |
| `ext_nevea_id` | integer | ID NEVEA pour resync |
| `is_active` | boolean | |

> Source : agences GPLearn + `plgfpro.sites` + `fplearn.sites_sit`

---

### 1.6 `organisations`
Référentiel universel de personnes morales — toute entreprise en lien avec l'activité : clients, fournisseurs, OPCO, financeurs, sous-traitants... **Pas de rôle ici** : le rôle est porté par les tables de lien (`liens_organisations`, `inscriptions.financeur_id`, `sessions_formation.organisation_id`).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(200) | |
| `siren` | varchar(14) | |
| `adresse` | text | |
| `email_contact` | varchar(255) | |
| `tel_contact` | varchar(25) | |

> Source : `fplearn.personne_morale_pmo`

---

### 1.7 `liens_organisations`
Rôle d'une organisation dans le contexte de la franchise. Une même entreprise peut être cliente FP et fournisseur de véhicules simultanément.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organisation_id` | uuid FK organisations | |
| `franchise_id` | uuid FK franchises | |
| `role` | enum('client','fournisseur','financeur','opco','sous_traitant','partenaire','autre') | |
| `notes` | text NULL | |
| `is_active` | boolean | |

> Source : qualifications implicites dans `fplearn` (type de la personne morale dans les contextes)

---

### 1.8 `liens_personnes_organisations`
Fonction d'une personne physique au sein d'une organisation. Précise à la fois le rôle de la personne dans la structure et, par extension, la nature de la relation entre la personne et notre activité via cette organisation.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | |
| `organisation_id` | uuid FK organisations | |
| `franchise_id` | uuid FK franchises | |
| `fonction` | varchar(100) | fonction dans l'org : DRH, contact commercial, représentant légal, responsable formation, stagiaire habituel... |
| `is_contact_principal` | boolean | interlocuteur principal pour cette organisation |
| `is_active` | boolean | |
| `notes` | text NULL | |

> La même personne peut être DRH dans une entreprise cliente et contact fournisseur dans une autre.
> Source : `fplearn` — liens entre personnes physiques et personnes morales

---

## 2 — PERSONNES

### 2.1 `personnes`
Référentiel universel de personnes physiques — état civil et coordonnées uniquement. **Pas de rôle ici** : le rôle est porté par les tables de lien (`inscriptions.role`, `ressources.personne_id`, `utilisateurs.personne_id`). Une même personne peut être formateur dans un contexte, apprenant dans un autre, et avoir un compte utilisateur.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | RLS |
| `civilite` | enum('M','Mme','Mx') | |
| `nom` | varchar(100) | |
| `prenom` | varchar(100) | |
| `nom_naissance` | varchar(100) | nom_jf / nomnaiss |
| `date_naissance` | date | |
| `ville_naissance` | varchar(100) | |
| `dept_naissance` | varchar(5) | |
| `pays_naissance` | varchar(100) | |
| `nationalite` | varchar(100) | |
| `sexe` | char(1) | 'M'/'F'/'X' |
| `adresse` | text | |
| `code_postal` | varchar(10) | |
| `ville` | varchar(100) | |
| `email` | varchar(255) | |
| `tel_mobile` | varchar(25) | |
| `tel_fixe` | varchar(25) | |
| `profession` | varchar(100) | |
| `vehicule_adapte` | boolean | veh_amenage GP |
| `numero_neph` | varchar(20) | n° NEPH auto-école |
| `organisation_id` | uuid FK organisations NULL | employeur FP |
| `document_photo_id` | uuid FK documents NULL | |
| `json_extra` | jsonb | données brutes migrées non encore structurées |
| `anonymise_rgpd_le` | timestamptz NULL | date de pseudonymisation RGPD (remplace le flag binaire `cryptage_cnil`) |
| `ext_gp_tiers_id` | bigint | PK `tiers.code` dans la base gp* d'origine — nommé `code` dans le schéma legacy mais c'est l'ID technique |
| `ext_pph_id` | bigint | PK `pph_IDpersonne_physique` fplearn |
| `ext_nevea_id` | varchar(50) | GUID NEVEA / megabase GUID |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Index :** `(franchise_id, nom, prenom)`, `(franchise_id, email)`, `(ext_gp_tiers_id)`, `(ext_pph_id)`

> Source : `gp*.tiers` + `fplearn.personne_physique_pph` + fiche apprenant NEVEA + `fplearn.utilisateur_uti`

---

### 2.2 `certifications_personnes`
Toutes les certifications, habilitations et permis d'une personne. Les permis de conduire (domaine GP) et les certifications professionnelles (domaine FP) sont des instances du même concept : une personne détient ou prépare un titre, avec une catégorie, des dates et un résultat. La table est discriminée par `type` + `categorie`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | |
| `type` | enum('permis_conduite','CACES_chariot','CACES_engin','CACES_PEMP','CACES_grue_aux','CACES_grue_mob','CACES_pont','habilitation_elec','FIMO','FCO','FCP','qualification_pro','medical','autre') | |
| `categorie` | varchar(20) | permis : 'A','B','C'... ; CACES : '1','R482'... ; hab_elec : 'B0V','HTA'... ; PEMP : '1A','3B'... |
| `statut` | enum('en_cours','obtenu','echoue','expire') NULL | progression (surtout permis) |
| `is_principal` | boolean NULL | permis ou cert cible de la formation en cours |
| `date_debut` | date NULL | date_demande (permis) ou date du passage (CACES/hab) |
| `date_premier_passage` | date NULL | date1erp — permis conduite |
| `date_validite` | date NULL | date d'obtention ou d'expiration selon le type |
| `date_visite_medicale` | date NULL | permis conduite |
| `prefecture` | varchar(100) NULL | permis conduite |
| `resultat` | enum('reussi','echoue','partiel','en_attente') NULL | CACES, habilitations |
| `testeur` | varchar(100) NULL | organisme testeur (CACES, hab) |
| `heures` | decimal(6,2) NULL | heures de formation |
| `rattrapage` | boolean NULL | passage de rattrapage |
| `notes` | text NULL | |
| `ext_nevea_champ` | varchar(50) NULL | nom du champ NEVEA source (traçabilité migration) |

**Index :** `(personne_id, type, categorie)` UNIQUE — une personne n'a qu'une ligne par (type, catégorie)

> Source GP : champs `permis_dem_*` + `date_permis_*` de `tiers` ; Source FP : fiche apprenant NEVEA (~600 champs → ~12 types × N catégories)

---

### 2.3 `liens_personnes_personnes`
Relation de responsabilité légale entre personnes physiques. Remplace les champs `nom_resp`, `prenom_resp`, `email_resp`, `tel_resp` stockés directement dans la fiche `tiers`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `personne_id` | uuid FK personnes | la personne représentée (mineur ou dépendant légal) |
| `responsable_id` | uuid FK personnes | le responsable légal |
| `type_lien` | enum('responsable_legal','parent','tuteur','autre') | |
| `is_contact_principal` | boolean | interlocuteur à contacter en priorité |
| `is_signataire_contrat` | boolean | doit signer le contrat via Lex Persona |
| `is_active` | boolean | |
| `notes` | text NULL | |

> Source : champs `nom_resp`, `prenom_resp`, `email_resp`, `tel_resp` de `gp*.tiers`
> G5.3 : le responsable légal devient une fiche `personnes` distincte liée via cette table — nécessaire pour la signature Lex Persona sur les contrats de mineurs.

---

## 3 — CATALOGUE

### 3.1 `activites`
Famille de formation FP (niveau supérieur). Ex : CACES, Habilitations, Conduite pro.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(100) | |
| `is_active` | boolean | |
| `ext_pfp_id` | integer | ID plgfpro.activites |

---

### 3.2 `types_actions`
Type d'action de formation FP. Ex : CACES R482, Habilitation BS.
Correspond aussi aux `type_stage` GPLearn (unification catalogue).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `activite_id` | uuid FK activites NULL | NULL pour les types GP purs |
| `mode` | enum('gp','fp','les_deux') | |
| `nom` | varchar(255) | |
| `duree_heures` | integer | durée théorique |
| `is_intra` | boolean | intra-entreprise |
| `code` | varchar(20) | code produit FP (`code_produit`) |
| `famille` | varchar(5) | famille FP |
| `numero_homologation` | varchar(30) | num_homol_ants GP |
| `tarif` | decimal(10,2) | tarif de base |
| `acompte` | decimal(10,2) | |
| `publie_ecommerce` | boolean | |
| `ext_pfp_typeaction_id` | integer | ID plgfpro.typeactions |
| `ext_nevea_id` | varchar(50) | ID NEVEA catalogue |
| `ext_gp_type_stage_id` | integer | ID type_stage GPLearn |

> Source : `plgfpro.typeactions` + `gp*.type_stage`

---

### 3.3 `modules`
Briques pédagogiques d'un type d'action (théorie, pratique, évaluation, déplacement...).
Pilotent le mapping vers les codes produits GP (TH, PRAT, PC, Camp, WEBX).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `type_action_id` | uuid FK types_actions NULL | NULL = module GP |
| `nom` | varchar(50) | ex: 'Théorie', 'Pratique distanciel' |
| `code_produit_gp` | varchar(4) | TH / PRAT / PC / Camp / WEBX |
| `couleur` | integer | couleur planning |
| `heures_par_jour` | float | |
| `ticket_resto` | boolean | |
| `compte_heures_travail` | boolean | |
| `coeff_heures_travail` | double | |
| `is_active` | boolean | |
| `ext_pfp_module_id` | smallint | ID plgfpro.modules |

> Source : `plgfpro.modules` — 324 modules

---

### 3.4 `competences`
Habilitations / qualifications requises des ressources pour animer un créneau.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(100) | |
| `type` | varchar(50) | CACES / habilitation / permis / etc. |
| `ext_pfp_module_id` | integer | lié à plgfpro.modules (compétence ≈ module requis) |

---

## 4 — SESSIONS & PLANNING

### 4.1 `sessions_formation`
Session de formation unifiée : stage GP (non ponctuel) + action FP + opportunité CRM.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | RLS |
| `mode` | enum('gp','fp') | |
| `type_action_id` | uuid FK types_actions | |
| `site_id` | uuid FK sites | |
| `nom` | varchar(255) | |
| `description` | text | |
| `date_debut` | date | |
| `date_fin` | date | |
| `nb_places` | integer | |
| `is_cloturee` | boolean | clot GP / terminee FP |
| `is_intra` | boolean | FP intra-entreprise |
| `publie_ecommerce` | boolean | |
| `lieu_convocation` | text | lieu_convoc FP |
| `date_ordre_mission` | date | date_om |
| `commentaire_ordre_mission` | text | |
| `date_bon_commande` | date | date_bc |
| `commentaire_bon_commande` | text | |
| `duree_theorique_heures` | integer | |
| `couleur` | integer | couleur planning FP |
| `organisation_id` | uuid FK organisations NULL | client FP (intra) |
| `ext_gp_stage_id` | bigint | ID gp*.stage |
| `ext_pfp_action_id` | bigint | ID plgfpro.actions |
| `ext_nevea_ref` | varchar(50) | ref_nevea |
| `ext_fgest_no_module` | bigint | Formagest module ID |
| `ext_fgest_database` | varchar(100) | Formagest database |
| `cree_par` | uuid FK utilisateurs | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Index :** `(franchise_id, date_debut)`, `(franchise_id, type_action_id)`, `(ext_pfp_action_id)`, `(ext_nevea_ref)`

> Source : `gp*.stage` (ponctuel=false) + `plgfpro.actions` + `fplearn.opportunite_opp`

---

### 4.2 `creneaux_planning`
Créneau planning élémentaire. Table la plus volumineuse (~120 M en production).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | RLS — clé de partition |
| `session_formation_id` | uuid FK sessions_formation NULL | NULL = créneau GP standalone (leçon isolée) |
| `module_id` | uuid FK modules NULL | FP : module pédago ; GP : produit via module |
| `site_id` | uuid FK sites NULL | site d'exécution (peut différer de la session) |
| `date_debut` | date | clé de partition range |
| `date_fin` | date | |
| `heure_debut` | time | |
| `heure_fin` | time | |
| `quantite` | decimal(10,4) | durée en heures ou unités |
| `commentaire` | text | |
| `commentaire_exploitation` | text | note exploitation FP |
| `statut_id` | integer | ID statut FP |
| `verrou_planning` | boolean | verrou_plg |
| `verrou_ressources` | boolean | verrou_ress |
| `verrou_apprenants` | boolean | verrou_elv |
| `nb_places` | integer | |
| `type_examen` | enum('A','B','N') NULL | type d'examen GP |
| `examen_id` | uuid FK examens NULL | |
| `mode_ecommerce` | enum('aucun','option','planning','mixte') | |
| `ext_gp_plgarg_id` | bigint | ID gp*.plg_arg |
| `ext_pfp_planning_id` | bigint | ID plgfpro.planning = idplgpart dans plg_arg |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Partitionnement :** `PARTITION BY RANGE (date_debut)` sur tranches mensuelles
**Index :** `(franchise_id, date_debut)`, `(session_formation_id)`, `(ext_pfp_planning_id)`

---

### 4.3 `creneaux_horaires_jour`
Horaires spécifiques par jour de la semaine pour un créneau FP répétitif. Une même action de formation peut avoir des plages horaires différentes selon le jour (ex: 8h-12h le lundi, 9h-17h le mardi). Absent en GP — spécifique FP.

| Colonne | Type | Notes |
|---|---|---|
| `creneau_id` | uuid FK creneaux_planning | PK |
| `jour_semaine` | smallint | PK — 1=lundi … 7=dimanche (ISO 8601) |
| `heure_debut` | time | |
| `heure_fin` | time | |

> Source : `plgfpro.plg_jours` (idplg, jour, hdeb, hfin)
> G3.6 : conserver ce niveau de détail FP. S'applique uniquement aux créneaux avec `session_formation_id IS NOT NULL` en mode FP.

---

### 4.4 `jours_feries`
Référentiel des jours fériés nationaux et des fermetures spécifiques à une franchise. Utilisé par le moteur de planification pour sauter les jours non ouvrés lors de la création de créneaux répétitifs (G3.3 : répétition personnalisée + saut jours fériés).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises NULL | NULL = férié national (tous centres) |
| `date_ferie` | date | |
| `nom` | varchar(100) | ex: 'Lundi de Pâques', 'Fermeture estivale Compans' |
| `est_national` | boolean | true = jour férié légal, false = fermeture spécifique agence |

**Contrainte :** UNIQUE `(franchise_id, date_ferie)`
> Pré-chargé à l'installation avec les jours fériés légaux français (NULL franchise_id). Les agences peuvent ajouter leurs propres fermetures.

> Source : `gp*.plg_arg` + `plgfpro.planning`
> **Note :** `stage` ponctuel GPLearn disparaît — ses `plg_arg` deviennent des `creneaux_planning` sans `session_formation_id`

---

### 4.3 `ressources_creneaux`
Ressources affectées à un créneau (formateurs, véhicules, machines).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `ressource_id` | uuid FK ressources | |
| `created_at` | timestamptz | |

> Source : `gp*.plg_ress` + `plgfpro.plg_ress`

---

### 4.4 `besoins_creneaux`
Besoins en ressources d'un créneau (FP) — combien de ressources de quel type.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `type_ressource_id` | uuid FK types_ressources | |
| `quantite` | integer | nb ressources requises |

> Source : `plgfpro.besoin_competence` (idplg, idtpress, nb)

---

### 4.5 `affectations_pedagogiques`
Étiquette pédagogique d'un créneau : quelle ressource assure l'encadrement pédagogique, selon quel mode, avec quel type de tag. Spécifique GP — permet de distinguer le moniteur qui est **dans le véhicule** (`avec_ou_sans = 1`) de celui qui supervise à distance, et d'apposer un label pédagogique (progression AAC, évaluation intermédiaire...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `ressource_id` | uuid FK ressources | moniteur / formateur pédago |
| `avec` | boolean | avec_ou_sans : true = présence physique du pédago dans le véhicule/salle |
| `type_etiquette_id` | integer NULL | idetiq — référence table étiquettes (non modélisée encore) |
| `created_at` | timestamptz | |

> Source GP : `gp****.plg_etiq` (idplgarg, idpedago, avec_ou_sans, idetiq)
> Source FP : `fplearn.plg_pedago` (idplg, idpedago) — même concept sans le champ avec/sans ni étiquette
> Distinct de `ressources_creneaux` qui liste toutes les ressources matérielles et humaines affectées.

---

### 4.6 `evaluations_pedagogiques`
Note d'un apprenant sur un critère pédagogique lors d'un créneau, saisie par le moniteur. Table la plus volumineuse après `creneaux_planning` — **3,3 M lignes** sur gp3101 seul. Cœur du livret de formation ECF-CERCA.

| Colonne | Type | Notes |
|---|---|---|
| `creneau_planning_id` | uuid FK creneaux_planning | PK |
| `personne_id` | uuid FK personnes | PK — apprenant évalué |
| `ressource_id` | uuid FK ressources | PK — moniteur évaluateur |
| `critere_id` | uuid FK criteres_pedagogiques | PK |
| `note` | integer NULL | note sur barème du critère |
| `observations` | text NULL | observations du moniteur |
| `auto_eval` | integer NULL | auto-évaluation de l'élève |
| `auto_obs` | text NULL | commentaire auto-évaluation |
| `raison` | text NULL | raison/contexte |
| `risques` | text NULL | risques identifiés |
| `influences` | text NULL | facteurs d'influence |
| `pression` | text NULL | niveau de pression |
| `commentaire` | text NULL | commentaire libre supplémentaire |
| `created_at` | timestamptz | |

**Index :** `(personne_id, critere_id)`, `(creneau_planning_id)`, `(ressource_id, created_at)`

> Source GP : `gp****.tpedago_plg_elv` (3,3 M lignes sur gp3101)
> Source FP : `fplearn.tpedago_plg_elv` (9 941 lignes sur dev) — même structure, référentiel `tpedago` FP distinct (1 669 critères vs 260 GP)

---

### 4.7 `commentaires_creneaux_apprenants`
Commentaire libre et numéro de redevance par apprenant sur un créneau. Distinct des `evaluations_pedagogiques` : pas de critère structuré, juste un texte libre et une référence de facturation individuelle.

| Colonne | Type | Notes |
|---|---|---|
| `creneau_planning_id` | uuid FK creneaux_planning | PK |
| `personne_id` | uuid FK personnes | PK |
| `commentaire` | text NULL | |
| `no_redevance` | varchar(100) NULL | référence de facturation individuelle sur ce créneau |
| `updated_at` | timestamptz | |

> Source : `gp****.plg_cmt_trs` (146 K lignes — idplgarg, idtiers, comment, no_redevance)

---

### 4.8 `liens_creneaux`
Liens URL ou références externes attachés à un créneau (fiche technique, document réglementaire...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `nom` | varchar(255) | |
| `url` | text | |

> Source : `gp****.plg_liens` (476 lignes — id, idplgarg, nom, lien)

---

## 5 — INSCRIPTIONS

### 5.1 `inscriptions`
Lien entre une personne et une session de formation, **avec le rôle** qu'elle y tient. Une même personne peut être apprenant dans une session et formateur dans une autre. Correspond aux `lien_*_personne_*` de fplearn qui portent le rôle dans le lien.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | RLS — clé de partition |
| `personne_id` | uuid FK personnes | |
| `session_formation_id` | uuid FK sessions_formation | |
| `role` | enum('apprenant','formateur','responsable','observateur','accompagnant') | rôle de la personne dans cette session |
| `ressource_id` | uuid FK ressources NULL | formateur/moniteur référent si role='apprenant' (GP) |
| `statut` | enum('option','confirme','present','absent','annule','termine') | |
| `date_inscription` | date | |
| `financeur_id` | uuid FK organisations NULL | OPCO / financeur FP |
| `ext_gp_stgelv_tiers` | bigint | FK tiers dans gp*.stg_elv |
| `ext_gp_stgelv_idstage` | bigint | FK idstage dans gp*.stg_elv |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Partitionnement :** aligné sur `sessions_formation.date_debut`
**Index :** `(franchise_id, personne_id)`, `(session_formation_id)`

> Source : `gp*.stg_elv` (composite PK idstage+tiers+idguser) + `plgfpro.repartition_stgr_ress_plg` + `fplearn.lien_opportunite_personne_lop`

---

### 5.2 `presence_creneaux`
Présence/absence d'un apprenant sur un créneau, avec le formateur en charge ce jour-là.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `inscription_id` | uuid FK inscriptions | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `ressource_id` | uuid FK ressources NULL | formateur en charge sur ce créneau (peut différer du formateur principal) |
| `presence` | enum('present','absent','retard','excuse') NULL | |
| `observation` | text NULL | observation sur la présence (`abspres.obs`) |
| `ordre_passage` | smallint NULL | ordre de passage examen (gp*.plg_rang_exam) |

> Source GP : `gp*.abspres` (idtiers, idplgarg, abspres, obs) + `gp*.plg_rang_exam` (ordre_passage)
> Source FP : `plgfpro.repartition_stgr_ress_plg` (idplg, idress, idlop)

---

### 5.3 `emargements`
Trace légale de la signature de présence d'un apprenant sur un créneau. Distinct de `presence_creneaux` (donnée administrative) : l'émargement est la preuve physique ou numérique de la signature, avec document joint optionnel.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `inscription_id` | uuid FK inscriptions | |
| `creneau_planning_id` | uuid FK creneaux_planning | |
| `signe_le` | timestamptz NULL | horodatage signature (null = non signé) |
| `document_id` | uuid FK documents NULL | scan PDF de la feuille signée |

> Source : `gp****.plg_emarg` (idplgarg, idtiers, iddoc, tampon)
> Les commentaires et numéros de redevance par (créneau × apprenant) sont dans `commentaires_creneaux_apprenants` (§4.7) ← `plg_cmt_trs`

---

## 6 — RESSOURCES

### 6.1 `types_ressources`
Catégorie de ressource (formateur conduite B, moniteur CACES, véhicule articulé, salle CACES, engin...). La nature — humain, véhicule, salle, matériel — est déduite de la configuration plutôt qu'encodée en enum.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(50) | |
| `unite` | varchar(20) | unité de mesure (heures, jours, km...) |
| `mode` | enum('gp','fp','les_deux') | |
| `couleur` | integer | couleur planning (entier RGB) |
| `est_localisation` | boolean | `location` : ressource = lieu physique (salle, piste, aire CACES) — distingue les lieux des personnes/engins |
| `affectation_obligatoire` | boolean | `forcer_affectation` : l'ajout d'un créneau sur ce type force l'affectation à un site |
| `tarif_jour` | decimal(10,2) NULL | tarif journalier (refacturation interne ou client) |
| `tarif_km` | decimal(8,4) NULL | tarif kilométrique pour les véhicules avec `unite='km'` |
| `code_analytique` | varchar(8) NULL | `analytique` — code centre analytique / comptable (ex: P70099, P70299) |
| `img_besoin_insatisfait_key` | varchar(500) NULL | clé MinIO de l'icône rouge "besoin non satisfait" (Gantt) |
| `img_besoin_satisfait_key` | varchar(500) NULL | clé MinIO de l'icône verte "besoin satisfait" (Gantt) |
| `ext_pfp_typeress_id` | tinyint | ID plgfpro.typeress |
| `ext_gp_typeress_id` | integer NULL | ID gpfp.typeress (100-324) |

> Source : `plgfpro.typeress` (24 types, riche) + `gpfp.typeress` (simple id/nom)
> Les images `img_bes_*` sont des blobs en base → à migrer vers MinIO

---

### 6.2 `ressources`
Ressource planifiable : humaine (moniteur, formateur, jury) ou matérielle (véhicule, simulateur, salle, piste). Appartient à un centre de formation (`franchise_id`) mais peut intervenir sur plusieurs sites via `ressources_sites`. Source GP : `intervt` — les moniteurs ont un `agence_def` mais sont présents dans `age_ress` sur N agences.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | centre de formation d'appartenance (= base `gp****` source) |
| `type_ressource_id` | uuid FK types_ressources | |
| `personne_id` | uuid FK personnes NULL | état civil si ressource humaine ; NULL pour véhicules/salles |
| `utilisateur_id` | uuid FK utilisateurs NULL | compte applicatif si la ressource peut se connecter |
| `nom` | varchar(100) | nom affiché dans le planning |
| `capacite` | integer NULL | nb places simultanées (salles, simulateurs, véhicules) |
| `is_active` | boolean | |
| `is_vacataire` | boolean | |
| `is_interimaire` | boolean | |
| `email` | varchar(255) NULL | |
| `tel_fixe` | varchar(25) NULL | |
| `tel_mobile` | varchar(25) NULL | |
| `no_autorisation_enseigner` | varchar(50) NULL | **GP** : numéro préfecture (obligatoire moniteurs conduite) |
| `date_validite_autorisation` | date NULL | expiration autorisation d'enseigner |
| `signature_document_id` | uuid FK documents NULL | signature numérisée injectée dans PDFs |
| `reference_externe` | varchar(25) NULL | référence système externe (EasySysteme...) |
| `memo` | text NULL | |
| `ext_pfp_ressource_id` | integer NULL | ID plgfpro.ressources |
| `ext_gp_intervt_id` | bigint NULL | ID gp****.intervt |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Index :** `(franchise_id, type_ressource_id)`, `(personne_id)`, `(franchise_id, is_active)`

> Source : `plgfpro.ressources` (1 789) + `gp****.intervt` (moniteurs, véhicules GP)
> Sites d'exercice → table `ressources_sites` (§6.7)
> Rôles admin FP (`is_admin`, `is_resp_ifp`, `is_superadmin`, `lecture_seule`) → portés par `roles_utilisateurs` (§1.4) dans la nouvelle application

---

### 6.3 `ressources_sites`
Sites sur lesquels une ressource peut être planifiée. Un moniteur appartient à un centre de formation mais peut intervenir sur plusieurs bureaux/sites (y compris dans d'autres centres de la même entreprise).

| Colonne | Type | Notes |
|---|---|---|
| `ressource_id` | uuid FK ressources | PK |
| `site_id` | uuid FK sites | PK |
| `est_site_principal` | boolean | correspond à `agence_def` de `intervt` |

> Source : `gp****.age_ress` (idress, agence) — LIONEL (code=3) intervient sur 3102+3105+3107+3109
> Avec 1 DB par entreprise, un moniteur CERCA peut être planifié sur des sites de plusieurs centres de formation CERCA sans jointure inter-base

---

### 6.4 `competences_ressources`
Habilitations détenues par une ressource avec date de validité.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ressource_id` | uuid FK ressources | |
| `competence_id` | uuid FK competences | |
| `valide_jusqu_au` | date NULL | NULL = pas d'expiration |
| `priorite` | integer | ordre de préférence pour l'affectation automatique |

> Source : `plgfpro.competence_ress` (46 K lignes — idress, idmodule, priorite, validite)

---

### 6.5 `heures_travail`
Heures travaillées par ressource — suivi RH/paie FP. Workflow en trois colonnes reflétant le processus métier : le formateur saisit ses heures, un calculateur automatique les recalcule depuis le planning, l'administrateur valide.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `ressource_id` | uuid FK ressources | |
| `type_action_id` | uuid FK types_actions NULL | FP : type d'action concerné |
| `site_id` | uuid FK sites NULL | site de la prestation |
| `module_id` | uuid FK modules NULL | module pédagogique concerné |
| `date_travail` | date | |
| `duree_saisie` | decimal(6,2) NULL | `duree_sais` : heures déclarées par le formateur |
| `duree_calculee` | decimal(6,2) NULL | `duree_calc` : heures calculées automatiquement depuis le planning |
| `duree_validee` | decimal(6,2) NULL | `duree_val` : heures validées par l'administrateur (source de vérité paie) |
| `verrou` | boolean | `verrou` : ligne verrouillée après validation finale |
| `ticket_resto` | boolean NULL | droit au ticket-restaurant pour cette journée |
| `document_justif_id` | uuid FK documents NULL | justificatif associé (depuis `justif_heures`) |

> Source : `plgfpro.heures_trav` (917 K lignes — idress, idtpaction, idsite, idmodule, jour, duree_sais, duree_val, duree_calc, verrou) + `plgfpro.justif_heures` (618 K — justif_sais, tk_resto_sais, justif_val, tk_resto_val)
> Le workflow : le formateur saisit `duree_saisie`, le robot calcule `duree_calculee`, l'admin valide en `duree_validee`. `verrou=true` gèle la ligne pour la paie.

---

### 6.6 `suivis_ressources`
Suivi de maintenance et d'inspection des ressources matérielles (véhicules, engins). Gère les alertes d'échéance (contrôle technique, révision, assurance...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `ressource_id` | uuid FK ressources | |
| `nom_suivi` | varchar(250) | libellé de la maintenance (ex: "Contrôle technique", "Révision annuelle") |
| `km_saisie` | integer NULL | kilométrage au moment du suivi |
| `date_saisie` | date | date de la maintenance |
| `km_validite` | integer NULL | seuil kilométrique déclenchant une alerte |
| `date_validite` | date NULL | date limite de validité — alertes à J-7, J-14, J-21 |
| `document_id` | uuid FK documents NULL | document justificatif (facture, certificat d'inspection) |

> Source : `gpfp.suivi_ressources` + `gpfp.doc_suivi_ress`

---

### 6.7 `liens_ressources_personnes`
Équipe pédagogique affectée à un apprenant, indépendamment de toute session. Permet de retrouver "quel formateur suit cet élève" ou "quel psychologue est rattaché à ce stagiaire" pour les statistiques, les documents générés, et les suggestions de planning.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | l'apprenant / le bénéficiaire |
| `ressource_id` | uuid FK ressources | le formateur / intervenants (moniteur, psy, coordinateur...) |
| `franchise_id` | uuid FK franchises | |
| `role` | varchar(50) NULL | ex: 'formateur_principal', 'psychologue', 'coordinateur' — libre |
| `is_active` | boolean | |
| `notes` | text NULL | |

> Source : `gpfp.ress_trs` (tiers, resscode) — équipe pédagogique par apprenant

---

### 6.8 `groupes_planning`
Vue de planning configurable : définit un ensemble de ressources (colonnes) visibles simultanément. Un utilisateur abonné à un groupe voit dans son planning les colonnes correspondant aux ressources du groupe. Correspond à `g_user` dans GPLearn.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(100) | ex: "Compans", "Atlanta", "Moniteur", "Secrétaires - Compans" |
| `type` | enum('agence','fonction','planning') | agence = centré sur des sites, fonction = par rôle, planning = ad hoc |
| `is_active` | boolean | |

> Source : `gp****.g_user` + `gp****.type_grp_u`
> Exemples : "global" (25 ressources, 16 agences), "Compans" (11 ressources, agence 3102), "Moniteur" (vue fonction multi-sites)

---

### 6.9 `groupes_planning_sites`
Sites couverts par un groupe de planning — un créneau dans ces sites est visible dans la vue.

| Colonne | Type | Notes |
|---|---|---|
| `groupe_planning_id` | uuid FK groupes_planning | PK |
| `site_id` | uuid FK sites | PK |

> Source : `gp****.g_user_agences`

---

### 6.10 `groupes_planning_ressources`
Ressources (colonnes) visibles dans un groupe de planning, dans l'ordre d'affichage configuré.

| Colonne | Type | Notes |
|---|---|---|
| `groupe_planning_id` | uuid FK groupes_planning | PK |
| `ressource_id` | uuid FK ressources | PK |
| `ordre` | integer | ordre d'affichage de la colonne (= `tri` dans `gu_ressplg`) |

> Source : `gp****.gu_ressplg` (idguser, idress, tri)
> Exemple : groupe "Compans" = 10 moniteurs + 1 simulateur dans un ordre précis

---

### 6.11 `utilisateurs_groupes_planning`
Abonnement d'un utilisateur à une vue de planning. Un utilisateur peut être abonné à plusieurs groupes.

| Colonne | Type | Notes |
|---|---|---|
| `utilisateur_id` | uuid FK utilisateurs | PK |
| `groupe_planning_id` | uuid FK groupes_planning | PK |
| `est_defaut` | boolean | groupe affiché en premier à l'ouverture |

> Source : `gp****.gus_user` (iduser, idguser)

---

### 6.12 `observations_ressources_jour`
Note interne journalière sur une ressource (formateur absent, retard, remarque ponctuelle). Saisie par la direction ou l'administration.

| Colonne | Type | Notes |
|---|---|---|
| `ressource_id` | uuid FK ressources | PK |
| `jour` | date | PK |
| `franchise_id` | uuid FK franchises | |
| `observation` | text | |
| `updated_at` | timestamptz | |

> Source : `gp****.plg_obs_ress_jour` (632 lignes — idress, jour, obs)

---

## 7 — FACTURATION

### 7.1 `factures`
Factures émises (GP et FP).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `numero` | bigint | numéro séquentiel — repart à 1 dans la nouvelle base |
| `ext_source_franchise` | varchar(10) NULL | code franchise source (ex: 'gp3101') — traçabilité migration |
| `ext_ancien_numero` | bigint NULL | ancien numéro dans la base source — référence comptable historique |
| `date` | date | |
| `date_echeance` | date | |
| `personne_facturee_id` | uuid FK personnes NULL | tiersfact si personne physique |
| `organisation_facturee_id` | uuid FK organisations NULL | tiersfact si personne morale |
| `personne_destinataire_id` | uuid FK personnes NULL | tierscons |
| `solde_affecte` | decimal(12,2) | reg_affect |
| `libelle` | varchar(50) | |
| `lettrage` | char(2) | lettrage comptable |
| `is_verrouillee` | boolean | |
| `notes` | text | |
| `conditions_reglement` | text | modal_reglt |
| `conditions_particulieres` | text | cond_part |
| `modele_id` | bigint | idmodele (modèle de document) |
| `cree_par` | uuid FK utilisateurs | |
| `created_at` | timestamptz | |

> Source : `gp*.factures`

---

### 7.2 `lignes_factures`
Lignes de facture liées aux créneaux et inscriptions.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `facture_id` | uuid FK factures | |
| `creneau_planning_id` | uuid FK creneaux_planning NULL | aff_plg_lfac GP |
| `inscription_id` | uuid FK inscriptions NULL | |
| `code_produit` | varchar(10) | |
| `libelle` | varchar(200) | |
| `quantite` | decimal(10,4) | |
| `prix_unitaire` | decimal(12,2) | |
| `taux_tva` | decimal(5,2) | |
| `ordre` | integer | |

> Source : `gp*.lfac` (lignes de facture)

---

### 7.3 `reglements`
Règlements reçus.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `numero` | bigint | numéro séquentiel |
| `date_reglement` | date | |
| `date_enregistrement` | date | dtreg |
| `personne_payeur_id` | uuid FK personnes NULL | tierspar |
| `organisation_payeur_id` | uuid FK organisations NULL | |
| `personne_beneficiaire_id` | uuid FK personnes NULL | tierspour |
| `montant` | decimal(12,2) | |
| `type_reglement` | char(1) | C=chèque, V=virement, E=espèces, P=prélèvement... |
| `code_banque` | varchar(4) | |
| `date_remise` | date | daterem |
| `lettrage` | char(2) | |
| `is_verrouille` | boolean | |
| `libelle` | varchar(50) | |
| `hash_integrite` | varchar(64) | sha2 (vérification intégrité) |

> Source : `gp*.reglts`

---

### 7.4 `contrats`
Contrats de formation (GP et FP).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `personne_id` | uuid FK personnes | |
| `organisation_id` | uuid FK organisations NULL | financeur/OPCO |
| `inscription_id` | uuid FK inscriptions NULL | |
| `date_edition` | date | |
| `date_signature` | date | |
| `document_id` | uuid FK documents NULL | |
| `tx_blockchain_id` | varchar(100) | signature Tezos (tezos-digisign) |

> Source : `gp*.contrats` + module `tezos-digisign`

---

## 8 — TRANSVERSE

### 8.1 `documents`
Fichiers associés (photos, pièces justificatives, PDFs signés...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `type_entite` | varchar(50) | 'personnes','factures','contrats',... |
| `entite_id` | uuid | FK polymorphique |
| `nom_fichier` | varchar(255) | |
| `mime_type` | varchar(100) | |
| `cle_stockage` | varchar(500) | chemin S3/MinIO |
| `taille_octets` | bigint | |
| `is_signe` | boolean | signature électronique |
| `signe_le` | timestamptz | |
| `tx_blockchain_id` | varchar(100) | Tezos |
| `cree_par` | uuid FK utilisateurs | |
| `created_at` | timestamptz | |

---

### 8.2 `journal_audit`
Traçabilité de toutes les modifications (RGPD + conformité).

| Colonne | Type | Notes |
|---|---|---|
| `id` | bigint PK (séquence) | volume élevé — pas d'UUID |
| `franchise_id` | uuid | |
| `utilisateur_id` | uuid NULL | |
| `nom_table` | varchar(100) | |
| `enregistrement_id` | uuid | |
| `operation` | enum('INSERT','UPDATE','DELETE') | |
| `donnees_avant` | jsonb NULL | |
| `donnees_apres` | jsonb NULL | |
| `adresse_ip` | inet | |
| `created_at` | timestamptz | |

**Index :** `(franchise_id, nom_table, enregistrement_id)`, `(created_at DESC)` — TTL 3 ans

---

## 9 — DIAGRAMME DE RELATIONS (simplifié)

```
franchises ──────────────────────────────────────────────────────────────┐
   │                                                                     │
   ├── sites                                                             │
   ├── utilisateurs ── roles_utilisateurs ── roles ── permissions_roles  │
   ├── organisations                                                     │
   │                                                                     │
   ├── personnes ──── certifications_personnes                           │
   │                                                                     │
   ├── activites ── types_actions ── modules                             │
   │                             └── competences                        │
   │                                                                     │
   ├── types_ressources                                                  │
   ├── ressources ────── competences_ressources                          │
   │             ├────── heures_travail                                  │
   │             ├────── suivis_ressources                               │
   │             └────── liens_ressources_personnes ──► personnes        │
   │                                                                     │
   ├── sessions_formation ──────────────────────────────────────────┐    │
   │        └── creneaux_planning ── ressources_creneaux            │    │
   │                             ├── besoins_creneaux               │    │
   │                             └── affectations_pedagogiques      │    │
   │                                                                │    │
   ├── inscriptions ────────────────────────────────────────────────►│   │
   │        ├── presence_creneaux ───────────────────────────────────►│  │
   │        └── emargements ────────────────────────────────────────►│   │
   │                                                                │    │
   ├── factures ── lignes_factures ──────────────────────────────►creneaux_planning
   ├── reglements                                                        │
   └── contrats                                                          │
                                                                         │
journal_audit, documents  ←──── transverse (toutes entités) ────────────┘
```

---

## 10 — DÉCISIONS DE CONCEPTION

### D1 — UUID v7 pour toutes les PKs
Triables chronologiquement, compatibles index B-tree, pas de conflit en migration multi-source. Exception : `journal_audit.id` en bigserial (volume).

### D2 — Partition `creneaux_planning` par mois
```sql
CREATE TABLE creneaux_planning (...)
PARTITION BY RANGE (date_debut);
-- + partitions automatiques via pg_partman
```
Tranche mensuelle = ~10 M lignes en prod. Archivage > 3 ans vers tablespace cold.

### D3 — RLS via `franchise_id`
```sql
ALTER TABLE creneaux_planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_franchise ON creneaux_planning
  USING (franchise_id = current_setting('app.franchise_courante')::uuid);
```
Toutes les tables de données métier ont cette politique.

### D4 — `stage` ponctuel supprimé
Les `plg_arg` de stages ponctuels deviennent des `creneaux_planning` avec `session_formation_id = NULL`. Un `stage` ponctuel ne portait aucune information métier propre (le produit et les élèves suffisent).

### D5 — Références externes NEVEA et Formagest : conservées comme intégrations actives

Les colonnes `ext_nevea_*` et `ext_fgest_*` ne sont **pas** de simples artefacts de migration — elles supportent deux intégrations actives permanentes :

- **NEVEA** : reste le système maître FP régional tant qu'il n'est pas remplacé. Le nouveau système doit continuer à recevoir les actions/apprenants depuis NEVEA (polling ou webhook) et maintenir la correspondance d'IDs.
- **Formagest** : le nouveau système **envoie** des données vers Formagest, qui est le portail e-commerce national. `ext_fgest_no_module` et `ext_fgest_database` identifient les sessions côté Formagest.

En conséquence :

1. Les colonnes `ext_nevea_ref`, `ext_fgest_no_module`, `ext_fgest_database` dans `sessions_formation` sont permanentes, pas temporaires.
2. Une table `etats_sync_externe` est nécessaire pour suivre l'état de synchronisation par entité et par système externe :

```
etats_sync_externe (
  id                 uuid PK,
  franchise_id       uuid FK,
  type_entite        varchar(50),   -- 'sessions_formation', 'personnes', 'ressources'...
  entite_id          uuid,
  systeme            enum('nevea','formagest'),
  ext_id             varchar(100),
  synchronise_le     timestamptz,
  statut_sync        enum('ok','erreur','en_attente'),
  derniere_erreur    text NULL,
  direction          enum('entrant','sortant','bidirectionnel')
)
```

3. La table fplearn `lien_opportunite_externe_oex` devient inutile car ses trois liens sont portés par `ext_pfp_action_id`, `ext_nevea_ref`, `ext_fgest_no_module` de `sessions_formation` — mais la logique de sync reste.

### D6 — Séparation identité / rôle (modèle fplearn)

`personnes` et `organisations` sont des **référentiels purs** — état civil / raison sociale et coordonnées uniquement. Aucun rôle n'est inscrit dans ces tables. Le rôle est toujours porté par la table de lien, dans le contexte où il s'exprime.

**Personnes physiques :**

| Lien | Rôle exprimé |
|---|---|
| `inscriptions.role` | apprenant / formateur / responsable dans une session |
| `ressources.personne_id` | la personne opère comme ressource (moniteur, formateur, engin humain) |
| `utilisateurs.personne_id` | la personne a un compte applicatif |
| `liens_personnes_organisations.fonction` | fonction de la personne dans une organisation (DRH, contact commercial, représentant légal...) |

**Personnes morales :**

| Lien | Rôle exprimé |
|---|---|
| `liens_organisations.role` | client / fournisseur / financeur / OPCO / sous-traitant |
| `inscriptions.financeur_id` | l'organisation finance cette inscription |
| `sessions_formation.organisation_id` | l'organisation est cliente d'une session intra |

Conséquences :
- Pas de `type_personne` dans `personnes`
- Pas de `type` dans `organisations`
- La même entreprise peut être simultanément cliente FP et fournisseur de matériel
- La même personne peut être formateur, apprenant et utilisateur selon les contextes

### D7 — Certifications NEVEA : modèle structuré, pas flat
600 colonnes NEVEA → `certifications_personnes` avec `(personne_id, type_certification, categorie)` unique. Extensible sans migration de schéma pour de nouvelles certifications.

### D8 — Ressources GP et FP unifiées
`age_ress` (GP) + `intervt` (gpfp) + `plgfpro.ressources` → une seule table `ressources`. Les moniteurs GP qui sont aussi formateurs FP n'ont qu'un seul enregistrement. `personne_id` fait le lien avec `personnes` pour les humains.

### D9 — Compétences = modules requis (FP)
Dans plgfpro, `competence_ress(idress, idmodule)` et `besoin_competence(idplg, idtpress)` utilisent les mêmes identifiants. Le nouveau modèle distingue `competences` (référentiel) de `competences_ressources` (possession) et `besoins_creneaux` (besoin par créneau).

### D10 — Migration : déchiffrer les `tiers` pseudonymisés CNIL avant import

Les `tiers` avec `cryptage_cnil = 1` ont ~35 champs PII chiffrés via `AES_ENCRYPT(valeur, tiers.code)`. Le script de migration doit les déchiffrer avec `AES_DECRYPT(valeur, tiers.code)` **avant** insertion dans `personnes`. Les coordonnées GPS et dates PAP obfusquées (÷25) doivent également être recalculées. Après migration, le nouveau système utilise `anonymise_rgpd_le` (timestamptz) et une vraie pseudonymisation irréversible.

### D13 — Ressources : nature par configuration, pas par enum

`types_ressources.est_localisation` distingue les lieux des personnes/engins sans avoir besoin d'un enum `('humain','vehicule','salle','materiel')`. Cette approche permet à chaque franchise de créer ses propres types sans toucher au schéma.

Les champs `tarif_jour`, `tarif_km`, `code_analytique` sur le type permettent la refacturation interne entre agences et la comptabilité analytique — aujourd'hui géré à la main dans certaines franchises.

`ressources.no_autorisation_enseigner` + `date_validite_autorisation` sont des données réglementaires GP (obligation légale d'affichage dans l'auto-école). `suivis_ressources` gère les alertes de maintenance matérielle (contrôle technique, révision...).

`liens_ressources_personnes` (depuis `ress_trs`) est distinct de `inscriptions.ressource_principale_id` : le premier est l'équipe pédagogique de suivi global d'un apprenant, le second est le formateur d'une session spécifique.

### D12 — Fusion `licences_conduite` + `certifications_personnes`

Les permis de conduire (GP) et les certifications CACES/habilitations (FP) sont structurellement identiques : une personne, un titre, une catégorie, une date et un résultat. Les séparer dans deux tables forçait du code dupliqué pour les recherches transversales (ex: "quelles certifications actives pour cette personne ?").

Table unique `certifications_personnes` discriminée par `(type, categorie)`. Les champs spécifiques aux permis (`date_visite_medicale`, `prefecture`, `date_premier_passage`) sont nullable — ils ne s'appliquent qu'au type `permis_conduite`. L'index UNIQUE `(personne_id, type, categorie)` garantit qu'on ne peut avoir qu'une ligne par combinaison.

### D11 — Champs `ext_*` temporaires ou permanents
- `ext_gp_*`, `ext_pfp_*` : temporaires — peuvent être supprimés après stabilisation de la migration
- `ext_nevea_*` : permanents tant que NEVEA est maître
- `ext_fgest_*` : permanents tant que Formagest est le portail e-commerce national

### D14 — Responsable légal = fiche `personnes` distincte (G5.3)
Dans l'existant, les coordonnées du responsable légal d'un mineur sont stockées dans des champs plats (`nom_resp`, `email_resp`…) de `tiers`. Dans la nouvelle application, le responsable légal est une fiche `personnes` à part entière, liée par `liens_personnes_personnes`. Avantages : (1) une personne peut être responsable légal de plusieurs élèves ; (2) Lex Persona peut envoyer la demande de signature directement au responsable légal via son email propre.

### D15 — RBAC : règle de délégation des droits (G2.2)
Deux niveaux de délégation :
- **Rôle `admin`** (droit système) : peut attribuer ou retirer n'importe quel droit à n'importe quel utilisateur.
- **Utilisateur standard** : peut attribuer à un autre utilisateur uniquement les droits qu'il possède lui-même (`permissions_roles` vérifié avant attribution).

Implémentation : `permissions.est_delegable_par_possesseur boolean` (default true). Les droits ultra-sensibles (réouverture clôture, déchiffrement CNIL) peuvent avoir ce flag à false, réservant leur attribution à l'admin uniquement.

### D16 — Numérotation factures : repart à zéro + référence historique (G4.2)
`factures.numero` repart à 1 dans la nouvelle base. Les champs `ext_source_franchise` et `ext_ancien_numero` assurent la traçabilité vers l'historique comptable Sage. Les exports Sage incluent la référence ancienne dans le libellé pour permettre le lettrage des en-cours à la migration.

### D17 — Lettrage règlement ↔ facture : convention minuscule/majuscule (G4.3)
- Lettrage automatique partiel (montant ≠ total facture) : **lettre minuscule** ('a', 'b'…).
- Lettrage équilibré (règlements = total facture) : **lettre MAJUSCULE** ('A', 'B'…).

La colonne `lettrage char(2)` dans `factures` et `reglements` supporte les deux formats. Un trigger ou un processus de réconciliation élève automatiquement les lettres quand l'équilibre est atteint.

### D18 — Verrouillages planning : irréversibles après clôture (G3.4)
Les trois verrous de `creneaux_planning` (`verrou_planning`, `verrou_ressources`, `verrou_apprenants`) deviennent **irréversibles** dès que la session parent est clôturée (`sessions_formation.is_cloturee = true`). Le droit 61 ("Déverrouiller les enregistrements planning") ne peut opérer que sur des sessions non clôturées. Logique à appliquer au niveau API : refuser le déverrouillage si la session est clôturée, indépendamment du droit possédé.

### D19 — Réouverture de clôture : super-admin uniquement (G4.5)
`sessions_formation.is_cloturee` peut être remis à `false` uniquement par un utilisateur portant le rôle `super_admin` (droit système non délégable). Cette action est journalisée dans `journal_audit` avec les données avant/après.

### D20 — Archivage CNIL et données historiques > N ans (G8.2)
Deux mécanismes distincts :
1. **Pseudonymisation CNIL** : les fiches `personnes` sans activité depuis X ans (paramétré par franchise) ont leurs champs PII remplacés par des valeurs pseudonymisées. Flag `anonymise_rgpd_le` dans `personnes`. Equivalence du `cryptage_cnil` GPLearn.
2. **Archivage volumétrique** : les `creneaux_planning`, `inscriptions`, `heures_travail` > 5 ans migrent vers un tablespace cold (PostgreSQL tablespace ou table de partition dédiée). Récupération possible sur demande via interface admin.

Références source : `GPLearn/Traitements/archivage_docs.php`, `cryptage_cnil_batch.php`, `Eleves/cryptage_cnil.php`.

### D21 — Isolation entreprises : RLS suffit, pas de bases séparées (G2.3)
Les entreprises du groupe (7 au total) sont isolées par RLS via `franchise_id` (et indirectement `entreprise_id`). Il n'y a pas besoin d'une base PostgreSQL par entreprise. Un utilisateur ne peut voir que les données des franchises de son entreprise. Quand une personne a besoin d'accéder à deux entreprises, un second compte est créé dans l'autre entreprise — les comptes ne sont pas cross-entreprise.

### D22 — Avertissement chevauchement planning : non bloquant (G3.5)
Quand un créneau est créé ou modifié, le système vérifie en temps réel si une ressource est déjà affectée sur une plage horaire qui se chevauche. L'UI affiche un **avertissement** (bandeau ou tooltip orange) mais n'empêche pas la saisie. Ce comportement reproduit l'existant GPLearn : les chevauchements sont signalés, pas interdits.

---

## 11 — VOLUMES & STRATÉGIE D'INDEX

| Table | Dev (×1) | Prod (×20) | Partition | Index critiques |
|---|---|---|---|---|
| `creneaux_planning` | 5,96 M | **~120 M** | RANGE date_debut (mensuel) | franchise_id+date_debut, session_formation_id |
| `sessions_formation` | 8,2 M | ~164 M | non | franchise_id+date_debut, type_action_id |
| `inscriptions` | 5,4 M | ~108 M | RANGE (aligné sessions) | personne_id, session_formation_id |
| `personnes` | 464 K | ~9,3 M | non | franchise_id+nom, email, ext_gp_tiers_id |
| `factures` | 1,5 M | ~30 M | non | franchise_id+date, personne_facturee_id |
| `reglements` | 1,27 M | ~25 M | non | franchise_id+date_reglement |
| `heures_travail` | 917 K | ~18 M | non | ressource_id+date_travail |
| `competences_ressources` | 46 K | ~920 K | non | ressource_id, competence_id+valide_jusqu_au |
| `suivis_ressources` | faible | faible | non | ressource_id, date_validite |
| `journal_audit` | — | très élevé | TTL 3 ans | created_at DESC |

---

## 9 — PRODUITS GP

Spécifique GP. En FP, le catalogue est couvert par `types_actions` (§ 3.2) et `modules` (§ 3.3).
Le lien GP↔FP existe déjà via `modules.code_produit_gp` (TH, PRAT, PC, Camp, WEBX).

### 9.1 `permis_categories`
Catégories de permis de conduire gérées par l'auto-école.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `code` | varchar(10) | 'B', 'A1', 'A2', 'BE', 'C', 'D'... |
| `nom` | varchar(100) | 'Permis B', 'Permis A1'... |
| `code_ecommerce` | varchar(50) NULL | slug pour intégration e-commerce |
| `ext_gp_permis_id` | bigint | ID `gp*.permis.idpermis` |

> Source : `gp*.permis` (25 catégories : B, A1, A2, BE, C, D, AM, ETG, MSRE, PAP, TAXI...)

---

### 9.2 `filieres_formation`
Voies d'apprentissage GP pour un permis donné.
Ex : un élève prépare le permis B en filière AAC (apprentissage anticipé de la conduite).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(50) | 'AAC', 'Conduite Supervisée', 'Traditionnel', 'Annulation'... |
| `designation` | varchar(250) NULL | |
| `description` | text NULL | |
| `elements_dossier` | text NULL | liste des pièces justificatives requises |
| `code_joker` | varchar(4) NULL | code produit à insérer automatiquement en début de filière |
| `code_ecommerce` | varchar(50) NULL | |
| `ext_gp_filiere_id` | bigint | ID `gp*.filieres.idfiliere` |

> Source : `gp*.filieres` (13 filières : AAC, CS, Traditionnelle, Annulation de permis, PAP, Cyclo, Formation ETG...)

---

### 9.3 `produits`
Brique élémentaire du catalogue GP : leçon de conduite, cours de code, forfait théorie, présentation à l'examen, frais de dossier...

Un produit est référencé directement dans `creneaux_planning.produit_code` — c'est le lien entre le catalogue et le planning.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `code` | varchar(4) UNIQUE par franchise | '*LI', '*FT', '*PP', '*EVA', 'TH', 'PRAT'... |
| `nom` | varchar(50) | |
| `duree_minutes` | integer NULL | durée standard (NULL = sans durée : forfait) |
| `prix_unitaire` | decimal(12,4) NULL | tarif de base (cascade de tarification ci-dessous) |
| `code_tva` | varchar(4) NULL | 'EXO', '200' (20%), '206' (taux réduit)... |
| `compte_compta` | varchar(20) NULL | compte de produit |
| `compte_facav` | varchar(20) NULL | compte facture d'avance |
| `compte_tva_exoneree` | varchar(20) NULL | |
| `rubrique_comptable` | varchar(4) NULL | code analytique rubrique |
| `capacite` | integer NULL | nb places max sur un créneau de ce produit |
| `couleur` | integer NULL | couleur planning (RGB entier) |
| `famille_code` | varchar(2) NULL | code famille hérité legacy (ex: '51'=AAC, '52'=Traditionnel, NULL=commun) |
| `produit_facturation_id` | uuid FK produits NULL | produit utilisé en facturation à la place de celui-ci (ex : regroupement) |
| `code_joker` | varchar(4) NULL | code produit substitué dans certains contextes (e-commerce) |
| `est_hors_activite` | boolean | n'apparaît pas dans les stats d'activité (congés, absences moniteur...) |
| `est_hors_planning` | boolean | ne crée pas de créneau visible (frais purs) |
| `est_hors_facturation` | boolean | ne génère pas de ligne de facture |
| `est_theorie` | boolean | produit de formation théorique (code) |
| `est_au_volant` | boolean | leçon avec transfert de conduite à l'élève |
| `natures_limitees` | boolean | produit réservé à certaines natures d'élèves |
| `plafond_credit_avant_examen` | decimal(12,2) NULL | plafond récupération crédit PAP avant examen |
| `plafond_credit_apres_examen` | decimal(12,2) NULL | plafond récupération crédit PAP après examen |
| `mention_sms` | text NULL | template SMS automatique envoyé à l'élève à la planification |
| `mention_email` | text NULL | template email automatique |
| `mode_ecommerce` | enum('aucun','option','planning','mixte') | |
| `est_desactive` | boolean | |
| `ext_gp_produit_id` | bigint | PK `gp*.produits.idproduit` |

**Index :** `(franchise_id, code)` UNIQUE, `(franchise_id, est_hors_planning, est_desactive)`

> Source : `gp*.produits` (61 produits/agence)
> `produit_facturation_id` est une auto-référence : le produit `*CEL` (code en liberté) peut être facturé sous le produit `*COD` (cours de code). Permet de regrouper des lignes de facture sans changer la nature du créneau.

---

### 9.4 `tarifs_produits`
Tarification en cascade d'un produit. Le prix effectif appliqué est celui de la règle la plus précise qui correspond au contexte (filière + permis + site).

Cascade de précision (la première règle qui matche gagne) :
1. `accords_cadres` (tarif client négocié — hors cette table)
2. filière + permis + franchise (tarifs_apf)
3. site
4. famille seule (tarifs)
5. `produits.prix_unitaire` (base)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `produit_id` | uuid FK produits | |
| `site_id` | uuid FK sites NULL | NULL = toute l'agence |
| `filiere_id` | uuid FK filieres_formation NULL | NULL = toutes filières |
| `permis_categorie_id` | uuid FK permis_categories NULL | NULL = tous permis |
| `prix_unitaire` | decimal(12,4) | |
| `code_tva` | varchar(4) NULL | surcharge TVA |
| `compte_compta` | varchar(25) NULL | surcharge compte comptable |
| `compte_facav` | varchar(25) NULL | |
| `compte_tva_exoneree` | varchar(25) NULL | |
| `capacite` | integer NULL | surcharge capacité |
| `couleur` | integer NULL | surcharge couleur planning |

**Contrainte :** UNIQUE `(franchise_id, produit_id, site_id, filiere_id, permis_categorie_id)` — une seule règle par combinaison.

> Source : `gp*.tarifs` (produit × famille) + `gp*.tarifs_apf` (produit × agence × permis × filière) + `gp*.tarif_tar` (produit × site)

---

### 9.5 `accords_cadres`
Contrat tarifaire négocié avec une organisation cliente (entreprise, OPCO, collectivité...).
Les formations réalisées dans le cadre de cet accord s'appliquent les tarifs négociés.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(255) | |
| `date_debut` | date NULL | |
| `date_fin` | date NULL | |
| `signataire_id` | uuid FK personnes NULL | signataire côté client |
| `is_actif` | boolean | |
| `ext_gp_accord_id` | bigint | ID `gp*.accord_cadre_acc` |

---

### 9.6 `accords_cadres_organisations`
Organisations couvertes par un accord-cadre (clients, sous-traitants exclus...).

| Colonne | Type | Notes |
|---|---|---|
| `accord_cadre_id` | uuid FK accords_cadres PK | |
| `organisation_id` | uuid FK organisations PK | |
| `type_lien` | varchar(50) | 'bénéficiaire', 'exclu', 'co-signataire' |
| `observations` | text NULL | |

> Source : `gp*.cadre_accord_cadre_cac` (bénéficiaires) + `gp*.exclu_accord_cadre_xac` (exclusions)

---

### 9.7 `tarifs_accords_cadres`
Tarifs préférentiels d'un accord-cadre par produit. Priorité absolue sur tous les autres tarifs.

| Colonne | Type | Notes |
|---|---|---|
| `accord_cadre_id` | uuid FK accords_cadres PK | |
| `produit_id` | uuid FK produits PK | |
| `prix_accord` | decimal(12,4) NULL | prix négocié (NULL = prix catalogue) |
| `prix_maximum` | decimal(12,4) NULL | plafond de facturation |
| `remise_pct` | decimal(5,2) NULL | remise en % sur le prix catalogue |

> Source : `gp*.accord_cadre_tarif_act`

---

### 9.8 `autorisations_produits`
Formateurs / moniteurs habilités à enseigner un produit donné.
Règle métier : un moniteur ne peut pas être planifié sur un produit qu'il n'est pas habilité à dispenser.

| Colonne | Type | Notes |
|---|---|---|
| `produit_id` | uuid FK produits PK | |
| `ressource_id` | uuid FK ressources PK | |
| `franchise_id` | uuid FK franchises | |
| `created_at` | timestamptz | |

> Source : `gp*.produits_pedago` (2 904 lignes — idproduit × idpedago)

---

### 9.9 `criteres_pedagogiques`
Référentiel arborescent des critères d'évaluation pédagogique ECF-CERCA (spécifique GP conduite). Structure en arbre 4 niveaux : thème → séquence → critère → sous-critère.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `parent_id` | uuid FK criteres_pedagogiques NULL | NULL = racine |
| `nom` | varchar(255) | |
| `intitule_livret` | varchar(255) NULL | libellé officiel livret de formation |
| `niveau` | integer | profondeur dans l'arbre (1-4) |
| `ordre` | integer | tri à l'affichage |
| `description` | text NULL | |
| `objectifs` | text NULL | |
| `criteres_eval` | text NULL | critères d'évaluation associés |
| `url_fiche` | text NULL | lien fiche pédagogique externe |
| `url_quizz` | text NULL | lien quizz associé |
| `affi_ccas` | boolean | affiché dans carnet de suivi |
| `is_active` | boolean | |

> Source GP : `gp****.tpedago` (260 lignes) — critères conduite auto-école
> Source FP : `fplearn.tpedago` (1 669 lignes) — critères FP, même structure, référentiel distinct
> Dans la nouvelle application, les deux référentiels coexistent dans la même table (discriminés par `franchise_id` ou `mode`)

---

### 9.10 `baremes_criteres_pedagogiques`
Barèmes de scoring pour les sous-critères (notes possibles et leur description).

| Colonne | Type | Notes |
|---|---|---|
| `critere_id` | uuid FK criteres_pedagogiques PK | |
| `valeur` | integer PK | valeur de note (ex: 0, 1, 2, 3) |
| `nom` | varchar(255) | libellé de la valeur |
| `description` | text NULL | |
| `points` | decimal(6,2) NULL | pondération pour calcul de score global |

> Source : `gp****.tpedago_eval` (IDTpedago, Icritere, nom, description, points)

---

### 9.11 `criteres_parcours`
Tables d'association liant un critère pédagogique à son contexte d'application. Elles définissent **le parcours attendu** : quels critères sont à travailler selon la famille, la filière, le permis, le type de stage ou le produit. C'est la pièce centrale du livret de formation — sans ces tables, `criteres_pedagogiques` n'est qu'un référentiel inerte.

```
criteres_familles     (critere_id, filiere_formation_id)  -- parcours par filière GP
criteres_permis       (critere_id, permis_categorie_id)   -- parcours par permis GP
criteres_types_actions (critere_id, type_action_id)       -- parcours par type d'action FP
criteres_produits     (critere_id, produit_id)            -- critères déclenchés par produit
```

Chaque table est une association pure `(critere_id, contexte_id)` avec clé primaire composite.

> Source GP : `gp*.famille_pedago` (idfamille × idpedago), `gp*.filiere_pedago` (idfiliere × idpedago), `gp*.permis_pedago` (idpermis × idpedago), `gp*.produits_pedago` (idproduit × idpedago)
> Source FP : `gp*.typestg_pedago` (id_type_stage × idpedago), `gp*.action_pedago` (idaction × idpedago) — via ECFCoach IndexedDB

---

### 9.12 `evaluations_pedagogiques`
Trace des évaluations réalisées : note attribuée par le moniteur sur **un créneau**, pour **un élève**, sur **un critère** précis du référentiel. Table la plus volumineuse après `creneaux_planning` (~3,3 M lignes par centre GP).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | RLS — clé de partition |
| `creneau_id` | uuid FK creneaux_planning | le créneau/leçon |
| `personne_id` | uuid FK personnes | l'élève évalué |
| `critere_id` | uuid FK criteres_pedagogiques | le critère évalué |
| `icritere` | integer | index du barème dans `baremes_criteres_pedagogiques` |
| `note` | integer | valeur attribuée (0, 1, 2, 3…) |
| `observations` | text NULL | commentaire libre du moniteur |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Partitionnement :** aligné sur `creneaux_planning` par `(franchise_id, date)`.
**Index :** `(franchise_id, creneau_id)`, `(franchise_id, personne_id, critere_id)` — pour la vue livret de formation.

> Source : `gp****.Tpedago_plg_elv` (idplgarg, idtiers, idpedago, icritere, note, observations) — ~3,3 M lignes sur 1 centre dev
> Alimenté exclusivement depuis ECFCoach (tablette moniteur), via `synchro_retours_gplearn.php`

---

### 9.13 `progressions_personnes`
Critères pédagogiques acquis ou travaillés par une personne, **indépendamment d'un créneau** spécifique. Représente la progression globale dans le livret de formation — vue consolidée par élève.

| Colonne | Type | Notes |
|---|---|---|
| `personne_id` | uuid FK personnes | PK |
| `critere_id` | uuid FK criteres_pedagogiques | PK |
| `franchise_id` | uuid FK franchises | |
| `updated_at` | timestamptz | |

> Source : `gp*.tiers_pedago` (idtiers, idpedago)

---

### 9.14 `evaluations_cepc`
Compte-Rendu de l'Évaluation de la Pratique de la Conduite. Formulaire 14 critères (A-N) rempli par le moniteur sur tablette ECFCoach pour chaque passage, avant l'examen pratique. Interne à ECF-CERCA — pas de transmission directe Préfecture.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `creneau_id` | uuid FK creneaux_planning | créneau d'évaluation |
| `personne_id` | uuid FK personnes | élève |
| `A` … `N` | smallint NULL | note sur chacun des 14 critères CEPC |
| `obs_A` … `obs_N` | text NULL | observations par critère |
| `bilan` | varchar(10) NULL | bilan global |
| `T1`, `T2`, `T3`, `TJ`, `TK` | integer NULL | totaux calculés par catégorie |
| `updated_at` | timestamptz | |

> Source : `gp*.res_ex_cepc` (idplgarg, idtiers, A..N, obs_A..obs_N)
> Alimenté exclusivement depuis ECFCoach (`AppliPedago_cepc.js`)

---

### 9.15 `evaluations_evini`
Évaluation initiale de conduite (EVINI), saisie par le moniteur sur tablette ECFCoach lors de la première leçon. Trois variantes selon le permis préparé : voiture v1, voiture v2, moto. Données structurées très détaillées (~50-70 champs chacune) représentant la grille d'observation du comportement initial de l'élève.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `creneau_id` | uuid FK creneaux_planning | créneau de l'EVINI |
| `personne_id` | uuid FK personnes | élève |
| `variante` | enum('voiture_v1','voiture_v2','moto') | détermine quels champs sont renseignés |
| `donnees` | jsonb | l'intégralité des champs EVINI (50-70 selon variante) |
| `proposition` | text NULL | proposition de parcours rédigée par le moniteur |
| `iddoc_sig_eleve` | uuid FK documents NULL | signature élève |
| `iddoc_sig_parent` | uuid FK documents NULL | signature parent/responsable légal |
| `iddoc_sig_formateur` | uuid FK documents NULL | signature formateur |
| `updated_at` | timestamptz | |

**Justification jsonb :** les 3 variantes partagent ~30 % de champs communs. Stocker les 70 champs voiture en colonnes séparées rendrait la table illisible et les variantes difficiles à faire évoluer. Le jsonb est indexable et queryable en PostgreSQL.

> Source : `gp*.res_ex_evini` (~60 champs), `gp*.res_ex_evini2` (~70 champs), `gp*.res_ex_evini_moto` (~50 champs)
> Alimenté exclusivement depuis ECFCoach (`AppliPedago_L_aac.js` + variantes)

---

### Décisions de conception — Produits

#### D14 — `creneaux_planning` référence `produits` par FK, non par code varchar
Dans le schéma legacy, `plg_arg.produit` est un `varchar(4)` — jointure par valeur de code.
Dans le nouveau modèle, `creneaux_planning` ajoute une colonne `produit_id uuid FK produits` (nullable, NULL pour les créneaux FP qui utilisent `module_id`).

#### D15 — Tarification en cascade, résolution applicative
La cascade de tarifs (accord-cadre > agence×permis×filière > site > famille > base) est résolue côté application, pas en SQL. Une fonction `resoudre_tarif(produit_id, franchise_id, filiere_id, permis_id, site_id, accord_id)` retourne le prix et les comptes comptables à appliquer. Cela évite des jointures complexes à chaque génération de ligne de facture.

#### D16 — `famille_code` conservé comme legacy, pas comme FK
`produits.famille_code` reste un varchar(2) nullable (code legacy '51'/'52'). Il n'est pas normalisé en FK vers une table `familles` — les familles n'existent que dans le legacy comme discriminant implicite entre filières, et cette logique est désormais portée par les `tarifs_produits` (filiere_id + permis_categorie_id).

#### D17 — `produit_facturation_id` : auto-référence de regroupement
Certains produits pédagogiques (ex: `*CEL` code en liberté) sont planifiés sous leur propre code mais facturés sous un autre produit de regroupement. La colonne `produit_facturation_id` préserve ce comportement. La règle : si non NULL, c'est ce produit-là qui apparaît sur la facture.

---

---

## 10 — EXAMENS

Spécifique GP. Les passages de code et de conduite — planification prévisionnelle, inscription aux sessions, résultats bruts et grilles détaillées.

### 10.1 `types_examens`
Référentiel des épreuves (code, conduite, évaluation initiale...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(50) | 'Code ETG', 'Conduite B', 'ALA', 'EB'... |
| `type_resultat` | enum('oui_non','note','nb_fautes','sans','heures_theo_prat','oui_non_nb_fautes') | comment est exprimé le résultat |
| `ext_gp_exam_id` | integer | ID `gp*.examens.idexam` |

> Source : `gp*.examens`

---

### 10.2 `sessions_examens`
Créneau d'examen réel organisé par l'agence (distinct de `creneaux_planning` qui est le planning opérationnel interne).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `type_examen_id` | uuid FK types_examens | |
| `site_id` | uuid FK sites | agence organisatrice |
| `date` | date | |
| `heure_debut` | time | |
| `heure_fin` | time | |
| `numero` | integer NULL | numéro de convocation |
| `nb_places` | integer NULL | `unites` |
| `ext_gp_examen_id` | bigint | ID `gp*.examen.idexam` |

> Source : `gp*.examen` (sessions réelles) — à ne pas confondre avec `gp*.examens` (référentiel)
> **Note :** `creneaux_planning.examen_id` FK vers cette table (§4.2)

---

### 10.3 `inscriptions_examens`
Inscription d'un apprenant à une session d'examen, prévisionnelle ou confirmée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | |
| `session_examen_id` | uuid FK sessions_examens | |
| `franchise_id` | uuid FK franchises | |
| `statut` | enum('prevu','liste_attente','confirme','passe','absent','annule') | xoption + état |
| `ordre_passage` | smallint NULL | ordre dans la session |
| `semaine` | integer NULL | semaine calendaire prévue |
| `annee` | smallint NULL | année prévisionnelle |
| `mois` | tinyint NULL | mois prévisionnel |

> Source : `gp*.previ_exam_eleves` (prévisionnel) + `gp*.plg_rang_exam` (ordre passage)

---

### 10.4 `resultats_examens`
Résultat global d'un passage pour un apprenant.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `inscription_examen_id` | uuid FK inscriptions_examens | |
| `creneau_planning_id` | uuid FK creneaux_planning NULL | créneau d'examen si planifié |
| `option_id` | uuid FK options_examens NULL | sous-épreuve (ex: plateau, circulation) |
| `resultat` | integer NULL | valeur brute (0/1 pour oui/non, note, nb fautes...) |
| `resultat_secondaire` | integer NULL | `resultat2` — résultat complémentaire |
| `json_details` | jsonb NULL | données structurées spécifiques au type d'examen |
| `saisie_le` | timestamptz | |

> Source : `gp*.res_ex` (idplgarg, tiers, idopt_exam, resultat, resultat2, json_values)

---

### 10.5 `options_examens`
Sous-épreuves d'un type d'examen (ex : plateau / circulation pour le permis B).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `type_examen_id` | uuid FK types_examens | |
| `nom` | varchar(50) | 'Plateau', 'Circulation', 'ETG série A'... |
| `ext_gp_opt_exam_id` | integer | ID `gp*.opt_exam.idopt_exam` |

> Source : `gp*.opt_exam`

---

### 10.6 `resultats_conduite_cepc`
Grille CEPC (Certificat d'Examen du Permis de Conduire) — 14 thèmes évalués. Structure fixe imposée par la réglementation.

| Colonne | Type | Notes |
|---|---|---|
| `resultat_examen_id` | uuid FK resultats_examens PK | |
| `theme_a` ... `theme_n` | char(1) | note par thème (A=Maîtrise véhicule ... N=Éco-conduite) |
| `obs_a` ... `obs_n` | text NULL | observations du jury par thème |
| `saisie_le` | timestamptz | |

> Source : `gp*.res_ex_cepc` (14 colonnes A-N + 14 obs_*)
> Structure normative : les 14 thèmes sont fixes (réglementation CESR), pas de flexibilité requise.

---

### 10.7 `evaluations_initiales`
Fiche de premier contact — profil conducteur de l'apprenant avant toute formation. ~60 indicateurs booléens (expérience préalable, motivations, comportements...) + proposition pédagogique.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | |
| `creneau_planning_id` | uuid FK creneaux_planning NULL | créneau de l'évaluation |
| `franchise_id` | uuid FK franchises | |
| `profil` | jsonb | les ~60 booléens du profil (expérience, motivations, comportements...) |
| `proposition_module` | varchar(50) NULL | module pédagogique proposé |
| `proposition_acceptee` | boolean NULL | l'apprenant accepte la proposition |
| `module_applique` | varchar(50) NULL | module finalement appliqué |
| `volume_total_h` | decimal(6,2) NULL | volume total proposé en heures |
| `volume_conduite_h` | decimal(6,2) NULL | |
| `volume_theorie_h` | decimal(6,2) NULL | |
| `document_sig_eleve_id` | uuid FK documents NULL | |
| `document_sig_parent_id` | uuid FK documents NULL | |
| `document_sig_formateur_id` | uuid FK documents NULL | |
| `saisie_le` | timestamptz | |

> Source : `gp*.res_ex_evini` (~60 champs tinyint + PROP_* → normalisé en JSONB)
> **D18** : les ~60 booléens de profil sont stockés en JSONB — structure normative imposée par la réglementation (formulaire officiel EV.INI), non interrogée champ par champ.

---

### 10.8 `regles_conformite_examens`
Contrôles réglementaires : délais min/max entre étapes (inscription → passage → obtention).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `type_examen_id` | uuid FK types_examens | |
| `famille_code` | varchar(10) NULL | famille GP concernée |
| `etape` | enum('inscription','enregistrement','presentation','presentation_1','presentation_x1','presentation_2','obtention','plannification','age','validite_etg') | |
| `delai_maxi` | varchar(150) NULL | expression du délai max (ex: '3 ans', '6 mois') |
| `delai_mini` | varchar(150) NULL | |

> Source : `gp*.controles_examens`

---

## 11 — MODÈLES DE DOCUMENTS

Trois familles de modèles distinctes : forfaits de formation, templates Word/ODT pour génération de documents, gabarits de planning.

### 11.1 `forfaits_formation`
Offres de formation pré-construites (ex : "Pack AAC 20h + code"), vendables en ligne. Correspond aux `modeles` GP.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `libelle` | varchar(50) | |
| `permis_categorie_id` | uuid FK permis_categories NULL | |
| `filiere_id` | uuid FK filieres_formation NULL | |
| `type_action_id` | uuid FK types_actions NULL | FP |
| `site_id` | uuid FK sites NULL | site de production |
| `identifiant_offre` | char(1) NULL | code offre A-F (e-commerce) |
| `nb_points_inscription` | smallint NULL | points de fidélité |
| `vendu_en_ligne` | boolean | |
| `publie_web` | boolean | |
| `acompte_ecommerce` | decimal(10,2) NULL | |
| `delai_paiement` | varchar(7) NULL | |
| `descr_ecommerce` | text NULL | description boutique |
| `observations` | text NULL | |
| `conditions_particulieres` | text NULL | |
| `ext_gp_modele_id` | bigint | ID `gp*.modeles.numero` |

> Source : `gp*.modeles`

---

### 11.2 `lignes_forfaits`
Produits constituant un forfait avec quantités et conditions tarifaires.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `forfait_id` | uuid FK forfaits_formation | |
| `produit_id` | uuid FK produits | |
| `ordre` | smallint | |
| `est_forfait` | boolean | produit vendu en forfait (prix fixe) ou à l'unité |
| `quantite` | decimal(8,3) | |
| `type_remise` | enum('montant','pourcentage') | |
| `remise_pct` | decimal(6,2) NULL | |
| `remise_montant` | decimal(12,2) NULL | |
| `prix_ht` | decimal(12,2) | |
| `prix_ttc` | decimal(12,2) | |
| `code_tva` | varchar(4) | |
| `libelle_surcharge` | varchar(50) NULL | libellé alternatif sur la facture |

> Source : `gp*.lmodele`

---

### 11.3 `modeles_docx`
Templates Word/ODT pour génération automatique de documents (contrats, attestations, convocations...). Stockés en MinIO (blob migré depuis la base).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(255) | |
| `mode` | enum('gp','fp','les_deux') | |
| `type_document` | varchar(50) | 'contrat','attestation','convocation','bilan','courrier'... |
| `cle_stockage` | varchar(500) | chemin MinIO |
| `publie_generique` | boolean NULL | disponible sans restriction de contexte |
| `ext_gp_lien_table` | varchar(50) NULL | table d'origine GP (`docx_modele_permis`...) |
| `ext_pfp_docx_id` | bigint NULL | ID `plgfpro.docx_modeles` |
| `created_at` | timestamptz | |

> Source : `gp*.documents` (blobs) + `plgfpro.docx_modeles` (blobs) → tous migrés vers MinIO

---

### 11.4 `contextes_modeles_docx`
Règles d'association : quel modèle s'applique selon le contexte (permis, filière, type de dossier...).

| Colonne | Type | Notes |
|---|---|---|
| `modele_docx_id` | uuid FK modeles_docx PK | |
| `type_contexte` | enum('permis','filiere','type_action','site','dossier','handicap','origine_prospect','famille') PK | |
| `valeur_contexte_id` | uuid PK | FK polymorphique vers la table du contexte |

> Source : 7 tables GP `docx_modele_*` (agence, dossier, famille, filiere, handicap, orig_pros, permis, permis_filiere, type_stage)

---

### 11.5 `modeles_planning`
Gabarits de planning réutilisables — FP (squelette de sessions récurrentes) et GP (semaine-type avec moniteurs et créneaux pré-remplis).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `mode` | enum('gp','fp') | |
| `type_action_id` | uuid FK types_actions NULL | FP : type d'action |
| `site_id` | uuid FK sites NULL | site par défaut |
| `nom` | varchar(255) | |
| `date_debut_modele` | date NULL | date de référence du modèle |
| `date_fin_modele` | date NULL | |
| `duree_theorique_h` | integer NULL | |
| `ext_pfp_modele_plg_id` | bigint NULL | ID `plgfpro.modeles_plg` |
| `ext_gp_modele_plg_id` | bigint NULL | ID `gp****.modeles_planning` |

> Source FP : `plgfpro.modeles_plg`
> Source GP : `gp****.modeles_planning` (427 gabarits — stocke aussi les créneaux dans `mopl_plg_arg`)

---

### 11.6 `creneaux_modeles_planning`
Créneaux constituant un gabarit de planning.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `modele_planning_id` | uuid FK modeles_planning | |
| `module_id` | uuid FK modules NULL | FP : module pédago |
| `produit_id` | uuid FK produits NULL | GP : produit planifié |
| `date_debut` | date NULL | date relative dans le gabarit |
| `date_fin` | date NULL | |
| `heure_debut` | time NULL | |
| `heure_fin` | time NULL | |
| `quantite` | decimal(10,4) NULL | |
| `commentaire` | tinytext NULL | |
| `horsfact` | boolean | hors facturation |

> Source FP : `plgfpro.modeles_plg_plg`
> Source GP : `gp****.mopl_plg_arg` (créneaux) + `mopl_plg_ress` (ressources affectées) + `mopl_plg_pdg` (pédago)

---

## 12 — NOTIFICATIONS

Envois automatiques et manuels de SMS et emails aux apprenants, formateurs et contacts.

### 12.1 `modeles_notifications`
Templates réutilisables unifiés (SMS et email dans la même table).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(150) | |
| `canal` | enum('sms','email','les_deux') | |
| `sujet_email` | text NULL | sujet si email |
| `corps` | text | contenu (SMS ou corps email) |
| `variables_disponibles` | jsonb NULL | liste des variables de substitution disponibles |

> Source : `gp*.modeles_sms` (id, nom, sms) + `gp*.modeles_email` (id, nom, sujet, email) → unifiés

---

### 12.2 `automates_notifications`
Règles d'envoi automatique déclenchées par des événements métier (planification d'un produit, J-X avant examen...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `nom` | varchar(250) | |
| `type_declencheur` | varchar(50) | 'planification_produit', 'j_avant_examen', 'inscription_stage'... |
| `moment` | varchar(20) | 'avant', 'apres', 'jour_j' |
| `decalage_jours` | integer NULL | |
| `decalage_minutes` | integer NULL | |
| `produits_concernes` | text NULL | liste CSV de codes produits déclencheurs |
| `modele_notification_id` | uuid FK modeles_notifications | |
| `inclure_contenu_pedago` | boolean | `pedago` = inclure lien ou contenu pédagogique |
| `is_actif` | boolean | |

> Source : `gp*.automates_personnalises` (0 ligne en prod gp3101 — table prête, non utilisée)

---

### 12.3 `journal_notifications`
Historique des envois.

| Colonne | Type | Notes |
|---|---|---|
| `id` | bigint PK | volume élevé |
| `franchise_id` | uuid | |
| `modele_id` | uuid FK modeles_notifications NULL | |
| `automate_id` | uuid FK automates_notifications NULL | NULL = envoi manuel |
| `canal` | enum('sms','email') | |
| `destinataire_personne_id` | uuid FK personnes NULL | |
| `destinataire_ressource_id` | uuid FK ressources NULL | |
| `adresse_destination` | varchar(255) | numéro ou email effectivement utilisé |
| `statut` | enum('envoye','echec','en_attente') | |
| `erreur` | text NULL | |
| `envoye_le` | timestamptz | |

> Source : `plgfpro.histo_sms` (iduser, iddest, tampon, message) — historique FP uniquement

---

## 13 — VENTE EN LIGNE

Configuration des boutiques en ligne GP — quels forfaits sont publiés, dans quel contexte, avec quelles options produits web.

### 13.1 `regles_publication_ecommerce`
Règles d'affichage d'un forfait en ligne : combinaisons agence × famille × filière × permis autorisées.

| Colonne | Type | Notes |
|---|---|---|
| `forfait_id` | uuid FK forfaits_formation PK | |
| `site_id` | uuid FK sites NULL PK | NULL = toutes les agences |
| `famille_code` | varchar(2) NULL PK | |
| `filiere_id` | uuid FK filieres_formation NULL PK | |
| `permis_categorie_id` | uuid FK permis_categories NULL PK | |

> Source : 4 tables `gp*.modeles_vente_enligne_agences/familles/filieres/permis`

---

### 13.2 `produits_web_forfait`
Détail des produits présentés sur la boutique en ligne pour un forfait donné.

| Colonne | Type | Notes |
|---|---|---|
| `forfait_id` | uuid FK forfaits_formation PK | |
| `code_produit_web` | varchar(50) PK | code produit côté plateforme e-commerce |
| `ordre` | integer NULL | |
| `libelle` | varchar(255) NULL | |
| `description` | text NULL | |
| `produit_formation_web` | varchar(50) NULL | code de formation côté web |

> Source : `gp*.modele_ecommerce_pdtweb`

---

## 14 — RÉMUNÉRATIONS UNIFIÉES

**Mise à jour de §6.4** : `heures_travail` couvrait uniquement le FP (`plgfpro.heures_trav`). Le GP utilise `heures_saisies` avec une granularité plus fine (13 types d'éléments, unité en secondes). La table unifiée absorbe les deux.

### 14.1 `heures_travail` *(mise à jour §6.4)*

Ajout des colonnes GP à la table déjà définie en §6.4 :

| Colonne | Type | Notes |
|---|---|---|
| *(colonnes §6.4 conservées)* | | |
| `type_element` | enum('hprod','hadmin','rtt','jferie','maladie','recup','cp','cep','cet','formation','deplacement','reunion','partiel') NULL | GP : type d'élément de temps (NULL pour lignes FP) |
| `famille_code` | varchar(2) NULL | GP : famille de la ressource (pour ventilation analytique) |

> Source GP : `gp*.heures_saisies` (sec_calc/sais/val en secondes → converti en décimal heures) + `gp*.heures_saisies_justif`
> **D19** : L'unité source GP est la **seconde** ; FP est le **décimal heures**. La table unifiée stocke en décimal heures (conversion ÷ 3600 à l'import).

---

## 15 — GÉOLOCALISATION AAC

Traces GPS des trajets en conduite accompagnée — bilan de progression consultable par l'apprenant et le formateur.

### 15.1 `trajets`
Synthèse d'un trajet par apprenant + créneau — kilométrage par type de voie et conditions météo. Couvre les trajets AAC (GP) et les trajets formateurs FP (coaching en situation de travail).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | apprenant (GP) ou formateur (FP) |
| `ressource_id` | uuid FK ressources NULL | formateur FP associé si trajet coaching |
| `franchise_id` | uuid FK franchises | |
| `creneau_planning_id` | uuid FK creneaux_planning NULL | créneau associé si connu |
| `debut` | timestamptz | |
| `fin` | timestamptz NULL | |
| `km_total` | decimal(8,3) NULL | |
| `km_ville` | decimal(8,3) NULL | |
| `km_route_nationale` | decimal(8,3) NULL | |
| `km_route_departementale` | decimal(8,3) NULL | |
| `km_autoroute` | decimal(8,3) NULL | |
| `km_indetermine` | decimal(8,3) NULL | |
| `km_jour` | decimal(8,3) NULL | |
| `km_nuit` | decimal(8,3) NULL | |
| `km_soleil` | decimal(8,3) NULL | |
| `km_pluie` | decimal(8,3) NULL | |
| `km_neige` | decimal(8,3) NULL | |
| `km_brume` | decimal(8,3) NULL | |
| `km_nuage` | decimal(8,3) NULL | |
| `observations` | text NULL | |
| `est_manuel` | boolean | trajet saisi manuellement (sans trace GPS) |

> Source GP : `gp****.trajets_geoloc_aac` (127 460 lignes dans gp3101)
> Source FP : `fplearn.trajets_coach_trs` (même structure, trajet du formateur FP avec l'apprenant)

---

### 15.2 `points_geoloc`
Trace GPS temps réel — points individuels enregistrés pendant le trajet.

| Colonne | Type | Notes |
|---|---|---|
| `trajet_id` | uuid FK trajets_aac PK | |
| `horodatage` | timestamptz PK | |
| `latitude` | double precision | |
| `longitude` | double precision | |
| `vitesse_kmh` | double precision NULL | |
| `distance_m` | double precision NULL | distance depuis le point précédent |
| `precision_m` | double precision NULL | précision GPS en mètres |
| `jour_nuit` | char(1) NULL | 'J' / 'N' |
| `meteo` | enum('soleil','brume','nuage','bruine','pluie','neige','indeterminee') NULL | |
| `voie` | enum('ville','route_dep','route_nat','autoroute','indeterminee') NULL | |

> Source : `gp*.trajets_geoloc_details` (12 634 points dans gp3101)
> **D20** : Volume élevé attendu (~12 K pts/agence × 20 = 240 K pts en prod). Partition par `(franchise_id, trajet_id)`. TTL 5 ans (données pédagogiques réglementaires AAC).

---

## 16 — SIGNATURE ÉLECTRONIQUE

Le module de signature qualifiée utilise **Lex Persona** (pas Tezos — `tezos-digisign` était un prototype abandonné). La table `lex_sign` dans la base `block_chains` enregistre les workflows de signature.

### 16.1 `workflows_signature`
Suivi des demandes de signature électronique qualifiée (contrats, attestations...).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `workflow_lex_id` | varchar(100) | ID workflow côté Lex Persona |
| `document_lex_id` | varchar(100) | ID document côté Lex Persona |
| `type_entite` | varchar(50) | 'contrats', 'factures', 'documents'... |
| `entite_id` | uuid | FK polymorphique |
| `personne_id` | uuid FK personnes NULL | signataire |
| `statut` | varchar(50) | 'started', 'signed', 'refused', 'expired'... |
| `cree_le` | timestamptz | |
| `signe_le` | timestamptz NULL | |

> Source : `block_chains.lex_sign` (wfl, doc, base, tiers, numfact, numdev, status)
> **D21** : `contrats.tx_blockchain_id` et `documents.tx_blockchain_id` (§7.4 et §8.1) deviennent `workflows_signature.workflow_lex_id` — le champ existant conserve la compatibilité migration.

---

## 17 — CONSOLIDATION RÉSEAU

Les tables `compilcerca_*` sont des **agrégats calculés par scripts batch** — elles ne sont pas des entités transactionnelles.

**Décision D22** : Dans le nouveau système, `compilcerca_stats_agences` et `compilcerca_stats_age_inscr` (~50 KPI par agence/permis/filière/mois) sont remplacés par des **vues matérialisées PostgreSQL** rafraîchies toutes les nuits via `pg_cron`. Le module de reporting réseau interroge ces vues directement.

```sql
-- Exemple : vue matérialisée stats réseau
CREATE MATERIALIZED VIEW stats_reseau_mensuel AS
SELECT
  franchise_id,
  date_trunc('month', date_debut) AS mois,
  permis_categorie_id,
  filiere_id,
  COUNT(DISTINCT inscriptions.personne_id) AS n_apprenants,
  COUNT(DISTINCT inscriptions.id) AS n_inscriptions,
  SUM(lignes_factures.prix_unitaire * lignes_factures.quantite) AS ca_ht,
  ...
FROM sessions_formation
JOIN inscriptions USING (session_formation_id)
JOIN lignes_factures USING (inscription_id)
GROUP BY 1, 2, 3, 4;
```

> Source : `gp*.compilcerca_stats_agences` / `compilcerca_stats_age_inscr` / `compilcerca_remis_bq_agences`

---

## 18 — DIAGRAMME DE RELATIONS MIS À JOUR

```
franchises ──────────────────────────────────────────────────────────────────────┐
   │                                                                             │
   ├── sites                                                                     │
   ├── utilisateurs ── roles_utilisateurs ── roles ── permissions_roles          │
   ├── organisations ── liens_organisations                                      │
   │                                                                             │
   ├── personnes ─────── certifications_personnes                                │
   │          │                                                                  │
   │          ├──────── evaluations_initiales                                    │
   │          └──────── trajets_aac ── points_geoloc                             │
   │                                                                             │
   ├── activites ── types_actions ── modules                                     │
   │                             └── competences                                 │
   │                                                                             │
   ├── permis_categories                                                         │
   ├── filieres_formation                                                        │
   ├── produits ── tarifs_produits ── accords_cadres ── tarifs_accords_cadres    │
   │          └── autorisations_produits                                         │
   │                                                                             │
   ├── forfaits_formation ── lignes_forfaits                                     │
   │          └── regles_publication_ecommerce                                   │
   │          └── produits_web_forfait                                           │
   │                                                                             │
   ├── types_ressources                                                          │
   ├── ressources ─── ressources_sites ──► sites                                │
   │             ├─── competences_ressources                                     │
   │             ├─── heures_travail                                             │
   │             ├─── suivis_ressources                                          │
   │             └─── liens_ressources_personnes ──► personnes                  │
   │                                                                             │
   ├── groupes_planning ─── groupes_planning_sites ──► sites                    │
   │                    └── groupes_planning_ressources ──► ressources           │
   │         utilisateurs_groupes_planning ──► utilisateurs + groupes_planning  │
   │                                                                             │
   ├── types_examens ── options_examens                                          │
   ├── sessions_examens ── inscriptions_examens ── resultats_examens             │
   │                                           ├── resultats_conduite_cepc       │
   │                                           └── regles_conformite_examens     │
   │                                                                             │
   ├── criteres_pedagogiques (arbre auto-réf.) ── baremes_criteres_pedagogiques  │
   │                                                                             │
   ├── sessions_formation ─────────────────────────────────────────────────┐    │
   │        └── creneaux_planning ── ressources_creneaux                   │    │
   │                             ├── besoins_creneaux                      │    │
   │                             ├── affectations_pedagogiques             │    │
   │                             ├── evaluations_pedagogiques ──► criteres_pedagogiques │
   │                             ├── commentaires_creneaux_apprenants      │    │
   │                             ├── liens_creneaux                        │    │
   │                             └── sessions_examens (FK examen_id)       │    │
   │                                                                       │    │
   ├── inscriptions ─────────────────────────────────────────────────────► │    │
   │        ├── presence_creneaux                                          │    │
   │        └── emargements                                                │    │
   │                                                                       │    │
   ├── factures ── lignes_factures ────────────────────────────► creneaux  │    │
   ├── reglements                                                           │    │
   └── contrats ── workflows_signature                                     │    │
                                                                           │    │
   ├── modeles_docx ── contextes_modeles_docx                              │    │
   ├── modeles_planning ── creneaux_modeles_planning                       │    │
   ├── modeles_notifications ── automates_notifications                    │    │
   └── journal_notifications                                               │    │
                                                                           │    │
journal_audit, documents ←── transverse (toutes entités) ─────────────────┘────┘
stats_reseau_mensuel (vue matérialisée, rafraîchissement nuit)
```

---

## 19 — DÉCISIONS DE CONCEPTION (suite)

*(D1–D17 en §10 — Décisions de conception)*

### D18 — EV.INI en JSONB
Les ~60 booléens du formulaire EV.INI (`res_ex_evini`) sont stockés en JSONB. Structure normative imposée par la réglementation : le formulaire est fixe, lu intégralement pour affichage, jamais interrogé champ par champ dans les requêtes SQL.

### D19 — Unité secondes (GP) → décimal heures
`heures_saisies` stocke les durées en secondes (sec_calc, sec_sais, sec_val). La migration divise par 3600 vers `heures_travail.duree_calculee / saisie / validee` en décimal. La perte de précision (< 1 s) est acceptable pour la gestion des temps.

### D20 — `points_geoloc` partitionné et TTL 5 ans
Volume estimé ~240 K points en production. Partition par `(franchise_id, RANGE horodatage)` en tranches mensuelles. Archivage automatique après 5 ans (durée légale de conservation des données de conduite AAC).

### D21 — Lex Persona remplace Tezos
Le module `tezos-digisign` (présent dans `.gitignore`, jamais commité) était un prototype. La production utilise **Lex Persona** (signature électronique qualifiée eIDAS niveau avancé). `tx_blockchain_id` dans `contrats` et `documents` migre vers `workflow_lex_id` dans `workflows_signature`.

### D28 — Planification transversale : les ressources mixtes sont vérifiées cross-mode

**Contexte :** certaines ressources sont utilisées indifféremment en GP et en FP — pistes/plateaux de manœuvres, véhicules poids lourds (permis C en GP + FCO/FIMO en FP), instructeurs habilités dans les deux domaines, salles de cours partagées. Actuellement, GPLearn et PlgFPro ignorent mutuellement leurs réservations, rendant les doubles-réservations invisibles.

**Règle dans le nouveau système :**

1. `types_ressources.mode = 'les_deux'` identifie les ressources partagées.
2. Lors de la création d'un `creneaux_planning`, la vérification de conflit porte sur **tous** les `creneaux_planning` existants pour cette ressource, **indépendamment du mode** (`gp` ou `fp`). La requête de détection :

```sql
SELECT cp.id, cp.mode, cp.heure_debut, cp.heure_fin, sf.nom AS session
FROM creneaux_creneaux cp
JOIN ressources_creneaux rc ON rc.creneau_planning_id = cp.id
WHERE rc.ressource_id = @ressource_cible
  AND cp.date_debut = @date
  AND cp.heure_debut < @heure_fin_nouvelle
  AND cp.heure_fin  > @heure_debut_nouvelle
  AND cp.id != @creneau_en_cours
```

3. La granularité du conflit est **créneau par créneau** (pas à la journée) : une piste FP réservée de 13h à 17h reste disponible en GP de 8h à 12h le même jour.

4. Dans l'interface planning, les créneaux d'un mode étranger sur une ressource mixte sont affichés avec une couleur distincte et non modifiables (lecture seule depuis l'autre contexte).

5. Les `groupes_planning` peuvent inclure des ressources de mode `'les_deux'` — elles apparaissent alors dans les vues GP et FP simultanément, affichant leurs créneaux des deux modes.

**Impact MCD :** aucune table supplémentaire — la détection de conflit est applicative, basée sur le modèle existant. `ressources.mode` (hérité de `types_ressources.mode`) est l'index de routage.

### D22 — compilcerca → vues matérialisées PostgreSQL
Les tables `compilcerca_*` (agrégats batch) n'ont pas d'équivalent transactionnel dans le nouveau schéma. Remplacées par des vues matérialisées rafraîchies par `pg_cron` chaque nuit. Les anciennes tables sont conservées en lecture seule pendant la transition pour alimenter les dashboards existants.

---

### D23 — 1 base par entreprise (pas par centre de formation)
Dans l'existant, chaque base `gp****` = 1 centre de formation, avec une base par groupe d'agences. Dans la refonte, CERCA aura **une seule base** pour tous ses centres de formation (idem pour chaque autre entreprise du groupe). Avantages : planification inter-sites native (un moniteur planifiable sur plusieurs sites sans jointure cross-database), rapports consolidés sans pipeline batch, gestion unifiée des utilisateurs. L'isolation des données reste assurée par RLS sur `franchise_id` (centre de formation) pour les utilisateurs qui ne doivent voir qu'un sous-ensemble.

---

### D25 — Évaluations pédagogiques : PK quadruple, pas d'UUID
`evaluations_pedagogiques` a une PK composite (creneau_id, personne_id, ressource_id, critere_id). Pas d'UUID surrogate — le quadruplet est naturellement unique et chaque UPDATE cible exactement une ligne. Partition par `creneau_id` (RANGE mensuel, cohérente avec `creneaux_planning`). Cette table représente ~50% du volume total de la base.

---

### D24 — `ressources` multi-sites via `ressources_sites`
Le champ `agence_def` de `intervt` et la table `age_ress` (N agences par ressource) sont remplacés par `ressources_sites (ressource_id, site_id, est_site_principal)`. Suppression du tableau `uuid[]` dans `ressources.sites` — trop opaque pour les jointures et les contraintes FK. Les groupes de planning (`groupes_planning_ressources`) se construisent ensuite en sélectionnant des ressources indépendamment de leur site principal.

---

## 20 — VOLUMES & STRATÉGIE D'INDEX (mis à jour)

| Table | Dev (×1) | Prod (×20) | Partition | Index critiques |
|---|---|---|---|---|
| `creneaux_planning` | 5,96 M | **~120 M** | RANGE date_debut (mensuel) | franchise_id+date_debut, session_formation_id |
| `sessions_formation` | 8,2 M | ~164 M | non | franchise_id+date_debut, type_action_id |
| `inscriptions` | 5,4 M | ~108 M | RANGE (aligné sessions) | personne_id, session_formation_id |
| `personnes` | 464 K | ~9,3 M | non | franchise_id+nom, email, ext_gp_tiers_id |
| `factures` | 1,5 M | ~30 M | non | franchise_id+date, personne_facturee_id |
| `reglements` | 1,27 M | ~25 M | non | franchise_id+date_reglement |
| `heures_travail` | 917 K + 11 K | ~19 M | non | ressource_id+date_travail, type_element |
| `competences_ressources` | 46 K | ~920 K | non | ressource_id, competence_id+valide_jusqu_au |
| `trajets_aac` | 127 K | ~2,5 M | non | personne_id, franchise_id+debut |
| `points_geoloc` | 12 K | ~240 K | RANGE horodatage (mensuel) | trajet_id, horodatage |
| `resultats_examens` | faible | faible | non | inscription_examen_id |
| `journal_notifications` | variable | élevé | TTL 1 an | franchise_id+envoye_le |
| `journal_audit` | — | très élevé | TTL 3 ans | created_at DESC |

---

## 21 — ENTITÉS RESTANTES (phase 3)

### Entités à analyser

- **`referentiel_geo`** : `geo_meteo.ident_u_tiers` — identités élèves centralisées inter-agences (mégabase GUID). Nécessite analyse spécifique de la table `geo_meteo` non accessible.
- **`remunerations_moniteurs`** : paie finale des moniteurs (fiches de paie, charges sociales) — probablement dans un système RH externe (Silae, Sage Paie). À confirmer.
- **`myRoad`** / **`campus`** : espace apprenant web/mobile — architecture à définir selon le futur de ces applications (refonte ou conservation).

---

## 22 — DISPONIBILITÉS

### 22.1 `periodes_disponibilite_ressources`
Période de disponibilité d'une ressource (moniteur, formateur, équipement). Conteneur temporel — les plages horaires détaillées sont dans `plages_horaires_dispo`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `ressource_id` | uuid FK ressources | |
| `date_debut` | date | début de la période de validité |
| `date_fin` | date | fin de la période de validité |
| `semaines_cycle` | integer NULL | 1 = toutes les semaines, 2 = alternance paire/impaire |
| `notes` | text NULL | |

> Source : `gp****.dispo_dates` (iddispo_dates, idress, du, au, semaines_cycle)

---

### 22.2 `plages_horaires_dispo`
Plages horaires journalières au sein d'une période de disponibilité. Une ressource peut avoir plusieurs plages par jour (matin + après-midi).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `periode_id` | uuid FK periodes_disponibilite_ressources | |
| `jour_semaine` | smallint | 0=lundi … 6=dimanche (après conversion `(jour+6)%7` depuis legacy) |
| `semaine_dans_cycle` | smallint NULL | semaine concernée si cycle > 1 |
| `heure_debut` | time | |
| `heure_fin` | time | |

> Source : `gp****.disp_horaires` (iddispo_dates, jour, semaine, hdeb, hfin)
> Relation : N plages pour 1 période (plusieurs créneaux horaires par jour)

---

### 22.3 `disponibilites_apprenants`
Disponibilité ponctuelle d'un apprenant (date à date), utilisée pour filtrer les propositions de créneaux dans le planning.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `personne_id` | uuid FK personnes | |
| `franchise_id` | uuid FK franchises | |
| `date` | date | jour de disponibilité |
| `heure_debut` | time NULL | NULL = toute la journée |
| `heure_fin` | time NULL | |
| `est_indisponible` | boolean | false = disponible, true = indisponible (congé, contrainte) |
| `notes` | text NULL | |

> Source : `gp****.dispo_tiers` (tiers, date, + colonnes horaires si présentes)

---

## 23 — CRM UNIFIÉ

Couvre le cycle complet du prospect à la facturation : acquisition → interaction → devis → contrat signé → facture générée.

### 23.1 Flux CRM

```
Personne (prospect)
      │
      ▼
pipeline_crm          ← statut : nouveau → en_contact → devis_envoyé → inscrit → perdu
      │
      ├──► interactions  ← fiche de renseignement, RDV, note, email entrant...
      │         └──► rappels (J+14, J+X...)
      │
      ├──► devis         ← offre tarifée
      │         └──► lignes_devis
      │         └──► rappels (J+14...)
      │
      └──► contrats      ← contrat de formation (§7.4 enrichi)
                └──► signataires_contrat ← élève + responsable légal si mineur
                          │  (tous signés ?)
                          ▼
                       factures  ← générée automatiquement à signature complète
```

---

### 23.2 `pipeline_crm`
Suivi de l'état d'avancement d'un prospect/élève dans le cycle commercial d'une franchise. Une personne peut avoir plusieurs entrées pipeline si elle revient après abandon.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `site_id` | uuid FK sites | agence de contact initiale |
| `personne_id` | uuid FK personnes | |
| `statut` | enum('nouveau','en_contact','devis_envoye','contrat_envoye','inscrit','perdu','archive') | |
| `canal_acquisition` | enum('web','bouche_oreille','panneau','telephone','prescription','autre') NULL | origine prospect |
| `date_entree` | date | date du premier contact |
| `date_derniere_action` | date NULL | |
| `date_inscription` | date NULL | renseigné quand statut = 'inscrit' |
| `permis_categorie_id` | uuid FK permis_categories NULL | permis visé (GP) |
| `type_action_id` | uuid FK types_actions NULL | formation visée (FP) |
| `notes_commerciales` | text NULL | |
| `cree_par` | uuid FK utilisateurs | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

> Source : `gp****.tiers` (champs dtinscont, dateinscr, origines_prospects)
> **D26** : `pipeline_crm` est distinct de `personnes` — une même personne peut avoir plusieurs entrées pipeline (reprises, permis différents). L'identité est dans `personnes`, le cycle commercial dans `pipeline_crm`.

---

### 23.3 `interactions`
Toutes les interactions (notes, RDV, échanges téléphoniques, emails reçus) liées à une personne dans le contexte d'une franchise. Remplace et étend `renseignements` (libellé court + corps RTF) en y ajoutant le type d'interaction et le lien optionnel au pipeline.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `personne_id` | uuid FK personnes | |
| `pipeline_id` | uuid FK pipeline_crm NULL | lien pipeline si commercial |
| `type` | enum('note','rdv','appel','email_entrant','email_sortant','sms','visite','autre') | |
| `titre` | varchar(200) | libellé court |
| `corps` | text NULL | corps de l'interaction (markdown ou texte) |
| `date_interaction` | timestamptz | date effective de l'interaction |
| `utilisateur_id` | uuid FK utilisateurs | auteur |
| `created_at` | timestamptz | |

> Source : `gp****.renseignements` (id, tampon, titre, idtiers, iduser, texte RTF → converti markdown)
> Source : `fplearn.rdv_rdv` + `fplearn.evennements`
> **D27** : le corps RTF de `renseignements` est converti en texte brut ou markdown à la migration. La perte de formatage RTF est acceptable — le contenu textuel est conservé.

---

### 23.4 `rappels`
Rappels programmés liés à une entité (interaction, devis, contrat). Déclenchent une notification au responsable et/ou à l'apprenant à une date calculée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `type_entite` | enum('pipeline_crm','interactions','devis','contrats') | entité source |
| `entite_id` | uuid | FK polymorphique vers l'entité |
| `personne_id` | uuid FK personnes NULL | personne à relancer (si notification externe) |
| `utilisateur_id` | uuid FK utilisateurs NULL | utilisateur à notifier (interne) |
| `date_rappel` | date | date programmée du rappel |
| `message` | text NULL | message optionnel |
| `statut` | enum('programme','envoye','annule') | |
| `envoye_le` | timestamptz NULL | |

> **Exemple :** à la création d'un `pipeline_crm` statut='nouveau', un rappel est automatiquement créé à J+14 pour relancer la personne.

---

### 23.5 `devis`
Offre tarifée envoyée à un prospect ou élève. Peut être transformé en contrat et/ou en facture.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `franchise_id` | uuid FK franchises | |
| `numero` | bigint | numéro séquentiel par franchise |
| `pipeline_id` | uuid FK pipeline_crm NULL | |
| `personne_id` | uuid FK personnes | destinataire |
| `forfait_id` | uuid FK forfaits_formation NULL | forfait GP de référence |
| `date_devis` | date | |
| `date_validite` | date NULL | |
| `statut` | enum('brouillon','envoye','accepte','refuse','expire','transforme') | |
| `libelle` | varchar(100) | |
| `conditions_particulieres` | text NULL | |
| `workflow_signature_id` | uuid FK workflows_signature NULL | si envoyé via Lex Persona |
| `cree_par` | uuid FK utilisateurs | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

> Source : `gp****.devis` (en-tête)

---

### 23.6 `lignes_devis`
Lignes de détail d'un devis.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `devis_id` | uuid FK devis | |
| `produit_id` | uuid FK produits NULL | produit GP |
| `type_action_id` | uuid FK types_actions NULL | formation FP |
| `libelle` | varchar(200) | libellé affiché |
| `quantite` | decimal(10,4) | |
| `prix_unitaire` | decimal(12,2) | |
| `taux_tva` | decimal(5,2) | |
| `type_remise` | enum('montant','pourcentage') NULL | |
| `remise` | decimal(12,2) NULL | |
| `ordre` | integer | |

> Source : `gp****.ldevis`

---

### 23.7 `signataires_contrat`
Personnes devant signer un contrat, avec leur rôle et leur statut de signature. Permet de gérer le cas du mineur (élève + responsable légal) et les cas multi-signataires FP (apprenant + représentant employeur).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `contrat_id` | uuid FK contrats | |
| `personne_id` | uuid FK personnes | signataire |
| `role` | enum('apprenant','responsable_legal','representant_employeur','formateur','directeur') | |
| `ordre_signature` | smallint | ordre dans le workflow Lex Persona |
| `est_obligatoire` | boolean | la signature est-elle requise pour valider le contrat ? |
| `workflow_signature_id` | uuid FK workflows_signature NULL | workflow Lex Persona individuel |
| `statut` | enum('en_attente','notifie','signe','refuse','expire') | |
| `signe_le` | timestamptz NULL | |
| `refuse_le` | timestamptz NULL | |
| `raison_refus` | text NULL | |

> **Règle métier — mineur :** si `personnes.date_naissance` indique un âge < 18 ans à la date de signature, un signataire `role='responsable_legal'` est automatiquement ajouté.
> **Règle métier — contrat complet :** quand tous les signataires `est_obligatoire = true` ont `statut = 'signe'`, le contrat passe au statut `'signe'` et déclenche la génération automatique de la facture (via `forfaits_formation` ou `lignes_devis`).

---

### CRM FP (`fplearn`) — entités non encore modélisées

| Table source | Contenu | Priorité |
|---|---|---|
| `marche_mar` | Segments de marché (catégories commerciales FP) | basse |
| `catalogue_cat` | Catalogue FP hiérarchique (arbre parent/enfant) | moyenne |
| `catalogue_pedago_cpg` | Lien catalogue ↔ pédago | basse |
| `opportunite_opp` | Opportunités CRM (prospects FP) → déjà en §1.6 `organisations` ? | à confirmer |
| `rdv_rdv` | Rendez-vous CRM | basse |
| `potentiel_pot` / `personne_physique_potentiel_ppp` | Score prospect | basse |
| `marche_pedago_mgp` | Lien marché ↔ pédagogie | basse |
| `caces_personne_plg` | Options CACES choisies par personne par créneau (160 lignes) | moyenne |
| `trs_qdj` | Questionnaire Début de Journée par apprenant (5 lignes) | basse |
| `action_pedago` | Lien action FP ↔ pédagogue responsable | faible (probablement couvert par `inscriptions` role=formateur) |

### Entités mineures GP découvertes

| Table source | Contenu | État |
|---|---|---|
| `plg_arg_resa` | Réservations MyArgan (portail online) — `idplgarg + idpedago + avec_ou_sans` | à confirmer couverture par `inscriptions` |
| `verr_plg_ress` | Verrouillage ressource/date (idress, date) | technique — pas de table MCD nécessaire |
| `plg_ress_x` | Ressources supprimées avec timestamp (audit trail) | couvert par `journal_audit` |
