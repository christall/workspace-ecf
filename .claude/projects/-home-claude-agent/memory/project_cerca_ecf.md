---
name: Projet refonte CERCA/ECF
description: Contexte complet du projet de refonte du parc applicatif réseau auto-écoles CERCA/ECF — objectif, périmètre, mapping inter-systèmes, architecture cible
type: project
originSessionId: c839d15c-2c69-439c-87f6-00e81c69f3d4
---
Refonte complète du parc applicatif d'un réseau de franchises d'auto-écoles (CERCA/ECF), activité mixte auto-école (GP) + formation professionnelle (FP).

**Why:** Le parc actuel est une dette technique massive — PHP sans framework, dhtmlX obsolète, SQL injection, MD5, 17 bases MySQL identiques, 3 systèmes représentant les mêmes entités avec des noms différents. L'objectif est une application unique, sécurisée, multi-tenant natif.

**How to apply:** Toujours avoir ce contexte en tête. L'analyse et le CDC sont dans `/home/claude-agent/analyse-refonte/`. Travailler en séquentiel (pas de parallélisme agents).

---

## Structure applicative actuelle

### Applications GP (auto-école)
- **GPLearn** (`/home/applisWeb/gplearn_tom/`) : ERP principal, PHP + dhtmlX, 3387 fichiers PHP
- **learnFP** (`/home/applisWeb/learnfp_tom/`) : **symlink vers gplearn_tom** — strictement identique, seul le CSS change le thème
- **myRoad** (`/home/webservices/myRoad/`) : App élève, PHP versionné
- **appliPedago** + **ECFCoach** : Backend pédagogique et coaching tablette, PHP versionné
- **campus** (`/home/applisWeb/campus/`) : Next.js 15 (seule app moderne, peu fonctionnelle)

### Applications FP (formation professionnelle)
- **PlanniFProWeb** (`/home/applisWeb/PlanniFProWeb_tom/`) : Planning opérationnel FP, PHP + dhtmlX, 166 fichiers serverside, base `plgfpro`
- **myRoadFP** + **ecfcoachFP** : Espaces apprenants FP (forks de myRoad/ECFCoach)

### Applications réseau
- **Remunerations** : Rémunérations moniteurs (PHP + dhtmlX)
- **Argan** + **compilcerca** : Portail agences + consolidation réseau
- **intranet** : Drupal 6 (FIN DE VIE — risque sécurité critique)
- **tezos-digisign** : Signature blockchain Tezos (Docker)

---

## Bases MySQL — périmètre réel

### Bases GP (auto-école)
- **17 bases gp*** (`gp1301`, `gp8803`...) : instances agences identiques, multi-tenant manuel
- **gpcontrolserveurs** : auth centralisée + liste des bases
- **geo_meteo** : référentiel géographique + identités élèves (`ident_u_tiers`)
- **block_chains** : signatures blockchain contrats
- **ac_sms_ecf**, **gpfp**, **gp_services_cerca** : services transverses

### Bases FP (formation professionnelle)
- **plgfpro** : planning FP opérationnel (77K actions, 384K créneaux, 659K affectations ressources, 615K besoins compétences, 917K heures travaillées)
- **fplearn** : CRM commercial FP (157K personnes physiques, 141K opportunités, 51 personnes morales) + **tables de correspondance inter-systèmes** (`lien_*_ext`)

### Bases communes
- **compilcerca** : consolidation financière réseau (74 tables d'agrégation)
- **remunerations** : paie moniteurs
- **plgfpro** : planning FP (mentionné ci-dessus)

---

## Mapping conceptuel inter-systèmes (CLEF DU PROJET)

Les trois systèmes représentent les mêmes concepts métier avec des noms différents :

| Concept métier | GPLearn (bases gp*) | plgfpro / NEVEA (ERP ext.) | fplearn (CRM) |
|---|---|---|---|
| **Personne** | `tiers` | fiche personne | `personne_physique_pph` |
| **Session de formation** | `stage` non ponctuel | `action` | `opportunite_opp` |
| **Inscription** | `stg_elv` | apprenant | `lien_opportunite_personne_lop` |
| **Créneau simple** | `stage` ponctuel + `plg_arg` | créneau `planning` | — |

**Points critiques :**
- `stage` **ponctuel** dans GPLearn = artifice technique pour lister les élèves d'une leçon unique. Ce n'est PAS une entité métier, c'est juste un créneau planning avec élèves. À supprimer dans le nouveau modèle.
- `fplearn.lien_*_ext` = tables de correspondance inter-systèmes (mémorisent les IDs croisés entre GPLearn, plgfpro, NEVEA). Deviennent inutiles quand tout est unifié dans une seule base.
- **NEVEA** = ERP régional externe (organisme de formation) — interface de synchronisation via `pfp_nevea_action`, `pfp_nevea_catalogue`, `pfp_nevea_site` dans plgfpro
- **Formagest** = autre ERP externe couplé au planning FP (`fgest_database`, `code_produit`, `fgest_no_module` dans plgfpro.actions)

---

## Modèles de planning — différence fondamentale GP vs FP

### Planning GP (simple, dans chaque base gp*)
```
plg_arg (créneau)
  ├── date, hdeb, hfin, produit, commentaire
  ├── plg_ress → ressources (moniteurs, véhicules)
  ├── plg_stg → stage → stg_elv (élèves)
  └── aff_plg_lfac → lignes de facture
```

### Planning FP (hiérarchique, dans plgfpro)
```
activites (CACES, Habilitations, Conduite pro...)
  └── typeactions (CACES R482, Habilitation BS, Perfectionnement...)
        └── actions (session concrète, 77K en base)
              └── planning (créneaux, 384K en base)
                    ├── modules (briques pédago : théorie, pratique, éval — 324)
                    ├── plg_ress (formateurs + machines + véhicules)
                    │     └── besoin_competence (habilitation requise par créneau)
                    └── repartition_stgr_ress_plg (stagiaires par formateur)

ressources (1789 : formateurs + parc)
  └── competence_ress (46K habilitations avec date de validité)
  └── heures_trav (917K) + justif_heures (618K)
```

---

## Entités cibles du nouveau modèle (unification)

```
persons            ← fusionne tiers + personne_physique_pph + fiche personne NEVEA
training_sessions  ← fusionne stage non ponctuel + action + opportunite_opp
enrollments        ← fusionne stg_elv + apprenant NEVEA + lien_opportunite_personne_lop
planning_slots     ← fusionne plg_arg + planning FP (avec type GP/FP)
```

---

## Architecture cible

- **Backend** : Node.js 22 + Fastify 5 + TypeScript + Drizzle ORM
- **Base** : PostgreSQL 16 avec Row Level Security (multi-tenant natif)
- **Frontend** : Next.js 15 + shadcn/ui + FullCalendar v6 + TanStack Table
- **Auth** : JWT access+refresh + argon2
- **Queue** : BullMQ + Redis
- **Dépôt d'analyse** : `/home/claude-agent/analyse-refonte/`
- **CDC général** : `05-cahier-des-charges-general.md`

## Volumes production (serveur dev ×20)

| Table cible | Dev/recette | Production estimée |
|---|---|---|
| persons (tiers GP) | 464 K | ~9,3 M |
| planning_slots (plg_arg) | 5,96 M | **~119 M** |
| training_sessions (stage) | 8,2 M | ~164 M |
| enrollments (stg_elv) | 5,4 M | ~108 M |
| invoices (factures) | 1,5 M | ~30 M |
| payments (reglts) | 1,27 M | ~25 M |

Partitionnement PostgreSQL par tenant_id + date indispensable sur planning_slots.

## Avancement CDC
- v0.2 — périmètre fonctionnel complet GP + FP, mapping inter-systèmes, architecture cible
- Prochaine étape : MCD unifié détaillé

## Vulnérabilités critiques (ne pas oublier)
1. Master passwords hardcodés dans `connection.php` (bypass auth universel) — valeurs dans les `.env` à créer
2. SQL injection via `$_REQUEST` direct (GPLearn, PlanniFProWeb, myRoad...)
3. MD5 pour les mots de passe élèves
4. Certificats iOS/Android (.p12, .keystore) dans les dépôts
5. Drupal 6 (EOL 2016) pour l'intranet
6. CORS permissif (`Access-Control-Allow-Origin: *`) sur tous les backends
7. `exec_sql.php` — RCE via `$_REQUEST["sql"]` injecté dans `exec("sudo mysql … source …")`, sans auth
