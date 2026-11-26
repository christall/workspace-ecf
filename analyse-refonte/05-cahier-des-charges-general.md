# Cahier des charges général — Application unifiée CERCA/ECF

**Version** : 0.5 — intégration des réponses tableau de gouvernance G1-G10 (volumes confirmés, règles métier, intégrations)  
**Date** : 2026-05-29  
**Statut** : En cours d'élaboration

---

## 1. Contexte et objectif

### 1.1 Situation actuelle

Le réseau CERCA/ECF exploite deux parcs applicatifs parallèles et redondants :

**Organisation du réseau**

CERCA est une entreprise qui exploite plusieurs **centres de formation**, chacun regroupant plusieurs **bureaux/agences** physiques. D'autres entreprises du groupe suivent le même modèle. Aujourd'hui chaque centre de formation = 1 base MySQL séparée (`gp1702`, `gp3101`...) avec les mêmes tables partout.

**Parc "Grand Public" (auto-école)**
- GPLearn : ERP auto-école (PHP + dhtmlX) — 1 instance par centre de formation, toutes identiques
- myRoad : espace élève web/mobile
- appliPedago / ECFCoach : pédagogie numérique et coaching en agence

**Parc "Formation Professionnelle"**
- learnFP : **lien symbolique vers GPLearn** — même code, seul le thème CSS change
- PlanniFProWeb : planning opérationnel FP dédié (PHP + dhtmlX, base `plgfpro`) — outil métier distinct, plus complexe que le planning GP
- fplearn : CRM commercial FP — prospects, personnes morales, opportunités
- myRoadFP / ecfcoachFP : espaces apprenants FP

**Constat** : learnFP est un **lien symbolique** vers le dossier gplearn — rigoureusement le même code, seul le CSS change le thème visuel. La spécificité FP réside intégralement dans **PlanniFProWeb / plgfpro** (planning hiérarchique) et **fplearn** (CRM de prospection + table de correspondance inter-systèmes).

**Mapping conceptuel fondamental** — les trois systèmes représentent les mêmes concepts métier avec des noms différents :

| Concept métier | GPLearn | plgfpro / NEVEA | fplearn |
|---|---|---|---|
| **Personne** | `tiers` | fiche personne | `personne_physique_pph` |
| **Session de formation** | `stage` non ponctuel | `action` | `opportunite_opp` |
| **Inscription à une session** | `stg_elv` | apprenant | `lien_opportunite_personne_lop` |
| **Créneau simple (leçon)** | `stage` ponctuel + `plg_arg` | créneau `planning` | — |

Note : dans GPLearn, un `stage` **ponctuel** n'est qu'un artifice technique pour rattacher des élèves à une leçon unique — il ne représente pas une vraie session de formation.

Les tables `fplearn.lien_*_ext` sont la **couche de correspondance inter-systèmes** : elles mémorisent les identifiants croisés entre GPLearn, plgfpro et NEVEA pour chaque entité partagée. C'est le pivot de cohérence de l'écosystème actuel.

### 1.2 Objectif du projet

Créer **une seule application unifiée** qui couvre l'intégralité des besoins métiers :
- Activité auto-école (permis B, A, C, D, EB, formation AAC...)
- Activité formation professionnelle (CACES, habilitations, perfectionnement conduite...)
- Réseau de franchises (multi-tenant natif, consolidation, pilotage réseau)
- Espaces utilisateurs connectés (élèves, stagiaires, moniteurs, formateurs)

---

## 2. Périmètre fonctionnel

### 2.1 Modules communs (GP + FP fusionnés)

Ces modules sont **identiques dans GPLearn et learnFP** — ils seront unifiés avec un mécanisme de contexte (auto-école / formation pro) pour adapter l'affichage et les règles métier.

| Module | Description |
|---|---|
| **Personnes** | Gestion unifiée des apprenants (élèves auto-école + stagiaires FP) — état civil, contact, documents, historique |
| **Planning** | Planification des créneaux : leçons, stages, examens, sessions FP — vues ressource/produit/apprenant |
| **Stages & Sessions** | Stages auto-école (AAC, plateau, code) et sessions FP — inscriptions, places, documents |
| **Facturation** | Devis → Factures → Règlements — valable GP et FP, avec gestion des financeurs |
| **Encaissements** | Saisie des règlements, bordereaux de remise, lettrage |
| **Pédagogie** | Contenu numérique, suivi progression apprenant, évaluations |
| **Messagerie & CRM** | Prospects, événements, RDV, SMS, emails automatiques |
| **BackOffice** | Paramétrage agence, ressources (moniteurs/formateurs), droits utilisateurs, modèles |
| **Statistiques** | Tableaux de bord CA, activité, résultats — agence et réseau |
| **Rémunérations** | Calcul et suivi des rémunérations des ressources |

### 2.2 Modules spécifiques auto-école

| Module | Description |
|---|---|
| **Examens** | ETG (code de la route), pratique, ALA, EB — convocations, résultats, interface Préfecture (CEPC, EVINI) |
| **ANTS** | Interface Agence Nationale des Titres Sécurisés — pré-enregistrement permis, pièces jointes |
| **Espace élève** (myRoad) | Suivi dossier, réservation en ligne, paiement, résultats, pédagogie |
| **ECFCoach** | Application tablette pour coaching en salle d'attente / kiosque agence |
| **E-commerce** | Vente de formations en ligne, synchronisation Novius |

### 2.3 Modules spécifiques formation professionnelle

#### 2.3.1 Planning FP (remplace PlanniFProWeb / plgfpro)

Le planning FP est structurellement différent du planning GP. Il suit une hiérarchie à 5 niveaux :

| Niveau | Entité | Exemple |
|---|---|---|
| 1 | **Activité** | CACES, Habilitations électriques, Conduite pro |
| 2 | **Type d'action** | CACES R482 cat. A, Habilitation BS, Perfectionnement |
| 3 | **Action** | "CACES R482 du 15/06 au 20/06 — Site Lyon" (77K en base) |
| 4 | **Créneau planning** | "Lundi 15/06 — module Théorie — 08h00→12h00" (384K en base) |
| 5 | **Module** | Théorie, Pratique engin, Évaluation (324 modules) |

Chaque créneau porte des **besoins en compétences** (615K enregistrements) : quelle habilitation le formateur doit posséder pour animer ce module.

| Module FP | Description |
|---|---|
| **Catalogue d'actions** | Référentiel types d'actions par activité — équivalent FP du catalogue produits GP |
| **Actions de formation** | Sessions concrètes : titre, site, dates début/fin, nb places, famille, code produit Formagest |
| **Planning actions** | Découpage temporel d'une action en créneaux par module, avec horaires journaliers (`plg_jours`) |
| **Modules** | Briques pédagogiques réutilisables (théorie, pratique, évaluation) avec paramètres heures/coefficients |
| **Parc de ressources FP** | Formateurs + véhicules + machines + simulateurs — gérés comme des ressources typées |
| **Compétences & habilitations** | Référentiel des compétences par module, habilitations des formateurs avec dates de validité |
| **Suivi formateurs** | Référentiel de suivi, modèles de suivi par type de ressource, historique des suivis |
| **Heures travaillées** | Saisie et justification des heures par créneau, vue synthèse et détail par module |
| **Répartition stagiaires/formateurs** | Affectation des stagiaires par formateur sur un créneau (`repartition_stgr_ress_plg`) |
| **Affectation parc** | Réservation et validation des véhicules/machines sur les créneaux |
| **Intégration NEVEA** | Synchronisation avec la plateforme régionale NEVEA (numéros d'action, catalogue) |

#### 2.3.2 CRM Formation Pro (remplace fplearn)

| Module FP | Description |
|---|---|
| **Personnes physiques** | Base prospects/stagiaires FP (157K) — état civil, coordonnées, email, documents |
| **Personnes morales** | Entreprises clientes, donneurs d'ordre, organismes (51 en base) |
| **Opportunités** | Demandes de formation : désignation, catalogue lié, montant, statut, étapes (141K) |
| **Catalogue formations** | Référentiel des formations proposables (495 entrées, 4257 éléments pédago) |
| **Marchés** | Contrats-cadres et appels d'offres avec donneurs d'ordre |
| **Événements & RDV** | Suivi des échanges commerciaux (47 événements, 1780 RDV) |

#### 2.3.3 Gestion contractuelle FP (dans learnFP / GPLearn)

| Module FP | Description |
|---|---|
| **Conventions de formation** | Contrats avec financeurs : contrat de formation, convention simplifiée, convention d'état, contrat professionnel, lettre de commande |
| **Financeurs** | OPCO, France Travail, CPF, employeurs — montants par convention |
| **Stagiaires convention** | Rattachement apprenant à convention avec profil (type stagiaire, activité, objectif, spécialité) |

### 2.4 Modules réseau (niveau franchiseur CERCA)

| Module | Description |
|---|---|
| **Consolidation** | Tableaux de bord multi-agences (remplace compilcerca) — natif via requêtes cross-tenant |
| **Pilotage réseau** | KPIs réseau, comparaisons inter-agences, alertes |
| **Administration réseau** | Gestion des agences, paramètres réseau, diffusion de modèles |

---

## 3. Acteurs et profils utilisateurs

| Profil | Contexte | Accès |
|---|---|---|
| **Secrétaire** | Agence GP ou FP | Élèves/stagiaires, planning, facturation, encaissements |
| **Moniteur / Formateur** | Terrain | Son planning, ses élèves/stagiaires, pédagogie |
| **Responsable agence** | Direction agence | Tous modules, statistiques agence |
| **Comptable** | Finance | Facturation, encaissements, exports Sage |
| **Administrateur réseau** | CERCA siège | Vue consolidée, paramétrage, pilotage |
| **Élève** (espace apprenant) | Web/mobile | Son dossier, son planning, paiement, pédagogie |
| **Stagiaire FP** (espace apprenant) | Web/mobile | Son parcours FP, ses documents, suivi |
| **Coach / Kiosque** | Tablette en agence | Mode ECFCoach (contenu pédago, coaching) |

---

## 4. Contraintes et exigences

### 4.1 Multi-tenant

L'architecture adopte un modèle à **3 niveaux** :

```
Entreprise (CERCA, autre entreprise du groupe)
  └── Centre de formation  (= 1 base gp**** aujourd'hui)
        └── Bureau / Site  (= agence physique)
```

- **1 base PostgreSQL par entreprise** — CERCA a une seule base pour tous ses centres de formation (décision D23). Cela supprime les jointures cross-base et rend native la planification inter-sites.
- L'isolation des données entre centres de formation est assurée par **Row Level Security sur `franchise_id`** (= centre de formation) — un utilisateur attaché à un centre ne voit pas les données d'un autre, sauf si son profil est niveau entreprise.
- Les utilisateurs niveau entreprise (directeur régional, comptable CERCA) ont `franchise_id = NULL` et accèdent à tous les centres de leur entreprise.
- La migration se fait centre de formation par centre de formation, sans interruption de service.

### 4.2 Dualité GP / FP

- Une même agence peut être **mixte** (auto-école + organisme FP)
- Le contexte s'active par le **type de formation** choisi, pas par base de données
- Les modules communs (personnes, facturation, encaissements, BackOffice) fonctionnent dans les deux contextes
- **Le planning est bifurqué** : créneau simple GP (`plg_arg`) vs action hiérarchique FP (`action → planning → module`) — les deux coexistent dans l'application mais sont des vues différentes du même outil de planification
- Le CRM FP (opportunités, personnes morales) est propre à l'activité FP
- Les intégrations spécifiques s'activent par contexte : ANTS/CEPC pour GP, NEVEA/Formagest pour FP

### 4.3 Sécurité

- Authentification forte : JWT access + refresh tokens, argon2
- RBAC granulaire (42 droits standard dans `droits.xml`, jusqu'à 96 en base selon les centres — voir `09-specs-fonctionnelles.md` §1)
- Audit log complet : qui fait quoi, quand, sur quelle donnée
- Conformité RGPD : droit à l'oubli, anonymisation, export données
- Aucune donnée sensible en dur dans le code

### 4.4 Intégrations externes

| Système | Usage |
|---|---|
| **ANTS** | Pré-enregistrement permis de conduire — manuel à la saisie + cron nuit pour remontée des mises en production. Pièces jointes PDF. |
| **DSR** | Délégation de Sécurité Routière — API envoi formateurs (autorisations d'enseigner), élèves (n° NEPH) et leçons |
| **Sage Compta** | Export XML journal des ventes et encaissements — déposé dans un dossier d'échanges. Sources : `robot_export_sagecompta_*.php`, `encaissements_nevea_sage.php`, `production_nevea_sage`, `ecritures_nevea_sage.php`, `remises_en_banques_nevea_sage.php` |
| **CEPC** | Résultats examens saisis en interne par le formateur, enregistrés par la secrétaire à l'obtention. Récupération via ANTS à l'obtention (à confirmer). |
| **EVINI / ECFCoach** | Évaluation initiale — application interne ECFCoach (PWA avec IndexedDB + synchronisation). Sources : `ecfcoach_back/`, `ecfcoach_front/`. **Remplace Timéo** (devenu externe → interne). |
| **OVH SMS** | Envoi de SMS — contrat actif, ~3 000 SMS/mois |
| **OPCO / France Travail** | Dossiers de financement FP |
| **Lex Persona** | Signature électronique des contrats — API + sandbox disponibles (doc à fournir). Signature automatique pour inscription en ligne, manuelle par secrétaire sur devis. |
| **Novius** | Synchronisation e-commerce national — à maintenir pendant la transition vers ecfcerca_ecom |
| **NEVEA** | Plateforme régionale FP à remplacer par la nouvelle application. Maintenu actif pendant la transition. |
| **Formagest** | Chaîne : nouveau système → Formagest → Megabase ECF national → e-commerce. Conserver l'alimentation Formagest pendant la transition. |

### 4.5 Performance et disponibilité

- Interface réactive même sur connexion modeste (agences en zone rurale)
- Planning fluide avec chargement progressif (journée, semaine, mois)
- **Disponibilité 7/24** (G7.4) — parents/élèves consultent myRoad le soir, pas uniquement en heures ouvrées
- Exports PDF/DOCX/Excel sans bloquer l'interface
- Monitoring : Grafana + Prometheus (nouvelle mise en place, G7.5)
- Backup : PRA hors-site + Veeam Backup sur les VMs PostgreSQL (G7.6)

---

## 5. Architecture cible (grandes lignes)

### 5.1 Principe directeur : une base, un backend, un frontend

```
Navigateur / Mobile
       │
  Next.js 15 (frontend unique — GP + FP + Réseau + Espaces apprenants)
       │
  Fastify API (backend TypeScript — un seul endpoint par ressource)
       │
  PostgreSQL (base unique multi-tenant via Row Level Security)
```

### 5.2 Multi-tenant natif

Chaque table métier porte un `franchise_id` (centre de formation). Le Row Level Security PostgreSQL garantit l'isolation : une requête retourne uniquement les données du centre de formation de l'utilisateur connecté. Les utilisateurs niveau entreprise (`franchise_id = NULL`) voient tous les centres de leur entreprise. Les administrateurs réseau voient tous les centres de toutes les entreprises.

```
Rôle                    franchise_id   Scope visible
──────────────────────────────────────────────────────
Secrétaire / Moniteur   = X            Centre de formation X uniquement
Directeur centre        = X            Centre X + statistiques agglomérées
Directeur entreprise    = NULL         Tous les centres de CERCA
Administrateur réseau   = NULL*        Toutes les entreprises
```

### 5.3 Unification des entités — un seul concept, une seule table

Le bénéfice principal de la refonte est de **fusionner les représentations multiples** d'une même réalité métier :

```
AVANT (3 systèmes, 3 noms différents)          APRÈS (1 table unifiée)
────────────────────────────────────           ──────────────────────
tiers (GPLearn)                  ─┐
personne_physique_pph (fplearn)   ├──────────► persons
fiche personne (NEVEA)           ─┘

stage non ponctuel (GPLearn)     ─┐
action (plgfpro/NEVEA)            ├──────────► training_sessions
opportunite_opp (fplearn)        ─┘

stg_elv (GPLearn)                ─┐
apprenant (NEVEA)                 ├──────────► enrollments
lien_opportunite_personne_lop    ─┘

stage ponctuel (GPLearn)         ─┐
                                  ├──────────► (supprimé — c'est juste un créneau planning)
plg_arg (GPLearn)                ─┘
```

Les tables `lien_*_ext` de fplearn deviennent inutiles : dans le nouveau système, une seule clé primaire suffit à identifier n'importe quelle entité dans n'importe quel contexte.

### 5.4 Ressources et planning multi-sites

Un formateur/moniteur **appartient à un centre de formation** mais peut intervenir sur **plusieurs bureaux/sites** (via la table `ressources_sites`). C'est le comportement natif de l'existant (`age_ress` dans GPLearn).

Le planning est organisé en **groupes de planning configurables** — chaque groupe définit un ensemble de ressources (colonnes) et de sites couverts. Un utilisateur est abonné à un ou plusieurs groupes :

```
Groupe "Compans"      → moniteurs + simulateurs du bureau Compans
Groupe "Atlanta"      → moniteurs des bureaux Atlanta Nord + Sud
Groupe "Moniteur"     → vue fonctionnelle : tous les moniteurs sur 11 agences
Groupe "Sécrétaires"  → vue par rôle, 1 groupe par bureau
```

Un même moniteur peut apparaître dans plusieurs groupes. La configuration (quels moniteurs, dans quel ordre) est entièrement paramétrable par l'administration.

### 5.5 Deux modes de planification dans un seul module planning

Le module planning de la nouvelle application doit supporter **deux modes coexistants** selon le type de formation :

#### Mode 1 — Planification à l'unité (style GPLearn)
Pour les leçons de conduite, examens, cours de code, stages ponctuels :
```
planning_slot (créneau simple)
  ├── date, hdeb, hfin
  ├── produit (leçon B, examen ETG, code...)
  ├── ressources (moniteur, véhicule) — sans gestion de compétences obligatoire
  └── apprenants rattachés directement
```

#### Mode 2 — Planification par action/stage (style plgfpro)
Pour les formations professionnelles, CACES, habilitations, stages multi-sessions :
```
training_session (action de formation)
  ├── type d'action, activité, site, dates, nb places
  ├── ordre de mission (date_om), bon de commande (date_bc)
  └── planning_slots (créneaux découpés par module)
        ├── module (théorie, pratique, évaluation...)
        ├── ressources avec besoins de compétences
        │     → habilitation requise + date de validité
        └── répartition des apprenants par formateur
```

Les deux modes partagent les mêmes entités : `persons`, `resources`, `sites`, `planning_slots`. Le mode est déterminé par le type de session, pas par l'activité GP/FP — un stage AAC multi-sessions auto-école utilise aussi le mode 2.

L'interface adapte ses vues et ses formulaires selon le mode : vue créneau simple pour le mode 1, vue action hiérarchique avec gestion des besoins pour le mode 2.

### 5.6 Évaluations pédagogiques — le cœur du livret de formation

La nouvelle application intègre nativement le **livret de formation numérique** ECF-CERCA : lors de chaque leçon, le moniteur évalue l'apprenant sur des critères pédagogiques structurés en arbre (260 critères GP, 1 669 critères FP). Cette fonctionnalité est aujourd'hui dans `tpedago_plg_elv` (3,3 M lignes sur un seul centre de formation en dev).

La table `evaluations_pedagogiques` est partitionnée comme `creneaux_planning` et représente ~50 % du volume total de la base.

### 5.7 Données en volume (ordre de grandeur à migrer)

> Note : les volumes GP sont mesurés sur le serveur dev/recette (18 bases). La production compte **32 centres** (20 CERCA + 12 adhérents, G1.1) — **multiplier par ~32** pour les volumes réels en production totale. Le facteur ×20 reste valable pour CERCA seul.

#### Bases GP (dev/recette mesuré → production estimée ×20)

| Entité | Dev/recette (18 bases) | Production estimée |
|---|---|---|
| `tiers` → **persons** | 464 000 | ~9,3 M |
| `plg_arg` → **planning_slots** | 5,96 M | ~119 M |
| `stage` → **training_sessions** | 8,2 M | ~164 M (dont ~99% ponctuels) |
| `stg_elv` → **enrollments** | 5,4 M | ~108 M |
| `factures` → **invoices** | 1,5 M | ~30 M |
| `reglts` → **payments** | 1,27 M | ~25 M |

#### Bases FP (production = dev, pas de facteur)

| Base | Entité | Volume |
|---|---|---|
| plgfpro | `actions` → training_sessions FP | 77 000 |
| plgfpro | `planning` → planning_slots FP | 384 000 |
| plgfpro | `plg_ress` | 659 000 |
| plgfpro | `besoin_competence` | 615 000 |
| plgfpro | `heures_trav` | 917 000 |
| fplearn | `personne_physique_pph` → persons | 157 000 |
| fplearn | `opportunite_opp` → training_sessions | 141 000 |

#### Total production (PostgreSQL à dimensionner)

| Table cible | Volume estimé production |
|---|---|
| `personnes` | ~9,5 M (GP + FP + fplearn) |
| `creneaux_planning` | ~120 M |
| `sessions_formation` | ~165 M |
| `evaluations_pedagogiques` | **~66 M** (3,3 M × 20 centres GP + FP) |
| `inscriptions` | ~108 M |
| `factures` | ~30 M |
| `reglements` | ~25 M |
| `points_geoloc` | ~250 M (TTL 5 ans) |

**Implication architecture :** partitionnement PostgreSQL par `franchise_id` et par plage de dates sur `creneaux_planning` et `evaluations_pedagogiques` indispensable. Ces deux tables représentent ~75 % du volume total.

---

## 6. État d'avancement de l'analyse

| Livrable | État | Fichier |
|---|---|---|
| Cartographie applicative | ✅ Terminé | `01-cartographie-applicative.md` |
| Besoins métiers détaillés | ✅ Terminé | `02-besoins-metiers-detail.md` |
| Analyse sécurité / dette technique | ✅ Terminé | `03-analyse-securite-dette-technique.md` |
| Architecture cible | ✅ Terminé | `04-architecture-refonte.md` |
| Cahier des charges général | 🔄 En cours (v0.4) | `05-cahier-des-charges-general.md` |
| Pipeline synchronisation | ✅ Terminé | `06-pipeline-synchronisation-inter-systemes.md` |
| **MCD unifié GP + FP** | 🔄 **v0.7** — gouvernance intégrée : liens_personnes_personnes, jours_feries, creneaux_horaires_jour, D14-D22 | `07-mcd-unifie.md` |
| Moteur génération documents | ✅ Terminé | `08-moteur-generation-documents.md` |
| **Specs fonctionnelles (code)** | 🔄 v0.1 — droits, tarification, fact. auto, automates | `09-specs-fonctionnelles.md` |
| **Stratégie de migration** | 🔄 v0.1 — phases, CDC, règles parallélisation | `10-strategie-migration.md` |
| **Tableau de gouvernance** | ✅ v0.1 — 45/45 questions répondues, intégrées dans les docs | `11-tableau-gouvernance.md` |

### Ce qui reste à couvrir

- [ ] Wireframes / maquettes des écrans principaux
- [ ] Specs fonctionnelles : compléter modules Examens, ANTS, Conventions, Export Sage, Rémunérations (voir `09-specs-fonctionnelles.md` §9)
- [ ] Intégrations ANTS et DSR : protocoles, formats, fréquences (dépend réponses tableau gouvernance G6)
- [ ] API REST : routes, formats, pagination, versioning (phase suivante)
- [ ] Plan de tests (unitaires, intégration, E2E, migration)
- [ ] Plan de formation des utilisateurs

---

## 7. Prochaines étapes

1. ~~Construire le MCD unifié GP + FP~~ — **Terminé** (`07-mcd-unifie.md` v0.5, 76 tables)
2. **Valider le périmètre fonctionnel** avec les parties prenantes métier (ce document)
3. **Rédiger les spécifications fonctionnelles détaillées** par module — règles métier, cas limites, UX
4. **Préparer la stratégie de migration** — ordre des centres, coexistence, rollback
5. **Démarrer le développement** — infrastructure PostgreSQL, authentification, planning (module le plus complexe en premier)
