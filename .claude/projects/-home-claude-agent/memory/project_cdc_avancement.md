---
name: CDC CERCA/ECF — avancement et décisions
description: Suivi des décisions prises et de l'avancement du cahier des charges de la refonte
type: project
originSessionId: c839d15c-2c69-439c-87f6-00e81c69f3d4
---
**Why:** Garder trace des décisions architecturales et de l'état d'avancement pour reprendre sans perdre le contexte.
**How to apply:** Consulter avant de commencer une session de travail sur le CDC ou le MCD.

## État au 2026-04-21

### Fichiers produits (dans `/home/claude-agent/analyse-refonte/`)
- `01-cartographie-applicative.md` : inventaire de toutes les apps
- `02-besoins-metiers-detail.md` : 13 domaines métiers GP détaillés
- `03-analyse-securite-dette-technique.md` : vulnérabilités + dette technique
- `04-architecture-refonte.md` : stack cible + MCD simplifié + phases
- `05-cahier-des-charges-general.md` : **CDC v0.2** — périmètre GP+FP, mapping inter-systèmes
- `06-pipeline-synchronisation-inter-systemes.md` : pipeline NEVEA→plgfpro→fplearn→gplearn documenté
- `07-mcd-unifie.md` : **MCD v0.1** — 30 tables, 12 groupes, décisions de conception

### Prochaine étape décidée
Spécifications fonctionnelles détaillées par module, ou affinage MCD sur domaines non couverts (exams, produits GP, e-commerce, compilcerca, rémunérations).

## Décisions architecturales prises

### Planning — décision IMPORTANTE (2026-04-21)
L'application doit supporter **deux modes de planification** :
1. **Planification à l'unité** (style GPLearn) : créneau simple, une ressource, un produit, des élèves — pour les leçons de conduite, examens, stages ponctuels
2. **Planification par action/stage** (style plgfpro) : session multi-jours, découpée en modules, avec gestion des besoins en ressources compétentes — pour les formations professionnelles, stages AAC multi-sessions, CACES...

Ces deux modes coexistent dans le même module planning — ce ne sont pas deux applications séparées. Le discriminant est le type de session (ponctuelle/unitaire vs action structurée).

### Multi-tenant
PostgreSQL Row Level Security — une base, isolation par tenant_id.

### Stack
Node.js 22 + Fastify 5 + TypeScript + Drizzle ORM + PostgreSQL 16 + Next.js 15 + shadcn/ui

### Entités unifiées (mapping décidé)
- `persons` ← tiers + personne_physique_pph + fiche personne NEVEA
- `training_sessions` ← stage non ponctuel + action + opportunite_opp
- `enrollments` ← stg_elv + apprenant NEVEA + lien_opportunite_personne_lop
- `planning_slots` ← plg_arg + planning FP (discriminant type)
- Stage ponctuel supprimé comme entité (c'est juste un créneau planning avec apprenants)

## Questions ouvertes / à décider
- Faut-il un MCD unique pour les deux types de planning ou deux sous-modèles ?
- Migration : ordre des agences ? Par taille ? Par activité (GP d'abord, FP ensuite) ?
- NEVEA et Formagest : interface read-only ou synchronisation bidirectionnelle dans le nouveau système ?
