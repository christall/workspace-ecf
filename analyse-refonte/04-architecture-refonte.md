# Architecture proposée — Refonte complète

## Principes directeurs

1. **Une seule application centrale** (remplace les 17+ bases `gp*` + GPLearn multi-instances)
2. **Multi-tenant natif** via PostgreSQL Row Level Security — fini les bases par agence
3. **API-first** : un backend unique consommé par tous les fronts
4. **Progressive** : modules livrés un par un, coexistence avec l'ancien
5. **Sécurisé by design** : auth JWT, RBAC, audit log, RGPD
6. **Testable** : couverture > 80%, CI/CD dès le départ

---

## Stack technologique

### Backend — API centrale

```
Node.js 22 LTS + TypeScript
├── Framework   : Fastify 5 (performances, TypeScript natif, plugins)
├── ORM         : Drizzle ORM (TypeScript, type-safe, migrations)
├── Base        : PostgreSQL 16 (multi-tenant via RLS)
├── Auth        : JWT (access + refresh tokens) + bcrypt/argon2
├── Validation  : Zod (schémas partagés front/back)
├── PDF         : PDFKit ou Puppeteer (remplace FPDF/mPDF)
├── DOCX        : docx.js (remplace PHPWord)
├── Email       : Nodemailer + templates MJML
├── SMS         : Twilio ou OVH SMS SDK
├── Queue       : BullMQ + Redis (exports, emails, synchros)
├── Cache       : Redis
└── Tests       : Vitest + Supertest
```

**Pourquoi pas PHP/Laravel ?** — L'équipe a déjà Next.js en production (campus). TypeScript unifié front/back élimine la duplication de validation. Fastify > Express (2x plus rapide).

### Frontend — Application unique

```
Next.js 15 + TypeScript
├── UI          : shadcn/ui + Radix UI (accessible, personnalisable)
├── Planning    : react-big-calendar ou FullCalendar v6 (remplace dhtmlxScheduler)
├── Grilles     : TanStack Table v8 (remplace dhtmlxGrid)
├── Formulaires : React Hook Form + Zod
├── État        : Zustand (léger) ou TanStack Query (data fetching)
├── PDF viewer  : react-pdf
└── Tests       : Vitest + Testing Library + Playwright (E2E)
```

### Infrastructure

```
Docker + Docker Compose (dev)
├── nginx         : reverse proxy + SSL
├── postgresql    : base principale
├── redis         : cache + queues
├── api           : backend Fastify
└── frontend      : Next.js

Production : VPS Linux existant (migration progressive)
CI/CD      : Gitea + Gitea Actions (ou GitHub Actions)
Monitoring : Grafana + Loki (logs) + Prometheus (métriques)
Backup     : pg_dump automatique + réplication
```

---

## Architecture multi-tenant

### Problème actuel
17+ bases MySQL identiques = maintenance x17, impossible de faire des requêtes cross-agences, synchronisation manuelle via `compilcerca`.

### Solution : PostgreSQL + RLS

```sql
-- Table centrale avec colonne tenant_id
CREATE TABLE tenants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code      TEXT UNIQUE NOT NULL,  -- ex: 'gp1301'
  nom       TEXT NOT NULL,
  config    JSONB
);

-- Row Level Security sur toutes les tables
CREATE TABLE eleves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  -- ... champs
);

ALTER TABLE eleves ENABLE ROW LEVEL SECURITY;
CREATE POLICY eleves_tenant ON eleves
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Réseau CERCA peut voir tout :
CREATE POLICY eleves_reseau ON eleves
  USING (current_setting('app.role') = 'reseau');
```

Avantages :
- Une seule base à maintenir
- Consolidation réseau native (requêtes cross-tenant pour les admins réseau)
- Isolation garantie par la DB (pas de risque de fuite cross-tenant dans le code)
- Migration agence par agence possible

---

## Modèle de données cible (simplifié)

### Entités principales

```
tenants              — Agences / entités du réseau
users                — Utilisateurs (remplace g_user, gus_user)
roles_permissions    — RBAC granulaire (remplace droits.xml)

eleves               — Dossiers élèves (remplace tiers + dossier)
eleve_permis         — Permis demandés
eleve_financements   — Financements envisagés
eleve_documents      — Documents contractuels

planning_slots       — Créneaux (remplace plg_arg)
planning_resources   — Ressources affectées (remplace plg_ress)
planning_students    — Élèves affectés (remplace stg_elv via stage)
planning_sequences   — Séquences liées (remplace plg_liens)
planning_locks       — Verrouillages (remplace verr_plg_ress)

stages               — Stages (remplace stage)
stages_students      — Inscriptions (remplace stg_elv)

examens              — Examens (remplace examen + examens)
examen_slots         — Prévisionnels (remplace previ_exam)
examen_results       — Résultats (remplace res_ex + cepc + evini)

products             — Catalogue produits (remplace produits)
product_types        — Types (remplace type_stage, filieres, permis)
tarifs               — Grille tarifaire

invoices             — Factures (remplace factures)
invoice_lines        — Lignes (remplace lfacture)
invoice_assignments  — Affectation planning (remplace aff_plg_lfac)
payments             — Règlements (remplace reglts)
payment_batches      — Bordereaux (remplace bordereaux)

pedagogy_modules     — Modules pédago (remplace tpedago)
pedagogy_progress    — Progression élève (remplace tpedago_plg_elv)

resources            — Moniteurs/formateurs (remplace age_ress)
resource_schedules   — Disponibilités (remplace disp_horaires)

audit_log            — Historique toutes actions (RGPD + sécurité)
```

---

## Modules à livrer (ordre de priorité)

### Phase 1 — Fondations (2 mois)
- [ ] Authentification JWT + RBAC
- [ ] Multi-tenant RLS
- [ ] API CRUD élèves (état civil, permis, contact)
- [ ] Import données depuis MySQL (migration)
- [ ] Interface liste + fiche élève (remplace module Élèves)

### Phase 2 — Planning (2 mois)
- [ ] API planning (CRUD créneaux, ressources, stages)
- [ ] Interface planning (FullCalendar — vue ressource, produit, élève)
- [ ] Modèles de planning, répétition
- [ ] Verrouillages

### Phase 3 — Facturation (2 mois)
- [ ] Devis → Factures → Règlements
- [ ] Affectation planning ↔ lignes
- [ ] Bordereaux, clôtures
- [ ] Export Sage Compta

### Phase 4 — Examens (1 mois)
- [ ] Gestion examens ETG + pratique
- [ ] Convocations, résultats
- [ ] Interface Préfecture (CEPC, EVINI)

### Phase 5 — Conventions & Financement (1 mois)
- [ ] Conventions de formation
- [ ] Financeurs (OPCO, CPF, France Travail)

### Phase 6 — BackOffice & Pédagogie (2 mois)
- [ ] Paramétrage agence, produits, tarifs
- [ ] Contenu pédagogique, suivi progression
- [ ] Application élève (remplace myRoad)

### Phase 7 — FP & Consolidation (2 mois)
- [ ] Module Formation Pro
- [ ] Tableaux de bord réseau (remplace compilcerca)
- [ ] Rémunérations moniteurs

---

## Comparaison ancien / nouveau

| Aspect | Actuel | Cible |
|---|---|---|
| **Bases** | 17+ bases MySQL identiques | 1 base PostgreSQL multi-tenant |
| **Auth** | MD5 + sessions MySQL | JWT + bcrypt/argon2 |
| **Frontend** | dhtmlX (2012) | React + shadcn/ui |
| **Planning** | dhtmlxScheduler | FullCalendar v6 |
| **Mobile** | PHP + JS vanilla | PWA Next.js responsive |
| **API** | Fichiers PHP directs | REST/JSON typé avec Zod |
| **Tests** | Aucun | Vitest + Playwright |
| **Sécurité** | Passwords hardcodés, MD5 | JWT, argon2, RBAC, audit log |
| **RGPD** | Non outillé | Anonymisation, droit à l'oubli |
| **Déploiement** | FTP manuel | Docker + CI/CD |
| **Monitoring** | Aucun | Grafana + alertes |
| **Consolidation** | compilcerca (agrégation manuelle) | Requêtes cross-tenant natives |

---

## Stratégie de migration

### Principe : coexistence progressive
1. Le nouveau système est déployé en parallèle
2. Les nouvelles agences démarrent directement sur le nouveau
3. Les anciennes migrent agence par agence (import de données)
4. L'ancien reste en lecture seule pendant la transition
5. Coupure définitive quand 100% migré

### Script de migration
```typescript
// Pour chaque base gp* :
// 1. Lire MySQL (tables tiers, plg_arg, factures, etc.)
// 2. Transformer au nouveau schéma
// 3. Insérer dans PostgreSQL avec tenant_id = code_agence
// 4. Vérifier les totaux (count, sommes)
// 5. Valider avec l'agence
```

---

## Estimation effort

| Phase | Complexité | Durée estimée |
|---|---|---|
| Fondations + auth + élèves | Moyenne | 2 mois |
| Planning | Haute | 2 mois |
| Facturation + comptabilité | Haute | 2 mois |
| Examens + ANTS | Moyenne | 1 mois |
| Conventions + FP | Moyenne | 1 mois |
| Pédagogie + myRoad | Moyenne | 2 mois |
| BackOffice + paramétrage | Faible | 1 mois |
| Consolidation réseau | Faible | 1 mois |
| Migration données | Moyenne | En parallèle |
| **Total** | | **~12 mois** |

Avec travail intensif en sessions Claude Code : réalisable par phases livrables en continu.
