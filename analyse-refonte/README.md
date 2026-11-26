# Analyse Refonte CERCA/ECF

Dossier d'analyse pour la refonte de l'ERP/CRM unifié remplaçant GPLearn, PlanniFProWeb, fplearn.

## Documents

| # | Fichier | Contenu | État |
|---|---|---|---|
| 01 | `01-cartographie-applicative.md` | Inventaire des 10+ applications existantes, stacks, points faibles | ✅ v1 |
| 02 | `02-besoins-metiers-detail.md` | 13 domaines métier détaillés (élèves, planning, stages, examens, facturation, FP…) | ✅ v1 |
| 03 | `03-analyse-securite-dette-technique.md` | Vulnérabilités, dette technique, risques | ✅ v1 |
| 04 | `04-architecture-refonte.md` | Stack cible (Node.js/Fastify/PostgreSQL/Next.js), multi-tenant RLS, phases | ✅ v1 |
| 05 | `05-cahier-des-charges-general.md` | CDC général v0.5 — volumes confirmés (32 centres, 7 entreprises), intégrations affinées | 🔄 v0.5 |
| 06 | `06-pipeline-synchronisation-inter-systemes.md` | Synchro NEVEA, Formagest, GPLearn ↔ PlgFPro | ✅ v1 |
| 07 | `07-mcd-unifie.md` | MCD unifié v0.7 — +liens_personnes_personnes, +jours_feries, +creneaux_horaires_jour, décisions D14-D22 | 🔄 v0.7 |
| 08 | `08-moteur-generation-documents.md` | Moteur génération DOCX/PDF, MinIO, Lex Persona | ✅ v1 |
| 09 | `09-specs-fonctionnelles.md` | Règles métier extraites du code PHP/SQL GPLearn | 🔄 v0.1 |
| 10 | `10-strategie-migration.md` | Phases migration, CDC, règles parallélisation par système source | 🔄 v0.1 |
| 11 | `11-tableau-gouvernance.md` | 45 questions — toutes répondues, intégrées dans les docs | ✅ v0.1 |
| 12 | `12-outil-planification-transitoire.md` | Outil bridge GP/FP pour ressources mixtes — conception + plan dev 2 semaines | ✅ v0.1 |
| 13 | `13-cartographie-fp.md` | Cartographie plgfpro + fplearn — structures, volumes, ponts GP↔FP | ✅ v1.0 |
| 14 | `14-lien-planning-fp-conventions.md` | Lien plgfpro↔gpfp (idplgpart encoding), conventions FP — schéma ERP + requêtes d'import | ✅ v1.0 |

## Décision architecturale — 2026-06-01

> **Un seul contexte ERP** — pas de mode "auto-école" / "formation pro".
> L'**activité** est le seul discriminant (Permis B = GP, CACES R482 = FP, mais même interface, mêmes tables).
> Validé par l'analyse de `plgfpro` et `fplearn` (doc 13).

## Prochaines étapes

1. ~~**Compléter `11-tableau-gouvernance.md`**~~ — ✅ 45/45 questions répondues
2. **Décision MinIO vs OVH Object Storage** (G7.1) — choix stockage fichiers, répondre dans `11-tableau-gouvernance.md`
3. **Analyse ECFCoach** (G6.4) — PWA IndexedDB, synchro complexe, comprendre avant de spécifier EVINI
4. ~~**Analyse Campus**~~ — ✅ portail webinaires Teams autonome, hors périmètre refonte
5. **Specs fonctionnelles** — Examens, ANTS, CEPC/EVINI, DSR, Export Sage (`09-specs-fonctionnelles.md`)
6. **Développer l'outil transitoire** (`12-outil-planification-transitoire.md`) — 2 semaines, répond T1-T5
7. **Démarrer le développement ERP** — infrastructure PostgreSQL, authentification, module planning
