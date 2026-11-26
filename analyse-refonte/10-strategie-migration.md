# Stratégie de migration et parallélisation des données

> Version 0.1 — 2026-05-21  
> Périmètre : migration MySQL (GPLearn, PlgFPro, fplearn) → PostgreSQL (MCD unifié)  
> Principe : coexistence progressive, centre de formation par centre de formation, sans interruption de service.

---

## 1 — PRINCIPES DIRECTEURS

### 1.1 Priorités absolues

1. **Zéro perte de données** : la migration est validée par des comptages et sommes de contrôle avant toute bascule.
2. **Zéro interruption de service** : l'ancien système reste la source de vérité pendant toute la transition.
3. **Rollback possible à tout moment** : jusqu'à la bascule définitive d'un centre, il est possible de revenir à l'ancien système en moins d'une heure.
4. **Validation métier** : chaque centre est validé par un utilisateur clé avant bascule.

### 1.2 Source de vérité pendant la transition

```
Phase 0 (avant migration)       : GPLearn / PlgFPro / fplearn  →  source de vérité unique
Phase 1 (centre en migration)   : GPLearn  →  source de vérité (écriture)
                                   Nouveau MCD  →  réplication (lecture seule)
Phase 2 (bascule centre)        : Nouveau MCD  →  source de vérité (écriture)
                                   GPLearn  →  gel (lecture seule, archive)
Phase 3 (stabilisation)         : GPLearn  →  archivé, puis décommissionné
```

---

## 2 — PHASES DE MIGRATION

### Phase 0 — Infrastructure (avant toute migration centre)

- [ ] Déployer PostgreSQL + nouveau backend en environnement de recette
- [ ] Écrire et tester tous les scripts de migration par système source
- [ ] Valider les scripts sur les bases dev (gp3101, plgfpro, fplearn)
- [ ] Mettre en place le système de CDC (Change Data Capture) — voir §3
- [ ] Créer les tableaux de bord de surveillance (dérive, erreurs, lag)

### Phase 1 — Migration initiale d'un centre pilote

Recommandation : choisir un centre de taille moyenne, volontaire, avec un responsable technique disponible.

1. **Extraction initiale** : copie complète MySQL → PostgreSQL (script batch nuit)
2. **Vérifications** : comptages table par table + sommes de contrôle sur les montants
3. **Activation CDC** : activation du flux temps réel old → new (voir §3)
4. **Mode lecture** : le nouveau système est ouvert en lecture seule pour le centre pilote
5. **Validation métier** : le centre pilote navigue dans le nouveau système pendant 2-4 semaines
6. **Correction anomalies** : correction des écarts identifiés dans les règles de mapping
7. **Bascule** : activation du nouveau système en écriture, gel de l'ancien

### Phase 2 — Déploiement progressif (autres centres)

Rythme recommandé : 1 centre toutes les 2-4 semaines selon la complexité.

**Ordre de priorité (à valider §11 gouvernance) :**
- Centres avec le moins d'intégrations spécifiques (ANTS, CEPC) en premier
- Centres CERCA avant les autres entreprises du groupe
- Éviter les bascules en période de rentrée scolaire (août-septembre) ou de bilan annuel

### Phase 3 — Migration des systèmes transverses

Une fois tous les centres GP migrés :
- Migration PlgFPro → données FP dans le nouveau MCD
- Migration fplearn → CRM FP dans le nouveau MCD
- Déconnexion des anciens systèmes
- Archivage des bases MySQL (lecture seule, sauvegarde longue durée)

---

## 3 — STRATÉGIE DE PARALLÉLISATION (CDC)

### 3.1 Principe du dual-write différé

Pendant la période de coexistence, les écritures se font **uniquement dans l'ancien système**. Le nouveau système est alimenté en quasi-temps réel par **capture de changements** (CDC).

```
Ancien système (GPLearn MySQL)
        │  écriture applicative normale
        ▼
   MySQL binlog  ──────────────────►  Pipeline CDC
                                           │
                                           ▼
                                    Transformation
                                    (mapping règles)
                                           │
                                           ▼
                                    PostgreSQL (nouveau MCD)
                                    [lecture seule côté métier]
```

**Technologies envisagées :**
- **Debezium** (open source) : connecteur MySQL → Kafka ou directement → PostgreSQL
- **Alternative légère** : trigger MySQL → table de journal → script PHP de sync toutes les 30 secondes (plus simple à mettre en place sur l'infrastructure existante)

**Recommandation pour l'infrastructure existante** (serveur Linux, pas de Kafka) : déclencher un script de sync incrémentale toutes les minutes via cron, basé sur les timestamps `updated_at` des tables sources.

### 3.2 Règles de parallélisation — GPLearn → nouveau MCD

#### 3.2.1 Table `tiers` → `personnes`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `tiers.code` | `personnes.ext_gp_tiers_id` | Conservation PK legacy |
| `tiers.nom` | `personnes.nom` | Direct |
| `tiers.prenom` | `personnes.prenom` | Direct |
| `tiers.datenaiss` | `personnes.date_naissance` | Direct |
| `tiers.adresse` / `cp` / `ville` | `personnes.adresse` / `code_postal` / `ville` | Direct |
| `tiers.email` | `personnes.email` | Direct |
| `tiers.tel` | `personnes.tel_mobile` | Direct |
| `tiers.cryptage_cnil = 1` | Déchiffrer avant import | `AES_DECRYPT(valeur, tiers.code)` — voir D10 |
| `tiers.agenceresp` | `inscriptions.site_id` (site principal) | Via `sites.code` |
| `tiers.famille` | `personnes.json_extra.famille_legacy` | Conservé en JSON |
| `tiers.idpermis` / `idfiliere` | `certifications_personnes` (permis) | Pivot |

**Critère de déclenchement :** `tiers.updated_at > derniere_sync` (ajouter colonne `updated_at` si absente via trigger MySQL).

**Conflits possibles :** une même personne peut exister dans plusieurs bases `gp*` (multi-agences). Résolution : déduplication sur `(nom, prenom, date_naissance)` avec création de liens `ext_gp_tiers_id` multiples si nécessaire.

#### 3.2.2 Table `plg_arg` → `creneaux_planning`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `plg_arg.idplgarg` | `creneaux_planning.ext_gp_plgarg_id` | Conservation ID legacy |
| `plg_arg.date` | `creneaux_planning.date_debut` + `date_fin` | `date_fin = date` si journée entière |
| `plg_arg.hdeb` / `hfin` | `creneaux_planning.heure_debut` / `heure_fin` | Direct |
| `plg_arg.produit` | `creneaux_planning.produit_id` | Via `produits.code` → `produits.id` |
| `plg_arg.qte` | `creneaux_planning.quantite` | Direct |
| `plg_arg.verrou_plg/ress/elv` | `creneaux_planning.verrou_*` | Direct |
| `plg_arg.idexam` | `creneaux_planning.examen_id` | Via `sessions_examens.ext_gp_examen_id` |
| `stage` ponctuel via `plg_stg` | `session_formation_id = NULL` | Supprimer l'artifice — D4 |

**Volume critique :** ~6 M lignes sur gp3101 dev → migration par tranches mensuelles recommandée.

#### 3.2.3 Table `factures` → `factures` + `lignes_factures`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `factures.numero` | `factures.numero` | Conservation (contrainte comptable) |
| `factures.tiersfact` | `factures.personne_facturee_id` | Via `personnes.ext_gp_tiers_id` |
| `factures.tierscons` | `factures.personne_destinataire_id` | Idem |
| `factures.verrouillee` | `factures.is_verrouillee` | Direct |
| `lfacture` (lignes) | `lignes_factures` | Mapping direct colonnes |
| `aff_plg_lfac` | `lignes_factures.creneau_planning_id` | Via `ext_gp_plgarg_id` |

**⚠ Numérotation :** les numéros de facture doivent être conservés pour la conformité comptable. La séquence PostgreSQL démarre après le dernier numéro migré.

#### 3.2.4 Table `reglts` → `reglements`

Conservation des champs `numero`, `montant`, `type_reglement`, `lettrage`. Vérification de l'intégrité via le champ `hash_integrite` (SHA2 à recalculer).

#### 3.2.5 Table `stg_elv` → `inscriptions`

| Source | Cible | Notes |
|---|---|---|
| `stg_elv.tiers` | `inscriptions.personne_id` | Via `personnes.ext_gp_tiers_id` |
| `stg_elv.idstage` | `inscriptions.session_formation_id` | Via `sessions_formation.ext_gp_stage_id` |
| `stg_elv.base` | `inscriptions.franchise_id` | Multi-tenant : résoudre via `franchises.code` |
| `stage.ponctuel = 1` | `session_formation_id = NULL` sur le créneau | Artifice supprimé — D4 |

**Cas particulier multi-base :** `stg_elv.base` peut référencer une autre base `gp*` (élève d'une agence inscrit dans une autre). Dans le nouveau système, cela devient un `inscriptions.franchise_id` différent du `franchise_id` de la session — à gérer par les politiques RLS niveau entreprise.

---

### 3.3 Règles de parallélisation — PlgFPro → nouveau MCD

#### 3.3.1 Table `actions` → `sessions_formation`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `actions.idaction` | `sessions_formation.ext_pfp_action_id` | Conservation ID |
| `actions.nom` | `sessions_formation.nom` | Direct |
| `actions.idtpaction` | `sessions_formation.type_action_id` | Via `types_actions.ext_pfp_typeaction_id` |
| `actions.idsite` | `sessions_formation.site_id` | Via `sites.ext_nevea_id` ou code |
| `actions.ref_nevea` | `sessions_formation.ext_nevea_ref` | Permanent (intégration active) |
| `actions.fgest_no_module` | `sessions_formation.ext_fgest_no_module` | Permanent (intégration active) |
| `actions.debut` / `fin` | `sessions_formation.date_debut` / `date_fin` | Direct |
| `actions.nb_places` | `sessions_formation.nb_places` | Direct |

#### 3.3.2 Table `planning` → `creneaux_planning`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `planning.idplg` | `creneaux_planning.ext_pfp_planning_id` | Conservation ID |
| `planning.idmodule` | `creneaux_planning.module_id` | Via `modules.ext_pfp_module_id` |
| `planning.idaction` | `creneaux_planning.session_formation_id` | Via `sessions_formation.ext_pfp_action_id` |
| `planning.date_debut/fin` | `creneaux_planning.date_debut/fin` | Direct |
| `plg_jours` | `creneaux_planning` (une ligne par jour) | Décompacter les jours/horaires |

**⚠ `plg_jours` :** dans PlgFPro, un créneau planning peut avoir des horaires différents selon le jour de la semaine (table `plg_jours`). Dans le nouveau MCD, chaque jour devient un `creneaux_planning` distinct lié à la même `session_formation`. Migration : dénormalisation nécessaire.

#### 3.3.3 Table `ressources` → `ressources` (unification GP+FP)

Un formateur FP qui est aussi moniteur GP existe dans `plgfpro.ressources` ET dans `gp*.intervt`. La migration doit détecter les doublons par `(nom, email)` et créer une seule ligne `ressources` avec les deux `ext_*` renseignés.

#### 3.3.4 Tables CDC `rdrd_*` / `udrd_*`

Ces tables de journal de changements PlgFPro alimentent `mopl_plg_*` dans GP-Learn. Dans le nouveau système, elles deviennent inutiles — le même PostgreSQL porte les deux systèmes. Les synchronisations PlgFPro → GPLearn sont remplacées par des requêtes directes cross-table.

**Action à la bascule PlgFPro :** désactiver les scripts de sync CDC et vérifier que les créneaux `mopl_plg_arg` sont bien migrés vers `creneaux_planning` avec les bons `session_formation_id`.

---

### 3.4 Règles de parallélisation — fplearn → nouveau MCD

#### 3.4.1 Table `personne_physique_pph` → `personnes`

| Source MySQL | Cible PostgreSQL | Transformation |
|---|---|---|
| `pph_IDpersonne_physique` | `personnes.ext_pph_id` | Conservation ID |
| `pph_nom` / `pph_prenom` | `personnes.nom` / `prenom` | Direct |
| `pph_date_naissance` | `personnes.date_naissance` | Direct |
| `pph_email` | `personnes.email` | Direct |
| `pph_json_data` | `personnes.json_extra` | Conservation JSON brut |

**Déduplication fplearn ↔ GPLearn :**
Les tables `lien_personne_physique_externe_pex` de fplearn contiennent déjà les correspondances entre `pph_ID` et `tiers.code` dans GPLearn. Utiliser cette table comme pivot de déduplication lors de la migration.

```sql
-- Correspondances connues
SELECT pex.pph_IDpersonne_physique, pex.IDexterne AS tiers_gp_code, pex.base
FROM lien_personne_physique_externe_pex pex
WHERE pex.application = 'gplearn'
```

#### 3.4.2 Table `opportunite_opp` → `sessions_formation` / pipeline CRM

Les opportunités fplearn sont de deux types :
- **Opportunité aboutie** (liée à une action plgfpro via `lien_opportunite_externe_oex`) → migrer comme `sessions_formation` + `inscriptions`
- **Opportunité en cours / perdue** → migrer comme entrée `pipeline_crm` avec statut approprié

#### 3.4.3 Tables `lien_*_externe_*` → obsolètes après migration

Une fois toutes les entités unifiées dans le nouveau MCD avec leurs `ext_*` IDs, les tables de correspondance fplearn deviennent inutiles. Elles sont conservées en lecture seule pendant la transition pour audit.

---

## 4 — VÉRIFICATIONS DE COHÉRENCE

### 4.1 Comptages à effectuer après chaque migration de centre

```sql
-- Compter les personnes migrées vs source
SELECT COUNT(*) FROM tiers WHERE base = 'gp3101';           -- MySQL
SELECT COUNT(*) FROM personnes WHERE franchise_id = '...';  -- PostgreSQL → doit être ≥

-- Vérifier les montants facturés
SELECT SUM(montant_ttc) FROM factures WHERE base = 'gp3101';          -- MySQL
SELECT SUM(prix_unitaire * quantite) FROM lignes_factures WHERE ...;  -- PostgreSQL → doit être =

-- Vérifier les encaissements
SELECT SUM(montant) FROM reglts WHERE base = 'gp3101';   -- MySQL
SELECT SUM(montant) FROM reglements WHERE ...;           -- PostgreSQL → doit être =
```

### 4.2 Alertes de dérive (CDC en continu)

Pendant la phase de parallélisation, surveiller :
- Lag CDC > 5 minutes : alerte orange
- Lag CDC > 30 minutes : alerte rouge + notification responsable
- Erreur de mapping (entité source sans correspondance cible) : log + file d'attente

### 4.3 Validation métier par centre

Avant bascule, le responsable du centre valide :
- [ ] Toutes les fiches tiers accessibles et correctes
- [ ] Planning du mois en cours identique à l'ancien
- [ ] Soldes des comptes élèves cohérents (5 comptes test à vérifier)
- [ ] Dernière facturation reproductible
- [ ] Documents générables (contrat, facture)

---

## 5 — PROCÉDURE DE BASCULE

### 5.1 Séquence (fenêtre de maintenance : 2h en soirée)

```
T-60min : Notification utilisateurs (maintenance programmée)
T-30min : Dernier checkpoint CDC — vérification lag = 0
T-0     : Gel de l'ancien système (mode lecture seule dans sqlConnect.php)
T+15min : Dernier passage script de migration incrémentale
T+30min : Vérification comptages de cohérence
T+45min : Activation du nouveau système en écriture
T+60min : Tests de smoke (login, planning, facture test)
T+90min : Confirmation bascule ou ROLLBACK
```

### 5.2 Rollback

Si anomalie détectée avant T+90min :
1. Désactiver le nouveau système (maintenance page)
2. Réactiver l'ancien système en mode écriture
3. Analyser les écarts apparus pendant la fenêtre
4. Reprogrammer la bascule après correction

**Durée max acceptable avant rollback : 2 heures** (au-delà, données écrites dans le nouveau système doivent être rejouées dans l'ancien — complexité élevée).

---

## 6 — DONNÉES HISTORIQUES

### 6.1 Périmètre de migration

| Données | Décision recommandée | Justification |
|---|---|---|
| Planning < 1 an | ✅ Migrer | Utilisé pour facturation en cours |
| Planning 1-5 ans | ✅ Migrer | Référence pédagogique et statistique |
| Planning > 5 ans | ⚠ À confirmer | Volume important — peut être archivé en MySQL |
| Factures toutes dates | ✅ Migrer | Obligatoire (10 ans comptabilité) |
| Règlements toutes dates | ✅ Migrer | Idem |
| Évaluations pédagogiques | ✅ Migrer | Livret de formation élève |
| Points GPS > 5 ans | ✗ Ne pas migrer | TTL légal 5 ans, archiver en cold storage |
| Logs serveur | ✗ Ne pas migrer | Données techniques |

### 6.2 Stratégie archives MySQL

Les bases `gp*` d'origine sont conservées en mode lecture seule (arrêt des applicatifs, accès DB maintenu) pendant **12 mois** après la bascule de chaque centre, puis archivées en dump compressé. Conservation des dumps : **10 ans** (durée légale comptabilité).

---

## 7 — OUTILS DE MIGRATION (à développer)

| Outil | Rôle | Techno suggérée |
|---|---|---|
| `migrate-init.ts` | Migration initiale complète d'un centre GP | Node.js + mysql2 + pg |
| `migrate-plgfpro.ts` | Migration PlgFPro | Idem |
| `migrate-fplearn.ts` | Migration fplearn CRM | Idem |
| `sync-cdc.ts` | Sync incrémentale (polling timestamps) | Node.js + cron |
| `check-coherence.ts` | Vérification comptages avant bascule | Node.js |
| `dashboard-migration` | Tableau de bord avancement (centres migrés, lag CDC) | Next.js page admin |
