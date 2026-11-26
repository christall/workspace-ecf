# Lien Planning plgfpro↔gpfp et données Conventions

> Version 1.0 — 2026-06-01
> Analyse directe des bases MySQL ECF CERCA

---

## 1. Flux de données Planning plgfpro → gpfp

### Architecture du lien

```
plgfpro.planning (385k)
    ↓  robot_planning_plannifpro2gplearn.php
    ↓  fonction planning_plannifpro2gplearn($rPlg)
gpfp.plg_arg (138k) ← même schéma que gp1702.plg_arg
```

### Encodage clé : `idplgpart`

```
gpfp.plg_arg.idplgpart = prefix × 10^14 + plgfpro.planning.idplg
```

| prefix | Signification |
|---|---|
| 0 | Créneau principal (matin) |
| 1 | Créneau secondaire (après-midi, 2e session) |
| N | N+1ème session du même planning |

**Un seul `plgfpro.planning.idplg` peut générer plusieurs `gpfp.plg_arg`** (ex: matin + après-midi).

**Jointure inverse** :
```sql
-- De gpfp vers plgfpro
SELECT pa.idplgarg, pa.idplgpart % 100000000000000 as idplg_pfp
FROM gpfp.plg_arg pa
JOIN plgfpro.planning p ON p.idplg = (pa.idplgpart % 100000000000000)
```

### Enrichissement des données

| Champ | plgfpro.planning | gpfp.plg_arg |
|---|---|---|
| `hdeb/hfin` | Souvent 00:00:00 (absent) | **Horaires réels** (08:30, 13:30…) |
| `date` | `date_debut` + `date_fin` (période) | **Date exacte** du créneau |
| `produit` | via `modules.produit_gplearn` | Code produit direct (LCI, TH…) |

**Conséquence** : pour les horaires précis de planning FP, lire depuis `gpfp.plg_arg`, pas `plgfpro.planning`.

### Récurrences hebdomadaires (plg_jours)

`plgfpro.plg_jours` (84k) décrit les récurrences pour un planning multi-semaines :
- `jour` : 0=Lun, 1=Mar, 2=Mer…
- `repetition` : "toutes les sem" / "1 sem / 2" / "sem 1, 3, 5" / "sem 2, 4"
- `hdeb/hfin` : horaires du jour

Le robot PHP développe ces récurrences en créneaux individuels dans `gpfp.plg_arg`.

### Chaîne complète (lecture)

```
plgfpro.actions (action de formation)
  ↓ plgfpro.planning.idaction
plgfpro.planning (créneau module)
  ↓ plgfpro.plg_ress.idplg
plgfpro.ressources (formateurs affectés au planning)
  ↓ idplgpart encoding
gpfp.plg_arg (créneau daté avec horaires réels)
  ↓ gpfp.plg_stg.idplgarg
gpfp.stage (formation "contenante" type)
  ↓ gpfp.stg_elv.idstage
gpfp.tiers (stagiaires inscrits au stage)
```

### Import ERP depuis gpfp

**Le script `import-gplearn.ts` existant importe déjà ce flux** avec `MYSQL_DATABASE=gpfp`.
Les créneaux FP apparaissent avec leurs codes produits (`LCI`, `TH`, `LCC`…) — le `type_stage` fait la distinction CACES/Permis/SST.

---

## 2. Données Conventions — chaîne fplearn → plgfpro → gpfp

### Terminologie

| Concept métier | fplearn | plgfpro | gpfp |
|---|---|---|---|
| **Convention / contrat de formation** | `opportunite_opp` | `actions` | `stage` + `conventions` (vide) |
| **Stagiaire** | `personne_physique_pph` (161k) | — | `tiers` (32k) |
| **Inscription stagiaire** | `lien_opportunite_personnes_lop` (185k) | `repartition_stgr_ress_plg` | `stg_elv` |
| **Financeur** | (non modélisé fplearn) | — | `conv_fin` (vide) |

### Poly-référencement via `lien_opportunite_externe_oex`

Une opportunité fplearn est liée à **3-4 systèmes simultanément** :

```
fplearn.opportunite_opp (opp_ID=139225)
  ├─ oex: PlanniFPro / plgfpro / actions → idaction=86689
  ├─ oex: nevea / ecf/cerca / actions_de_formation → id_nevea=32070894
  ├─ oex: Formagest / Formagest-CERCA / modules → id_formagest=5075345
  └─ oex: gplearn / gpfp / stage → idstage=2750
```

**Requête de jointure complète convention :**
```sql
SELECT 
    o.opp_IDopportunite, o.opp_designation, o.opp_montant,
    o.opp_date_debut, o.opp_date_fin,
    -- lien vers plgfpro
    oex_pfp.oex_IDExterne as id_action_plgfpro,
    a.nom as action_nom, a.debut, a.fin, a.nb_places,
    act.nom as activite_nom, ta.nom as type_action_nom,
    -- lien vers gpfp
    oex_gp.oex_IDExterne as id_stage_gpfp,
    s.nom as stage_gpfp_nom,
    -- comptage stagiaires
    COUNT(DISTINCT lop.lop_IDlien_opportunite_personnes_lop) as nb_stagiaires
FROM fplearn.opportunite_opp o
LEFT JOIN fplearn.lien_opportunite_externe_oex oex_pfp 
    ON oex_pfp.oex_IDopportunite=o.opp_IDopportunite 
    AND oex_pfp.oex_application='PlanniFPro' AND oex_pfp.oex_table='actions'
LEFT JOIN plgfpro.actions a ON a.idaction=oex_pfp.oex_IDExterne
LEFT JOIN plgfpro.typeactions ta ON ta.idtpaction=a.idtpaction
LEFT JOIN plgfpro.activites act ON act.idactivite=ta.idactivite
LEFT JOIN fplearn.lien_opportunite_externe_oex oex_gp 
    ON oex_gp.oex_IDopportunite=o.opp_IDopportunite 
    AND oex_gp.oex_application='gplearn' AND oex_gp.oex_table='stage'
LEFT JOIN gpfp.stage s ON s.idstage=oex_gp.oex_IDExterne
LEFT JOIN fplearn.lien_opportunite_personnes_lop lop 
    ON lop.lop_IDopportunite=o.opp_IDopportunite
WHERE o.opp_date_debut >= '2026-01-01'
GROUP BY o.opp_IDopportunite
ORDER BY o.opp_date_debut
```

### Stagiaires d'une convention

```sql
SELECT 
    lop.lop_IDopportunite, lop.lop_IDlien_opportunite_personnes_lop as id_lop,
    lop.lop_nature_lien,
    pph.pph_nom, pph.pph_prenom, pph.pph_email, pph.pph_telephone_mobile,
    -- lien vers gpfp.tiers
    pex.pex_IDExterne as id_tiers_gpfp
FROM fplearn.lien_opportunite_personnes_lop lop
JOIN fplearn.personne_physique_pph pph ON pph.pph_IDpersonne_physique=lop.lop_IDpersonne_physique
LEFT JOIN fplearn.lien_personne_physique_externe_pex pex 
    ON pex.pex_IDpersonne_physique=lop.lop_IDpersonne_physique 
    AND pex.pex_application='gplearn' AND pex.pex_base_de_donnees='gpfp'
WHERE lop.lop_IDopportunite = ?
```

### État des conventions financières

`gpfp.conventions`, `gpfp.conv_fin`, `gpfp.conv_tiers` sont **structurées mais vides** (0 lignes).
Les données financières sont dans `fplearn.opportunite_opp.opp_montant` (souvent 0 = stage interne).

Le schéma `gpfp.conventions` (42 colonnes) préfigure le modèle cible de l'ERP :
- Numéro convention, dates, agence, famille
- Montants : `montant_global`, `montant_ht`, `acompte`
- Heures : `heures_centre`, `heures_atelier`, `heures_entrep`
- Statuts de retour signatures

Le schéma `gpfp.conv_tiers` modélise les données Cerfa :
- `A_type_stagiaire` (A1a=fin demandeur emploi, A2=fin public, A3=auto-fin, A4=autres)
- `B_activite_propre_st` (B1=interne, B2=pour autre org)
- `C_objectif_general` (C1a=certif, C2=autres continues)
- `D_codespecialite` (code Formagest)

---

## 3. Schéma ERP à ajouter pour les conventions

### Nouvelles tables SQLite

```sql
-- Convention de formation (= opportunité fplearn = action plgfpro = stage gpfp)
CREATE TABLE conventions (
    id TEXT PRIMARY KEY,
    franchise_id TEXT NOT NULL REFERENCES franchises(id),
    session_id TEXT REFERENCES sessions_formation(id),  -- si on modélise sessions_fp
    
    -- Identifiants sources (pour réconciliation)
    id_source_fplearn INTEGER,    -- opportunite_opp.opp_IDopportunite
    id_source_plgfpro INTEGER,    -- actions.idaction
    id_source_gpfp INTEGER,       -- stage.idstage
    
    -- Données convention
    reference TEXT,               -- numéro convention
    designation TEXT NOT NULL,
    date_debut TEXT,
    date_fin TEXT,
    montant_total REAL DEFAULT 0,
    nb_heures_centre REAL DEFAULT 0,
    nb_heures_atelier REAL DEFAULT 0,
    nb_heures_entreprise REAL DEFAULT 0,
    nb_places INTEGER DEFAULT 0,
    statut TEXT DEFAULT 'en_cours', -- en_cours | terminee | annulee
    
    -- Activité (le discriminant)
    activite_nom TEXT,            -- ex: "CACES R489", "FCO Marchandises"
    type_action_nom TEXT,
    site_nom TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

-- Financeurs d'une convention (OPCO, CPF, France Travail, employeur)
CREATE TABLE convention_financeurs (
    id TEXT PRIMARY KEY,
    convention_id TEXT NOT NULL REFERENCES conventions(id),
    franchise_id TEXT NOT NULL,
    type_financeur TEXT NOT NULL,  -- opco | cpf | france_travail | employeur | auto
    nom_financeur TEXT,
    montant REAL DEFAULT 0,
    type_payeur TEXT,              -- valeurs Cerfa (ppe_pfls, pppp_pfap_etat…)
    created_at TEXT DEFAULT (datetime('now'))
);

-- Stagiaires d'une convention (avec données Cerfa)
CREATE TABLE convention_stagiaires (
    id TEXT PRIMARY KEY,
    convention_id TEXT NOT NULL REFERENCES conventions(id),
    personne_id TEXT REFERENCES personnes(id),
    franchise_id TEXT NOT NULL,
    
    -- Identifiant source fplearn
    id_lop INTEGER,               -- lien_opportunite_personnes_lop.lop_ID
    
    -- Données Cerfa (gpfp.conv_tiers)
    type_stagiaire TEXT,          -- A1a | A2 | A3 | A4
    activite_stagiaire TEXT,      -- B1 | B2
    objectif_formation TEXT,      -- C1a | C2
    code_specialite TEXT,
    
    statut_presence TEXT DEFAULT 'inscrit',  -- inscrit | present | absent | certifie
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Ajout à `db/seed.ts`

Ces 3 tables doivent être ajoutées au schéma initial (`CREATE TABLE IF NOT EXISTS`) avec les index :
```sql
CREATE INDEX idx_conventions_franchise ON conventions(franchise_id);
CREATE INDEX idx_conventions_dates ON conventions(date_debut, date_fin);
CREATE INDEX idx_conv_financeurs_convention ON convention_financeurs(convention_id);
CREATE INDEX idx_conv_stagiaires_convention ON convention_stagiaires(convention_id);
CREATE INDEX idx_conv_stagiaires_personne ON convention_stagiaires(personne_id);
```

---

## 4. Extension du script d'import

### Import conventions depuis fplearn

```typescript
// Dans import-gplearn.ts, après l'import des personnes :

// ── Conventions (fplearn.opportunite_opp → plgfpro.actions) ─────────────
const [conventions] = await fplearn.query(`
    SELECT 
        o.opp_IDopportunite as id_opp,
        o.opp_designation as designation,
        o.opp_montant as montant,
        o.opp_date_debut as date_debut,
        o.opp_date_fin as date_fin,
        oex_pfp.oex_IDExterne as id_action_pfp,
        a.nom as action_nom, a.nb_places,
        act.nom as activite_nom,
        ta.nom as type_action_nom,
        s.nom as site_nom,
        oex_gp.oex_IDExterne as id_stage_gpfp,
        COUNT(DISTINCT lop.lop_IDlien_opportunite_personnes_lop) as nb_stagiaires
    FROM fplearn.opportunite_opp o
    LEFT JOIN fplearn.lien_opportunite_externe_oex oex_pfp 
        ON oex_pfp.oex_IDopportunite=o.opp_IDopportunite 
        AND oex_pfp.oex_application='PlanniFPro' AND oex_pfp.oex_table='actions'
    LEFT JOIN plgfpro.actions a ON a.idaction=oex_pfp.oex_IDExterne
    LEFT JOIN plgfpro.typeactions ta ON ta.idtpaction=a.idtpaction
    LEFT JOIN plgfpro.activites act ON act.idactivite=ta.idactivite
    LEFT JOIN plgfpro.sites s ON s.idsite=a.idsite
    LEFT JOIN fplearn.lien_opportunite_externe_oex oex_gp 
        ON oex_gp.oex_IDopportunite=o.opp_IDopportunite 
        AND oex_gp.oex_application='gplearn' AND oex_gp.oex_table='stage'
    LEFT JOIN fplearn.lien_opportunite_personnes_lop lop 
        ON lop.lop_IDopportunite=o.opp_IDopportunite
    WHERE o.opp_date_debut >= ?
    GROUP BY o.opp_IDopportunite
    ORDER BY o.opp_date_debut DESC
    LIMIT 2000`, [dateDebut])

// Import stagiaires par convention (par batch)
const [stagiaires_conv] = await fplearn.query(`
    SELECT lop.lop_IDopportunite, lop.lop_IDlien_opportunite_personnes_lop as id_lop,
           pph.pph_nom as nom, pph.pph_prenom as prenom,
           pex.pex_IDExterne as id_tiers_gpfp
    FROM fplearn.lien_opportunite_personnes_lop lop
    JOIN fplearn.personne_physique_pph pph ON pph.pph_IDpersonne_physique=lop.lop_IDpersonne_physique
    LEFT JOIN fplearn.lien_personne_physique_externe_pex pex 
        ON pex.pex_IDpersonne_physique=lop.lop_IDpersonne_physique 
        AND pex.pex_application='gplearn' AND pex.pex_base_de_donnees='gpfp'
    WHERE lop.lop_IDopportunite IN (${ids_opp.join(',')})`)
```

### Note sur les connexions multiples

L'import FP nécessite **3 connexions MySQL simultanées** :
- `gpfp` (planning daté, tiers, stages) — via `MYSQL_DATABASE=gpfp`
- `fplearn` (opportunités, stagiaires pph, lop, oex) — via `MYSQL_DATABASE_CRM=fplearn`
- `plgfpro` (activités, actions, ressources FP) — via `MYSQL_DATABASE_PFP=plgfpro`

Ou requêtes cross-base en une connexion (même serveur) :
```sql
SELECT ... FROM fplearn.opportunite_opp o 
JOIN plgfpro.actions a ON ...
JOIN gpfp.stage s ON ...
```
